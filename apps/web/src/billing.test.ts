// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const client=vi.hoisted(()=>({get:vi.fn(),post:vi.fn(),getUser:vi.fn(),signOut:vi.fn()}));
vi.mock('./cloudflare-client',()=>({api:{get:client.get,post:client.post},auth:{getUser:client.getUser,signOut:client.signOut}}));
import { mountBillingRoute } from './billing';

const plans=[
  {code:'essencial_monthly',name:'Essencial',interval:'monthly',priceCents:14900,features:['Obra360','PWA/mobile'],limits:{maxUsers:5,maxProjects:3,maxDevices:2}},
  {code:'pro_monthly',name:'Pro',interval:'monthly',priceCents:29900,features:['Financeiro','RH'],limits:{maxUsers:20,maxProjects:10,maxDevices:5}},
  {code:'empresa_monthly',name:'Empresa',interval:'monthly',priceCents:49900,features:['IA'],limits:{maxUsers:60,maxProjects:30,maxDevices:15}},
  {code:'pro_yearly',name:'Pro',interval:'yearly',priceCents:299000,features:['Financeiro'],limits:{maxUsers:20,maxProjects:10,maxDevices:5}}
];

describe('billing commercial screens',()=>{
  beforeEach(()=>{vi.resetAllMocks();document.body.innerHTML='';sessionStorage.clear();client.getUser.mockResolvedValue({userId:'u1',name:'Cliente',email:'cliente@example.test'});client.get.mockResolvedValue({data:{plans}})});

  it('renders the real catalog with desktop sidebar and mobile navigation',async()=>{
    location.hash='#planos';await mountBillingRoute();
    expect(document.querySelectorAll('.billing-plan')).toHaveLength(3);
    expect(document.querySelector('.billing-sidebar')).not.toBeNull();
    expect(Array.from(document.querySelectorAll('.billing-bottom span')).map(node=>node.textContent)).toEqual(['Planos','Cobrança','Início']);
    expect(document.body.textContent).toContain('Desktop e PWA/mobile incluídos');
  });

  it('creates checkout with an idempotency key and exposes only the Asaas URL',async()=>{
    location.hash='#checkout?plano=pro_monthly';
    client.post.mockResolvedValue({data:{order:{id:'order-12345678',amount_cents:29900,currency:'BRL',financial_status:'pending',checkout_url:'https://asaas.example.test/pay'}}});
    await mountBillingRoute();
    (document.getElementById('companyName') as HTMLInputElement).value='Empresa Teste';
    document.getElementById('checkoutForm')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    await vi.waitFor(()=>expect(client.post).toHaveBeenCalled());
    const [path,body]=client.post.mock.calls[0];
    expect(path).toBe('/api/billing/checkout');
    expect(body).toMatchObject({planCode:'pro_monthly',companyName:'Empresa Teste'});
    expect(body.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('shows enriched subscription data on plan and billing',async()=>{
    location.hash='#plano-cobranca';client.get.mockResolvedValue({data:{orders:[],subscriptions:[{id:'s1',financial_status:'paid',current_period_end:'2026-10-05',created_at:'',updated_at:'',plan_name:'Pro',price_cents:29900,currency:'BRL',interval_code:'monthly'}]}});
    await mountBillingRoute();
    expect(document.body.textContent).toContain('Pro');
    expect(document.body.textContent).toContain('R$ 299,00');
    expect(document.body.textContent).toContain('Ativa');
  });
});
