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
const deboraOverview={clients:5,pro:2,freemium:2,expiring:1,revoked:1};

async function mount(){
  document.body.innerHTML='<nav class="nav"></nav><header class="top"></header><main id="content"></main>';
  client.hasSession.mockResolvedValue(true);
  client.get.mockImplementation(async(path:string)=>path==='/api/owner/debora-overview'?{data:{overview:deboraOverview}}:{data:{companies}});
  await mountOwnerPortal();
}

function clickView(view:string){
  (document.querySelector(`[data-owner-view="${view}"]`) as HTMLButtonElement).click();
}

describe('Central Artisys owner navigation',()=>{
  beforeEach(()=>{vi.resetAllMocks();document.body.innerHTML='';});

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

  it('keeps Débora licensing in a dedicated product view and endpoint',async()=>{
    await mount();
    clickView('debora');
    const form=document.getElementById('deboraLicenseForm') as HTMLFormElement;
    expect(form).not.toBeNull();
    expect(document.body.textContent).toContain('Pro 6 meses');
    expect(document.querySelector('[data-debora-metric="clients"]')?.textContent).toContain('5');
    expect(document.querySelector('[data-debora-metric="pro"]')?.textContent).toContain('2');
    expect(document.querySelector('[data-debora-metric="freemium"]')?.textContent).toContain('2');
    expect(document.querySelector('[data-debora-metric="expiring"]')?.textContent).toContain('1');
    expect(document.querySelector('[data-debora-metric="revoked"]')?.textContent).toContain('1');
    (form.elements.namedItem('email') as HTMLInputElement).value='consultora@example.test';
    client.post.mockResolvedValue({data:{state:'active',grant:{email:'consultora@example.test',status:'active',plan_code:'pro_6m'}}});
    form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    await vi.waitFor(()=>expect(client.post).toHaveBeenCalledWith('/api/owner/debora-license',{action:'grant',email:'consultora@example.test'}));
  });

  it('exposes dedicated Clientes and Licenças views without duplicating provisioning forms',async()=>{
    await mount();
    clickView('clients');
    expect(document.body.textContent).toContain('Clientes do Obra na Mão');
    expect(document.body.textContent).toContain('Cliente Ativo');
    expect(document.getElementById('companyForm')).toBeNull();
    clickView('licenses');
    expect(document.body.textContent).toContain('Licenças do Obra na Mão');
    expect(document.body.textContent).toContain('Cliente Pendente');
    expect(document.getElementById('deboraLicenseForm')).toBeNull();
  });
});
