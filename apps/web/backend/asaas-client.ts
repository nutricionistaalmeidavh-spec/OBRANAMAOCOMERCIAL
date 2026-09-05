export type AsaasClientEnv={ASAAS_API_KEY?:string;ASAAS_API_BASE_URL?:string}
export type AsaasCheckoutResult={customerId:string;paymentId:string;subscriptionId?:string;checkoutUrl:string;providerStatus:string}
type RecordValue=Record<string,unknown>
const asRecord=(value:unknown):RecordValue=>value&&typeof value==='object'&&!Array.isArray(value)?value as RecordValue:{}

function providerConfig(env:AsaasClientEnv){
  const credential=String(env.ASAAS_API_KEY||'').trim()
  const configuredBase=String(env.ASAAS_API_BASE_URL||'').trim().replace(/\/$/,'')
  if(!credential||!configuredBase)throw new Error('Asaas não configurado.')
  let parsed:URL
  try{parsed=new URL(configuredBase)}catch{throw new Error('Endpoint Asaas inválido.')}
  if(parsed.protocol!=='https:'||!['api.asaas.com','api-sandbox.asaas.com'].includes(parsed.hostname)||!parsed.pathname.startsWith('/v3'))throw new Error('Endpoint Asaas não permitido.')
  return{credential,base:parsed.toString().replace(/\/$/,'')}
}

async function providerRequest(env:AsaasClientEnv,path:string,init:RequestInit={}){
  const cfg=providerConfig(env)
  const headers=new Headers(init.headers)
  headers.set('accept','application/json');headers.set('content-type','application/json');headers.set('access_token',cfg.credential)
  const response=await fetch(cfg.base+path,{...init,headers}),raw=await response.text()
  let data:RecordValue={};try{data=asRecord(JSON.parse(raw))}catch{}
  if(!response.ok)throw new Error(`Asaas recusou a operação (${response.status}).`)
  return data
}

export async function createAsaasCheckout(env:AsaasClientEnv,input:{orderId:string;customerName:string;customerEmail:string;amountCents:number;planName:string;interval:'monthly'|'yearly'|'one_time'}):Promise<AsaasCheckoutResult>{
  if(!Number.isInteger(input.amountCents)||input.amountCents<=0)throw new Error('Valor de cobrança inválido.')
  const customer=await providerRequest(env,'/customers',{method:'POST',body:JSON.stringify({name:input.customerName.slice(0,120),email:input.customerEmail.slice(0,160),externalReference:input.orderId})}),customerId=String(customer.id||'')
  if(!customerId)throw new Error('Asaas não retornou o cliente.')
  const common={customer:customerId,billingType:'UNDEFINED',value:input.amountCents/100,description:`ArtiSys - ${input.planName}`.slice(0,500),externalReference:input.orderId},today=new Date().toISOString().slice(0,10)
  if(input.interval==='one_time'){
    const payment=await providerRequest(env,'/payments',{method:'POST',body:JSON.stringify({...common,dueDate:today})}),paymentId=String(payment.id||''),checkoutUrl=String(payment.invoiceUrl||'')
    if(!paymentId||!checkoutUrl)throw new Error('Asaas não retornou a cobrança.')
    return{customerId,paymentId,checkoutUrl,providerStatus:String(payment.status||'PENDING')}
  }
  const subscription=await providerRequest(env,'/subscriptions',{method:'POST',body:JSON.stringify({...common,nextDueDate:today,cycle:input.interval==='yearly'?'YEARLY':'MONTHLY'})}),subscriptionId=String(subscription.id||'')
  if(!subscriptionId)throw new Error('Asaas não retornou a assinatura.')
  const payments=await providerRequest(env,`/subscriptions/${encodeURIComponent(subscriptionId)}/payments?limit=1`),rows=Array.isArray(payments.data)?payments.data.map(asRecord):[],payment=rows[0]||{},paymentId=String(payment.id||''),checkoutUrl=String(payment.invoiceUrl||'')
  if(!paymentId||!checkoutUrl)throw new Error('Asaas não retornou a cobrança inicial da assinatura.')
  return{customerId,paymentId,subscriptionId,checkoutUrl,providerStatus:String(payment.status||'PENDING')}
}
