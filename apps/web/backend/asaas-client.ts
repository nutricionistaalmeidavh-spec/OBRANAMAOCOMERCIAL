export type AsaasClientEnv={ASAAS_API_KEY?:string;ASAAS_API_BASE_URL?:string}
export type AsaasCheckoutResult={checkoutId:string;checkoutUrl:string;providerStatus:string}
export type AsaasReconciliationResult={customerId:string;paymentId:string;subscriptionId?:string;checkoutUrl:string;providerStatus:string;amountCents:number;externalReference:string}
export type AsaasFailureKind='definitive'|'unknown'

type RecordValue=Record<string,unknown>
const asRecord=(value:unknown):RecordValue=>value&&typeof value==='object'&&!Array.isArray(value)?value as RecordValue:{}

export class AsaasRequestError extends Error{
  readonly kind:AsaasFailureKind
  readonly status?:number
  constructor(message:string,kind:AsaasFailureKind,status?:number){super(message);this.name='AsaasRequestError';this.kind=kind;this.status=status}
}
export const isUnknownAsaasOutcome=(cause:unknown)=>cause instanceof AsaasRequestError&&cause.kind==='unknown'

function providerConfig(env:AsaasClientEnv){
  const credential=String(env.ASAAS_API_KEY||'').trim(),configuredBase=String(env.ASAAS_API_BASE_URL||'').trim().replace(/\/$/,'')
  if(!credential||!configuredBase)throw new Error('Asaas não configurado.')
  let parsed:URL;try{parsed=new URL(configuredBase)}catch{throw new Error('Endpoint Asaas inválido.')}
  if(parsed.protocol!=='https:'||!['api.asaas.com','api-sandbox.asaas.com'].includes(parsed.hostname)||!(parsed.pathname==='/v3'||parsed.pathname.startsWith('/v3/')))throw new Error('Endpoint Asaas não permitido.')
  return{credential,base:parsed.toString().replace(/\/$/,'')}
}

function unknownHttpStatus(status:number){return status===408||status===425||status===429||status>=500}
async function providerRequest(env:AsaasClientEnv,path:string,init:RequestInit={}){
  const cfg=providerConfig(env),headers=new Headers(init.headers);headers.set('accept','application/json');headers.set('content-type','application/json');headers.set('access_token',cfg.credential)
  let response:Response
  try{response=await fetch(cfg.base+path,{...init,headers})}catch{throw new AsaasRequestError('Não foi possível confirmar a resposta do Asaas.','unknown')}
  const raw=await response.text();let data:RecordValue={};try{data=asRecord(JSON.parse(raw))}catch{}
  if(!response.ok)throw new AsaasRequestError(`Asaas recusou a operação (${response.status}).`,unknownHttpStatus(response.status)?'unknown':'definitive',response.status)
  return data
}
const rows=(body:RecordValue)=>Array.isArray(body.data)?body.data.map(asRecord):[]
const isoDate=()=>new Date().toISOString().slice(0,10)
function checkoutLink(id:string,body:RecordValue,env:AsaasClientEnv){
  const cfg=providerConfig(env),sandbox=new URL(cfg.base).hostname==='api-sandbox.asaas.com',fallback=sandbox?`https://sandbox.asaas.com/checkoutSession/show/${encodeURIComponent(id)}`:`https://asaas.com/checkoutSession/show?id=${encodeURIComponent(id)}`,candidate=String(body.link||body.url||fallback).trim()
  let parsed:URL;try{parsed=new URL(candidate)}catch{throw new Error('Asaas retornou link de checkout inválido.')}
  if(parsed.protocol!=='https:'||!['asaas.com','sandbox.asaas.com'].includes(parsed.hostname)||!parsed.pathname.startsWith('/checkoutSession/'))throw new Error('Asaas retornou link de checkout não permitido.')
  return parsed.toString()
}
export function asaasCheckoutUrl(env:AsaasClientEnv,checkoutId:string,candidate?:string){return checkoutLink(checkoutId,candidate?{link:candidate}:{},env)}
function safeCallbackBase(value:string){let url:URL;try{url=new URL(value)}catch{throw new Error('Origem de callback inválida.')};if(url.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(url.hostname))throw new Error('Origem de callback insegura.');return url.origin}

export async function createAsaasCheckout(env:AsaasClientEnv,input:{orderId:string;amountCents:number;planName:string;interval:'monthly'|'yearly'|'one_time';callbackBaseUrl:string}):Promise<AsaasCheckoutResult>{
  if(!Number.isInteger(input.amountCents)||input.amountCents<=0)throw new Error('Valor de cobrança inválido.')
  const orderId=input.orderId.trim();if(!orderId)throw new Error('Ordem de cobrança inválida.')
  const base=safeCallbackBase(input.callbackBaseUrl),recurring=input.interval!=='one_time'
  const body:RecordValue={
    billingTypes:recurring?['CREDIT_CARD']:['PIX','CREDIT_CARD'],
    chargeTypes:[recurring?'RECURRENT':'DETACHED'],
    minutesToExpire:60,
    externalReference:orderId,
    items:[{name:input.planName.slice(0,120),quantity:1,value:input.amountCents/100}],
    callback:{
      successUrl:`${base}/sistema.html#assinatura?pedido=${encodeURIComponent(orderId)}`,
      cancelUrl:`${base}/sistema.html#planos`,
      expiredUrl:`${base}/sistema.html#planos`,
    },
  }
  if(recurring)body.subscription={cycle:input.interval==='yearly'?'YEARLY':'MONTHLY',nextDueDate:isoDate()}
  const checkout=await providerRequest(env,'/checkouts',{method:'POST',body:JSON.stringify(body)}),checkoutId=String(checkout.id||'').trim()
  if(!checkoutId)throw new AsaasRequestError('Asaas não retornou o checkout.','unknown')
  return{checkoutId,checkoutUrl:checkoutLink(checkoutId,checkout,env),providerStatus:String(checkout.status||'ACTIVE')}
}

function reconciliationResult(payment:RecordValue,subscriptionId?:string):AsaasReconciliationResult|null{
  const paymentId=String(payment.id||''),customerId=String(payment.customer||''),checkoutUrl=String(payment.invoiceUrl||''),externalReference=String(payment.externalReference||''),amount=Number(payment.value||0)
  if(!paymentId||!customerId||!externalReference||!Number.isFinite(amount))return null
  return{customerId,paymentId,subscriptionId:subscriptionId||String(payment.subscription||'')||undefined,checkoutUrl,providerStatus:String(payment.status||'PENDING'),amountCents:Math.round(amount*100),externalReference}
}

// Mantido para reconciliar ordens legadas criadas antes da migração para Hosted Checkout.
export async function reconcileAsaasOrder(env:AsaasClientEnv,orderId:string):Promise<AsaasReconciliationResult|null>{
  const reference=orderId.trim();if(!reference)return null
  const direct=rows(await providerRequest(env,`/payments?externalReference=${encodeURIComponent(reference)}&limit=2`));if(direct.length>1)throw new Error('Mais de uma cobrança Asaas corresponde à ordem. Revisão manual necessária.');if(direct.length===1)return reconciliationResult(direct[0])
  const subscriptions=rows(await providerRequest(env,`/subscriptions?externalReference=${encodeURIComponent(reference)}&limit=2`));if(subscriptions.length>1)throw new Error('Mais de uma assinatura Asaas corresponde à ordem. Revisão manual necessária.');if(subscriptions.length!==1)return null
  const subscription=subscriptions[0],subscriptionId=String(subscription.id||'');if(!subscriptionId)return null
  const payments=rows(await providerRequest(env,`/subscriptions/${encodeURIComponent(subscriptionId)}/payments?limit=2`));if(payments.length>1)payments.sort((a,b)=>String(a.dateCreated||'').localeCompare(String(b.dateCreated||'')))
  const payment=payments[0];if(!payment)return null
  const normalized={...payment,externalReference:String(payment.externalReference||subscription.externalReference||reference),customer:String(payment.customer||subscription.customer||'')};return reconciliationResult(normalized,subscriptionId)
}
