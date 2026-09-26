// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bindDeboraPartners, deboraPartnersSection } from './owner-debora-partners';

describe('Débora partners owner module',()=>{
  beforeEach(()=>{document.body.innerHTML=deboraPartnersSection()});

  it('renders partner discount, commission and attributed sales from owner routes',async()=>{
    const get=vi.fn(async(path:string)=>{
      if(path==='/api/owner/debora-partners')return{data:{partners:[{id:'p1',name:'Ana',code:'ANA15',active:1,commission_type:'percent',commission_value:10,discount_type:'percent',discount_value:15}]}};
      if(path==='/api/owner/debora-partner-sales')return{data:{summary:{paidSales:1,revenueCents:8492,discountCents:1498,pendingCommissionCents:849},sales:[{id:'s1',partner_code_snapshot:'ANA15',plan_code:'pro_monthly',status:'paid',commission_status:'pending',total_cents:8492,discount_cents:1498,commission_cents:849,created_at:'2026-09-25T10:00:00Z',partners:{name:'Ana'}}]}};
      throw new Error(path);
    });
    const post=vi.fn();
    await bindDeboraPartners({get,post} as any);
    expect(document.body.textContent).toContain('ANA15');
    expect(document.body.textContent).toContain('15%');
    expect(document.body.textContent).toContain('10%');
    expect(document.body.textContent).toContain('R$ 84,92');
  });

  it('saves through the existing partner authority instead of a local store',async()=>{
    const get=vi.fn(async(path:string)=>path.includes('partner-sales')?{data:{summary:{},sales:[]}}:{data:{partners:[]}});
    const post=vi.fn(async()=>({data:{partner:{id:'p1'}}}));
    await bindDeboraPartners({get,post} as any);
    const form=document.querySelector<HTMLFormElement>('[data-debora-partner-form]')!;
    (form.elements.namedItem('name') as HTMLInputElement).value='Ana';
    (form.elements.namedItem('code') as HTMLInputElement).value='ANA15';
    (form.elements.namedItem('discountType') as HTMLSelectElement).value='percent';
    (form.elements.namedItem('discountValue') as HTMLInputElement).value='15';
    form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    await new Promise(resolve=>setTimeout(resolve,0));
    expect(post).toHaveBeenCalledWith('/api/owner/debora-partners',expect.objectContaining({code:'ANA15',discountType:'percent',discountValue:15}));
  });
});
