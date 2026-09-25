import { describe, expect, it, vi } from 'vitest';
import { handleLicenseCenterReadonlyInternal, licenseCenterAdminParity } from './license-center-readonly-internal';

describe('license center internal endpoint',()=>{
  const env={DB:{} as D1Database,LICENSE_CENTER_READ_SECRET:'read-secret'} as any;
  const readHeaders={'x-artisys-license-center-secret':'read-secret'};

  it('ignores unrelated routes',async()=>{
    const response=await handleLicenseCenterReadonlyInternal(new Request('https://obra.test/api/health'),env);
    expect(response).toBeNull();
  });

  it('rejects mutation methods before touching the database',async()=>{
    const response=await handleLicenseCenterReadonlyInternal(new Request('https://obra.test/api/internal/license-center/snapshot',{method:'POST'}),env);
    expect(response?.status).toBe(405);
    expect(await response?.json()).toEqual({error:'method_not_allowed'});
  });

  it('requires the dedicated read-only shared secret',async()=>{
    const response=await handleLicenseCenterReadonlyInternal(new Request('https://obra.test/api/internal/license-center/snapshot'),env);
    expect(response?.status).toBe(401);
    expect(await response?.json()).toEqual({error:'unauthorized'});
  });

  it('publishes the required general-panel capability handshake',()=>{
    expect(licenseCenterAdminParity()).toEqual({
      contractVersion:1,
      requiredCapabilities:expect.arrayContaining([
        'obra.company.create','debora.license.manage','debora.observability.read','debora.manual-sales.manage','loja-online.license.update'
      ])
    });
  });

  it('serves Debora observability and manual-sales reads through the read-only bridge',async()=>{
    const deps={
      consolidatedSummary:vi.fn(async()=>({presence:{onlineNow:2},accounts:{total:7}})),
      listConsolidatedUsers:vi.fn(async(_env:any,query:any)=>({items:[{email:'client@example.test'}],hasMore:false,nextCursor:null,query})),
      mergedSales:vi.fn(async(_env:any,query:any)=>({items:[{id:'sale-1'}],hasMore:false,nextCursor:null,query})),
      fetchDeboraObservability:vi.fn(async(path:string)=>({items:[{id:'session-1'}],path})),
      listManualSales:vi.fn(async(_db:any,query:any)=>({items:[{id:'manual-1'}],hasMore:false,nextCursor:null,query})),
      manualSalesSummary:vi.fn(async()=>({total:1,paid:1,realizedRevenueCents:8000})),
    } as any;

    let response=await handleLicenseCenterReadonlyInternal(new Request('https://obra.test/api/internal/license-center/debora/observability/summary',{headers:readHeaders}),env,deps);
    expect(response?.status).toBe(200);
    expect(await response?.json()).toMatchObject({presence:{onlineNow:2}});

    response=await handleLicenseCenterReadonlyInternal(new Request('https://obra.test/api/internal/license-center/debora/observability/users?limit=25&search=client',{headers:readHeaders}),env,deps);
    expect(response?.status).toBe(200);
    expect(deps.listConsolidatedUsers).toHaveBeenCalledWith(env,expect.objectContaining({limit:'25',search:'client'}));

    response=await handleLicenseCenterReadonlyInternal(new Request('https://obra.test/api/internal/license-center/debora/observability/sales?limit=10&channel=asaas',{headers:readHeaders}),env,deps);
    expect(response?.status).toBe(200);
    expect(deps.mergedSales).toHaveBeenCalledWith(env,expect.objectContaining({limit:'10',channel:'asaas'}));

    response=await handleLicenseCenterReadonlyInternal(new Request('https://obra.test/api/internal/license-center/debora/observability/users/u%201/sessions?limit=5',{headers:readHeaders}),env,deps);
    expect(response?.status).toBe(200);
    expect(deps.fetchDeboraObservability).toHaveBeenCalledWith('/api/internal/observability/users/u%201/sessions?limit=5',env);

    response=await handleLicenseCenterReadonlyInternal(new Request('https://obra.test/api/internal/license-center/debora/manual-sales?limit=20&paymentStatus=paid',{headers:readHeaders}),env,deps);
    expect(response?.status).toBe(200);
    expect(deps.listManualSales).toHaveBeenCalledWith(env.DB,expect.objectContaining({limit:'20',paymentStatus:'paid'}));

    response=await handleLicenseCenterReadonlyInternal(new Request('https://obra.test/api/internal/license-center/debora/manual-sales/summary',{headers:readHeaders}),env,deps);
    expect(response?.status).toBe(200);
    expect(await response?.json()).toMatchObject({paid:1,realizedRevenueCents:8000});
  });

  it('rejects Debora bridge reads without the read secret',async()=>{
    const response=await handleLicenseCenterReadonlyInternal(new Request('https://obra.test/api/internal/license-center/debora/observability/summary'),env,{} as any);
    expect(response?.status).toBe(401);
    expect(await response?.json()).toEqual({error:'unauthorized'});
  });
});
