import { error, json, requireAuth, withScopes, type RouterRoutes, type RuntimeEnv } from '../cloudflare/sdk'
import { billingStatus, checkoutForUser, createPlanVersion, listActivePlans, processAsaasWebhookPayload } from './billing-service'
import { reconcileBillingOrder } from './billing-reconciliation'
import { catalogPublicView, commercialPlan } from './commercial-plan-catalog'

type BillingRuntime=RuntimeEnv&{ASAAS_API_KEY?:string;ASAAS_API_BASE_URL?:string;ASAAS_WEBHOOK_TOKEN?:string}
const secured=[requireAuth(),withScopes('email','profile')] as const
const rec=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{}
const arr=(v:unknown)=>Array.isArray(v)?v.map(String):[]
const owner=(email:string|undefined,env:RuntimeEnv)=>String(email||'').trim().toLowerCase()===String(env.OWNER_EMAIL||'').trim().toLowerCase()&&!!String(env.OWNER_EMAIL||'').trim()

export const BILLING_ROUTES:RouterRoutes={
  'GET /api/billing/plans':[...secured,async c=>{
    const rows=await listActivePlans(c.env as BillingRuntime)
    const plans=rows.map(row=>{
      const canonical=commercialPlan(String(row.plan_code||''))
      return canonical?{id:row.id,version:row.version,...catalogPublicView(canonical)}:row
    })
    return json({plans})
  }],
  'GET /api/billing/status':[...secured,async c=>json(await billingStatus(c.env as BillingRuntime,c.user!.userId))],
  'POST /api/billing/checkout':[...secured,async c=>{
    const body=rec(c.body),idempotencyKey=String(c.request.headers.get('idempotency-key')||body.idempotencyKey||'').trim(),callbackBaseUrl=new URL(c.request.url).origin,result=await checkoutForUser(c.env as BillingRuntime,c.user!,{planCode:String(body.planCode||''),companyName:String(body.companyName||''),idempotencyKey,callbackBaseUrl})
    if(!result.ok)return error(result.error,result.status);return json({order:result.order,reused:result.reused},result.reused?200:201)
  }],
  'POST /api/billing/admin/plans':[...secured,async c=>{
    if(!owner(c.user!.email,c.env))return error('Apenas o proprietário pode alterar o catálogo comercial.',403)
    const b=rec(c.body);try{const plan=await createPlanVersion(c.env as BillingRuntime,{planCode:String(b.planCode||''),name:String(b.name||''),priceCents:Number(b.priceCents||0),interval:String(b.interval||'monthly'),modules:arr(b.modules),channels:arr(b.channels),maxUsers:Number(b.maxUsers||10),maxProjects:Number(b.maxProjects||5),maxDevices:Number(b.maxDevices||2)});return json({plan},201)}catch(e){return error((e as Error).message||'Plano inválido.',400)}
  }],
  'POST /api/billing/admin/orders/reconcile':[...secured,async c=>{
    if(!owner(c.user!.email,c.env))return error('Apenas o proprietário pode reconciliar cobranças.',403)
    const orderId=String(rec(c.body).orderId||'').trim();if(!orderId)return error('Informe a ordem.',400)
    try{const result=await reconcileBillingOrder(c.env as BillingRuntime,orderId);if(!result.ok)return error(result.error,result.status);return json(result)}catch(e){return error((e as Error).message||'Falha na reconciliação.',409)}
  }],
  'POST /api/billing/admin/events/retry':[...secured,async c=>{
    if(!owner(c.user!.email,c.env))return error('Apenas o proprietário pode reconciliar cobranças.',403)
    const eventId=String(rec(c.body).eventId||'').trim();if(!eventId)return error('Informe o evento.',400)
    const row=await c.env.DB.prepare(`SELECT payload_json FROM billing_provider_events WHERE provider='asaas' AND provider_event_id=?`).bind(eventId).first<{payload_json:string}>();if(!row)return error('Evento não encontrado.',404)
    try{const payload=JSON.parse(row.payload_json) as Record<string,unknown>,result=await processAsaasWebhookPayload(c.env as BillingRuntime,payload);return json(result)}catch(e){return error((e as Error).message||'Falha na reconciliação.',409)}
  }]
}
