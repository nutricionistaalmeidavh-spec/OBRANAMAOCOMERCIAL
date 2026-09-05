export type AsaasClientEnv={ASAAS_API_KEY?:string;ASAAS_API_BASE_URL?:string}
export type AsaasCheckoutResult={customerId:string;paymentId:string;subscriptionId?:string;checkoutUrl:string;providerStatus:string}
export type AsaasReconciliationResult=AsaasCheckoutResult&{amountCents:number;externalReference:string}
type RecordValue=Record<string,unknown>
const asRecord=(value:unknown):RecordValue=>value&&typeof value==='object'&&!Array.isArray(value)?value as RecordValue:{}

function providerConfig(env:AsaasClientEnv){
  const credential=String(env.ASAAS_API_KEY||'').trim(),configuredBase=String(env.ASAAS_API_BASE_URL||'').trim().replace(/\/$/,'')
  if(!credential||!configuredBase)throw new Error('Asaas não configurado.')
  let parsed:URL;try{parsed=new URL(configuredBase)}catch{throw new Error('Endpoint Asaas inválido.')}
  if(parsed.protocol!=='https:'||!['api.asaas.com','api-sandbox.asaas.com'].includes(parsed.hostname)||!(parsed.pathname==='/v3'||parsed.pathname.startsWith('/v3/')))throw new Error('Endpoint Asaas não permitido.')
  return{credential,base:parsed.toString().replace(/\/$/,'')}
}

async function providerRequest(env:AsaasClientEnv,path:string,init:RequestInit={}){
  const cfg=providerConfig(env),headers=new Headers(init.headers);headers.set('accept','application/json');headers.set('content-type','application/json');headers.set('access_token',cfg.credential)
  const response=await fetch(cfg.base+path,{...init,headers}),raw=await response.text();let data:RecordValue={};try{data=asRecord(JSON.parse(raw))}catch{}
  if(!response.ok)throw new Error(`Asaas recusou a operação (${response.status}).`);return data
}
const rows=(body:RecordValue)=>Array.isArray(body.data)?body.data.map(asRecord):[]

export async function createAsaasCheckout(env:AsaasClientEnv,input:{orderId:string;customerName:string;customerEmail:string;amountCents:number;planName:string;interval:'monthly'|'yearly'|'one_time'}):Promise<AsaasCheckoutResult>{
  if(!Number.isInteger(input.amountCents)||input.amountCents<=0)throw new Error('Valor de cobrança inválido.')
  const customer=await providerRequest(env,'/customers',{method:'POST',body:JSON.stringify({name:input.customerName.slice(0,120),email:input.customerEmail.slice(0,160),externalReference:input.orderId})}),customerId=String(customer.id||'');if(!customerId)throw new Error('Asaas não retornou o cliente.')
  const common={customer:customerId,billingType:'UNDEFINED',value:input.amountCents/100,description:`ArtiSys - ${input.planName}`.slice(0,500),externalReference:input.orderId},today=new Date().toISOString().slice(0,10)
  if(input.interval==='one_time'){
    const payment=await providerRequest(env,'/payments',{method:'POST',body:JSON.stringify({...common,dueDate:today})}),paymentId=String(payment.id||''),checkoutUrl=String(payment.invoiceUrl||'');if(!paymentId||!checkoutUrl)throw new Error('Asaas não retornou a cobrança.')
    return{customerId,paymentId,checkoutUrl,providerStatus:String(payment.status||'PENDING')}
  }
  const subscription=await providerRequest(env,'/subscriptions',{method:'POST',body:JSON.stringify({...common,nextDueDate:today,cycle:input.interval==='yearly'?'YEARLY':'MONTHLY'})}),subscriptionId=String(subscription.id||'');if(!subscriptionId)throw new Error('Asaas não retornou a assinatura.')
  const payments=await providerRequest(env,`/subscriptions/${encodeURIComponent(subscriptionId)}/payments?limit=1`),payment=rows(payments)[0]||{},paymentId=String(payment.id||''),checkoutUrl=String(payment.invoiceUrl||'');if(!paymentId||!checkoutUrl)throw new Error('Asaas não retornou a cobrança inicial da assinatura.')
  return{customerId,paymentId,subscriptionId,checkoutUrl,providerStatus:String(payment.status||'PENDING')}
}

function reconciliationResult(payment:RecordValue,subscriptionId?:string):AsaasReconciliationResult|null{
  const paymentId=String(payment.id||''),customerId=String(payment.customer||''),checkoutUrl=String(payment.invoiceUrl||''),externalReference=String(payment.externalReference||''),amount=Number(payment.value||0)
  if(!paymentId||!customerId||!externalReference||!Number.isFinite(amount))return null
  return{customerId,paymentId,subscriptionId:subscriptionId||String(payment.subscription||'')||undefined,checkoutUrl,providerStatus:String(payment.status||'PENDING'),amountCents:Math.round(amount*100),externalReference}
}

export async function reconcileAsaasOrder(env:AsaasClientEnv,orderId:string):Promise<AsaasReconciliationResult|null>{
  const reference=orderId.trim();if(!reference)return null
  const direct=rows(await providerRequest(env,`/payments?externalReference=${encodeURIComponent(reference)}&limit=2`));if(direct.length>1)throw new Error('Mais de uma cobrança Asaas corresponde à ordem. Revisão manual necessária.');if(direct.length===1)return reconciliationResult(direct[0])
  const subscriptions=rows(await providerRequest(env,`/subscriptions?externalReference=${encodeURIComponent(reference)}&limit=2`));if(subscriptions.length>1)throw new Error('Mais de uma assinatura Asaas corresponde à ordem. Revisão manual necessária.');if(subscriptions.length!==1)return null
  const subscription=subscriptions[0],subscriptionId=String(subscription.id||'');if(!subscriptionId)return null
  const payments=rows(await providerRequest(env,`/subscriptions/${encodeURIComponent(subscriptionId)}/payments?limit=2`));if(payments.length>1)payments.sort((a,b)=>String(a.dateCreated||'').localeCompare(String(b.dateCreated||'')))
  const payment=payments[0];if(!payment)return null
  const normalized={...payment,externalReference:String(payment.externalReference||subscription.externalReference||reference),customer:String(payment.customer||subscription.customer||'')};return reconciliationResult(normalized,subscriptionId)
}
