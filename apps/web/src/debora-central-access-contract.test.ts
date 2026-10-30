import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const load=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');

describe('Debora owner product isolation contracts',()=>{
  it('uses independent middlewares for Obra and lactation APIs',()=>{
    const routes=load('../backend/index.ts'),companies=load('../backend/owner-companies.ts'),license=load('../backend/debora-license-admin.ts');
    expect(routes).toContain('createCompanyRoutes(ownerSecured,deboraSecured)');
    expect(companies).toContain('createDeboraLicenseAdminRoutes(deboraSecured,secured)');
    expect(companies).toContain('createDeboraObservabilityAdminRoutes(deboraSecured)');
    expect(companies).toContain('createDeboraPartnerAdminRoutes(deboraSecured)');
    expect(license).toMatch(/'GET \/api\/owner\/license-audit': \[\s*\.\.\.ownerSecured/);
  });
  it('does not request or show Obra data for a lactation-only session',()=>{
    const owner=load('./owner.ts'),portal=load('./portal.ts'),field=load('./main.ts');
    expect(owner).toContain("if(centralRole==='owner')await refreshCompanies()");
    expect(owner).toContain("if(centralRole==='owner'){try{await refreshLicenseHistory()}");
    expect(owner).toContain("if(centralRole==='debora')ownerView='debora'");
    expect(portal).toContain("if(central.role==='debora'){location.replace('./sistema.html#owner');return}");
    expect(field).toContain("if(central.role==='debora'){location.replace('./sistema.html#owner');return}");
  });
});
