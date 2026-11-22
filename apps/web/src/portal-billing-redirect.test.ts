import { describe, expect, it } from 'vitest';
import { shouldRouteCorporateToPlans } from './portal';

describe('portal billing entry',()=>{
  it('routes a regular corporate account without a license to plans',()=>{
    expect(shouldRouteCorporateToPlans({needsClaim:true,platformRole:'user'})).toBe(true);
  });

  it('does not send a licensed client who needs setup to buy another license',()=>{
    expect(shouldRouteCorporateToPlans({needsClaim:true,authorized:true,license:{licenseId:'lic-01',modules:['obra360'],channels:['mobile']},platformRole:'user'})).toBe(false);
    expect(shouldRouteCorporateToPlans({needsClaim:true,authorized:false,license:{licenseId:'desktop-only',modules:['obra360'],channels:['desktop']},platformRole:'user'})).toBe(false);
  });

  it('does not redirect owner, superadmin or blocked/pending credentials',()=>{
    expect(shouldRouteCorporateToPlans({needsClaim:true,isOwner:true,platformRole:'superadmin'})).toBe(false);
    expect(shouldRouteCorporateToPlans({needsClaim:true,platformRole:'superadmin'})).toBe(false);
    expect(shouldRouteCorporateToPlans({needsClaim:true,platformRole:'user',platformAccess:{status:'pending'} as any})).toBe(false);
    expect(shouldRouteCorporateToPlans({needsClaim:true,platformRole:'user',platformAccess:{status:'blocked'} as any})).toBe(false);
  });
});
