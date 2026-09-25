import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { matchesConsolidatedUserFilters } from './debora-observability-admin';

const manual={
  userId:'u1',email:'manual@example.test',planCode:'freemium',subscriptionStatus:null,
  effectiveLicense:{planCode:'pro_6m',status:'active',source:'mercado_livre_manual',expiresAt:'2027-03-25T00:00:00Z'},
  manualSale:{acquisitionChannel:'mercado_livre',paymentStatus:'paid',amountCents:8000},
};
const legacy={...manual,email:'legacy@example.test',manualSale:null};

describe('consolidated Debora user filters',()=>{
  it('filters by effective local plan, acquisition channel and payment status',()=>{
    expect(matchesConsolidatedUserFilters(manual,{plan:'pro_6m',origin:'mercado_livre',payment:'paid'})).toBe(true);
    expect(matchesConsolidatedUserFilters(manual,{plan:'pro_monthly'})).toBe(false);
    expect(matchesConsolidatedUserFilters(manual,{origin:'direct_sale'})).toBe(false);
    expect(matchesConsolidatedUserFilters(manual,{payment:'pending'})).toBe(false);
  });

  it('treats an unclassified legacy manual license as unknown payment',()=>{
    expect(matchesConsolidatedUserFilters(legacy,{plan:'pro_6m',payment:'unknown'})).toBe(true);
    expect(matchesConsolidatedUserFilters(legacy,{payment:'paid'})).toBe(false);
  });

  it('caps server-side remote scanning instead of loading the whole account table',()=>{
    const source=readFileSync('backend/debora-observability-admin.ts','utf8');
    expect(source).toMatch(/MAX_USER_SCAN\s*=\s*500/);
    expect(source).toMatch(/scanned\s*<\s*MAX_USER_SCAN/);
    expect(source).not.toMatch(/SELECT \* FROM auth_users/i);
  });
});
