// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const client=vi.hoisted(()=>({hasSession:vi.fn(),signOut:vi.fn(),get:vi.fn(),post:vi.fn(),put:vi.fn()}));
vi.mock('./cloudflare-client',()=>({
  auth:{hasSession:client.hasSession,signOut:client.signOut},
  api:{get:client.get,post:client.post,put:client.put}
}));

import { mountOwnerPortal } from './owner';

const companies=[
  {id:'c1',name:'Cliente Ativo',adminEmail:'ativo@example.test',status:'active',modules:['finance','obra360'],channels:['desktop','mobile'],usersCount:3,projectsCount:2,devicesCount:1,license:{id:'l1',plan:'manual'}},
  {id:'c2',name:'Cliente Pendente',adminEmail:'pendente@example.test',status:'pending',modules:['obra360'],channels:['desktop'],usersCount:1,projectsCount:0,devicesCount:0,license:{id:'l2',plan:'manual'}}
];
const deboraOverview={clients:3,pro:1,freemium:2,expiring:1,revoked:1};
const deboraClients=[
  {email:'pro@debora.test',planCode:'pro_6m',status:'active',expiresAt:'2027-03-16T12:00:00.000Z',source:'mercado_livre_manual',expiring:false},
  {email:'expira@debora.test',planCode:'pro_6m',status:'active',expiresAt:'2026-09-30T12:00:00.000Z',source:'mercado_livre_manual',expiring:true},
  {email:'revogada@debora.test',planCode:'pro_6m',status:'revoked',expiresAt:'2027-01-01T12:00:00.000Z',source:'mercado_livre_manual',expiring:false},
];
const licenseEvents=[
  {id:'ev1',product:'obra-na-mao',email:'ativo@example.test',action:'created',source:'manual',actor:'owner@example.test',createdAt:'2026-09-16T10:00:00.000Z'},
  {id:'ev2',product:'debora-lactacao',email:'pro@debora.test',action:'grant',source:'mercado_livre_manual',actor:'owner@example.test',createdAt:'2026-09-16T11:00:00.000Z'},
];

async function mount(){
  document.body.innerHTML='<nav class="nav"></nav><header class="top"></header><main id="content"></main>';
  client.hasSession.mockResolvedValue(true);
  client.get.mockImplementation(async(path:string)=>{
    if(path==='/api/owner/debora-overview')return {data:{overview:deboraOverview,clients:deboraClients}};
    if(path==='/api/owner/license-audit')return {data:{events:licenseEvents}};
    return {data:{companies}};
  });
  await mountOwnerPortal();
}

function clickView(view:string){
  (document.querySelector(`[data-owner-view="${view}"]`) as HTMLButtonElement).click();
}

describe('Central Artisys owner navigation',()=>{
  beforeEach(()=>{vi.restoreAllMocks();vi.resetAllMocks();document.body.innerHTML='';});

  it('opens on a compact overview with product cards and operational metrics',async()=>{
    await mount();
    expect(document.querySelector('[data-owner-shell]')).not.toBeNull();
    expect(document.querySelectorAll('[data-owner-view]')).toHaveLength(5);
    expect(document.body.textContent).toContain('Visão geral');
    expect(document.body.textContent).toContain('Obra na Mão');
    expect(document.body.textContent).toContain('Débora Lactação');
    expect(document.querySelector('[data-metric="companies"]')?.textContent).toContain('2');
    expect(document.querySelector('[data-metric="active"]')?.textContent).toContain('1');
    expect(document.getElementById('companyForm')).toBeNull();
    expect(document.getElementById('deboraLicenseForm')).toBeNull();
    expect(document.querySelector('a[href="./index.html#portal"]')).not.toBeNull();
  });

  it('keeps Obra na Mão provisioning isolated and preserves its license-generation endpoint',async()=>{
    await mount();
    clickView('obra');
    const form=document.getElementById('companyForm') as HTMLFormElement;
    expect(form).not.toBeNull();
    expect(document.body.textContent).toContain('Nova empresa cliente');
    (form.elements.namedItem('name') as HTMLInputElement).value='Nova Empresa';
    (form.elements.namedItem('adminEmail') as HTMLInputElement).value='nova@example.test';
    client.post.mockResolvedValue({data:{license:{code:'ABC123'}}});
    form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    await vi.waitFor(()=>expect(client.post).toHaveBeenCalledWith('/api/owner/companies',expect.objectContaining({name:'Nova Empresa',adminEmail:'nova@example.test'})));
  });

  it('keeps Débora licensing in a dedicated product view, exposes SEO and preserves its endpoint',async()=>{
    await mount();
    clickView('debora');
    const form=document.getElementById('deboraLicenseForm') as HTMLFormElement;
    expect(form).not.toBeNull();
    expect(document.body.textContent).toContain('Liberar / renovar 6 meses');
    expect(document.querySelector('[data-debora-metric="clients"]')?.textContent).toContain('3');
    expect(document.querySelector('a[href="https://deboralactacao.com/admin/seo/"]')).not.toBeNull();
    (form.elements.namedItem('email') as HTMLInputElement).value='consultora@example.test';
    client.post.mockResolvedValue({data:{state:'active',grant:{email:'consultora@example.test',status:'active',plan_code:'pro_6m'}}});
    form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    await vi.waitFor(()=>expect(client.post).toHaveBeenCalledWith('/api/owner/debora-license',{action:'grant',email:'consultora@example.test'}));
  });

  it('renders a unified client list with product and status filters',async()=>{
    await mount();
    clickView('clients');
    expect(document.body.textContent).toContain('Todos os clientes');
    expect(document.body.textContent).toContain('Cliente Ativo');
    expect(document.body.textContent).toContain('pro@debora.test');
    const product=document.getElementById('ownerClientProduct') as HTMLSelectElement;
    product.value='debora-lactacao';
    product.dispatchEvent(new Event('change',{bubbles:true}));
    expect((document.querySelector('[data-owner-client][data-product="obra-na-mao"]') as HTMLElement).hidden).toBe(true);
    expect((document.querySelector('[data-owner-client][data-product="debora-lactacao"]') as HTMLElement).hidden).toBe(false);
    const search=document.getElementById('ownerClientSearch') as HTMLInputElement;
    search.value='revogada';
    search.dispatchEvent(new Event('input',{bubbles:true}));
    expect(Array.from(document.querySelectorAll<HTMLElement>('[data-owner-client]')).filter(node=>!node.hidden)).toHaveLength(1);
  });

  it('renders unified license status, expiring licenses and combined history',async()=>{
    await mount();
    clickView('licenses');
    expect(document.body.textContent).toContain('Todas as licenças');
    expect(document.body.textContent).toContain('Expira em breve');
    expect(document.body.textContent).toContain('Histórico de alterações');
    expect(document.body.textContent).toContain('pro@debora.test');
    expect(document.body.textContent).toContain('ativo@example.test');
    expect(document.getElementById('ownerLicenseStatus')).not.toBeNull();
  });

  it('requires confirmation before revoking a Debora license',async()=>{
    await mount();
    clickView('debora');
    const form=document.getElementById('deboraLicenseForm') as HTMLFormElement;
    (form.elements.namedItem('email') as HTMLInputElement).value='pro@debora.test';
    const confirm=vi.spyOn(window,'confirm').mockReturnValue(false);
    (document.getElementById('deboraLicenseRevoke') as HTMLButtonElement).click();
    expect(confirm).toHaveBeenCalled();
    expect(client.post).not.toHaveBeenCalledWith('/api/owner/debora-license',expect.objectContaining({action:'revoke'}));
  });

  it('keeps the Obra na Mão admin usable when Debora reads are unavailable',async()=>{
    document.body.innerHTML='<nav class="nav"></nav><header class="top"></header><main id="content"></main>';
    client.hasSession.mockResolvedValue(true);
    client.get.mockImplementation(async(path:string)=>{
      if(path==='/api/owner/debora-overview'||path==='/api/owner/license-audit')throw new Error('optional admin data unavailable');
      return {data:{companies}};
    });
    await mountOwnerPortal();
    expect(document.querySelector('[data-owner-shell]')).not.toBeNull();
    clickView('obra');
    expect(document.getElementById('companyForm')).not.toBeNull();
  });
});
