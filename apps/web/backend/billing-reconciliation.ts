import type { RuntimeEnv } from '../cloudflare/sdk'
import { reconcileAsaasOrder } from './asaas-client'
import { processAsaasWebhookPayload } from './billing-service'

type Env=RuntimeEnv&{ASAAS_API_KEY?:string;ASAAS_API_BASE_URL?:string;ASAAS_WEBHOOK_TOKEN?:string}
type Order={id:string;user_id:string;user_email:string;plan_version_id:string;amount_cents:number;financial_status:string;provider_payment_id:string|null;provider_subscription_id:string|null}
const now=()=>new Date().toISOString(),id=()=>crypto.randomUUID().replace(/-/g,'')
const eventForStatus=(status:string)=>({RECEIVED:'PAYMENT_RECEIVED',CONFIRMED:'PAYMENT_CONFIRMED',OVERDUE:'PAYMENT_OVERDUE',REFUNDED:'PAYMENT_REFUNDED'} as Record<string,string>)[status.toUpperCase()]||null

export async function reconcileBillingOrder(env:Env,orderId:string){
  const order=await env.DB.prepare('SELECT id,user_id,user_email,plan_version_id,amount_cents,financial_status,provider_payment_id,provider_subscription_id FROM billing_orders WHERE id=?').bind(orderId).first<Order>()
  if(!order)return{ok:false as const,status:404,error:'Ordem não encontrada.'}
  const match=await reconcileAsaasOrder(env,order.id);if(!match)return{ok:true as const,found:false,orderId:order.id}
  if(match.externalReference!==order.id||match.amountCents!==order.amount_cents)return{ok:false as const,status:409,error:'A cobrança encontrada não corresponde ao valor/vínculo da ordem.'}
  if(order.provider_payment_id&&order.provider_payment_id!==match.paymentId)return{ok:false as const,status:409,error:'A ordem já está vinculada a outra cobrança.'}
  if(order.provider_subscription_id&&match.subscriptionId&&order.provider_subscription_id!==match.subscriptionId)return{ok:false as const,status:409,error:'A ordem já está vinculada a outra assinatura.'}
  const stamp=now()
  await env.DB.prepare(`UPDATE billing_orders SET provider_customer_id=?,provider_payment_id=?,provider_subscription_id=?,provider_status=?,checkout_url=?,reconciliation_required=0,financial_status=CASE WHEN financial_status='created' THEN 'pending' ELSE financial_status END,updated_at=? WHERE id=?`).bind(match.customerId,match.paymentId,match.subscriptionId||null,match.providerStatus,match.checkoutUrl||null,stamp,order.id).run()
  if(match.subscriptionId)await env.DB.prepare(`INSERT OR IGNORE INTO billing_subscriptions(id,user_id,user_email,plan_version_id,provider,provider_customer_id,provider_subscription_id,financial_status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'pending',?,?)`).bind(id(),order.user_id,order.user_email,order.plan_version_id,'asaas',match.customerId,match.subscriptionId,stamp,stamp).run()
  const eventType=eventForStatus(match.providerStatus)
  if(eventType)await processAsaasWebhookPayload(env,{id:`reconcile_${order.id}_${match.paymentId}_${match.providerStatus}`.slice(0,180),event:eventType,payment:{id:match.paymentId,customer:match.customerId,value:match.amountCents/100,status:match.providerStatus,externalReference:order.id,subscription:match.subscriptionId||undefined}})
  return{ok:true as const,found:true,orderId:order.id,paymentId:match.paymentId,subscriptionId:match.subscriptionId||null,status:match.providerStatus}
}
