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
const PAGE_SIZE=500
type Manifest=Omit<FieldRdoCatalogRecord,'materials'> & {paged:true;total:number;pages:number}
const readLatest=async(projectId:string):Promise<FieldRdoCatalogRecord|Manifest|null>=>{
 const row=await runtimeEnv().DB.prepare('SELECT record_json FROM kv_records WHERE collection=? AND id=?')
  .bind(table(projectId),'latest').first<{record_json:string}>()
 if(!row)return null
 try{return JSON.parse(row.record_json) as FieldRdoCatalogRecord|Manifest}catch{return null}
}
export async function getFieldRdoCatalog(projectId:string,options:{page?:number;version?:string}={}):Promise<(FieldRdoCatalogRecord&{total?:number;page?:number;pages?:number})|null>{
 const latest=await readLatest(projectId)
 if(!latest)return null
 const requested=options.page
 if(requested!==undefined&&(!Number.isSafeInteger(requested)||requested<0))throw new Error('Página inválida.')
 if(options.version&&options.version!==latest.version)throw new Error('Catálogo atualizado; reinicie a consulta.')
 if(!('paged' in latest)){
  if(requested===undefined)return latest
  const total=latest.materials.length,pages=Math.max(1,Math.ceil(total/PAGE_SIZE))
  if(requested>=pages)throw new Error('Página inexistente.')
  return {...latest,materials:latest.materials.slice(requested*PAGE_SIZE,(requested+1)*PAGE_SIZE),total,page:requested,pages}
 }
 const {paged,total,pages,...meta}=latest
 const read=async(page:number)=>{
  const row=await runtimeEnv().DB.prepare('SELECT record_json FROM kv_records WHERE collection=? AND id=?').bind(table(projectId),'p:'+latest.version+':'+page).first<{record_json:string}>()
  if(!row)throw new Error('Página de catálogo indisponível; atualize novamente.')
  return JSON.parse(row.record_json) as FieldRdoCatalogRecord['materials']
 }
 if(requested!==undefined){if(requested>=pages)throw new Error('Página inexistente.');return {...meta,materials:await read(requested),total,page:requested,pages}}
 // Compatibility for earlier installed clients; never silently return only a prefix.
 const materials:FieldRdoCatalogRecord['materials']=[]
 for(let page=0;page<pages;page++)materials.push(...await read(page))
 if(materials.length!==total)throw new Error('Catálogo incompleto; atualize novamente.')
 return {...meta,materials}
}
export async function publishFieldRdoCatalog(projectId:string,deviceId:string,payload:unknown){
 const v=record(payload),materials=array(v.materials),fronts=array(v.fronts),services=array(v.services);
 const workId=Number(v.workId),version=strings(v.version,64)
 if(v.schemaVersion!==1||!Number.isSafeInteger(workId)||workId<1||!(/^[a-f0-9]{32}$/.test(version))||materials.length>20000||fronts.length>5000||services.length>5000)
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
 if(new Set(mat.map(m=>m.id)).size!==mat.length)throw new Error('Identidade de material duplicada.')
 const previous=await readLatest(projectId)
 if(previous?.version===version&&previous.workId===workId&&previous.sourceDeviceId===deviceId)return {...previous,materials:[],total:mat.length}
 const data:FieldRdoCatalogRecord={
  schemaVersion:1,workId,materials:mat,fronts:frontsValidated,services:servicesValidated,
  version,sourceDeviceId:deviceId,updatedAt:new Date().toISOString()
 }
 const stamp=data.updatedAt
 const db=runtimeEnv().DB
 const upsert=(id:string,value:unknown)=>db.prepare(`INSERT INTO kv_records(collection,id,record_json,created_at,updated_at) VALUES(?,?,?,?,?)
  ON CONFLICT(collection,id) DO UPDATE SET record_json=excluded.record_json,updated_at=excluded.updated_at`).bind(table(projectId),id,JSON.stringify(value),stamp,stamp)
 const pages=Math.max(1,Math.ceil(mat.length/PAGE_SIZE))
 const {materials:_,...meta}=data
 const manifest:Manifest={...meta,paged:true,total:mat.length,pages}
 // Atomic batch: readers see the previous snapshot or the new complete snapshot.
 const statements=[]
 for(let page=0;page<pages;page++)statements.push(upsert('p:'+version+':'+page,mat.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE)))
 statements.push(upsert('latest',manifest))
 statements.push(db.prepare("DELETE FROM kv_records WHERE collection=? AND id LIKE 'p:%' AND substr(id,1,?)<>?").bind(table(projectId),('p:'+version+':').length,'p:'+version+':'))
 await db.batch(statements)

 return {...manifest,materials:[]}
}
