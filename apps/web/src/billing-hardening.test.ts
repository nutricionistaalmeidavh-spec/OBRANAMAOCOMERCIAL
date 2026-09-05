// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const client=vi.hoisted(()=>({get:vi.fn(),post:vi.fn(),getUser:vi.fn(),signOut:vi.fn()}));
vi.mock('./cloudflare-client',()=>({api:{get:client.get,post:client.post},auth:{getUser:client.getUser,signOut:client.signOut}}));
import { mountBillingRoute } from './billing';

const plans=[
  {code:'essencial_monthly',name:'Essencial',interval:'monthly',priceCents:14900,features:['Obra360','RDO'],limits:{maxUsers:5,maxProjects:3,maxDevices:2}},
  {code:'pro_monthly',name:'Pro',interval:'monthly',priceCents:29900,features:['Financeiro','RH','IA ArtiSys'],limits:{maxUsers:20,maxProjects:10,maxDevices:5}},
  {code:'empresa_monthly',name:'Empresa',interval:'monthly',priceCents:49900,features:['Todos os módulos'],limits:{maxUsers:60,maxProjects:30,maxDevices:15}},
];

describe('billing hardening',()=>{
  beforeEach(()=>{
    vi.resetAllMocks();document.body.innerHTML='';sessionStorage.clear();
    client.getUser.mockResolvedValue({userId:'u1',name:'Cliente',email:'cliente@example.test'});
    client.get.mockResolvedValue({data:{plans}});
  });

  it('reuses the existing portal visual shell instead of creating a billing sidebar',async()=>{
    location.hash='#planos';await mountBillingRoute();
    expect(document.querySelector('.billing-sidebar')).toBeNull();
    expect(document.querySelector('.cp-header')).not.toBeNull();
    expect(document.querySelector('.cp-bottom-nav')).not.toBeNull();
  });

  it('reuses the same idempotency key when a checkout submission is retried',async()=>{
    location.hash='#checkout?plano=pro_monthly';
    client.post.mockRejectedValue(new Error('network'));
    await mountBillingRoute();
    const input=document.getElementById('companyName') as HTMLInputElement;
    input.value='Empresa Teste';
    const form=document.getElementById('checkoutForm')!;
    form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    await vi.waitFor(()=>expect(client.post).toHaveBeenCalledTimes(1));
    form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    await vi.waitFor(()=>expect(client.post).toHaveBeenCalledTimes(2));
    expect(client.post.mock.calls[0][1].idempotencyKey).toBe(client.post.mock.calls[1][1].idempotencyKey);
  });

  it('shows license usage, modules and payment history on plan and billing',async()=>{
    location.hash='#plano-cobranca';
    client.get.mockResolvedValue({data:{
      orders:[],
      subscriptions:[{id:'s1',financial_status:'paid',current_period_end:'2026-10-05',created_at:'',updated_at:'',plan_name:'Pro',price_cents:29900,currency:'BRL',interval_code:'monthly',modules:['finance','rh','ai'],limits:{maxUsers:20,maxProjects:10,maxDevices:5}}],
      usage:{users:12,projects:4,devices:2},
      payments:[{id:'p1',provider_payment_id:'pay1',financial_status:'paid',amount_cents:29900,paid_at:'2026-09-05T12:00:00Z',created_at:'2026-09-05T12:00:00Z'}]
    }});
    await mountBillingRoute();
    expect(document.body.textContent).toContain('12/20');
    expect(document.body.textContent).toContain('4/10');
    expect(document.body.textContent).toContain('2/5');
    expect(document.body.textContent).toContain('Financeiro');
    expect(document.body.textContent).toContain('Histórico de cobranças');
    expect(document.body.textContent).toContain('R$ 299,00');
  });
});
