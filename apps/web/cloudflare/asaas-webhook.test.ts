import { describe, expect, it } from 'vitest'
import { handleAsaasWebhook } from '../backend/asaas-webhook'

const request=(token:string|null,body:unknown)=>new Request('https://example.com/api/webhooks/asaas',{method:'POST',headers:{'content-type':'application/json',...(token?{'asaas-access-token':token}:{})},body:JSON.stringify(body)})

function eventDb(){
  const events=new Map<string,{processing_status:string}>()
  const db={prepare(sql:string){let values:unknown[]=[];return{bind(...args:unknown[]){values=args;return this},async run(){
    if(sql.includes('INSERT OR IGNORE INTO billing_provider_events')){const eventId=String(values[1]);if(events.has(eventId))return{meta:{changes:0}};events.set(eventId,{processing_status:'received'});return{meta:{changes:1}}}
    if(sql.includes('UPDATE billing_provider_events')){const eventId=String(values[5]),row=events.get(eventId);if(row)row.processing_status=String(values[0]);return{meta:{changes:row?1:0}}}
    return{meta:{changes:0}}
  },async first<T>(){
    if(sql.includes('FROM billing_provider_events'))return(events.get(String(values[1]))||null) as T|null
    return null
  },async all<T>(){return{results:[] as T[]}}
  }} } as unknown as D1Database
  return{db,events}
}

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
  it('does not acknowledge a paid event that is not linked to a persisted order/subscription',async()=>{
    const state=eventDb(),response=await handleAsaasWebhook(request('expected-token',{id:'evt_paid',event:'PAYMENT_CONFIRMED',payment:{id:'pay_404',value:199,externalReference:'order_missing'}}),{ASAAS_WEBHOOK_TOKEN:'expected-token',DB:state.db})
    expect(response.status).toBe(500);expect(state.events.get('evt_paid')?.processing_status).toBe('failed')
  })
  it('rejects invalid JSON without exposing internal details',async()=>{
    const badRequest=new Request('https://example.com/api/webhooks/asaas',{method:'POST',headers:{'content-type':'application/json','asaas-access-token':'expected-token'},body:'{bad-json'}),state=eventDb(),response=await handleAsaasWebhook(badRequest,{ASAAS_WEBHOOK_TOKEN:'expected-token',DB:state.db});expect(response.status).toBe(400)
  })
})
