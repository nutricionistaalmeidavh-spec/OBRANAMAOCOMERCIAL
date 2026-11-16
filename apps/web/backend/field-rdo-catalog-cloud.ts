import { runtimeEnv } from '../cloudflare/sdk'
const safe=(s:string)=>s.replace(/[^a-zA-Z0-9_-]/g,'_')
const table=(id:string)=>'field_rdo_catalog_'+safe(id)
const record=(v:unknown):Record<string,any>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,any>:{}
const strings=(v:unknown,max=240)=>String(v??'').trim().slice(0,max)
const array=(v:unknown)=>Array.isArray(v)?v:[]
export type FieldRdoCatalogRecord={
  schemaVersion:number;workId:number;materials:Array<{id:string;descricao:string;unidade:string;saldo:number}>;
  fronts:Array<{id:number;nome:string}>;services:Array<{id:number;nome:string;frente_id:number|null}>;
  version:string;updatedAt:string;sourceDeviceId:string
}
export async function getFieldRdoCatalog(projectId:string):Promise<FieldRdoCatalogRecord|null>{
 const row=await runtimeEnv().DB.prepare('SELECT record_json FROM kv_records WHERE collection=? AND id=?')
  .bind(table(projectId),'latest').first<{record_json:string}>()
 if(!row)return null
 try{return JSON.parse(row.record_json) as FieldRdoCatalogRecord}catch{return null}
}
export async function publishFieldRdoCatalog(projectId:string,deviceId:string,payload:unknown){
 const v=record(payload),materials=array(v.materials),fronts=array(v.fronts),services=array(v.services);
 const workId=Number(v.workId),version=strings(v.version,64)
 if(v.schemaVersion!==1||!Number.isSafeInteger(workId)||workId<1||!version||materials.length>1200||fronts.length>250||services.length>250)
  throw new Error('Catálogo de materiais não corresponde ao contrato operacional.')
 const mat=materials.map(input=>{
  const m=record(input),id=strings(m.id,40),descricao=strings(m.descricao,250),unidade=strings(m.unidade,24),saldo=Number(m.saldo)
  if(!/^mat_[a-f0-9]{24}$/.test(id)||!descricao||!unidade||!Number.isFinite(saldo))throw new Error('Item de catálogo inválido.')
  return{id,descricao,unidade,saldo}
 })
 const frontsValidated=fronts.map(input=>{
  const row=record(input),id=Number(row.id),nome=strings(row.nome,250)
  if(!Number.isSafeInteger(id)||id<1||!nome)throw new Error('Frente de obra inválida no catálogo.')
  return{id,nome}
 })
 const servicesValidated=services.map(input=>{
  const row=record(input),id=Number(row.id),nome=strings(row.nome,250),
    frente_id=row.frente_id==null?null:Number(row.frente_id)
  if(!Number.isSafeInteger(id)||id<1||!nome||(frente_id!==null&&(!Number.isSafeInteger(frente_id)||frente_id<1)))
   throw new Error('Serviço inválido no catálogo.')
  return{id,nome,frente_id}
 })
 const previous=await getFieldRdoCatalog(projectId)
 if(previous?.version===version&&previous.workId===workId&&previous.sourceDeviceId===deviceId)return previous
 const data:FieldRdoCatalogRecord={
  schemaVersion:1,workId,materials:mat,fronts:frontsValidated,services:servicesValidated,
  version,sourceDeviceId:deviceId,updatedAt:new Date().toISOString()
 }
 const stamp=data.updatedAt
 await runtimeEnv().DB.prepare(`INSERT INTO kv_records(collection,id,record_json,created_at,updated_at) VALUES(?,?,?,?,?)
  ON CONFLICT(collection,id) DO UPDATE SET record_json=excluded.record_json,updated_at=excluded.updated_at`)
  .bind(table(projectId),'latest',JSON.stringify(data),stamp,stamp).run()
 return data
}
