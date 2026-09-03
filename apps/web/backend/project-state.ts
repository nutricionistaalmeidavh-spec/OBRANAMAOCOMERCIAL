import { db } from '../cloudflare/sdk';
import { PROJECT_STATE_VERSION } from '../shared/version';

export type ProjectRecord={companyId:string;name:string;customer?:string;createdAt:string;createdBy:string};
export type ProjectMetaRecord={id?:string;state:Record<string,unknown>;dayKeys:string[];revision:number;updatedAt:string;updatedBy:string};
type DayRecord={id?:string;day:Record<string,unknown>;updatedAt:string;updatedBy:string};
type FloorRecord={id?:string;number:number;floor:Record<string,unknown>;updatedAt:string;updatedBy:string};

const now=()=>new Date().toISOString();
const safe=(value:string)=>value.replace(/[^a-zA-Z0-9_-]/g,'_');
const record=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const list=(value:unknown):unknown[]=>Array.isArray(value)?value:[];

const metaTable=(projectId:string)=>'project_meta_'+safe(projectId);
const floorsTable=(projectId:string)=>'project_floors_'+safe(projectId);
const dayTable=(projectId:string,date:string)=>'project_day_'+safe(projectId)+'_'+safe(date);

export async function getProject(projectId:string){const[p]=await db.get<ProjectRecord>('projects',[projectId]);return p}
export async function getCompany(companyId:string){const[c]=await db.get<Record<string,unknown>>('companies',[companyId]);return c}
export async function getMeta(projectId:string){const{items}=await db.list<ProjectMetaRecord>(metaTable(projectId),{limit:1});return items[0]||null}
export async function getFloors(projectId:string){const{items}=await db.list<FloorRecord>(floorsTable(projectId),{limit:50});return items.sort((a,b)=>a.number-b.number)}
export async function getDay(projectId:string,date:string){const{items}=await db.list<DayRecord>(dayTable(projectId,date),{limit:1});return items[0]?.day||null}

export async function persistMeta(projectId:string,meta:ProjectMetaRecord){
  if(!meta.id)throw new Error('Metadados da obra sem identificador.');
  await db.update(metaTable(projectId),[{id:String(meta.id),record:meta as unknown as Record<string,unknown>}]);
}

export async function saveDay(projectId:string,date:string,day:Record<string,unknown>,actor:string){
  const table=dayTable(projectId,date),{items}=await db.list<DayRecord>(table,{limit:1}),next={day,updatedAt:now(),updatedBy:actor};
  if(items[0])await db.update(table,[{id:items[0].id,record:next as Record<string,unknown>}]);
  else await db.add(table,[next as Record<string,unknown>]);
}

export async function saveSnapshot(projectId:string,snapshot:Record<string,unknown>,actor:string){
  const current=await getMeta(projectId),revision=(current?.revision||0)+1,days=record(snapshot.days),floors=list(snapshot.floors),dayKeys=Array.from(new Set([...(current?.dayKeys||[]),...Object.keys(days)])).sort();
  const stateMeta:Record<string,unknown>={};
  for(const[k,v]of Object.entries(snapshot))if(k!=='floors'&&k!=='days'&&k!=='desktopBridge')stateMeta[k]=v;
  stateMeta.desktopBridge=current?.state?.desktopBridge||{};
  stateMeta.version=Math.max(Number(stateMeta.version||0),PROJECT_STATE_VERSION);
  const next:ProjectMetaRecord={state:stateMeta,dayKeys,revision,updatedAt:now(),updatedBy:actor};
  if(current)await db.update(metaTable(projectId),[{id:String(current.id),record:next as unknown as Record<string,unknown>}]);
  else await db.add(metaTable(projectId),[next as unknown as Record<string,unknown>]);

  const table=floorsTable(projectId),existing=(await db.list<FloorRecord>(table,{limit:50})).items,byNumber=new Map(existing.map(item=>[item.number,item]));
  for(const value of floors){
    const floor=record(value),number=Number(floor.number);if(!Number.isFinite(number))continue;
    const item:FloorRecord={number,floor,updatedAt:now(),updatedBy:actor},old=byNumber.get(number);
    if(old)await db.update(table,[{id:String(old.id),record:item as unknown as Record<string,unknown>}]);
    else await db.add(table,[item as unknown as Record<string,unknown>]);
  }
  for(const[date,value]of Object.entries(days))await saveDay(projectId,date,record(value),actor);
  return revision;
}

export async function assembleState(projectId:string){
  const meta=await getMeta(projectId);if(!meta)return null;
  const floors=(await getFloors(projectId)).map(item=>item.floor),keys=meta.dayKeys||[],dates=keys.length<=31?keys:keys.slice(-31),days:Record<string,unknown>={};
  for(const date of dates){const day=await getDay(projectId,date);if(day)days[date]=day}
  return{...meta.state,floors,days,_remote:{revision:meta.revision,dayKeys:keys,updatedAt:meta.updatedAt,schemaVersion:PROJECT_STATE_VERSION}};
}

export async function carryForwardActiveAssignments(projectId:string,date:string,actor:string){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return;
  const meta=await getMeta(projectId);if(!meta)return;
  const current=record((await getDay(projectId,date))||{date,presentCount:null,absentCount:null,attendance:{},assignments:[],events:[],note:'',plans:[],sessions:[]});
  const existing=list(current.assignments).map(record),existingKeys=new Set(existing.map(item=>String(item.service||'')+':'+Number(item.floor)));
  const previousDates=(meta.dayKeys||[]).filter(key=>key<date).sort().reverse();
  let active:Record<string,unknown>[]=[];
  for(const previousDate of previousDates){
    const previous=record((await getDay(projectId,previousDate))||{}),candidates=list(previous.assignments).map(record).filter(item=>['in_progress','released'].includes(String(item.status||'')));
    if(candidates.length){active=candidates;break}
  }
  const carried=active.filter(item=>!existingKeys.has(String(item.service||'')+':'+Number(item.floor))).map(item=>({...item,status:String(item.status)==='released'?'released':'in_progress',note:String(item.note||'')?String(item.note)+' · Continuidade automática':'Continuidade automática'}));
  if(!carried.length)return;
  const repaired={...current,date,assignments:[...existing,...carried],attendance:record(current.attendance),events:list(current.events),plans:list(current.plans),sessions:list(current.sessions),note:String(current.note||'')};
  await saveDay(projectId,date,repaired,actor);
  const dayKeys=Array.from(new Set([...(meta.dayKeys||[]),date])).sort();
  await db.update(metaTable(projectId),[{id:String(meta.id),record:{...meta,dayKeys,revision:meta.revision+1,updatedAt:now(),updatedBy:actor} as unknown as Record<string,unknown>}]);
}
