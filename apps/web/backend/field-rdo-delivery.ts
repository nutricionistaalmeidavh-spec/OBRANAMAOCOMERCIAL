import { runtimeEnv } from '../cloudflare/sdk'
import { getDay } from './project-state'

const safe=(v:string)=>v.replace(/[^a-zA-Z0-9_-]/g,'_')
const collection=(projectId:string)=>'field_rdo_receipts_'+safe(projectId)
const dayPrefix=(projectId:string)=>'project_day_'+safe(projectId)+'_'
const decode=(v:string|undefined)=>{try{return JSON.parse(String(v||'{}')) as Record<string,unknown>}catch{return{}}}
const record=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{}
const list=(v:unknown):unknown[]=>Array.isArray(v)?v:[]
const validDate=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)

export type FieldRdoDelivery={
  date:string;fingerprint:string;
  report:{date:string;note:string;events:unknown[];sessions:unknown[];attendance:unknown;materials:unknown[];materialsReviewed:boolean;photos:Array<{id:string;sha256:string;contentType:string;uploadedAt:string}>}
}

/** Read persistent canonical day snapshots; acknowledgements are separate transport receipts. */
export async function pendingFieldRdos(projectId:string):Promise<FieldRdoDelivery[]>{
  const prefix=dayPrefix(projectId),ackCollection=collection(projectId)
  const sql=`SELECT d.record_json AS source, d.collection AS source_collection,
   ack.record_json AS receipt
   FROM kv_records d
   LEFT JOIN kv_records ack
     ON ack.collection=? AND ack.id=substr(d.collection,?)
   WHERE d.collection GLOB ?
     AND json_extract(d.record_json,'$.day.rdoStatus')='ready_for_desktop'
     AND json_extract(d.record_json,'$.day.materialsReviewed')=1
     AND (ack.record_json IS NULL OR json_extract(ack.record_json,'$.fingerprint')<>json_extract(d.record_json,'$.day.rdoClosedFingerprint') OR json_extract(ack.record_json,'$.status')<>'applied')
   ORDER BY d.updated_at ASC LIMIT 50`
  const query=await runtimeEnv().DB.prepare(sql).bind(ackCollection,prefix.length+1,prefix+'*').all<{source:string;receipt:string|null;source_collection:string}>()
  const reports:FieldRdoDelivery[]=[]
  for(const row of query.results||[]){
    const day=record(decode(row.source).day),receipt=decode(row.receipt||'{}')
    const date=String(day.date||'').trim(),fingerprint=String(day.rdoClosedFingerprint||'')
    if(!validDate(date)||row.source_collection!==prefix+date||!fingerprint||fingerprint.length>128000)continue
    if(receipt.fingerprint===fingerprint&&receipt.status==='applied')continue
    reports.push({date,fingerprint,report:{
      date,note:String(day.note||'').slice(0,20000),events:list(day.events).slice(0,200),
      sessions:list(day.sessions).slice(0,200),attendance:record(day.attendance),
      materials:list(day.materials).slice(0,200),materialsReviewed:true,
      photos:list(day.photos).slice(0,60).map(photo=>{
        const row=record(photo);
        return{id:String(row.id||''),sha256:String(row.sha256||''),contentType:String(row.contentType||''),
          uploadedAt:String(row.uploadedAt||'')}
      })
    }})
    if(reports.length>=50)break
  }
  return reports
}

export async function fieldRdoReceipts(projectId:string){
  const rows=await runtimeEnv().DB.prepare('SELECT id,record_json FROM kv_records WHERE collection=? ORDER BY updated_at DESC LIMIT 500').bind(collection(projectId)).all<{id:string;record_json:string}>()
  return Object.fromEntries((rows.results||[]).filter(row=>validDate(row.id)).map(row=>[row.id,decode(row.record_json)]))
}

export async function confirmFieldRdo(projectId:string,input:Record<string,unknown>,deviceId:string){
  const date=String(input.date||''),fingerprint=String(input.fingerprint||'')
  if(!validDate(date)||!fingerprint||fingerprint.length>128000)throw new Error('Identificação do diário inválida.')
  const current=record(await getDay(projectId,date))
  if(current.rdoStatus!=='ready_for_desktop'||current.materialsReviewed!==true||current.rdoClosedFingerprint!==fingerprint)
    throw new Error('O RDO foi alterado após o envio. Atualize antes de confirmar o recebimento.')
  const localRdoId=Number(input.localRdoId),materialRevision=Number(input.materialRevision)
  if(!Number.isSafeInteger(localRdoId)||localRdoId<1||!Number.isSafeInteger(materialRevision)||materialRevision<0)
    throw new Error('O servidor não forneceu identificadores canônicos válidos.')
  const stamp=new Date().toISOString()
  const data={status:'applied',date,fingerprint,localRdoId,materialRevision,sourceDeviceId:deviceId,confirmedAt:stamp}
  await runtimeEnv().DB.prepare(`INSERT INTO kv_records(collection,id,record_json,created_at,updated_at) VALUES(?,?,?,?,?)
    ON CONFLICT(collection,id) DO UPDATE SET record_json=excluded.record_json,updated_at=excluded.updated_at`)
    .bind(collection(projectId),date,JSON.stringify(data),stamp,stamp).run()
  return data
}
