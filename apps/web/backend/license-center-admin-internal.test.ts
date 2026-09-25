import { describe, expect, it } from 'vitest';
import { handleLicenseCenterAdminInternal } from './license-center-admin-internal';

const req=(path:string,init:RequestInit={})=>new Request(`https://obra.test${path}`,init);
const baseEnv={DB:{} as D1Database,LICENSE_CENTER_WRITE_SECRET:'write-secret',LICENSE_CENTER_READ_SECRET:'read-secret'} as any;

describe('license center internal write gateway',()=>{
  it('rejects writes when feature flag is disabled',async()=>{
    const response=await handleLicenseCenterAdminInternal(req('/api/internal/license-center/obra/companies',{method:'POST',headers:{'x-artisys-license-center-write-secret':'write-secret'},body:'{}'}),{...baseEnv,LICENSE_CENTER_WRITE_ENABLED:'false'});
    expect(response?.status).toBe(503);
    expect(await response?.json()).toEqual({error:'write_disabled'});
  });

  it('rejects read secret on write',async()=>{
    const response=await handleLicenseCenterAdminInternal(req('/api/internal/license-center/obra/companies',{method:'POST',headers:{'x-artisys-license-center-write-secret':'read-secret'},body:'{}'}),{...baseEnv,LICENSE_CENTER_WRITE_ENABLED:'true'});
    expect(response?.status).toBe(401);
    expect(await response?.json()).toEqual({error:'unauthorized'});
  });

  it('rejects malformed qa creation before any database access',async()=>{
    const response=await handleLicenseCenterAdminInternal(req('/api/internal/license-center/obra/companies',{method:'POST',headers:{'content-type':'application/json','x-artisys-license-center-write-secret':'write-secret','x-artisys-qa-run':'run-123'},body:JSON.stringify({name:'Cliente real',adminEmail:'real@example.com',modules:['obra360'],channels:['mobile']})}),{...baseEnv,LICENSE_CENTER_WRITE_ENABLED:'true'});
    expect(response?.status).toBe(403);
    expect(await response?.json()).toEqual({error:'qa_scope_violation'});
  });

  it('ignores unrelated routes',async()=>{
    expect(await handleLicenseCenterAdminInternal(req('/api/health'),baseEnv)).toBeNull();
  });
});
