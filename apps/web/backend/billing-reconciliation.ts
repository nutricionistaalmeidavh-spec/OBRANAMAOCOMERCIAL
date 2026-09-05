import type { RuntimeEnv } from '../cloudflare/sdk'
import { reconcileAsaasOrder } from './asaas-client'
import { processAsaasWebhookPayload, recoverHostedCheckoutOrder } from './billing-service'

type Env=RuntimeEnv&{ASAAS_API_KEY?:string;ASAAS_API_BASE_URL?:string;ASAAS_WEBHOOK_TOKEN?:string}
type Order={id:string;user_id:string;user_email:string;company_id:string|null;requested_company_name:string;plan_version_id:string;amount_cents:number;currency:string;financial_status:'created'|'pending'|'paid'|'overdue'|'canceled'|'refunded'|'failed';idempotency_key:string;provider:string;provider_customer_id:string|null;provider_payment_id:string|null;provider_subscription_id:string|null;provider_checkout_id:string|null;provider_status:string|null;checkout_url:string|null;license_id:string|null;reconciliation_required:number;created_at:string;updated_at:string}
const now=()=>new Date().toISOString(),id=()=>crypto.randomUUID().replace(/-/g,'')
const eventForStatus=(status:string)=>({RECEIVED:'PAYMENT_RECEIVED',CONFIRMED:'PAYMENT_CONFIRMED',OVERDUE:'PAYMENT_OVERDUE',REFUNDED:'PAYMENT_REFUNDED'} as Record<string,string>)[status.toUpperCase()]||null

export async function reconcileBillingOrder(env:Env,orderId:string){
  const order=await env.DB.prepare('SELECT * FROM billing_orders WHERE id=?').bind(orderId).first<Order>()
  if(!order)return{ok:false as const,status:404,error:'Ordem não encontrada.'}

  const hosted=await recoverHostedCheckoutOrder(env,order)
  if(hosted.provider_checkout_id||hosted.checkout_url){
    return{ok:true as const,found:true,mode:'hosted' as const,orderId:hosted.id,checkoutId:hosted.provider_checkout_id||null,checkoutUrl:hosted.checkout_url||null,status:hosted.provider_status||hosted.financial_status}
  }

  const match=await reconcileAsaasOrder(env,order.id);if(!match)return{ok:true as const,found:false,mode:'legacy' as const,orderId:order.id}
  if(match.externalReference!==order.id||match.amountCents!==order.amount_cents)return{ok:false as const,status:409,error:'A cobrança encontrada não corresponde ao valor/vínculo da ordem.'}
  if(order.provider_payment_id&&order.provider_payment_id!==match.paymentId)return{ok:false as const,status:409,error:'A ordem já está vinculada a outra cobrança.'}
  if(order.provider_subscription_id&&match.subscriptionId&&order.provider_subscription_id!==match.subscriptionId)return{ok:false as const,status:409,error:'A ordem já está vinculada a outra assinatura.'}
  const stamp=now()
  await env.DB.prepare(`UPDATE billing_orders SET provider_customer_id=?,provider_payment_id=?,provider_subscription_id=?,provider_status=?,checkout_url=?,reconciliation_required=0,financial_status=CASE WHEN financial_status='created' THEN 'pending' ELSE financial_status END,updated_at=? WHERE id=?`).bind(match.customerId,match.paymentId,match.subscriptionId||null,match.providerStatus,match.checkoutUrl||null,stamp,order.id).run()
  if(match.subscriptionId)await env.DB.prepare(`INSERT OR IGNORE INTO billing_subscriptions(id,user_id,user_email,plan_version_id,provider,provider_customer_id,provider_subscription_id,financial_status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'pending',?,?)`).bind(id(),order.user_id,order.user_email,order.plan_version_id,'asaas',match.customerId,match.subscriptionId,stamp,stamp).run()
  const eventType=eventForStatus(match.providerStatus)
  if(eventType)await processAsaasWebhookPayload(env,{id:`reconcile_${order.id}_${match.paymentId}_${match.providerStatus}`.slice(0,180),event:eventType,payment:{id:match.paymentId,customer:match.customerId,value:match.amountCents/100,status:match.providerStatus,externalReference:order.id,subscription:match.subscriptionId||undefined}})
  return{ok:true as const,found:true,mode:'legacy' as const,orderId:order.id,paymentId:match.paymentId,subscriptionId:match.subscriptionId||null,status:match.providerStatus}
}
