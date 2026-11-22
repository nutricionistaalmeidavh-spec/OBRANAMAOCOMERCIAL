import {runtimeEnv} from '../cloudflare/sdk';

const MAX=2*1024*1024;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
const MIMES=new Set(['application/pdf','image/jpeg','image/png']);
const invalid=(message:string):never=>{throw new Error(message)};
const collection=(projectId:string)=>'p1_document_download_'+projectId.replace(/[^-\w]/g,'_');
const hex=(bytes:Uint8Array)=>Array.from(bytes).map(x=>x.toString(16).padStart(2,'0')).join('');
const digest=async(bytes:Uint8Array)=>hex(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as BufferSource)));
const base64=(bytes:Uint8Array)=>{
 let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.slice(i,i+8192));
 return btoa(text);
};
const files=()=>{
 const storage=runtimeEnv().FILES;
 if(!storage)invalid('Transferência documental Web opcional não está configurada; use o Desktop/servidor próprio.');
 return storage!;
};
const obj=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
export type P1DownloadRecord={
 id:string;projectId:string;companyId:string;sourceDeviceId:string;documentLocalId:number;actorId:string;
 status:'pending'|'ready'|'failed';error?:string;name?:string;mimeType?:string;sha256?:string;sizeBytes?:number;key?:string;
 createdAt:string;updatedAt:string;expiresAt:string
};
async function load(projectId:string,id:string):Promise<P1DownloadRecord|null>{
 const x=await runtimeEnv().DB.prepare('SELECT record_json FROM kv_records WHERE collection=? AND id=?')
   .bind(collection(projectId),id).first<{record_json:string}>();
 if(!x)return null;
 try{return JSON.parse(x.record_json) as P1DownloadRecord}catch{return null}
}
export async function validateDownloadFilePayload(raw:unknown){
 const v=obj(raw),name=String(v.name||''),mimeType=String(v.mimeType||''),data=String(v.data||''),
   sha256=String(v.sha256||''),localId=v.localId;
 if(typeof localId!=='number'||!Number.isSafeInteger(localId)||localId<1||
   name.length<1||name.length>120||/[\\/\x00-\x1f]/.test(name)||!MIMES.has(mimeType)||!SHA.test(sha256)||
   !data||data.length>Math.ceil(MAX/3)*4+8||!/^[A-Za-z0-9+/]+={0,2}$/.test(data))
   invalid('Arquivo solicitado é inválido ou excede 2 MB.');
 let binary:string;try{binary=atob(data)}catch{invalid('Arquivo base64 inválido.');}
 const bytes=Uint8Array.from(binary!,c=>c.charCodeAt(0));
 if(bytes.length<5||bytes.length>MAX||await digest(bytes)!==sha256)invalid('SHA256 do arquivo solicitado não confere.');
 if((mimeType==='application/pdf'&&String.fromCharCode(...bytes.slice(0,5))!=='%PDF-')||
    (mimeType==='image/jpeg'&&!(bytes[0]===255&&bytes[1]===216&&bytes[2]===255))||
    (mimeType==='image/png'&&![137,80,78,71,13,10,26,10].every((x,i)=>bytes[i]===x)))
   invalid('Conteúdo e formato do documento não correspondem.');
 return{name,mimeType,sha256,localId,sizeBytes:bytes.length,bytes};
}
export async function requestP1DocumentDownload({companyId,projectId,actorId,sourceDeviceId,documentLocalId,retry=false}:{
  companyId:string;projectId:string;actorId:string;sourceDeviceId:string;documentLocalId:number;retry?:boolean
}):Promise<P1DownloadRecord>{
 if(!Number.isSafeInteger(documentLocalId)||documentLocalId<1||!/^[-\w]{1,128}$/.test(sourceDeviceId))invalid('Origem/documento inválido.');
 files(); // feature must be explicitly configured; no silent storage fallback.
 const now=new Date().toISOString();
 const prior=await runtimeEnv().DB.prepare(
   `SELECT record_json FROM kv_records WHERE collection=? AND
    json_extract(record_json,'$.actorId')=? AND json_extract(record_json,'$.sourceDeviceId')=? AND
    CAST(json_extract(record_json,'$.documentLocalId') AS INTEGER)=? AND
    json_extract(record_json,'$.expiresAt')>=?
    ORDER BY updated_at DESC LIMIT 1`
 ).bind(collection(projectId),actorId,sourceDeviceId,documentLocalId,now).first<{record_json:string}>();
 if(prior){const record=JSON.parse(prior.record_json) as P1DownloadRecord;
   if(record.projectId===projectId&&record.companyId===companyId&&!(record.status==='failed'&&retry))return record;
 }
 const request:P1DownloadRecord={
   id:crypto.randomUUID(),projectId,companyId,actorId,sourceDeviceId,documentLocalId,
   status:'pending',createdAt:now,updatedAt:now,expiresAt:new Date(Date.now()+24*3600*1000).toISOString()
 };
 await runtimeEnv().DB.prepare('INSERT INTO kv_records(collection,id,record_json,created_at,updated_at) VALUES(?,?,?,?,?)')
   .bind(collection(projectId),request.id,JSON.stringify(request),now,now).run();
 return request;
}
export async function pendingP1DocumentDownloads(projectId:string,sourceDeviceId:string):Promise<P1DownloadRecord[]>{
 const now=new Date().toISOString();
 const rows=await runtimeEnv().DB.prepare(`SELECT record_json FROM kv_records WHERE collection=?
  AND json_extract(record_json,'$.sourceDeviceId')=?
  AND json_extract(record_json,'$.status')='pending' AND json_extract(record_json,'$.expiresAt')>=?
  ORDER BY created_at ASC LIMIT 10`).bind(collection(projectId),sourceDeviceId,now).all<{record_json:string}>();
 return(rows.results||[]).map(x=>JSON.parse(x.record_json) as P1DownloadRecord);
}
export async function receiveP1DocumentDownload({projectId,companyId,sourceDeviceId,id,raw}:{
 projectId:string;companyId:string;sourceDeviceId:string;id:string;raw:unknown
}){
 if(!UUID.test(id))invalid('Pedido de download inválido.');
 const record=await load(projectId,id);
 if(!record||record.projectId!==projectId||record.companyId!==companyId||record.sourceDeviceId!==sourceDeviceId||
    record.expiresAt<new Date().toISOString())invalid('Solicitação de arquivo expirada ou não autorizada.');
 const payload=await validateDownloadFilePayload(raw);
 if(payload.localId!==record.documentLocalId)invalid('Documento retornado não corresponde ao solicitado.');
 if(record.status==='ready'){
   if(record.sha256!==payload.sha256||record.mimeType!==payload.mimeType||record.name!==payload.name)
     invalid('Arquivo já entregue com outros dados.');
   return{ok:true,id,status:'ready',duplicate:true};
 }
 const key='p1-download/'+companyId.replace(/[^-\w]/g,'_')+'/'+projectId.replace(/[^-\w]/g,'_')+'/'+id;
 await files().put(key,payload.bytes,{httpMetadata:{contentType:payload.mimeType}});
 const now=new Date().toISOString();
 const next:P1DownloadRecord={...record,status:'ready',name:payload.name,mimeType:payload.mimeType,
   sha256:payload.sha256,sizeBytes:payload.sizeBytes,key,updatedAt:now};
 const result=await runtimeEnv().DB.prepare(`UPDATE kv_records SET record_json=?,updated_at=?
  WHERE collection=? AND id=? AND json_extract(record_json,'$.status')='pending'`)
 .bind(JSON.stringify(next),now,collection(projectId),id).run();
 if(Number(result.meta?.changes||0)!==1)invalid('Download foi confirmado concorrentemente; atualize a solicitação.');
 return{ok:true,id,status:'ready',duplicate:false};
}
export async function failP1DocumentDownload({projectId,companyId,sourceDeviceId,id,errorMessage}:{
 projectId:string;companyId:string;sourceDeviceId:string;id:string;errorMessage:string
}){
 if(!UUID.test(id))invalid('Pedido documental inválido.');
 const existing=await load(projectId,id);
 if(!existing||existing.companyId!==companyId||existing.sourceDeviceId!==sourceDeviceId||
    existing.status!=='pending')invalid('Solicitação documental não está pendente para este Desktop.');
 const now=new Date().toISOString();
 const record:P1DownloadRecord={...existing,status:'failed',updatedAt:now,
   error:String(errorMessage||'Falha ao ler arquivo na origem.').slice(0,180)};
 const result=await runtimeEnv().DB.prepare(`UPDATE kv_records SET record_json=?,updated_at=? WHERE
  collection=? AND id=? AND json_extract(record_json,'$.status')='pending'`)
  .bind(JSON.stringify(record),now,collection(projectId),id).run();
 if(Number(result.meta?.changes||0)!==1)invalid('Solicitação documental alterada simultaneamente.');
 return{ok:true,status:'failed',id};
}
export async function readP1DocumentDownload({projectId,companyId,actorId,id}:{
 projectId:string;companyId:string;actorId:string;id:string
}){
 if(!UUID.test(id))invalid('ID de download inválido.');
 const record=await load(projectId,id);
 if(!record||record.actorId!==actorId||record.companyId!==companyId||record.projectId!==projectId)
   invalid('Solicitação de arquivo não pertence ao usuário/obra.');
 if(record.status==='failed')return{status:'failed',id,error:record.error||'Arquivo não disponível na origem.'};
 if(record.status!=='ready'||!record.key)return{status:'pending',id};
 if(record.expiresAt<new Date().toISOString())invalid('Link temporário expirou; solicite novamente.');
 const source=await files().get(record.key);
 if(!source)invalid('Arquivo temporário ainda não está disponível.');
 const bytes=new Uint8Array(await source.arrayBuffer());
 if(bytes.length!==record.sizeBytes||bytes.length>MAX||await digest(bytes)!==record.sha256)
   invalid('Arquivo temporário não passou na verificação SHA256.');
 return{status:'ready',id,name:record.name,mimeType:record.mimeType,data:base64(bytes)};
}
