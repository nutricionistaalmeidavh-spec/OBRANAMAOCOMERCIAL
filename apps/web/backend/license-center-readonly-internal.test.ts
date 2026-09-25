import { describe, expect, it } from 'vitest';
import { handleLicenseCenterReadonlyInternal } from './license-center-readonly-internal';

describe('license center internal endpoint',()=>{
  const env={DB:{} as D1Database,LICENSE_CENTER_READ_SECRET:'read-secret'} as any;

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
});
