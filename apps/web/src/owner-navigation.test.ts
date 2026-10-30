// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const client=vi.hoisted(()=>({hasSession:vi.fn(),signIn:vi.fn(),signOut:vi.fn(),get:vi.fn(),post:vi.fn(),put:vi.fn()}));
vi.mock('./cloudflare-client',()=>({
  auth:{hasSession:client.hasSession,signIn:client.signIn,signOut:client.signOut},
  api:{get:client.get,post:client.post,put:client.put}
}));

import { mountOwnerPortal } from './owner';

const companies=[
  {id:'c1',name:'Cliente Ativo',adminEmail:'ativo@example.test',status:'active',modules:['finance','obra360'],channels:['desktop','mobile'],usersCount:3,projectsCount:2,devicesCount:1,license:{id:'l1',plan:'manual',expiresAt:'2027-09-30T23:59:59.000Z',maxUsers:12,maxProjects:6,maxDevices:3},devices:[{id:'d1',name:'PC Administrativo',status:'active'}]},
  {id:'c2',name:'Cliente Pendente',adminEmail:'pendente@example.test',status:'pending',modules:['obra360'],channels:['desktop'],usersCount:1,projectsCount:0,devicesCount:0,license:{id:'l2',plan:'manual',maxUsers:5,maxProjects:2,maxDevices:1}}
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
    if(path==='/api/central/access')return {data:{role:'owner'}};
    if(path==='/api/owner/debora-overview')return {data:{overview:deboraOverview,clients:deboraClients}};
    if(path==='/api/owner/license-audit')return {data:{events:licenseEvents}};
    if(path==='/api/owner/companies/c1')return {data:{company:companies[0]}};
    return {data:{companies}};
  });
  await mountOwnerPortal();
}

function clickView(view:string){
  (document.querySelector(`[data-owner-view="${view}"]`) as HTMLButtonElement).click();
}

describe('Central Artisys owner navigation',()=>{
  beforeEach(()=>{vi.restoreAllMocks();vi.resetAllMocks();document.body.innerHTML='';});

  it('restores Google sign-in when the owner has no active session',async()=>{
    document.body.innerHTML='<nav class="nav"></nav><header class="top"></header><main id="content"></main>';
    client.hasSession.mockResolvedValue(false);
    client.signIn.mockResolvedValue(undefined);
    await mountOwnerPortal();
    const button=document.getElementById('centralGoogleLogin') as HTMLButtonElement;
    expect(button).not.toBeNull();
    expect(button.textContent).toContain('Entrar com Google');
    expect(document.querySelector('input[type="password"]')).toBeNull();
    button.click();
    await vi.waitFor(()=>expect(client.signIn).toHaveBeenCalledWith({scope:'openid email profile offline_access'}));
  });

  it('opens on a compact overview with product cards and operational metrics',async()=>{
    await mount();
    expect(document.querySelector('[data-owner-shell]')).not.toBeNull();
    expect(document.querySelectorAll('[data-owner-view]')).toHaveLength(5);
    expect(document.body.textContent).toContain('Visão geral');
    expect(document.body.textContent).toContain('Obra na Mão');
    expect(document.body.textContent).toContain('Débora Lactação');
    expect(document.querySelector('[data-metric="companies"]')?.textContent).toContain('2');
    expect(document.querySelector('[data-metric="active"]')?.textContent).toContain('2');
    expect(document.getElementById('companyForm')).toBeNull();
    expect(document.getElementById('deboraLicenseForm')).toBeNull();
    expect(document.querySelector('a[href="./index.html#portal"]')).not.toBeNull();
  });

  it('renders only lactation administration for an authorized Débora session',async()=>{
    document.body.innerHTML='<nav class="nav"></nav><header class="top"></header><main id="content"></main>';
    client.hasSession.mockResolvedValue(true);
    client.get.mockImplementation(async(path:string)=>{
      if(path==='/api/central/access')return {data:{role:'debora'}};
      if(path==='/api/owner/debora-overview')return {data:{overview:deboraOverview,clients:deboraClients}};
      throw new Error('Unexpected non-lactation API read: '+path);
    });
    await mountOwnerPortal();
    expect(document.querySelector('[data-owner-current="debora"]')).not.toBeNull();
    expect(document.querySelector('[data-owner-view="obra"]')).toBeNull();
    expect(document.getElementById('companyForm')).toBeNull();
    expect(document.querySelector('[data-metric="companies"]')).toBeNull();
    expect(document.getElementById('deboraLicenseForm')).not.toBeNull();
    expect(document.body.textContent).not.toContain('Cliente Ativo');
    expect(document.body.textContent).not.toContain('Minha operação');
    expect(client.get).not.toHaveBeenCalledWith('/api/owner/companies');
    expect(client.get).not.toHaveBeenCalledWith('/api/owner/license-audit');
  });

  it('has a collapsible, accessible task menu for owner without horizontal tab navigation',async()=>{
    await mount();
    const toggle=document.querySelector<HTMLButtonElement>('[data-owner-nav-toggle]');
    const menu=document.querySelector<HTMLElement>('#owner-nav-options');
    expect(toggle).not.toBeNull();
    expect(menu).not.toBeNull();
    expect(toggle?.getAttribute('aria-controls')).toBe('owner-nav-options');
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    toggle?.click();
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    expect(menu?.classList.contains('is-open')).toBe(true);
    clickView('clients');
    expect(document.querySelector('[data-owner-current="clients"]')).not.toBeNull();
    expect(document.querySelector<HTMLButtonElement>('[data-owner-nav-toggle]')?.getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelector<HTMLElement>('[data-owner-nav-current]')?.textContent).toContain('Clientes');
  });

  it('offers task-based navigation to Débora without granting Obra access',async()=>{
    document.body.innerHTML='<nav class="nav"></nav><header class="top"></header><main id="content"></main>';
    client.hasSession.mockResolvedValue(true);
    client.get.mockImplementation(async(path:string)=>{
      if(path==='/api/central/access')return {data:{role:'debora'}};
      if(path==='/api/owner/debora-overview')return {data:{overview:deboraOverview,clients:deboraClients}};
      if(path.startsWith('/api/owner/debora-'))return {data:{items:[],partners:[],sales:[],summary:{},accounts:{}}};
      throw new Error('Unexpected Obra request: '+path);
    });
    const scroll=vi.fn();
    const previous=HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView=scroll;
    try{
      await mountOwnerPortal();
      const links=[...document.querySelectorAll<HTMLButtonElement>('[data-owner-jump]')];
      expect(links.map(x=>x.textContent?.trim())).toEqual(['Resumo','Consultoras','Licenças','Vendas','Uso do sistema','Parceiros']);
      expect(document.querySelector('[data-owner-view="obra"]')).toBeNull();
      expect(document.getElementById('debora-users')).not.toBeNull();
      expect(document.getElementById('debora-sales')).not.toBeNull();
      expect(document.getElementById('debora-partners')).not.toBeNull();
      document.querySelector<HTMLButtonElement>('[data-owner-nav-toggle]')?.click();
      document.querySelector<HTMLButtonElement>('[data-owner-jump="debora-users"]')?.click();
      expect(scroll).toHaveBeenCalled();
      expect(document.querySelector('[data-owner-nav-current]')?.textContent).toContain('Consultoras');
      expect(document.querySelector<HTMLButtonElement>('[data-owner-nav-toggle]')?.getAttribute('aria-expanded')).toBe('false');
      expect(client.get).not.toHaveBeenCalledWith('/api/owner/companies');
    }finally{HTMLElement.prototype.scrollIntoView=previous;}
  });

  it('closes task menu on Escape and restores button focus',async()=>{
    await mount();
    const toggle=document.querySelector<HTMLButtonElement>('[data-owner-nav-toggle]')!;
    toggle.click();
    toggle.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggle);
  });


  it('consolidates the Débora dashboard into four essential metrics and discloses secondary license statuses',async()=>{
    document.body.innerHTML='<nav class="nav"></nav><header class="top"></header><main id="content"></main>';
    client.hasSession.mockResolvedValue(true);
    client.get.mockImplementation(async(path:string)=>{
      if(path==='/api/central/access')return {data:{role:'debora'}};
      if(path==='/api/owner/debora-overview')return {data:{overview:deboraOverview,clients:deboraClients}};
      if(path==='/api/owner/debora-observability/summary')return {data:{sales:{paid:7,realizedRevenueCents:14000},presence:{activeToday:4},accounts:{total:12}}};
      if(path.startsWith('/api/owner/debora-'))return {data:{items:[],partners:[],sales:[],summary:{}}};
      throw new Error('Unexpected Obra read: '+path);
    });
    await mountOwnerPortal();
    const headline=document.querySelectorAll('[data-debora-headline]');
    expect(headline).toHaveLength(4);
    await vi.waitFor(()=>expect(document.querySelector('[data-debora-headline="sales"]')?.textContent).toContain('7'));
    expect(document.querySelector('[data-debora-headline="pro"]')?.textContent).toContain('1');
    expect(document.querySelector('[data-debora-headline="active-today"]')?.textContent).toContain('4');
    const detailed=document.querySelector<HTMLDetailsElement>('[data-debora-license-details]');
    expect(detailed?.open).toBe(false);
    expect(detailed?.textContent).toContain('Expirando');
    expect(detailed?.textContent).toContain('Revogadas');
    expect(client.get).not.toHaveBeenCalledWith('/api/owner/companies');
  });

  it('keeps full Obra company controls but groups optional configuration in a disclosure',async()=>{
    await mount();
    clickView('obra');
    const custom=document.querySelector<HTMLDetailsElement>('[data-owner-company-options]');
    expect(custom).not.toBeNull();
    expect(custom?.open).toBe(false);
    const form=document.getElementById('companyForm') as HTMLFormElement;
    expect(form.querySelectorAll('input[name="modules"]:checked').length).toBeGreaterThan(0);
    expect(form.querySelector('input[name="advancedServer"]')).not.toBeNull();
    expect(form.querySelector('button[type="submit"]')).not.toBeNull();
  });

  it('separates Débora read-only license lookup from the explicit sale and grant form',async()=>{
    await mount();clickView('debora');
    const details=document.querySelector<HTMLDetailsElement>('[data-debora-grant-details]');
    expect(details?.open).toBe(false);
    expect(details?.querySelector('button[type="submit"]')?.textContent).toContain('Liberar');
    expect(document.getElementById('deboraLicenseStatus')?.closest('details')).toBeNull();
    expect(document.getElementById('deboraLicenseRevoke')?.closest('details')).toBeNull();
  });
  it('provisions Obra na Mão by email and keeps the code only as contingency',async()=>{
    await mount();
    clickView('obra');
    const form=document.getElementById('companyForm') as HTMLFormElement;
    expect(form).not.toBeNull();
    expect(document.body.textContent).toContain('liberação principal fica vinculada ao e-mail');
    (form.elements.namedItem('name') as HTMLInputElement).value='Nova Empresa';
    (form.elements.namedItem('adminEmail') as HTMLInputElement).value='nova@example.test';
    (form.elements.namedItem('plan') as HTMLInputElement).value='pro';
    (form.elements.namedItem('expiresAt') as HTMLInputElement).value='2027-12-31';
    (form.elements.namedItem('maxUsers') as HTMLInputElement).value='20';
    (form.elements.namedItem('maxProjects') as HTMLInputElement).value='8';
    (form.elements.namedItem('maxDevices') as HTMLInputElement).value='4';
    client.post.mockResolvedValue({data:{license:{code:'ABC123'}}});
    form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    await vi.waitFor(()=>expect(client.post).toHaveBeenCalledWith('/api/owner/companies',expect.objectContaining({name:'Nova Empresa',adminEmail:'nova@example.test',plan:'pro',expiresAt:'2027-12-31',maxUsers:20,maxProjects:8,maxDevices:4})));
    expect(document.getElementById('createResult')?.textContent).toContain('primeiro acesso é reconhecido por esse e-mail');
    expect(document.getElementById('createResult')?.textContent).toContain('Código de contingência');
  });

  it('exposes plan, expiry and license limits in the company detail',async()=>{
    await mount();
    clickView('clients');
    (document.querySelector('[data-company="c1"]') as HTMLButtonElement).click();
    await vi.waitFor(()=>expect(document.getElementById('licenseForm')).not.toBeNull());
    const form=document.getElementById('licenseForm') as HTMLFormElement;
    expect((form.elements.namedItem('plan') as HTMLInputElement).value).toBe('manual');
    expect((form.elements.namedItem('expiresAt') as HTMLInputElement).value).toBe('2027-09-30');
    expect((form.elements.namedItem('maxUsers') as HTMLInputElement).value).toBe('12');
    expect((form.elements.namedItem('maxProjects') as HTMLInputElement).value).toBe('6');
    expect((form.elements.namedItem('maxDevices') as HTMLInputElement).value).toBe('3');
    client.put.mockResolvedValue({data:{ok:true}});
    (form.elements.namedItem('maxUsers') as HTMLInputElement).value='15';
    form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    await vi.waitFor(()=>expect(client.put).toHaveBeenCalledWith('/api/owner/companies/c1',expect.objectContaining({status:'active',plan:'manual',maxUsers:15,maxProjects:6,maxDevices:3})));
  });

  it('manages a device independently without changing the company license',async()=>{
    await mount();
    clickView('clients');
    (document.querySelector('[data-company="c1"]') as HTMLButtonElement).click();
    await vi.waitFor(()=>expect(document.querySelector('[data-device-id="d1"]')).not.toBeNull());
    const confirm=vi.spyOn(window,'confirm').mockReturnValue(true);
    client.put.mockResolvedValue({data:{ok:true,status:'revoked'}});
    (document.querySelector('[data-device-id="d1"]') as HTMLButtonElement).click();
    await vi.waitFor(()=>expect(client.put).toHaveBeenCalledWith('/api/owner/devices/d1',{status:'revoked'}));
    expect(confirm).toHaveBeenCalledWith('Revogar somente este computador? A licença da empresa permanecerá inalterada.');
    expect(client.put).not.toHaveBeenCalledWith('/api/owner/companies/c1',expect.anything());
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
    await vi.waitFor(()=>expect(client.post).toHaveBeenCalledWith('/api/owner/debora-license',{
      action:'grant',
      email:'consultora@example.test',
      sale:{acquisitionChannel:'mercado_livre',paymentStatus:'paid',amountCents:null,externalOrderRef:null},
    }));
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
      if(path==='/api/central/access')return {data:{role:'owner'}};
      if(path==='/api/owner/debora-overview'||path==='/api/owner/license-audit')throw new Error('optional admin data unavailable');
      return {data:{companies}};
    });
    await mountOwnerPortal();
    expect(document.querySelector('[data-owner-shell]')).not.toBeNull();
    clickView('obra');
    expect(document.getElementById('companyForm')).not.toBeNull();
  });
});