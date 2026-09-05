import { describe, expect, it } from 'vitest'
import { handleAsaasWebhook } from '../backend/asaas-webhook'

const request=(token:string|null,body:unknown)=>new Request('https://example.com/api/webhooks/asaas',{method:'POST',headers:{'content-type':'application/json',...(token?{'asaas-access-token':token}:{})},body:JSON.stringify(body)})

type StoredOrder=Record<string,unknown>&{id:string;financial_status:string;provider_checkout_id:string|null;checkout_url:string|null;provider_status:string|null;reconciliation_required:number}
function eventDb(){
  const events=new Map<string,{processing_status:string;payload_json?:string;event_type?:string;external_reference?:string}>(),orders=new Map<string,StoredOrder>()
  const db={prepare(sql:string){let values:unknown[]=[];return{bind(...args:unknown[]){values=args;return this},async run(){
    if(sql.includes('INSERT OR IGNORE INTO billing_provider_events')){const eventId=String(values[1]);if(events.has(eventId))return{meta:{changes:0}};events.set(eventId,{processing_status:'received',event_type:String(values[2]||''),external_reference:String(values[5]||''),payload_json:String(values[6]||'')});return{meta:{changes:1}}}
    if(sql.includes('UPDATE billing_provider_events')){const eventId=String(values[5]),row=events.get(eventId);if(row)row.processing_status=String(values[0]);return{meta:{changes:row?1:0}}}
    if(sql.includes('UPDATE billing_orders SET provider_checkout_id=')){
      const orderId=String(values[4]),row=orders.get(orderId);if(!row)return{meta:{changes:0}}
      const checkoutId=String(values[0]);if(row.provider_checkout_id&&row.provider_checkout_id!==checkoutId)return{meta:{changes:0}}
      row.provider_checkout_id=checkoutId;row.provider_status=String(values[1]);row.checkout_url=String(values[2]);row.reconciliation_required=0
      if(row.financial_status==='created'||row.financial_status==='failed')row.financial_status='pending'
      return{meta:{changes:1}}
    }
    return{meta:{changes:0}}
  },async first<T>(){
    if(sql.includes('FROM billing_provider_events'))return(events.get(String(values[1]))||null) as T|null
    if(sql.includes('SELECT * FROM billing_orders WHERE id='))return(orders.get(String(values[0]))||null) as T|null
    if(sql.includes('FROM billing_orders WHERE provider=? AND provider_checkout_id=?'))return([...orders.values()].find(row=>row.provider_checkout_id===String(values[1]))||null) as T|null
    return null
  },async all<T>(){return{results:[] as T[]}}
  }} } as unknown as D1Database
  return{db,events,orders}
}

const hostedOrder=(id='order_123'):StoredOrder=>({
  id,user_id:'u1',user_email:'cliente@example.test',company_id:null,requested_company_name:'Empresa Teste',plan_version_id:'plan_1',amount_cents:29900,currency:'BRL',financial_status:'created',idempotency_key:'idem_1234567890123456',provider:'asaas',provider_customer_id:null,provider_payment_id:null,provider_subscription_id:null,provider_checkout_id:null,provider_status:'UNKNOWN',checkout_url:null,license_id:null,reconciliation_required:1,created_at:'2026-09-05T12:00:00Z',updated_at:'2026-09-05T12:00:00Z'
})

describe('Asaas webhook',()=>{
  it('rejects requests with an invalid authentication token',async()=>{const response=await handleAsaasWebhook(request('wrong-token',{id:'evt_1',event:'PAYMENT_CONFIRMED'}),{ASAAS_WEBHOOK_TOKEN:'expected-token'});expect(response.status).toBe(401)})
  it('fails closed when the webhook secret is not configured',async()=>{const response=await handleAsaasWebhook(request('any-token',{id:'evt_1',event:'PAYMENT_CONFIRMED'}),{});expect(response.status).toBe(503)})
  it('fails closed when durable persistence is unavailable',async()=>{const response=await handleAsaasWebhook(request('expected-token',{id:'evt_1',event:'PAYMENT_CONFIRMED'}),{ASAAS_WEBHOOK_TOKEN:'expected-token'});expect(response.status).toBe(503)})
  it('persists an event before acknowledging it and treats a replay as duplicate',async()=>{
    const state=eventDb(),env={ASAAS_WEBHOOK_TOKEN:'expected-token',DB:state.db}
    const payload={id:'evt_future',event:'FUTURE_ASAAS_EVENT'}
    const first=await handleAsaasWebhook(request('expected-token',payload),env),second=await handleAsaasWebhook(request('expected-token',payload),env)
    expect(first.status).toBe(200);expect(second.status).toBe(200);await expect(second.json()).resolves.toMatchObject({duplicate:true,processed:true});expect(state.events.get('evt_future')?.processing_status).toBe('processed')
  })
  it('binds CHECKOUT_CREATED to an uncertain order before acknowledging the event',async()=>{
    const state=eventDb(),order=hostedOrder();state.orders.set(order.id,order)
    const env={ASAAS_WEBHOOK_TOKEN:'expected-token',ASAAS_API_KEY:'test-key',ASAAS_API_BASE_URL:'https://api-sandbox.asaas.com/v3',DB:state.db}
    const payload={id:'evt_checkout',event:'CHECKOUT_CREATED',checkout:{id:'chk_123',externalReference:'order_123',link:'https://sandbox.asaas.com/checkoutSession/show/chk_123',status:'ACTIVE'}}
    const response=await handleAsaasWebhook(request('expected-token',payload),env)
    expect(response.status).toBe(200)
    expect(state.orders.get('order_123')).toMatchObject({provider_checkout_id:'chk_123',provider_status:'ACTIVE',checkout_url:'https://sandbox.asaas.com/checkoutSession/show/chk_123',reconciliation_required:0,financial_status:'pending'})
    expect(state.events.get('evt_checkout')?.processing_status).toBe('processed')
  })
  it('does not acknowledge a paid event that is not linked to a persisted order/subscription',async()=>{
    const state=eventDb(),response=await handleAsaasWebhook(request('expected-token',{id:'evt_paid',event:'PAYMENT_CONFIRMED',payment:{id:'pay_404',value:199,externalReference:'order_missing'}}),{ASAAS_WEBHOOK_TOKEN:'expected-token',DB:state.db})
    expect(response.status).toBe(500);expect(state.events.get('evt_paid')?.processing_status).toBe('failed')
  })
  it('rejects invalid JSON without exposing internal details',async()=>{
    const badRequest=new Request('https://example.com/api/webhooks/asaas',{method:'POST',headers:{'content-type':'application/json','asaas-access-token':'expected-token'},body:'{bad-json'}),state=eventDb(),response=await handleAsaasWebhook(badRequest,{ASAAS_WEBHOOK_TOKEN:'expected-token',DB:state.db});expect(response.status).toBe(400)
  })
})
