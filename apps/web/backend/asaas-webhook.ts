import { processAsaasWebhookPayload } from './billing-service'

export type AsaasWebhookEnv={ASAAS_WEBHOOK_TOKEN?:string;ASAAS_API_KEY?:string;ASAAS_API_BASE_URL?:string;DB?:D1Database}
type AsaasWebhookPayload={id?:string;event?:string;payment?:Record<string,unknown>;checkout?:Record<string,unknown>;subscription?:Record<string,unknown>;[key:string]:unknown}

function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}})}
function constantTimeEqual(received:string,expected:string){if(received.length!==expected.length)return false;let mismatch=0;for(let i=0;i<received.length;i++)mismatch|=received.charCodeAt(i)^expected.charCodeAt(i);return mismatch===0}

export async function handleAsaasWebhook(request:Request,env:AsaasWebhookEnv){
  if(request.method==='GET')return json({ok:true,service:'asaas-webhook',version:2})
  if(request.method!=='POST')return json({error:'Método não permitido.'},405)
  const expectedToken=String(env.ASAAS_WEBHOOK_TOKEN||'').trim();if(!expectedToken)return json({error:'Webhook temporariamente indisponível.'},503)
  const receivedToken=request.headers.get('asaas-access-token')||'';if(!receivedToken||!constantTimeEqual(receivedToken,expectedToken))return json({error:'Webhook não autorizado.'},401)
  if(!env.DB)return json({error:'Persistência de cobrança indisponível.'},503)
  let payload:AsaasWebhookPayload;try{payload=await request.json() as AsaasWebhookPayload}catch{return json({error:'Payload inválido.'},400)}
  if(!String(payload.id||'').trim()||!String(payload.event||'').trim())return json({error:'Evento inválido.'},400)
  try{const result=await processAsaasWebhookPayload(env as Required<Pick<AsaasWebhookEnv,'DB'>>&AsaasWebhookEnv,payload);return json({received:true,event:String(payload.event),...result})}catch(cause){console.error('Asaas webhook processing failed',{eventId:String(payload.id||''),event:String(payload.event||''),error:cause instanceof Error?cause.message:'processing_error'});return json({error:'Evento recebido, mas o processamento falhou e deverá ser reenviado.'},500)}
}
