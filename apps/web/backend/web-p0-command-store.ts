import { db, runtimeEnv } from '../cloudflare/sdk';
import type { P0CreateCommand } from './web-p0-create';

export type WebP0Queued={
  id:string;deviceId:string;companyId:string;projectId:string;
  entity:P0CreateCommand['entity'];action:'create'|'delete';data:Record<string,unknown>;
  localId?:number;targetLocalId?:number;expectedFingerprint?:string;
  actorId:string;status:'pending'|'applied'|'failed';error?:string;
  createdAt:string;updatedAt:string
};
const safe=(v:string)=>v.replace(/[^A-Za-z0-9_-]/g,'_');
const bucket=(projectId:string)=>'web_p0_commands_'+safe(projectId);
const stamp=()=>new Date().toISOString();

export async function getWebP0Command(projectId:string,id:string):Promise<WebP0Queued|null>{
  const [row]=await db.get<WebP0Queued>(bucket(projectId),[id]);
  return row||null;
}
export async function enqueueWebP0Command(input:{
  projectId:string;companyId:string;actorId:string;command:P0CreateCommand
}):Promise<WebP0Queued>{
  const {projectId,companyId,actorId,command}=input,now=stamp();
  const record:WebP0Queued={
    id:command.commandId,projectId,companyId,actorId,
    deviceId:command.sourceDeviceId,entity:command.entity,action:command.action||'create',data:command.data,
    ...(command.localId?{targetLocalId:command.localId}:{}),...(command.expectedFingerprint?{expectedFingerprint:command.expectedFingerprint}:{}),
    status:'pending',createdAt:now,updatedAt:now
  };
  // Exactly-once web submission; replay with same UUID must never create another job.
  await runtimeEnv().DB.prepare(
    'INSERT OR IGNORE INTO kv_records(collection,id,record_json,created_at,updated_at) VALUES(?,?,?,?,?)'
  ).bind(bucket(projectId),record.id,JSON.stringify(record),now,now).run();
  const found=await getWebP0Command(projectId,record.id);
  if(!found)throw new Error('Não foi possível registrar a solicitação.');
  if(found.actorId!==actorId||found.projectId!==projectId||found.companyId!==companyId||
    found.deviceId!==record.deviceId||found.entity!==record.entity||
    (found.action||'create')!==record.action||Number(found.targetLocalId||0)!==Number(record.targetLocalId||0)||String(found.expectedFingerprint||'')!==String(record.expectedFingerprint||'')||
    JSON.stringify(found.data)!==JSON.stringify(record.data))
    throw new Error('Identificador da solicitação já utilizado em outro cadastro.');
  return found;
}
export async function pendingWebP0Commands(projectId:string,deviceId:string):Promise<WebP0Queued[]>{
  const rows=await runtimeEnv().DB.prepare(
    "SELECT id,record_json FROM kv_records WHERE collection=? AND json_extract(record_json,'$.deviceId')=? AND json_extract(record_json,'$.status')='pending' ORDER BY created_at ASC LIMIT 25"
  ).bind(bucket(projectId),deviceId).all<{id:string;record_json:string}>();
  return (rows.results||[]).map(row=>{const record=JSON.parse(row.record_json) as WebP0Queued;return{...record,id:row.id,...(record.action==='delete'?{localId:record.targetLocalId}:{})}});
}
export async function listWebP0Commands(projectId:string,actorId:string):Promise<Array<Pick<WebP0Queued,'id'|'entity'|'action'|'deviceId'|'status'|'localId'|'error'|'createdAt'>>>{
  const {items}=await db.list<WebP0Queued>(bucket(projectId),{limit:100});
  return items.filter(item=>item.actorId===actorId)
    .map(item=>({id:item.id,entity:item.entity,action:item.action||'create',deviceId:item.deviceId,status:item.status,localId:item.localId,error:item.error,createdAt:item.createdAt}));
}
export async function ackWebP0Command(projectId:string,deviceId:string,input:{
  commandId:string;entity:string;localId?:number;error?:string
}):Promise<WebP0Queued|null>{
  const current=await getWebP0Command(projectId,input.commandId);
  if(!current)return null;
  if(current.deviceId!==deviceId||current.entity!==input.entity)throw new Error('Comando vinculado a outro dispositivo ou entidade.');
  if(current.status!=='pending')return current;
  const result=Number(input.localId)>0&&Number.isSafeInteger(input.localId)?{
    status:'applied' as const,localId:input.localId,error:undefined
  }:{
    status:'failed' as const,localId:undefined,error:String(input.error||'O Desktop não conseguiu criar o registro.').slice(0,250)
  };
  const next={...current,...result,updatedAt:stamp()};
  // Conditional update: delayed/repeated ACKs never revert completed status.
  const updated=await runtimeEnv().DB.prepare(
    "UPDATE kv_records SET record_json=?,updated_at=? WHERE collection=? AND id=? AND json_extract(record_json,'$.status')='pending'"
  ).bind(JSON.stringify(next),next.updatedAt,bucket(projectId),input.commandId).run();
  if(Number(updated.meta?.changes||0)!==1)return getWebP0Command(projectId,input.commandId);
  return next;
}
