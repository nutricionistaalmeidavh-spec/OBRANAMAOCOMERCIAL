import type { AuthUser, RuntimeEnv } from '../cloudflare/sdk'
import { createAsaasCheckout } from './asaas-client'
import { canApplyProviderTransition, normalizeAsaasEvent, validatePaidCheckout, validatePaidOrder, type FinancialStatus } from './billing-policy'
import { LICENSE_CHANNELS, LICENSE_MODULES, activateOrRenewBillingLicense, revokeBillingLicense } from './license-service'

type BillingEnv=RuntimeEnv&{ASAAS_API_KEY?:string;ASAAS_API_BASE_URL?:string;ASAAS_WEBHOOK_TOKEN?:string}
type Plan={id:string;plan_code:string;version:number;name:string;price_cents:number;currency:string;interval_code:'monthly'|'yearly'|'one_time';modules_json:string;channels_json:string;max_users:number;max_projects:number;max_devices:number;active:number}
type Order={id:string;user_id:string;user_email:string;company_id:string|null;requested_company_name:string;plan_version_id:string;amount_cents:number;currency:string;financial_status:FinancialStatus;idempotency_key:string;provider:string;provider_customer_id:string|null;provider_payment_id:string|null;provider_subscription_id:string|null;provider_checkout_id:string|null;provider_status:string|null;checkout_url:string|null;license_id:string|null;reconciliation_required:number;created_at:string;updated_at:string}
type Subscription={id:string;company_id:string|null;user_id:string;user_email:string;plan_version_id:string;provider:string;provider_customer_id:string|null;provider_subscription_id:string|null;financial_status:FinancialStatus;current_period_end:string|null;license_id:string|null;initial_order_id:string|null;created_at:string;updated_at:string}
type ProviderPayload={id?:string;event?:string;dateCreated?:string;payment?:Record<string,unknown>;checkout?:Record<string,unknown>;subscription?:Record<string,unknown>;[key:string]:unknown}

const now=()=>new Date().toISOString(),id=()=>crypto.randomUUID().replace(/-/g,''),rec=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{}
const arr=(value:string)=>{try{const x=JSON.parse(value);return Array.isArray(x)?x.map(String):[]}catch{return[]}}
async function first<T>(env:BillingEnv,sql:string,...bind:unknown[]){return env.DB.prepare(sql).bind(...bind).first<T>()}
async function planById(env:BillingEnv,planId:string){return first<Plan>(env,'SELECT * FROM billing_plan_versions WHERE id=?',planId)}
async function activePlan(env:BillingEnv,code:string){return first<Plan>(env,'SELECT * FROM billing_plan_versions WHERE plan_code=? AND active=1 ORDER BY version DESC LIMIT 1',code)}
async function orderById(env:BillingEnv,orderId:string){return first<Order>(env,'SELECT * FROM billing_orders WHERE id=?',orderId)}
async function orderByPayment(env:BillingEnv,paymentId:string){return first<Order>(env,'SELECT * FROM billing_orders WHERE provider=? AND provider_payment_id=?','asaas',paymentId)}
async function orderByCheckout(env:BillingEnv,checkoutId:string){return first<Order>(env,'SELECT * FROM billing_orders WHERE provider=? AND provider_checkout_id=?','asaas',checkoutId)}
async function subscriptionByProvider(env:BillingEnv,subscriptionId:string){return first<Subscription>(env,'SELECT * FROM billing_subscriptions WHERE provider=? AND provider_subscription_id=?','asaas',subscriptionId)}

export async function listActivePlans(env:BillingEnv){const rows=await env.DB.prepare('SELECT id,plan_code,version,name,price_cents,currency,interval_code FROM billing_plan_versions WHERE active=1 ORDER BY price_cents ASC').all<Plan>();return rows.results||[]}

export async function createPlanVersion(env:BillingEnv,input:{planCode:string;name:string;priceCents:number;interval:string;modules:string[];channels:string[];maxUsers:number;maxProjects:number;maxDevices:number}){
  const planCode=input.planCode.trim().toLowerCase().replace(/[^a-z0-9_-]/g,'').slice(0,40),name=input.name.trim().slice(0,120),priceCents=Math.floor(input.priceCents),interval=(['monthly','yearly','one_time'].includes(input.interval)?input.interval:'monthly') as Plan['interval_code'],modules=Array.from(new Set(input.modules.filter(x=>(LICENSE_MODULES as readonly string[]).includes(x)))),channels=Array.from(new Set(input.channels.filter(x=>(LICENSE_CHANNELS as readonly string[]).includes(x))))
  if(!planCode||!name||priceCents<=0||!modules.length||!channels.length)throw new Error('Plano comercial inválido.')
  const current=await first<{version:number}>(env,'SELECT MAX(version) AS version FROM billing_plan_versions WHERE plan_code=?',planCode),version=Number(current?.version||0)+1,planId=id(),stamp=now()
  await env.DB.prepare('UPDATE billing_plan_versions SET active=0 WHERE plan_code=?').bind(planCode).run()
  await env.DB.prepare(`INSERT INTO billing_plan_versions(id,plan_code,version,name,price_cents,currency,interval_code,modules_json,channels_json,max_users,max_projects,max_devices,active,created_at) VALUES(?,?,?,?,?,'BRL',?,?,?,?,?,?,1,?)`).bind(planId,planCode,version,name,priceCents,interval,JSON.stringify(modules),JSON.stringify(channels),Math.max(1,Math.min(999,Math.floor(input.maxUsers||10))),Math.max(1,Math.min(999,Math.floor(input.maxProjects||5))),Math.max(1,Math.min(999,Math.floor(input.maxDevices||2))),stamp).run()
  return activePlan(env,planCode)
}

export async function checkoutForUser(env:BillingEnv,user:AuthUser,input:{planCode:string;companyName:string;idempotencyKey:string;callbackBaseUrl:string}){
  const idem=input.idempotencyKey.trim(),companyName=input.companyName.trim().replace(/[\u0000-\u001f]/g,' ').slice(0,120),email=String(user.email||'').trim().toLowerCase()
  if(!email||idem.length<16||idem.length>120||!companyName)return{ok:false as const,status:400,error:'Dados de contratação inválidos.'}
  const existing=await first<Order>(env,'SELECT * FROM billing_orders WHERE user_id=? AND idempotency_key=?',user.userId,idem);if(existing)return{ok:true as const,order:existing,reused:true}
  const plan=await activePlan(env,input.planCode.trim().toLowerCase());if(!plan)return{ok:false as const,status:404,error:'Plano indisponível.'}
  const orderId=id(),stamp=now()
  try{await env.DB.prepare(`INSERT INTO billing_orders(id,user_id,user_email,requested_company_name,plan_version_id,amount_cents,currency,financial_status,idempotency_key,provider,created_at,updated_at) VALUES(?,?,?,?,?,?,'BRL','created',?,'asaas',?,?)`).bind(orderId,user.userId,email,companyName,plan.id,plan.price_cents,idem,stamp,stamp).run()}catch{const raced=await first<Order>(env,'SELECT * FROM billing_orders WHERE user_id=? AND idempotency_key=?',user.userId,idem);if(raced)return{ok:true as const,order:raced,reused:true};throw new Error('Não foi possível registrar a ordem.')}
  try{
    const provider=await createAsaasCheckout(env,{orderId,amountCents:plan.price_cents,planName:plan.name,interval:plan.interval_code,callbackBaseUrl:input.callbackBaseUrl}),updated=now()
    await env.DB.prepare(`UPDATE billing_orders SET financial_status='pending',provider_checkout_id=?,provider_status=?,checkout_url=?,updated_at=? WHERE id=? AND financial_status='created'`).bind(provider.checkoutId,provider.providerStatus,provider.checkoutUrl,updated,orderId).run()
    return{ok:true as const,order:await orderById(env,orderId),reused:false}
  }catch(cause){await env.DB.prepare(`UPDATE billing_orders SET reconciliation_required=1,provider_status='UNKNOWN',updated_at=? WHERE id=?`).bind(now(),orderId).run();return{ok:false as const,status:502,error:'Checkout criado com estado incerto. Não tente novamente com outra chave; a reconciliação é necessária.',orderId,details:cause instanceof Error?cause.message:'provider_error'}}
}

async function ensureCompany(env:BillingEnv,order:Order,plan:Plan){
  if(order.company_id)return order.company_id
  const companyId=`billing_${order.id}`,stamp=now(),record={name:order.requested_company_name,createdAt:stamp,createdBy:order.user_id,tenantVersion:1,attendanceTimesheetMode:'disabled',licensedModules:arr(plan.modules_json),licensedChannels:arr(plan.channels_json),billingOrderId:order.id}
  await env.DB.prepare(`INSERT OR IGNORE INTO kv_records(collection,id,record_json,created_at,updated_at) VALUES('companies',?,?,?,?)`).bind(companyId,JSON.stringify(record),stamp,stamp).run()
  await env.DB.prepare('UPDATE billing_orders SET company_id=?,updated_at=? WHERE id=? AND company_id IS NULL').bind(companyId,stamp,order.id).run();return companyId
}

async function bindCompanyLicense(env:BillingEnv,companyId:string,licenseId:string,plan:Plan){
  const row=await env.DB.prepare(`SELECT record_json FROM kv_records WHERE collection='companies' AND id=?`).bind(companyId).first<{record_json:string}>();if(!row)throw new Error('Empresa de cobrança não encontrada.')
  const record=rec(JSON.parse(row.record_json)),updated={...record,licenseId,licensedModules:arr(plan.modules_json),licensedChannels:arr(plan.channels_json)};await env.DB.prepare(`UPDATE kv_records SET record_json=?,updated_at=? WHERE collection='companies' AND id=?`).bind(JSON.stringify(updated),now(),companyId).run()
}

function checkoutItemsAmount(checkout:Record<string,unknown>){const items=Array.isArray(checkout.items)?checkout.items.map(rec):[];if(!items.length)return 0;const total=items.reduce((sum,item)=>sum+(Number(item.quantity||0)*Number(item.value||0)),0);return Number.isFinite(total)?Math.round(total*100):0}
function providerData(payload:ProviderPayload){
  const payment=rec(payload.payment),checkout=rec(payload.checkout),subscription=rec(payload.subscription),checkoutId=String(checkout.id||''),paymentId=String(payment.id||checkout.paymentId||''),subscriptionId=String(payment.subscription||subscription.id||checkout.subscriptionId||''),customerId=String(payment.customer||subscription.customer||checkout.customer||''),externalReference=String(payment.externalReference||checkout.externalReference||subscription.externalReference||''),paymentValue=Number(payment.value||0),checkoutValue=checkoutItemsAmount(checkout),amountCents=paymentValue>0&&Number.isFinite(paymentValue)?Math.round(paymentValue*100):checkoutValue
  return{payment,checkout,subscription,checkoutId,paymentId,subscriptionId,customerId,externalReference,amountCents}
}
async function markEvent(env:BillingEnv,eventId:string,status:string,errorMessage?:string){await env.DB.prepare(`UPDATE billing_provider_events SET processing_status=?,attempt_count=attempt_count+1,last_error=?,processed_at=CASE WHEN ?='processed' THEN ? ELSE processed_at END,updated_at=? WHERE provider='asaas' AND provider_event_id=?`).bind(status,errorMessage||null,status,now(),now(),eventId).run()}

async function activateOrder(env:BillingEnv,order:Order,plan:Plan,eventId:string,eventType:string,data:ReturnType<typeof providerData>){
  const hosted=eventType==='CHECKOUT_PAID'||!!order.provider_checkout_id
  const valid=eventType==='CHECKOUT_PAID'
    ?validatePaidCheckout({orderAmountCents:order.amount_cents,providerAmountCents:data.amountCents,providerCheckoutId:data.checkoutId,expectedCheckoutId:String(order.provider_checkout_id||''),externalReference:data.externalReference,orderId:order.id})
    :validatePaidOrder({orderAmountCents:order.amount_cents,providerAmountCents:data.amountCents,providerPaymentId:data.paymentId,expectedPaymentId:String(order.provider_payment_id||''),externalReference:data.externalReference,orderId:order.id})
  if(!valid.ok)throw new Error(`Pagamento rejeitado: ${valid.reason}`)
  const companyId=await ensureCompany(env,order,plan),sub=order.provider_subscription_id?await subscriptionByProvider(env,order.provider_subscription_id):null,license=await activateOrRenewBillingLicense({licenseId:order.license_id||sub?.license_id||undefined,email:order.user_email,companyId,plan:plan.plan_code,modules:arr(plan.modules_json),channels:arr(plan.channels_json),maxUsers:plan.max_users,maxProjects:plan.max_projects,maxDevices:plan.max_devices,interval:plan.interval_code,orderId:order.id,userId:order.user_id},{DB:env.DB})
  await bindCompanyLicense(env,companyId,license.id!,plan);const stamp=now()
  await env.DB.prepare(`UPDATE billing_orders SET company_id=?,license_id=?,provider_customer_id=COALESCE(NULLIF(?,''),provider_customer_id),provider_payment_id=COALESCE(NULLIF(?,''),provider_payment_id),provider_subscription_id=COALESCE(NULLIF(?,''),provider_subscription_id),provider_checkout_id=COALESCE(NULLIF(?,''),provider_checkout_id),financial_status='paid',provider_status=?,reconciliation_required=0,updated_at=? WHERE id=?`).bind(companyId,license.id,data.customerId,data.paymentId,data.subscriptionId,data.checkoutId,eventType,stamp,order.id).run()
  if(data.paymentId)await env.DB.prepare(`INSERT INTO billing_payments(id,order_id,subscription_id,provider,provider_payment_id,provider_status,financial_status,amount_cents,paid_at,created_at,updated_at) VALUES(?,?,?,?,?,?,'paid',?,?,?,?) ON CONFLICT(provider,provider_payment_id) DO UPDATE SET order_id=COALESCE(billing_payments.order_id,excluded.order_id),subscription_id=COALESCE(billing_payments.subscription_id,excluded.subscription_id),financial_status='paid',provider_status=excluded.provider_status,paid_at=excluded.paid_at,updated_at=excluded.updated_at`).bind(id(),order.id,sub?.id||null,'asaas',data.paymentId,String(data.payment.status||eventType),order.amount_cents,stamp,stamp,stamp).run()
  if(order.provider_subscription_id||data.subscriptionId)await env.DB.prepare(`UPDATE billing_subscriptions SET company_id=?,license_id=?,financial_status='paid',current_period_end=?,updated_at=? WHERE provider='asaas' AND provider_subscription_id=?`).bind(companyId,license.id,license.expiresAt||null,stamp,order.provider_subscription_id||data.subscriptionId).run()
  if(hosted&&eventType!=='CHECKOUT_PAID')throw new Error('Checkout hospedado requer confirmação CHECKOUT_PAID.')
  return license
}

async function recordInitialPayment(env:BillingEnv,order:Order,subscription:Subscription|null,eventType:string,data:ReturnType<typeof providerData>){
  if(!data.paymentId)return
  if(data.externalReference&&data.externalReference!==order.id)throw new Error('Cobrança inicial com vínculo divergente.')
  if(data.amountCents!==order.amount_cents)throw new Error('Valor da cobrança inicial divergente.')
  if(order.provider_payment_id&&order.provider_payment_id!==data.paymentId)throw new Error('Ordem já vinculada a outra cobrança.')
  const stamp=now()
  await env.DB.prepare(`UPDATE billing_orders SET provider_customer_id=COALESCE(NULLIF(?,''),provider_customer_id),provider_payment_id=?,provider_subscription_id=COALESCE(NULLIF(?,''),provider_subscription_id),provider_status=?,updated_at=? WHERE id=?`).bind(data.customerId,data.paymentId,data.subscriptionId,eventType,stamp,order.id).run()
  await env.DB.prepare(`INSERT INTO billing_payments(id,order_id,subscription_id,provider,provider_payment_id,provider_status,financial_status,amount_cents,paid_at,created_at,updated_at) VALUES(?,?,?,?,?,?,'paid',?,?,?,?) ON CONFLICT(provider,provider_payment_id) DO UPDATE SET order_id=COALESCE(billing_payments.order_id,excluded.order_id),subscription_id=COALESCE(billing_payments.subscription_id,excluded.subscription_id),financial_status='paid',provider_status=excluded.provider_status,paid_at=excluded.paid_at,updated_at=excluded.updated_at`).bind(id(),order.id,subscription?.id||null,'asaas',data.paymentId,String(data.payment.status||eventType),order.amount_cents,stamp,stamp,stamp).run()
}

async function bindSubscriptionCreated(env:BillingEnv,order:Order,data:ReturnType<typeof providerData>){
  if(!data.subscriptionId)throw new Error('Assinatura Asaas sem identificador.')
  if(order.provider_subscription_id&&order.provider_subscription_id!==data.subscriptionId)throw new Error('Ordem já vinculada a outra assinatura.')
  const stamp=now(),financial=order.financial_status==='paid'?'paid':'pending'
  await env.DB.prepare(`UPDATE billing_orders SET provider_customer_id=COALESCE(NULLIF(?,''),provider_customer_id),provider_subscription_id=?,updated_at=? WHERE id=?`).bind(data.customerId,data.subscriptionId,stamp,order.id).run()
  await env.DB.prepare(`INSERT INTO billing_subscriptions(id,company_id,user_id,user_email,plan_version_id,provider,provider_customer_id,provider_subscription_id,financial_status,license_id,initial_order_id,created_at,updated_at) VALUES(?,?,?,?,?,'asaas',?,?,?,?,?,?,?) ON CONFLICT(provider,provider_subscription_id) DO UPDATE SET company_id=COALESCE(excluded.company_id,billing_subscriptions.company_id),provider_customer_id=COALESCE(excluded.provider_customer_id,billing_subscriptions.provider_customer_id),financial_status=CASE WHEN billing_subscriptions.financial_status='paid' THEN 'paid' ELSE excluded.financial_status END,license_id=COALESCE(excluded.license_id,billing_subscriptions.license_id),initial_order_id=COALESCE(billing_subscriptions.initial_order_id,excluded.initial_order_id),updated_at=excluded.updated_at`).bind(id(),order.company_id,order.user_id,order.user_email,order.plan_version_id,data.customerId||null,data.subscriptionId,financial,order.license_id,order.id,stamp,stamp).run()
}

async function processRenewal(env:BillingEnv,subscription:Subscription,plan:Plan,eventId:string,data:ReturnType<typeof providerData>){
  if(!subscription.company_id||!subscription.license_id)throw new Error('Assinatura sem empresa/licença vinculada.')
  if(!data.paymentId||data.amountCents!==plan.price_cents)throw new Error('Valor ou cobrança de renovação divergente.')
  const existing=await first<{id:string;financial_status:FinancialStatus}>(env,'SELECT id,financial_status FROM billing_payments WHERE provider=? AND provider_payment_id=?','asaas',data.paymentId)
  if(existing?.financial_status==='paid'||existing?.financial_status==='refunded')return
  const license=await activateOrRenewBillingLicense({licenseId:subscription.license_id,email:subscription.user_email,companyId:subscription.company_id,plan:plan.plan_code,modules:arr(plan.modules_json),channels:arr(plan.channels_json),maxUsers:plan.max_users,maxProjects:plan.max_projects,maxDevices:plan.max_devices,interval:plan.interval_code,orderId:`renewal:${eventId}`,userId:subscription.user_id},{DB:env.DB}),stamp=now()
  if(existing)await env.DB.prepare(`UPDATE billing_payments SET provider_status=?,financial_status='paid',amount_cents=?,paid_at=?,updated_at=? WHERE id=?`).bind(String(data.payment.status||'PAID'),plan.price_cents,stamp,stamp,existing.id).run()
  else await env.DB.prepare(`INSERT INTO billing_payments(id,subscription_id,provider,provider_payment_id,provider_status,financial_status,amount_cents,paid_at,created_at,updated_at) VALUES(?,?,'asaas',?,?,'paid',?,?,?,?)`).bind(id(),subscription.id,data.paymentId,String(data.payment.status||'PAID'),plan.price_cents,stamp,stamp,stamp).run()
  await env.DB.prepare(`UPDATE billing_subscriptions SET financial_status='paid',current_period_end=?,updated_at=? WHERE id=?`).bind(license.expiresAt||null,stamp,subscription.id).run()
}

async function processSubscriptionPaymentState(env:BillingEnv,subscription:Subscription,plan:Plan,next:FinancialStatus,eventType:string,data:ReturnType<typeof providerData>){
  if(!data.paymentId)return
  if(data.amountCents>0&&data.amountCents!==plan.price_cents)throw new Error('Valor da cobrança da assinatura divergente.')
  const existing=await first<{id:string;financial_status:FinancialStatus;paid_at:string|null}>(env,'SELECT id,financial_status,paid_at FROM billing_payments WHERE provider=? AND provider_payment_id=?','asaas',data.paymentId)
  if(existing&&!canApplyProviderTransition(existing.financial_status,next))return
  const stamp=now(),amount=data.amountCents||plan.price_cents
  if(existing)await env.DB.prepare('UPDATE billing_payments SET provider_status=?,financial_status=?,amount_cents=?,updated_at=? WHERE id=?').bind(eventType,next,amount,stamp,existing.id).run()
  else await env.DB.prepare(`INSERT INTO billing_payments(id,subscription_id,provider,provider_payment_id,provider_status,financial_status,amount_cents,created_at,updated_at) VALUES(?,?,'asaas',?,?,?,?,?,?)`).bind(id(),subscription.id,data.paymentId,eventType,next,amount,stamp,stamp).run()
  if(next==='overdue'){
    const dueDate=String(data.payment.dueDate||'').slice(0,10),currentEnd=String(subscription.current_period_end||'').slice(0,10)
    if(!currentEnd||!dueDate||dueDate>=currentEnd)await env.DB.prepare(`UPDATE billing_subscriptions SET financial_status='overdue',updated_at=? WHERE id=?`).bind(stamp,subscription.id).run()
  }
  if(next==='refunded'&&subscription.license_id){
    const latest=await first<{provider_payment_id:string}>(env,`SELECT provider_payment_id FROM billing_payments WHERE subscription_id=? AND financial_status IN ('paid','refunded') ORDER BY COALESCE(paid_at,updated_at) DESC LIMIT 1`,subscription.id)
    if(latest?.provider_payment_id===data.paymentId){await env.DB.prepare(`UPDATE billing_subscriptions SET financial_status='refunded',updated_at=? WHERE id=?`).bind(stamp,subscription.id).run();await revokeBillingLicense(subscription.license_id,{source:'billing',email:subscription.user_email,userId:subscription.user_id,orderId:`refund:${data.paymentId}`},'Renovação estornada',{DB:env.DB})}
  }
}

export async function processAsaasWebhookPayload(env:BillingEnv,payload:ProviderPayload){
  const eventId=String(payload.id||'').trim(),eventType=String(payload.event||'').trim().toUpperCase();if(!eventId||!eventType)throw new Error('Evento Asaas sem identificador/tipo.')
  const data=providerData(payload),stamp=now(),insert=await env.DB.prepare(`INSERT OR IGNORE INTO billing_provider_events(id,provider,provider_event_id,event_type,provider_payment_id,provider_subscription_id,external_reference,processing_status,payload_json,occurred_at,created_at,updated_at) VALUES(?,'asaas',?,?,?,?,?,'received',?,?,?,?,?)`).bind(id(),eventId,eventType,data.paymentId||null,data.subscriptionId||null,data.externalReference||null,JSON.stringify(payload),String(payload.dateCreated||'')||null,stamp,stamp).run() as {meta?:{changes?:number}}
  const stored=await first<{processing_status:string}>(env,'SELECT processing_status FROM billing_provider_events WHERE provider=? AND provider_event_id=?','asaas',eventId);if(Number(insert.meta?.changes||0)===0&&stored?.processing_status==='processed')return{duplicate:true,processed:true}
  try{
    const next=normalizeAsaasEvent(eventType)
    let order=data.externalReference?await orderById(env,data.externalReference):null;if(!order&&data.checkoutId)order=await orderByCheckout(env,data.checkoutId);if(!order&&data.paymentId)order=await orderByPayment(env,data.paymentId)
    let subscription=data.subscriptionId?await subscriptionByProvider(env,data.subscriptionId):order?.provider_subscription_id?await subscriptionByProvider(env,order.provider_subscription_id):null
    if(!order&&subscription?.initial_order_id&&(!data.paymentId||!subscription.company_id)){order=await orderById(env,subscription.initial_order_id)}

    if(eventType==='SUBSCRIPTION_CREATED'){
      if(!order)throw new Error('Assinatura sem ordem vinculada.')
      await bindSubscriptionCreated(env,order,data);subscription=await subscriptionByProvider(env,data.subscriptionId)
    }else if(next==='paid'){
      if(order?.provider_checkout_id&&eventType==='CHECKOUT_PAID'&&order.financial_status!=='paid'){
        const plan=await planById(env,order.plan_version_id);if(!plan)throw new Error('Plano da ordem não encontrado.');if(!canApplyProviderTransition(order.financial_status,'paid'))throw new Error('Transição financeira inválida.');await activateOrder(env,order,plan,eventId,eventType,data)
      }else if(order?.provider_checkout_id&&data.paymentId){
        await recordInitialPayment(env,order,subscription,eventType,data)
      }else if(order&&order.financial_status!=='paid'){
        const plan=await planById(env,order.plan_version_id);if(!plan)throw new Error('Plano da ordem não encontrado.');if(!canApplyProviderTransition(order.financial_status,'paid'))throw new Error('Transição financeira inválida.');await activateOrder(env,order,plan,eventId,eventType,data)
      }else if(subscription){const plan=await planById(env,subscription.plan_version_id);if(!plan)throw new Error('Plano da assinatura não encontrado.');await processRenewal(env,subscription,plan,eventId,data)}
      else if(!order)throw new Error('Pagamento sem ordem/assinatura vinculada.')
    }else if(next&&order&&canApplyProviderTransition(order.financial_status,next)){
      if(data.checkoutId&&order.provider_checkout_id&&data.checkoutId!==order.provider_checkout_id)throw new Error('Checkout divergente da ordem.')
      await env.DB.prepare('UPDATE billing_orders SET financial_status=?,provider_status=?,updated_at=? WHERE id=?').bind(next,eventType,now(),order.id).run()
      if(next==='refunded'&&order.license_id)await revokeBillingLicense(order.license_id,{source:'billing',orderId:order.id,email:order.user_email,userId:order.user_id},'Pagamento estornado',{DB:env.DB})
    }
    if(next&&subscription&&next!=='paid'){const plan=await planById(env,subscription.plan_version_id);if(!plan)throw new Error('Plano da assinatura não encontrado.');await processSubscriptionPaymentState(env,subscription,plan,next,eventType,data)}
    if(eventType==='SUBSCRIPTION_INACTIVATED'&&subscription){await env.DB.prepare(`UPDATE billing_subscriptions SET financial_status='canceled',updated_at=? WHERE id=?`).bind(now(),subscription.id).run();if(subscription.license_id)await revokeBillingLicense(subscription.license_id,{source:'billing',email:subscription.user_email,userId:subscription.user_id,orderId:`cancel:${eventId}`},'Assinatura cancelada',{DB:env.DB})}
    await markEvent(env,eventId,'processed');return{duplicate:false,processed:true}
  }catch(cause){const message=(cause instanceof Error?cause.message:String(cause)).slice(0,500);await markEvent(env,eventId,'failed',message);throw cause}
}

function enrichPlan<T extends Record<string,unknown>>(row:T){const modules=arr(String(row.modules_json||'[]'));return{...row,modules,limits:{maxUsers:Number(row.max_users||0),maxProjects:Number(row.max_projects||0),maxDevices:Number(row.max_devices||0)}}}
async function countUsage(env:BillingEnv,companyId:string|null){
  if(!companyId)return{users:0,projects:0,devices:0}
  const users=await first<{count:number}>(env,`SELECT COUNT(DISTINCT COALESCE(NULLIF(json_extract(record_json,'$.userId'),''),LOWER(json_extract(record_json,'$.email')))) AS count FROM kv_records WHERE collection LIKE 'access_%' AND json_extract(record_json,'$.companyId')=?`,companyId)
  const projects=await first<{count:number}>(env,`SELECT COUNT(*) AS count FROM kv_records WHERE collection='projects' AND json_extract(record_json,'$.companyId')=?`,companyId)
  const devices=await first<{count:number}>(env,`SELECT COUNT(*) AS count FROM kv_records WHERE collection='devices' AND json_extract(record_json,'$.companyId')=? AND COALESCE(json_extract(record_json,'$.status'),'active')='active'`,companyId)
  return{users:Number(users?.count||0),projects:Number(projects?.count||0),devices:Number(devices?.count||0)}
}

export async function billingStatus(env:BillingEnv,userId:string){
  const orderRows=await env.DB.prepare(`SELECT o.id,o.company_id,o.plan_version_id,o.amount_cents,o.currency,o.financial_status,o.checkout_url,o.license_id,o.reconciliation_required,o.created_at,o.updated_at,p.plan_code,p.name AS plan_name,p.interval_code,p.modules_json,p.max_users,p.max_projects,p.max_devices FROM billing_orders o JOIN billing_plan_versions p ON p.id=o.plan_version_id WHERE o.user_id=? ORDER BY o.created_at DESC LIMIT 20`).bind(userId).all<Record<string,unknown>>()
  const subscriptionRows=await env.DB.prepare(`SELECT s.id,s.company_id,s.plan_version_id,s.financial_status,s.current_period_end,s.license_id,s.created_at,s.updated_at,p.plan_code,p.name AS plan_name,p.price_cents,p.currency,p.interval_code,p.modules_json,p.max_users,p.max_projects,p.max_devices FROM billing_subscriptions s JOIN billing_plan_versions p ON p.id=s.plan_version_id WHERE s.user_id=? ORDER BY s.updated_at DESC LIMIT 20`).bind(userId).all<Record<string,unknown>>()
  const payments=await env.DB.prepare(`SELECT DISTINCT bp.id,bp.provider_payment_id,bp.provider_status,bp.financial_status,bp.amount_cents,bp.paid_at,bp.created_at,bp.updated_at FROM billing_payments bp LEFT JOIN billing_orders bo ON bo.id=bp.order_id LEFT JOIN billing_subscriptions bs ON bs.id=bp.subscription_id WHERE bo.user_id=? OR bs.user_id=? ORDER BY COALESCE(bp.paid_at,bp.updated_at) DESC LIMIT 24`).bind(userId,userId).all<Record<string,unknown>>()
  const orders=(orderRows.results||[]).map(enrichPlan),subscriptions=(subscriptionRows.results||[]).map(enrichPlan),companyId=String(subscriptions[0]?.company_id||orders[0]?.company_id||'')||null,usage=await countUsage(env,companyId)
  return{orders,subscriptions,payments:payments.results||[],usage}
}
