import { describe, expect, it } from 'vitest';
import { normalizeManagedCompanyInput,companyViews } from './owner-company-service';

describe('owner company shared service',()=>{
  it('normalizes commercial limits and filters unsupported entitlements',()=>{
    expect(normalizeManagedCompanyInput({
      name:' Cliente ',adminEmail:' ADMIN@EXAMPLE.COM ',modules:['obra360','invalid'],channels:['desktop','bogus'],maxUsers:0,maxProjects:1005,maxDevices:4
    },{modules:['obra360','rdo'],channels:['desktop','mobile']})).toEqual({
      name:'Cliente',email:'admin@example.com',modules:['obra360'],channels:['desktop'],plan:'custom',expiresAt:undefined,maxUsers:10,maxProjects:999,maxDevices:4,advancedServer:false
    });
  });
  it('não inclui tenant arquivado no catálogo ativo, preservando trilha de licença',()=>{
    const company={id:'company-a',name:'Cliente arquivado',licenseId:'lic-a',principalEmail:'admin@a.test',archivedAt:'2026-11-18'};
    const license={id:'lic-a',email:'admin@a.test',companyId:'company-a',status:'revoked'};
    const view=companyViews([company],[license],[],[],[],[],'owner@test','Gestão');
    expect(view.companies).toHaveLength(0);
  });
  it('only permits explicit booleans for the advanced server add-on',()=>{
    expect(normalizeManagedCompanyInput({adminEmail:'a@example.com',advancedServer:true}).advancedServer).toBe(true)
    expect(normalizeManagedCompanyInput({adminEmail:'a@example.com',advancedServer:'true'}).advancedServer).toBe(false)
  });
});
