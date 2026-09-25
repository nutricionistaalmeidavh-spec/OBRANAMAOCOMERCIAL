import { describe, expect, it } from 'vitest';
import { prepareManualDeboraLicenseGrant } from './product-license-service';

function dbWith(existing:any=null){
  return {
    prepare(sql:string){
      return {
        bind(...args:any[]){
          return {
            async first(){return sql.includes('SELECT * FROM product_licenses')?existing:null},
            sql,args,
          } as any;
        },
      } as any;
    },
  } as D1Database;
}

describe('prepareManualDeboraLicenseGrant',()=>{
  it('prepares a first six-month grant without executing writes',async()=>{
    const prepared=await prepareManualDeboraLicenseGrant(dbWith(), ' CLIENT@example.com ', 'tester', '2026-09-25T12:00:00.000Z');
    expect(prepared.action).toBe('grant');
    expect(prepared.result).toMatchObject({
      email:'client@example.com',plan_code:'pro_6m',status:'active',source:'mercado_livre_manual',expires_at:'2027-03-25T12:00:00.000Z',
    });
    expect(prepared.statements).toHaveLength(3);
  });

  it('renews from the existing future expiry and keeps the same license id',async()=>{
    const existing={
      id:'license-1',product_code:'debora-lactacao',email:'client@example.com',plan_code:'pro_6m',status:'active',
      starts_at:'2026-03-25T12:00:00.000Z',expires_at:'2027-01-31T12:00:00.000Z',source:'mercado_livre_manual',external_ref:'',metadata_json:'{}',created_at:'2026-03-25T12:00:00.000Z',updated_at:'2026-03-25T12:00:00.000Z',
    };
    const prepared=await prepareManualDeboraLicenseGrant(dbWith(existing), 'client@example.com', 'tester', '2026-09-25T12:00:00.000Z');
    expect(prepared.action).toBe('renew');
    expect(prepared.result.id).toBe('license-1');
    expect(prepared.result.expires_at).toBe('2027-07-31T12:00:00.000Z');
    expect(prepared.statements).toHaveLength(3);
  });

  it('uses now as renewal base when the previous license is expired',async()=>{
    const existing={id:'license-2',expires_at:'2026-01-01T00:00:00.000Z'};
    const prepared=await prepareManualDeboraLicenseGrant(dbWith(existing), 'client@example.com', 'tester', '2026-09-25T12:00:00.000Z');
    expect(prepared.action).toBe('renew');
    expect(prepared.result.expires_at).toBe('2027-03-25T12:00:00.000Z');
  });
});
