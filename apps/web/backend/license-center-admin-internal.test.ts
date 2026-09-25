import { describe, expect, it, vi } from 'vitest';
import { handleLicenseCenterAdminInternal } from './license-center-admin-internal';

const req=(path:string,init:RequestInit={})=>new Request(`https://obra.test${path}`,init);
const baseEnv={DB:{} as D1Database,LICENSE_CENTER_WRITE_SECRET:'write-secret',LICENSE_CENTER_READ_SECRET:'read-secret'} as any;
const qaHeaders={'content-type':'application/json','x-artisys-license-center-write-secret':'write-secret','x-artisys-qa-run':'run-123'};
const writeHeaders={'content-type':'application/json','x-artisys-license-center-write-secret':'write-secret'};

function deps(overrides:Record<string,unknown>={}){
  return {
    managedCompanyInventory:vi.fn(async()=>({companies:[]})),
    createManagedCompany:vi.fn(async(input:any)=>({company:{id:'qa-company',...input},license:{id:'qa-license'}})),
    updateManagedCompany:vi.fn(async(id:string,input:any)=>({company:{id,...input},license:{id:'qa-license'}})),
    setManagedDeviceStatus:vi.fn(async(id:string,status:string)=>({device:{id,status}})),
    grantManualDeboraLicense:vi.fn(),
    grantManualDeboraLicenseWithSale:vi.fn(),
    getManualDeboraLicense:vi.fn(),resolveProductAccess:vi.fn(),revokeManualDeboraLicense:vi.fn(),
    classifyLegacyManualSale:vi.fn(),
    lojaOnlineRequest:vi.fn(),
    ...overrides,
  } as any;
}

describe('license center internal write gateway',()=>{
  it('rejects writes when feature flag is disabled',async()=>{
    const response=await handleLicenseCenterAdminInternal(req('/api/internal/license-center/obra/companies',{method:'POST',headers:{'x-artisys-license-center-write-secret':'write-secret'},body:'{}'}),{...baseEnv,LICENSE_CENTER_WRITE_ENABLED:'false'},deps());
    expect(response?.status).toBe(503);
    expect(await response?.json()).toEqual({error:'write_disabled'});
  });

  it('rejects read secret on write',async()=>{
    const response=await handleLicenseCenterAdminInternal(req('/api/internal/license-center/obra/companies',{method:'POST',headers:{'x-artisys-license-center-write-secret':'read-secret'},body:'{}'}),{...baseEnv,LICENSE_CENTER_WRITE_ENABLED:'true'},deps());
    expect(response?.status).toBe(401);
    expect(await response?.json()).toEqual({error:'unauthorized'});
  });

  it('rejects malformed qa creation before any service call',async()=>{
    const d=deps();
    const response=await handleLicenseCenterAdminInternal(req('/api/internal/license-center/obra/companies',{method:'POST',headers:qaHeaders,body:JSON.stringify({name:'Cliente real',adminEmail:'real@example.com',modules:['obra360'],channels:['mobile']})}),{...baseEnv,LICENSE_CENTER_WRITE_ENABLED:'true'},d);
    expect(response?.status).toBe(403);
    expect(await response?.json()).toEqual({error:'qa_scope_violation'});
    expect(d.createManagedCompany).not.toHaveBeenCalled();
  });

  it('rejects qa mutation against a persisted preexisting target',async()=>{
    const d=deps({managedCompanyInventory:vi.fn(async()=>({companies:[{id:'real-company',name:'Cliente real',adminEmail:'real@example.com',devices:[]}]}))});
    const response=await handleLicenseCenterAdminInternal(req('/api/internal/license-center/obra/companies/real-company',{method:'PUT',headers:qaHeaders,body:JSON.stringify({status:'suspended'})}),{...baseEnv,LICENSE_CENTER_WRITE_ENABLED:'true'},d);
    expect(response?.status).toBe(403);
    expect(await response?.json()).toEqual({error:'qa_scope_violation'});
    expect(d.updateManagedCompany).not.toHaveBeenCalled();
  });

  it('accepts qa mutation only when persisted identity matches qaRunId',async()=>{
    const d=deps({managedCompanyInventory:vi.fn(async()=>({companies:[{id:'qa-company',name:'ARTISYS QA E2E run-123',adminEmail:'qa-license-run-123@example.test',devices:[]}]}))});
    const response=await handleLicenseCenterAdminInternal(req('/api/internal/license-center/obra/companies/qa-company',{method:'PUT',headers:qaHeaders,body:JSON.stringify({status:'suspended'})}),{...baseEnv,LICENSE_CENTER_WRITE_ENABLED:'true'},d);
    expect(response?.status).toBe(200);
    expect(d.updateManagedCompany).toHaveBeenCalledTimes(1);
    expect(d.updateManagedCompany).toHaveBeenCalledWith('qa-company',{status:'suspended'},{userId:'general-panel',email:'general-panel@artisys.internal'});
  });

  it('records explicit commercial metadata when the general panel grants a Debora license',async()=>{
    const sale={acquisitionChannel:'mercado_livre',paymentStatus:'paid',amountCents:8000,externalOrderRef:'MLB-123'};
    const d=deps({grantManualDeboraLicenseWithSale:vi.fn(async()=>({grant:{id:'lic-1',status:'active'},sale:{id:'sale-1',paymentStatus:'paid'}}))});
    const response=await handleLicenseCenterAdminInternal(req('/api/internal/license-center/debora/license',{method:'POST',headers:writeHeaders,body:JSON.stringify({action:'grant',email:'client@example.test',sale})}),{...baseEnv,LICENSE_CENTER_WRITE_ENABLED:'true'},d);
    expect(response?.status).toBe(200);
    expect(d.grantManualDeboraLicenseWithSale).toHaveBeenCalledWith(baseEnv.DB,'client@example.test',sale,'general-panel-artisys');
    expect(await response?.json()).toMatchObject({state:'active',grant:{id:'lic-1'},sale:{id:'sale-1'}});
  });

  it('classifies a legacy Debora manual sale through the guarded write bridge',async()=>{
    const sale={acquisitionChannel:'direct_sale',paymentStatus:'paid',amountCents:5000,externalOrderRef:'DIRECT-1'};
    const d=deps({classifyLegacyManualSale:vi.fn(async()=>({id:'classified-1',email:'legacy@example.test'}))});
    const response=await handleLicenseCenterAdminInternal(req('/api/internal/license-center/debora/manual-sales/classify',{method:'POST',headers:writeHeaders,body:JSON.stringify({email:'legacy@example.test',sale})}),{...baseEnv,LICENSE_CENTER_WRITE_ENABLED:'true'},d);
    expect(response?.status).toBe(200);
    expect(d.classifyLegacyManualSale).toHaveBeenCalledWith(baseEnv.DB,'legacy@example.test',sale,'general-panel-artisys');
    expect(await response?.json()).toEqual({sale:{id:'classified-1',email:'legacy@example.test'}});
  });

  it('ignores unrelated routes',async()=>{
    expect(await handleLicenseCenterAdminInternal(req('/api/health'),baseEnv,deps())).toBeNull();
  });
});
