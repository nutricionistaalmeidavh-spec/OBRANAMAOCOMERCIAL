import { db, runtimeEnv } from '../cloudflare/sdk';
import { PROJECT_STATE_VERSION } from '../shared/version';

export type ProjectRecord={companyId:string;name:string;customer?:string;createdAt:string;createdBy:string};
export type ProjectMetaRecord={id?:string;state:Record<string,unknown>;dayKeys:string[];revision:number;updatedAt:string;updatedBy:string};
type DayRecord={id?:string;day:Record<string,unknown>;updatedAt:string;updatedBy:string};
type FloorRecord={id?:string;number:number;floor:Record<string,unknown>;updatedAt:string;updatedBy:string};
export class SnapshotRevisionConflict extends Error { constructor(){super('O estado da obra foi alterado em outra sessão. Recarregue antes de salvar novamente.');this.name='SnapshotRevisionConflict'} }

const now=()=>new Date().toISOString();
const safe=(value:string)=>value.replace(/[^a-zA-Z0-9_-]/g,'_');
const record=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const list=(value:unknown):unknown[]=>Array.isArray(value)?value:[];

const metaTable=(projectId:string)=>'project_meta_'+safe(projectId);
const floorsTable=(projectId:string)=>'project_floors_'+safe(projectId);
const dayTable=(projectId:string,date:string)=>'project_day_'+safe(projectId)+'_'+safe(date);

/** Compare-and-set of the Obra360 metadata document on its revision. */
export async function compareAndSetMeta(projectId:string,current:{id?:string;revision?:number},next:Record<string,unknown>){
  if(!current.id)throw new SnapshotRevisionConflict();
  const clean={...next} as Record<string,unknown>;delete clean.id;
  const result=await runtimeEnv().DB.prepare("UPDATE kv_records SET record_json=?,updated_at=? WHERE collection=? AND id=? AND CAST(json_extract(record_json,'$.revision') AS INTEGER)=?")
    .bind(JSON.stringify(clean),String(clean.updatedAt||now()),metaTable(projectId),String(current.id),Number(current.revision||0)).run();
  if(Number(result.meta?.changes||0)!==1)throw new SnapshotRevisionConflict();
}
/** Re-runs a read-modify-write of the metadata when another writer won the race. */
export async function retryOnMetaConflict<T>(operation:()=>Promise<T>,attempts=10):Promise<T>{
  for(let attempt=1;;attempt++){
    try{return await operation()}
    catch(e){
      if(!(e instanceof SnapshotRevisionConflict)||attempt>=attempts)throw e
      // Jittered backoff so competing writers do not retry in lockstep.
      await new Promise(resolve=>setTimeout(resolve,Math.min(200,10*attempt)+Math.random()*25))
    }
  }
}

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

async function saveSnapshotParts(projectId:string,snapshot:Record<string,unknown>,actor:string){
  const floors=list(snapshot.floors),days=record(snapshot.days),table=floorsTable(projectId),existing=(await db.list<FloorRecord>(table,{limit:50})).items,byNumber=new Map(existing.map(item=>[item.number,item]));
  for(const value of floors){
    const floor=record(value),number=Number(floor.number);if(!Number.isFinite(number))continue;
    const item:FloorRecord={number,floor,updatedAt:now(),updatedBy:actor},old=byNumber.get(number);
    if(old)await db.update(table,[{id:String(old.id),record:item as unknown as Record<string,unknown>}]);
    else await db.add(table,[item as unknown as Record<string,unknown>]);
  }
  for(const[date,value]of Object.entries(days))await saveDay(projectId,date,record(value),actor);
}

/**
 * One D1 batch: the metadata compare-and-set plus every floor and day. Floors and
 * days are written only if the metadata now carries this write's id, so a lost
 * race writes nothing at all (no half-saved snapshot, no overwrite of the winner).
 */
async function saveSnapshotAtomically(projectId:string,snapshot:Record<string,unknown>,actor:string,current:ProjectMetaRecord|null,next:ProjectMetaRecord,expected:number){
  const DB=runtimeEnv().DB as any,stamp=next.updatedAt,writeId=crypto.randomUUID(),meta=metaTable(projectId);
  const clean={...next,writeId} as Record<string,unknown>;delete clean.id;
  const metaId=current?.id?String(current.id):'meta';
  const statements:any[]=[current
    ?DB.prepare("UPDATE kv_records SET record_json=?,updated_at=? WHERE collection=? AND id=? AND CAST(json_extract(record_json,'$.revision') AS INTEGER)=?").bind(JSON.stringify(clean),stamp,meta,metaId,expected)
    :DB.prepare('INSERT INTO kv_records(collection,id,record_json,created_at,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(collection,id) DO NOTHING').bind(meta,metaId,JSON.stringify(clean),stamp,stamp)];
  const guarded=(collection:string,id:string,value:unknown)=>DB.prepare(`INSERT INTO kv_records(collection,id,record_json,created_at,updated_at)
    SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM kv_records WHERE collection=? AND id=? AND json_extract(record_json,'$.writeId')=?)
    ON CONFLICT(collection,id) DO UPDATE SET record_json=excluded.record_json,updated_at=excluded.updated_at`)
    .bind(collection,id,JSON.stringify(value),stamp,stamp,meta,metaId,writeId);
  const floorsCollection=floorsTable(projectId),existing=(await db.list<FloorRecord>(floorsCollection,{limit:50})).items,byNumber=new Map(existing.map(item=>[item.number,item]));
  for(const value of list(snapshot.floors)){
    const floor=record(value),number=Number(floor.number);if(!Number.isFinite(number))continue;
    statements.push(guarded(floorsCollection,String(byNumber.get(number)?.id||crypto.randomUUID()),{number,floor,updatedAt:stamp,updatedBy:actor}));
  }
  for(const[date,value]of Object.entries(record(snapshot.days))){
    const table=dayTable(projectId,date),{items}=await db.list<DayRecord>(table,{limit:1});
    statements.push(guarded(table,String(items[0]?.id||crypto.randomUUID()),{day:record(value),updatedAt:stamp,updatedBy:actor}));
  }
  const results=await DB.batch(statements);
  if(Number(results?.[0]?.meta?.changes||0)!==1)throw new SnapshotRevisionConflict();
}

export async function saveSnapshot(projectId:string,snapshot:Record<string,unknown>,actor:string,{allowUnversioned=false}:{allowUnversioned?:boolean}={}){
  const current=await getMeta(projectId),expectedRaw=record(snapshot._remote).revision,hasExpected=expectedRaw!==undefined&&expectedRaw!==null,expectedRevision=Number(expectedRaw),revision=(current?.revision||0)+1,days=record(snapshot.days),dayKeys=Array.from(new Set([...(current?.dayKeys||[]),...Object.keys(days)])).sort();
  const stateMeta:Record<string,unknown>={};
  for(const[k,v]of Object.entries(snapshot))if(k!=='floors'&&k!=='days'&&k!=='desktopBridge'&&k!=='_remote')stateMeta[k]=v;
  stateMeta.desktopBridge=current?.state?.desktopBridge||{};
  stateMeta.version=Math.max(Number(stateMeta.version||0),PROJECT_STATE_VERSION);
  const next:ProjectMetaRecord={state:stateMeta,dayKeys,revision,updatedAt:now(),updatedBy:actor};
  if(current&&!hasExpected&&!allowUnversioned)throw new SnapshotRevisionConflict();
  if(current&&hasExpected&&(!Number.isSafeInteger(expectedRevision)||expectedRevision<0))throw new SnapshotRevisionConflict();
  const DB=runtimeEnv().DB as {batch?:(statements:unknown[])=>Promise<Array<{meta?:{changes?:number}}>>}&ReturnType<typeof runtimeEnv>['DB'];
  if(typeof DB.batch==='function'){
    await saveSnapshotAtomically(projectId,snapshot,actor,current,next,hasExpected?expectedRevision:Number(current?.revision||0));
    return revision;
  }
  if(current&&hasExpected){
    if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)throw new SnapshotRevisionConflict();
    const clean={...next} as Record<string,unknown>;delete clean.id;
    const result=await runtimeEnv().DB.prepare("UPDATE kv_records SET record_json=?,updated_at=? WHERE collection=? AND id=? AND CAST(json_extract(record_json,'$.revision') AS INTEGER)=?")
      .bind(JSON.stringify(clean),next.updatedAt,metaTable(projectId),String(current.id),expectedRevision).run();
    if(Number(result.meta?.changes||0)!==1)throw new SnapshotRevisionConflict();
  } else if(current)await db.update(metaTable(projectId),[{id:String(current.id),record:next as unknown as Record<string,unknown>}]);
  else await db.add(metaTable(projectId),[next as unknown as Record<string,unknown>]);
  await saveSnapshotParts(projectId,snapshot,actor);
  return revision;
}

export async function assembleState(projectId:string,requestedDate?:string){
  const meta=await getMeta(projectId);if(!meta)return null;
  const floors=(await getFloors(projectId)).map(item=>item.floor),keys=meta.dayKeys||[],dates=keys.length<=31?[...keys]:keys.slice(-31),days:Record<string,unknown>={};
  if(requestedDate&&/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)&&keys.includes(requestedDate)&&!dates.includes(requestedDate))dates.push(requestedDate);
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
  // Never write back a stale copy of the metadata: re-read and compare-and-set.
  await retryOnMetaConflict(async()=>{
    const latest=await getMeta(projectId);if(!latest)return;
    const dayKeys=Array.from(new Set([...(latest.dayKeys||[]),date])).sort();
    await compareAndSetMeta(projectId,latest,{...latest,dayKeys,revision:latest.revision+1,updatedAt:now(),updatedBy:actor});
  });
}