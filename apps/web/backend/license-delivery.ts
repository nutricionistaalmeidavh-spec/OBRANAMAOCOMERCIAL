import { getLicense, type License } from './license-service';

type CloudflareSender={send(message:Record<string,unknown>):Promise<{messageId?:string}>};
export type DeliveryTransport={
  EMAIL?:CloudflareSender;
  EMAIL_FROM?:string;
  EMAIL_DELIVERY_URL?:string;
  EMAIL_DELIVERY_TOKEN?:string;
};
export type DeliveryEnvironment=DeliveryTransport&{DB:D1Database};
export type DeliveryStatus='queued'|'sending'|'sent'|'failed';
export type DeliveryRecord={
  email:string;status:DeliveryStatus;attempts:number;createdAt:string;updatedAt:string;
  nextAttemptAt?:string;leaseUntil?:string;sentAt?:string;messageId?:string;error?:string;
};

const COLLECTION='license_email_delivery';
const CODE_RE=/^[A-Z0-9-]{8,16}$/;
const EMAIL_RE=/^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/;
const RELEASE='https://github.com/nutricionistaalmeidavh-spec/OBRANAMAOCOMERCIAL/releases/download/';
const WIN=RELEASE+'desktop-commercial-v2.1.6/Obra-na-Mao-Desktop-Setup-2.1.6.exe';
const MAC_ARM=RELEASE+'desktop-commercial-macos-v2.1.6/Obra-na-Mao-Desktop-v2.1.6-macOS-Apple-Silicon.dmg';
const MAC_INTEL=RELEASE+'desktop-commercial-macos-v2.1.6/Obra-na-Mao-Desktop-v2.1.6-macOS-Intel.dmg';
const DRIVE='https://drive.google.com/drive/folders/1CzvNIJNEGavXAzwH5hVfMHCaofq6HatW';
const MANUAL='https://drive.google.com/file/d/1V1m7gGMbLN4Z9SY0UkCT5hF549ZeL0I9/view';
const now=()=>new Date().toISOString();
const normalizedEmail=(value:unknown)=>String(value||'').trim().toLowerCase();
const escaped=(value:unknown)=>String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));

export function validLicenseRecipient(license:Pick<License,'email'|'code'|'status'|'expiresAt'>){
  if(license.status!=='active'||!EMAIL_RE.test(normalizedEmail(license.email))||!CODE_RE.test(String(license.code||'')))return false;
  if(!license.expiresAt)return true;
  const expiry=new Date(license.expiresAt);
  return Number.isFinite(expiry.getTime())&&expiry.getTime()>=Date.now();
}

export function buildLicenseWelcome(license:License){
  if(!validLicenseRecipient(license))throw new Error('LICENSE_EMAIL_NOT_ELIGIBLE');
  const to=normalizedEmail(license.email);
  const subject='Seu acesso ao Obra na Mão — código e instalação';
  const limit=Number.isFinite(Number(license.maxDevices))?String(license.maxDevices):'conforme licença';
  const lines=[
    'Olá! Seu acesso ao Obra na Mão foi liberado.',
    '',
    'Código de ativação: '+license.code,
    'E-mail vinculado: '+to,
    'Plano: '+String(license.plan||'comercial'),
    'Computadores permitidos: '+limit,
    'Validade: '+(license.expiresAt||'sem vencimento informado'),
    '',
    'DOWNLOADS DIRETOS',
    'Windows: '+WIN,
    'Mac Apple Silicon: '+MAC_ARM,
    'Mac Intel: '+MAC_INTEL,
    '',
    'Manual PDF: '+MANUAL,
    'Pasta de materiais: '+DRIVE,
    'Também enviamos anexo um guia de instalação e ativação em PDF.',
    '',
    'COMO COMEÇAR',
    '1. Instale a versão compatível com seu computador.',
    '2. Abra o Obra na Mão conectado à internet.',
    '3. Quando solicitado, informe o código acima usando o e-mail cadastrado.',
    '4. Siga o assistente de primeiro acesso para configurar sua empresa.',
    '5. No Windows, aceite a opção de atualização quando uma versão nova aparecer.',
    '6. Para outros computadores, configure o acesso pela rede local do computador principal.',
    '',
    'Em caso de dúvidas, responda a esta mensagem.',
    'ArtiSys'
  ];
  const text=lines.join('\n');
  const html='<div style="font-family:Arial,sans-serif;color:#202a39;max-width:680px;line-height:1.6">'+
    '<h2>Seu acesso ao Obra na Mão está liberado</h2>'+
    '<p>Olá! A licença vinculada ao e-mail <strong>'+escaped(to)+'</strong> foi liberada.</p>'+
    '<p><strong>Código de ativação:</strong> <code style="font-size:18px">'+escaped(license.code)+'</code></p>'+
    '<p><strong>Plano:</strong> '+escaped(license.plan||'comercial')+' · <strong>Computadores:</strong> '+escaped(limit)+'</p>'+
    '<h3>Downloads diretos</h3><ul>'+
    '<li><a href="'+WIN+'">Windows</a></li><li><a href="'+MAC_ARM+'">Mac Apple Silicon</a></li>'+
    '<li><a href="'+MAC_INTEL+'">Mac Intel</a></li></ul>'+
    '<p><a href="'+MANUAL+'">Manual em PDF</a> · <a href="'+DRIVE+'">Pasta de materiais</a></p>'+
    '<p><strong>Primeiro acesso:</strong> instale, abra o aplicativo, informe seu código quando solicitado e siga a configuração. Um guia de instalação está anexado em PDF.</p>'+
    '<p>As atualizações do Windows são oferecidas automaticamente ao abrir o aplicativo com internet.</p>'+
    '<p>ArtiSys</p></div>';
  return {to,subject,text,html};
}

function pdfAscii(value:string){
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7E]/g,'?')
    .replace(/[\\()]/g,'\\$&');
}

// Small, standalone, one-page PDF; no paid renderer or external PDF service is required.
export function makeQuickStartPdf(license:Pick<License,'code'|'email'>):Uint8Array{
  const lines=[
    'OBRA NA MAO - GUIA DE INSTALACAO E ATIVACAO',
    '',
    'Este guia acompanha a liberacao da sua licenca pela ArtiSys.',
    'Email do cliente: '+String(license.email||''),
    'Codigo de ativacao: '+String(license.code||''),
    '',
    '1. Baixe o instalador do Windows ou Mac no email recebido.',
    '2. Execute o instalador. Nao desinstale versoes anteriores.',
    '3. Abra o programa conectado a internet.',
    '4. Informe o codigo de ativacao e o email cadastrado.',
    '5. Conclua o assistente de configuracao da empresa.',
    '6. No Windows, quando houver atualizacao, clique em baixar.',
    '7. Para uso em rede, configure o PC principal e depois os demais.',
    '',
    'MANUAL COMPLETO',
    'O email contem o link do manual PDF e dos arquivos do Drive.',
    '',
    'SUPORTE',
    'Responda ao email de liberacao enviado pela ArtiSys.',
    '',
    'Nunca compartilhe seu codigo de acesso publicamente.'
  ];
  const stream=['BT','/F1 11 Tf','50 777 Td','15 TL',...lines.map((line,i)=>'('+pdfAscii(line)+') Tj'+(i===lines.length-1?'':' T*')),'ET'].join('\n')+'\n';
  const objs=[
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Length '+new TextEncoder().encode(stream).length+' >>\nstream\n'+stream+'endstream'
  ];
  let pdf='%PDF-1.4\n';
  const offsets=[0];
  for(let i=0;i<objs.length;i++){offsets.push(new TextEncoder().encode(pdf).length);pdf+=(i+1)+' 0 obj\n'+objs[i]+'\nendobj\n'}
  const xref=new TextEncoder().encode(pdf).length;
  pdf+='xref\n0 '+(objs.length+1)+'\n0000000000 65535 f \n';
  for(let i=1;i<offsets.length;i++)pdf+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
  pdf+='trailer\n<< /Size '+(objs.length+1)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';
  return new TextEncoder().encode(pdf);
}

function base64(bytes:Uint8Array){
  let binary='';for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
  return btoa(binary);
}

export async function sendLicenseWelcome(license:License,env:DeliveryTransport,fetchImpl:typeof fetch=fetch){
  const message=buildLicenseWelcome(license);
  if(typeof env.EMAIL?.send==='function'){
    const from=String(env.EMAIL_FROM||'welcome@artisys.dev').trim();
    if(!EMAIL_RE.test(from))throw new Error('EMAIL_FROM_NOT_CONFIGURED');
    const response=await env.EMAIL.send({
      ...message,
      from:{name:'ArtiSys — Obra na Mão',email:from},
      attachments:[{filename:'Guia-de-Instalacao-Obra-na-Mao.pdf',type:'application/pdf',disposition:'attachment',content:base64(makeQuickStartPdf(license))}]
    });
    if(!response?.messageId)throw new Error('EMAIL_SEND_UNCONFIRMED');
    return {messageId:response.messageId};
  }
  if(!env.EMAIL_DELIVERY_URL||!env.EMAIL_DELIVERY_TOKEN||env.EMAIL_DELIVERY_TOKEN.length<32)throw new Error('EMAIL_TRANSPORT_NOT_CONFIGURED');
  const url=new URL(env.EMAIL_DELIVERY_URL);
  if(url.protocol!=='https:'||url.username||url.password||url.hash)throw new Error('EMAIL_BRIDGE_URL_INVALID');
  const result=await fetchImpl(url.toString(),{method:'POST',headers:{authorization:'Bearer '+env.EMAIL_DELIVERY_TOKEN,'content-type':'application/json'},redirect:'error',body:JSON.stringify({...message,link:MANUAL})});
  if(!result.ok)throw new Error('EMAIL_BRIDGE_FAILED');
  return {messageId:'bridge-confirmed'};
}

async function readRecord(id:string,env:DeliveryEnvironment):Promise<{record:DeliveryRecord;raw:string}|null>{
  const row=await env.DB.prepare('SELECT record_json FROM kv_records WHERE collection=? AND id=?').bind(COLLECTION,id).first<{record_json:string}>();
  if(!row)return null;
  return {record:JSON.parse(row.record_json) as DeliveryRecord,raw:row.record_json};
}
async function compareAndSet(id:string,raw:string,record:DeliveryRecord,env:DeliveryEnvironment){
  const stamp=now();
  const result=await env.DB.prepare('UPDATE kv_records SET record_json=?,updated_at=? WHERE collection=? AND id=? AND record_json=?')
    .bind(JSON.stringify(record),stamp,COLLECTION,id,raw).run() as {meta?:{changes?:number}};
  return Number(result.meta?.changes||0)===1;
}
export function safeDeliveryState(record:DeliveryRecord|null){
  return record?{status:record.status,attempts:record.attempts,sentAt:record.sentAt||null,updatedAt:record.updatedAt,error:record.error||null}:{status:'not_requested',attempts:0,sentAt:null,updatedAt:null,error:null};
}
export async function getLicenseDeliveryStatus(id:string,env:DeliveryEnvironment){
  return safeDeliveryState((await readRecord(id,env))?.record||null);
}
export async function enqueueLicenseDelivery(license:License,env:DeliveryEnvironment){
  if(!license.id||!validLicenseRecipient(license))return {status:'not_requested'};
  const stamp=now(),record:DeliveryRecord={email:normalizedEmail(license.email),status:'queued',attempts:0,createdAt:stamp,updatedAt:stamp};
  await env.DB.prepare('INSERT INTO kv_records(collection,id,record_json,created_at,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(collection,id) DO NOTHING')
    .bind(COLLECTION,license.id,JSON.stringify(record),stamp,stamp).run();
  return attemptLicenseDelivery(license.id,env);
}
export async function attemptLicenseDelivery(id:string,env:DeliveryEnvironment,force=false){
  const found=await readRecord(id,env);
  if(!found)return {status:'not_requested'};
  const {record,raw}=found;
  const stamp=now();
  if(!force){
    if(record.status==='sent')return safeDeliveryState(record);
    if(record.status==='sending'&&String(record.leaseUntil||'')>stamp)return safeDeliveryState(record);
    if(record.nextAttemptAt&&record.nextAttemptAt>stamp)return safeDeliveryState(record);
    if(record.attempts>=5)return safeDeliveryState(record);
  }
  const license=await getLicense(id,{DB:env.DB});
  if(!license||!validLicenseRecipient(license)||normalizedEmail(license.email)!==record.email)return {status:'not_requested'};
  const pending:DeliveryRecord={...record,status:'sending',attempts:force?1:record.attempts+1,updatedAt:stamp,leaseUntil:new Date(Date.now()+90_000).toISOString(),nextAttemptAt:undefined,error:undefined};
  if(!await compareAndSet(id,raw,pending,env))return getLicenseDeliveryStatus(id,env);
  const lock=JSON.stringify(pending);
  try{
    const sent=await sendLicenseWelcome(license,env);
    const success:DeliveryRecord={...pending,status:'sent',updatedAt:now(),sentAt:now(),messageId:sent.messageId,leaseUntil:undefined,error:undefined};
    await compareAndSet(id,lock,success,env);
    return safeDeliveryState(success);
  }catch(cause){
    const code=cause instanceof Error&&cause.message==='EMAIL_TRANSPORT_NOT_CONFIGURED'?'EMAIL_TRANSPORT_NOT_CONFIGURED':'EMAIL_SEND_FAILED';
    const minutes=Math.min(60,5*Math.pow(2,Math.max(0,pending.attempts-1)));
    const failed:DeliveryRecord={...pending,status:'failed',updatedAt:now(),error:code,leaseUntil:undefined,nextAttemptAt:new Date(Date.now()+minutes*60_000).toISOString()};
    await compareAndSet(id,lock,failed,env);
    return safeDeliveryState(failed);
  }
}
export async function resendLicenseDelivery(id:string,env:DeliveryEnvironment){
  const license=await getLicense(id,{DB:env.DB});
  if(!license||!validLicenseRecipient(license))throw new Error('LICENSE_EMAIL_NOT_ELIGIBLE');
  await enqueueLicenseDelivery(license,env);
  return attemptLicenseDelivery(id,env,true);
}
export async function drainLicenseDeliveries(env:DeliveryEnvironment){
  const rows=await env.DB.prepare("SELECT id FROM kv_records WHERE collection=? AND json_extract(record_json,'$.status') IN ('queued','failed','sending') ORDER BY updated_at ASC LIMIT 15")
    .bind(COLLECTION).all<{id:string}>();
  const results=[];
  for(const row of rows.results||[])results.push(await attemptLicenseDelivery(row.id,env));
  return results;
}
