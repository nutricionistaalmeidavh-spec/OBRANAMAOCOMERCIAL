import { describe, expect, it } from 'vitest';
import { createDeboraPartnerAdminRoutes, deboraPartnerAdminRequest } from './debora-partner-admin';

function binding(handler:(request:Request)=>Response|Promise<Response>){return{fetch:(request:RequestInfo|URL,init?:RequestInit)=>handler(request instanceof Request?request:new Request(request,init))}}

describe('Débora partner admin bridge',()=>{
  it('reuses the Débora service binding with the internal partner credential',async()=>{
    let seen:Request|null=null;
    const env:any={
      DEBORA_OBSERVABILITY:binding(request=>{seen=request;return new Response(JSON.stringify({partners:[]}),{headers:{'content-type':'application/json'}})}),
      DEBORA_PARTNER_ADMIN_SECRET:'partner-secret',
    };
    const payload=await deboraPartnerAdminRequest('/api/admin/partners',{},env);
    expect(payload).toEqual({partners:[]});
    expect(seen?.headers.get('x-debora-partner-admin-secret')).toBe('partner-secret');
  });

  it('falls back to the existing observability secret during the coordinated cutover',async()=>{
    let secret='';
    const env:any={
      DEBORA_OBSERVABILITY:binding(request=>{secret=request.headers.get('x-debora-partner-admin-secret')||'';return new Response('{}',{headers:{'content-type':'application/json'}})}),
      DEBORA_OBSERVABILITY_SECRET:'shared-cutover-secret',
    };
    await deboraPartnerAdminRequest('/api/admin/partners',{},env);
    expect(secret).toBe('shared-cutover-secret');
  });

  it('exposes owner routes without creating a local partner store',()=>{
    const routes=createDeboraPartnerAdminRoutes([]);
    expect(routes['GET /api/owner/debora-partners']).toBeTruthy();
    expect(routes['POST /api/owner/debora-partners']).toBeTruthy();
    expect(routes['GET /api/owner/debora-partner-sales']).toBeTruthy();
    expect(routes['POST /api/owner/debora-partner-commission']).toBeTruthy();
  });
});
