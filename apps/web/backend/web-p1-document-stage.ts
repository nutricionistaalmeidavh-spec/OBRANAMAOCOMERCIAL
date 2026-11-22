import {runtimeEnv} from '../cloudflare/sdk';

const MAX_BYTES=2*1024*1024;
const MIME_TYPES=new Set(['application/pdf','image/jpeg','image/png']);
const NAME=/^[^\\/\x00-\x1f]{1,120}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_DEVICE=/^[-\w]{1,128}$/;
const MIME_SIGNATURES:Record<string,(value:Uint8Array)=>boolean>={
  'application/pdf':v=>v.length>5&&String.fromCharCode(...v.slice(0,5))==='%PDF-',
  'image/jpeg':v=>v.length>3&&v[0]===0xff&&v[1]===0xd8&&v[2]===0xff,
  'image/png':v=>v.length>8&&[137,80,78,71,13,10,26,10].every((x,i)=>v[i]===x)
};
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const collection=(projectId:string)=>'p1_document_stage_'+projectId.replace(/[^-\w]/g,'_');
const hex=(arr:Uint8Array)=>Array.from(arr).map(x=>x.toString(16).padStart(2,'0')).join('');
const digest=async(bytes:Uint8Array)=>hex(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as BufferSource)));
function base64(bytes:Uint8Array):string{
  let text='';for(let pos=0;pos<bytes.length;pos+=8192)text+=String.fromCharCode(...bytes.slice(pos,pos+8192));
  return btoa(text);
}
const bucket=()=>{
  const r2=runtimeEnv().FILES;
  if(!r2)throw new Error('Transporte opcional de anexos ainda não configurado. Envie arquivos pelo Desktop/servidor próprio.');
  return r2;
};
const invalid=(message:string):never=>{throw new Error(message)};
export type StagedP1Document={
  stageId:string;sha256:string;name:string;mimeType:string;sizeBytes:number;
  projectId:string;companyId:string;sourceDeviceId:string;ownerId:string;
  key:string;createdAt:string;expiresAt:string
};
const metadata=async(projectId:string,id:string):Promise<StagedP1Document|null>=>{
  const row=await runtimeEnv().DB.prepare('SELECT record_json FROM kv_records WHERE collection=? AND id=?').bind(collection(projectId),id).first<{record_json:string}>();
  if(!row)return null;
  try{return JSON.parse(row.record_json) as StagedP1Document}catch{return null}
};
export function validateDocumentCommand(input:unknown){
  const raw=obj(input),keys=['stageId','sha256','name','mimeType','categoria','titulo','relacao_tipo','relacao_id'];
  if(Object.keys(raw).some(key=>!keys.includes(key)))invalid('Campo de documento não permitido.');
  const stageId=String(raw.stageId||''),sha256=String(raw.sha256||''),name=String(raw.name||''),
    mimeType=String(raw.mimeType||''),categoria=String(raw.categoria||'');
  if(!UUID.test(stageId)||!/^[a-f0-9]{64}$/.test(sha256)||!NAME.test(name)||!MIME_TYPES.has(mimeType)||
    !/^[a-zA-Z0-9_-]{2,50}$/.test(categoria))invalid('Identidade do documento inválida.');
  const relacao_tipo=raw.relacao_tipo===undefined?undefined:String(raw.relacao_tipo);
  if(relacao_tipo!==undefined&&!['rdos','medicoes','contratos_obra','pedidos_compra','recebimentos_materiais'].includes(relacao_tipo))invalid('Vínculo documental não permitido.');
  if((raw.relacao_id!==undefined)!==(relacao_tipo!==undefined))invalid('Vínculo documental incompleto.');
  if(raw.relacao_id!==undefined&&(!Number.isSafeInteger(raw.relacao_id)||Number(raw.relacao_id)<1))invalid('ID do vínculo documental inválido.');
  if(raw.titulo!==undefined&&(typeof raw.titulo!=='string'||raw.titulo.length>250||!raw.titulo.trim()))invalid('Título do documento inválido.');
  return{stageId,sha256,name,mimeType,categoria,
    ...(raw.titulo!==undefined?{titulo:String(raw.titulo).trim()}:{}),
    ...(relacao_tipo!==undefined?{relacao_tipo,relacao_id:Number(raw.relacao_id)}:{})};
}
export async function validateDocumentUpload(rawInput:unknown){
  const raw=obj(rawInput),uploadId=String(raw.uploadId||''),sourceDeviceId=String(raw.sourceDeviceId||''),
    name=String(raw.name||''),mimeType=String(raw.mimeType||''),data=String(raw.data||'');
  if(!UUID.test(uploadId)||!SAFE_DEVICE.test(sourceDeviceId)||!NAME.test(name)||
    !MIME_TYPES.has(mimeType))invalid('Arquivo/documento inválido ou formato não permitido.');
  if(!data||data.length>Math.ceil(MAX_BYTES/3)*4+8||!/^[A-Za-z0-9+/]+={0,2}$/.test(data))invalid('Arquivo inválido ou maior que 2 MB.');
  let text:string;try{text=atob(data)}catch{invalid('Arquivo base64 inválido.');}
  const bytes=Uint8Array.from(text!,c=>c.charCodeAt(0));
  if(!bytes.length||bytes.length>MAX_BYTES||!MIME_SIGNATURES[mimeType](bytes))invalid('Arquivo vazio, excessivo ou tipo real incompatível.');
  return{uploadId,sourceDeviceId,name,mimeType,sha256:await digest(bytes),bytes};
}
async function sweepExpiredUploads(projectId:string){
  const now=new Date().toISOString();
  const expired=await runtimeEnv().DB.prepare(`SELECT id,record_json FROM kv_records WHERE collection=? AND
    json_extract(record_json,'$.expiresAt')<? LIMIT 20`)
    .bind(collection(projectId),now).all<{id:string;record_json:string}>();
  for(const row of expired.results||[]){
    try{
      const info=JSON.parse(row.record_json) as StagedP1Document;
      if(info.key&&info.key.startsWith('p1-staged/'))await bucket().delete(info.key);
      await runtimeEnv().DB.prepare('DELETE FROM kv_records WHERE collection=? AND id=?')
        .bind(collection(projectId),row.id).run();
    }catch(error){console.warn('Limpeza de anexo expirado pendente: '+String((error as Error).message).slice(0,120))}
  }
}
export async function uploadP1StagedDocument({companyId,projectId,userId,input}:{
  companyId:string;projectId:string;userId:string;input:unknown
}){
  const file=await validateDocumentUpload(input);
  const active=bucket(),collectionId=collection(projectId),createdAt=new Date().toISOString();
  await sweepExpiredUploads(projectId);
  const existing=await metadata(projectId,file.uploadId);
  if(existing){
    if(existing.sha256!==file.sha256||existing.sourceDeviceId!==file.sourceDeviceId||
      existing.companyId!==companyId||existing.ownerId!==userId||existing.name!==file.name||existing.mimeType!==file.mimeType)
      invalid('Este upload já foi usado com outro arquivo ou origem.');
    return{stageId:existing.stageId,sha256:existing.sha256,name:existing.name,mimeType:existing.mimeType,sizeBytes:existing.sizeBytes};
  }
  const key='p1-staged/'+companyId.replace(/[^-\w]/g,'_')+'/'+projectId.replace(/[^-\w]/g,'_')+'/'+file.uploadId;
  const item:StagedP1Document={
    stageId:file.uploadId,sha256:file.sha256,name:file.name,mimeType:file.mimeType,sizeBytes:file.bytes.byteLength,
    companyId,projectId,sourceDeviceId:file.sourceDeviceId,ownerId:userId,key,createdAt,
    expiresAt:new Date(Date.now()+24*3600*1000).toISOString()
  };
  const result=await runtimeEnv().DB.prepare('INSERT OR IGNORE INTO kv_records(collection,id,record_json,created_at,updated_at) VALUES(?,?,?,?,?)')
    .bind(collectionId,item.stageId,JSON.stringify(item),createdAt,createdAt).run();
  if(Number(result.meta?.changes||0)!==1){
    const concurrent=await metadata(projectId,file.uploadId);
    if(!concurrent||concurrent.sha256!==item.sha256||concurrent.sourceDeviceId!==item.sourceDeviceId||concurrent.ownerId!==userId)
      invalid('Upload concorrente inválido.');
    return{stageId:item.stageId,sha256:item.sha256,name:item.name,mimeType:item.mimeType,sizeBytes:item.sizeBytes};
  }
  try{await active.put(key,file.bytes,{httpMetadata:{contentType:file.mimeType}})}
  catch(error){
    await runtimeEnv().DB.prepare('DELETE FROM kv_records WHERE collection=? AND id=?').bind(collectionId,item.stageId).run();
    throw error;
  }
  return{stageId:item.stageId,sha256:item.sha256,name:item.name,mimeType:item.mimeType,sizeBytes:item.sizeBytes};
}
export async function authorizeP1StagedCommand({projectId,companyId,stageId,sha256,actorId,sourceDeviceId,name,mimeType}:{
  projectId:string;companyId:string;stageId:string;sha256:string;actorId:string;
  sourceDeviceId:string;name:string;mimeType:string
}):Promise<boolean>{
  const item=await metadata(projectId,stageId);
  return!!item&&item.stageId===stageId&&item.sha256===sha256&&item.projectId===projectId&&
    item.companyId===companyId&&item.ownerId===actorId&&item.sourceDeviceId===sourceDeviceId&&
    item.name===name&&item.mimeType===mimeType&&item.expiresAt>=new Date().toISOString();
}
export async function readP1StagedDocument({projectId,stageId,sourceDeviceId,companyId,sha256}:{
  projectId:string;stageId:string;sourceDeviceId:string;companyId:string;sha256:string
}){
  const item=await metadata(projectId,stageId);
  if(!item||item.projectId!==projectId||item.companyId!==companyId||item.sourceDeviceId!==sourceDeviceId||
    item.sha256!==sha256||item.expiresAt<new Date().toISOString())invalid('Upload expirado ou não pertence à fonte autorizada.');
  const object=await bucket().get(item.key);
  if(!object)invalid('Conteúdo pendente não encontrado no transporte de arquivos.');
  const bytes=new Uint8Array(await object.arrayBuffer());
  if(bytes.length!==item.sizeBytes||bytes.length>MAX_BYTES||await digest(bytes)!==item.sha256)invalid('Integridade SHA256 do arquivo não confirmada.');
  return{stageId:item.stageId,sha256:item.sha256,name:item.name,mimeType:item.mimeType,
    data:base64(bytes),sizeBytes:item.sizeBytes};
}
export async function completeP1StagedDocument(projectId:string,stageId:string){
  const item=await metadata(projectId,stageId);
  if(!item)return;
  await bucket().delete(item.key);
  await runtimeEnv().DB.prepare('DELETE FROM kv_records WHERE collection=? AND id=?').bind(collection(projectId),stageId).run();
}
