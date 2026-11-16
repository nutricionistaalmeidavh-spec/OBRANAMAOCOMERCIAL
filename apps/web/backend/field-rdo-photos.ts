import { runtimeEnv } from '../cloudflare/sdk'
const safe=v=>String(v||'').replace(/[^a-zA-Z0-9_-]/g,'_')
const collection=id=>'field_rdo_photos_'+safe(id)
const validDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(v)
const allowedMimes=new Set(['image/jpeg','image/png','image/webp'])
const MAX_BYTES=500000
const decodeBase64=value=>{
 const text=String(value||'')
 if(!text||text.length>Math.ceil(MAX_BYTES/3)*4+16||!/^[A-Za-z0-9+/]+={0,2}$/.test(text))throw new Error('A imagem excede o limite de 500 KB ou está inválida.')
 let binary;try{binary=atob(text)}catch{throw new Error('Imagem codificada incorretamente.')}
 const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0))
 if(bytes.byteLength>MAX_BYTES)throw new Error('Imagem excede 500 KB.')
 return bytes
}
function actualMime(bytes){
 if(bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return'image/jpeg'
 if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return'image/png'
 if(bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return'image/webp'
 return null
}
const base64=bytes=>{
 let result=''
 for(let i=0;i<bytes.byteLength;i+=8192)result+=String.fromCharCode(...bytes.slice(i,i+8192))
 return btoa(result)
}
const record=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{}
const json=s=>{try{return JSON.parse(s)}catch{return null}}
function requireBucket(){
 const bucket=runtimeEnv().FILES
 if(!bucket)throw new Error('Evidências em nuvem não configuradas. O RDO continua disponível sem fotos.')
 return bucket
}
async function metadata(projectId,id){
 const row=await runtimeEnv().DB.prepare('SELECT record_json FROM kv_records WHERE collection=? AND id=?')
  .bind(collection(projectId),id).first()
 return row?json(row.record_json):null
}
export async function uploadFieldPhoto({companyId,projectId,date,mimeType,data,userId}){
 if(!validDate(String(date))||!allowedMimes.has(String(mimeType)))throw new Error('Data ou formato da foto inválidos.')
 const bytes=decodeBase64(data),actual=actualMime(bytes)
 if(actual!==mimeType)throw new Error('O conteúdo da imagem não corresponde ao formato informado.')
 const bucket=requireBucket(),id=crypto.randomUUID(),now=new Date().toISOString()
 const key=`field-rdo/${safe(companyId)}/${safe(projectId)}/${date}/${id}`
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(n=>n.toString(16).padStart(2,'0')).join('')
 const receipt={id,date,contentType:actual,sizeBytes:bytes.byteLength,sha256:digest,uploadedAt:now,uploadedBy:String(userId||''),key}
 const count=await runtimeEnv().DB.prepare("SELECT COUNT(*) AS n FROM kv_records WHERE collection=? AND json_extract(record_json,'$.date')=?")
  .bind(collection(projectId),date).first()
 if(Number(count?.n||0)>=60)throw new Error('Limite de 60 fotos por dia atingido; revise os anexos da obra.')
 await bucket.put(key,bytes,{httpMetadata:{contentType:actual}})
 try{
  await runtimeEnv().DB.prepare('INSERT INTO kv_records(collection,id,record_json,created_at,updated_at) VALUES(?,?,?,?,?)')
   .bind(collection(projectId),id,JSON.stringify(receipt),now,now).run()
 }catch(e){await bucket.delete(key).catch(()=>{});throw e}
 const {key:ignored,uploadedBy:internal,...publicPhoto}=receipt
 return publicPhoto
}
export async function readFieldPhoto(projectId,id){
 if(!/^[a-f0-9-]{36}$/i.test(String(id||'')))throw new Error('Identificador de foto inválido.')
 const info=record(await metadata(projectId,id))
 if(!info.key)throw new Error('Foto não encontrada neste projeto.')
 const value=await requireBucket().get(String(info.key))
 if(!value)throw new Error('Foto indisponível na área de arquivos.')
 const bytes=new Uint8Array(await value.arrayBuffer())
 if(bytes.byteLength>MAX_BYTES)throw new Error('Foto acima do tamanho autorizado.')
 return {id,contentType:String(info.contentType),data:base64(bytes)}
}
export async function removeFieldPhoto(projectId,id,date){
 const info=record(await metadata(projectId,id))
 if(!info.key||info.date!==date||!validDate(String(date)))throw new Error('Anexo não pertence ao RDO informado.')
 await requireBucket().delete(String(info.key))
 await runtimeEnv().DB.prepare('DELETE FROM kv_records WHERE collection=? AND id=?').bind(collection(projectId),id).run()
 return {ok:true,id}
}
