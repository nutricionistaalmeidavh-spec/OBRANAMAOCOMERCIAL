// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bindDeboraObservability, deboraObservabilitySection } from './owner-debora-observability';

const summary={accounts:{total:1},presence:{onlineNow:0},usage:{sessionsToday:0},pro:{total:1},plans:{freemium:0},sales:{paid:0,realizedRevenueCents:0}};
const legacyUser={
  userId:'legacy-u1',email:'legacy@example.test',createdAt:'2026-08-01T10:00:00Z',online:false,
  effectiveLicense:{planCode:'pro_6m',status:'active',source:'mercado_livre_manual',expiresAt:'2027-02-01T10:00:00Z'},
  manualSale:null,
};

describe('Debora legacy manual-sale classification',()=>{
  beforeEach(()=>{document.body.innerHTML=deboraObservabilitySection()});

  it('shows historical manual licenses as payment not informed instead of inferring paid',async()=>{
    const api={
      get:vi.fn(async(path:string)=>{
        if(path.endsWith('/summary'))return{data:summary};
        if(path.endsWith('/users'))return{data:{items:[legacyUser],hasMore:false,nextCursor:null}};
        if(path.endsWith('/sales'))return{data:{items:[],hasMore:false,nextCursor:null}};
        return{data:{items:[],hasMore:false,nextCursor:null}};
      }),
      post:vi.fn(),
    };
    await bindDeboraObservability(api as any);
    expect(document.body.textContent).toContain('Não informado');
    expect(document.body.textContent).toContain('Manual (legado)');
    expect(document.querySelector('[data-debora-classify-manual="legacy@example.test"]')).not.toBeNull();
  });

  it('classifies a legacy sale explicitly without changing the license action',async()=>{
    const api={
      get:vi.fn(async(path:string)=>{
        if(path.endsWith('/summary'))return{data:summary};
        if(path.endsWith('/users'))return{data:{items:[legacyUser],hasMore:false,nextCursor:null}};
        if(path.endsWith('/sales'))return{data:{items:[],hasMore:false,nextCursor:null}};
        return{data:{items:[],hasMore:false,nextCursor:null}};
      }),
      post:vi.fn(async()=>({data:{sale:{id:'classified-1'}}})),
    };
    await bindDeboraObservability(api as any);
    (document.querySelector('[data-debora-classify-manual="legacy@example.test"]') as HTMLButtonElement).click();
    const form=document.querySelector('[data-debora-classification-form]') as HTMLFormElement;
    expect(form).not.toBeNull();
    (form.elements.namedItem('acquisitionChannel') as HTMLSelectElement).value='mercado_livre';
    (form.elements.namedItem('paymentStatus') as HTMLSelectElement).value='paid';
    (form.elements.namedItem('amount') as HTMLInputElement).value='80,00';
    (form.elements.namedItem('externalOrderRef') as HTMLInputElement).value='MLB-LEGACY-1';
    form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    await vi.waitFor(()=>expect(api.post).toHaveBeenCalledWith('/api/owner/debora-manual-sales/classify',{
      email:'legacy@example.test',
      sale:{acquisitionChannel:'mercado_livre',paymentStatus:'paid',amountCents:8000,externalOrderRef:'MLB-LEGACY-1'},
    }));
  });
});
