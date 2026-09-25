import { describe, expect, it } from 'vitest';
import { normalizeManagedCompanyInput } from './owner-company-service';

describe('owner company shared service',()=>{
  it('normalizes commercial limits and filters unsupported entitlements',()=>{
    expect(normalizeManagedCompanyInput({
      name:' Cliente ',adminEmail:' ADMIN@EXAMPLE.COM ',modules:['obra360','invalid'],channels:['desktop','bogus'],maxUsers:0,maxProjects:1005,maxDevices:4
    },{modules:['obra360','rdo'],channels:['desktop','mobile']})).toEqual({
      name:'Cliente',email:'admin@example.com',modules:['obra360'],channels:['desktop'],plan:'custom',expiresAt:undefined,maxUsers:10,maxProjects:999,maxDevices:4
    });
  });
});
