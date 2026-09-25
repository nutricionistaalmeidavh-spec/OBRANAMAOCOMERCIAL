// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const client=vi.hoisted(()=>({hasSession:vi.fn(),signIn:vi.fn(),signOut:vi.fn(),get:vi.fn(),post:vi.fn(),put:vi.fn()}));
vi.mock('./cloudflare-client',()=>({
  auth:{hasSession:client.hasSession,signIn:client.signIn,signOut:client.signOut},
  api:{get:client.get,post:client.post,put:client.put},
}));

import { mountOwnerPortal } from './owner';

async function mount(){
  document.body.innerHTML='<nav class="nav"></nav><header class="top"></header><main id="content"></main>';
  client.hasSession.mockResolvedValue(true);
  client.get.mockImplementation(async(path:string)=>{
    if(path==='/api/owner/companies')return{data:{companies:[]}};
    if(path==='/api/owner/debora-overview')return{data:{overview:{clients:0,pro:0,freemium:0,expiring:0,revoked:0},clients:[]}};
    if(path==='/api/owner/license-audit')return{data:{events:[]}};
    if(path==='/api/owner/debora-observability/summary')return{data:{accounts:{total:0},presence:{onlineNow:0},usage:{sessionsToday:0},pro:{total:0},plans:{freemium:0},sales:{paid:0,realizedRevenueCents:0}}};
    if(path==='/api/owner/debora-observability/users'||path==='/api/owner/debora-observability/sales')return{data:{items:[],hasMore:false,nextCursor:null}};
    return{data:{}};
  });
  await mountOwnerPortal();
  (document.querySelector('[data-owner-view="debora"]') as HTMLButtonElement).click();
  await Promise.resolve();
}

describe('Central owner Debora integration',()=>{
  beforeEach(()=>{vi.resetAllMocks();document.body.innerHTML=''});

  it('keeps current manual license controls and mounts observability alongside them',async()=>{
    await mount();
    expect(document.getElementById('deboraLicenseForm')).not.toBeNull();
    expect(document.getElementById('deboraLicenseStatus')).not.toBeNull();
    expect(document.getElementById('deboraLicenseRevoke')).not.toBeNull();
    expect(document.querySelector('[data-debora-observability-root]')).not.toBeNull();
    const form=document.getElementById('deboraLicenseForm') as HTMLFormElement;
    expect(form.elements.namedItem('acquisitionChannel')).not.toBeNull();
    expect(form.elements.namedItem('paymentStatus')).not.toBeNull();
    expect(form.elements.namedItem('amount')).not.toBeNull();
    expect(form.elements.namedItem('externalOrderRef')).not.toBeNull();
  });

  it('sends explicit sale metadata only on grant, preserving status/revoke payloads',async()=>{
    client.post.mockResolvedValue({data:{state:'active',activation:'cloudflare_d1',grant:{status:'active',expires_at:'2027-03-25T00:00:00Z'}}});
    await mount();
    const form=document.getElementById('deboraLicenseForm') as HTMLFormElement;
    (form.elements.namedItem('email') as HTMLInputElement).value='client@example.test';
    (form.elements.namedItem('acquisitionChannel') as HTMLSelectElement).value='mercado_livre';
    (form.elements.namedItem('paymentStatus') as HTMLSelectElement).value='paid';
    (form.elements.namedItem('amount') as HTMLInputElement).value='80,00';
    (form.elements.namedItem('externalOrderRef') as HTMLInputElement).value='MLB-123';
    form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    await vi.waitFor(()=>expect(client.post).toHaveBeenCalledWith('/api/owner/debora-license',{
      action:'grant',email:'client@example.test',sale:{acquisitionChannel:'mercado_livre',paymentStatus:'paid',amountCents:8000,externalOrderRef:'MLB-123'},
    }));

    (document.getElementById('deboraLicenseStatus') as HTMLButtonElement).click();
    await vi.waitFor(()=>expect(client.post).toHaveBeenCalledWith('/api/owner/debora-license',{action:'status',email:'client@example.test'}));
  });
});
