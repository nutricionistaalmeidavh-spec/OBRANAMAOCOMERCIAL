// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bindDeboraObservability, deboraObservabilitySection } from './owner-debora-observability';

function apiWith(summary:any,users:any,sales:any,sessions:any={items:[],hasMore:false,nextCursor:null}){
  return {get:vi.fn(async(path:string,query?:Record<string,unknown>)=>{
    if(path.endsWith('/summary'))return{data:summary};
    if(path.endsWith('/sales'))return{data:sales};
    if(path.includes('/sessions'))return{data:sessions};
    if(path.endsWith('/users'))return{data:users};
    throw new Error(`unexpected ${path} ${JSON.stringify(query||{})}`);
  })};
}

const summary={
  accounts:{total:84,createdToday:2,created7d:9,created30d:31},
  presence:{onlineNow:7,activeToday:21,active7d:49,active30d:66},
  usage:{sessionsToday:36,activeSecondsToday:67320,activeSeconds7d:250000,activeSeconds30d:800000},
  pro:{total:33,monthly:12,annual:5,manual6m:16},
  sales:{paid:26,automaticPaid:17,manualPaid:9,realizedRevenueCents:259740},
};
const users={items:[{userId:'u1',email:'pro@example.test',createdAt:'2026-09-20T10:00:00Z',lastSignInAt:'2026-09-25T12:00:00Z',lastSeenAt:'2026-09-25T12:01:00Z',online:true,effectiveLicense:{planCode:'pro_6m',status:'active',source:'mercado_livre_manual'},manualSale:{acquisitionChannel:'mercado_livre',paymentStatus:'paid',amountCents:8000}}],hasMore:true,nextCursor:'users-next'};
const sales={items:[{id:'s1',email:'pro@example.test',source:'manual',planCode:'pro_6m',status:'paid',amountCents:8000,acquisitionChannel:'mercado_livre',externalOrderRef:'MLB-1',createdAt:'2026-09-25T10:00:00Z'}],hasMore:true,nextCursor:'sales-next'};

describe('Debora observability owner module',()=>{
  beforeEach(()=>{document.body.innerHTML=deboraObservabilitySection()});

  it('renders summary cards, users and sales without replacing license controls outside its root',async()=>{
    const client=apiWith(summary,users,sales);
    await bindDeboraObservability(client as any);
    expect(document.body.textContent).toContain('Online agora');
    expect(document.querySelector('[data-debora-observability-metric="online"]')?.textContent).toContain('7');
    expect(document.body.textContent).toContain('Contas totais');
    expect(document.body.textContent).toContain('Vendas pagas');
    expect(document.body.textContent).toContain('R$ 2.597,40');
    expect(document.body.textContent).toContain('pro@example.test');
    expect(document.body.textContent).toContain('Mercado Livre');
    expect(document.body.textContent).toContain('Pago');
  });

  it('keeps filters when advancing user pagination',async()=>{
    const client=apiWith(summary,users,sales);
    await bindDeboraObservability(client as any);
    const search=document.querySelector<HTMLInputElement>('[data-debora-users-search]')!;
    search.value='pro@example.test';search.dispatchEvent(new Event('input'));
    await new Promise(resolve=>setTimeout(resolve,320));
    document.querySelector<HTMLButtonElement>('[data-debora-users-next]')!.click();
    await vi.waitFor(()=>expect(client.get).toHaveBeenCalledWith('/api/owner/debora-observability/users',expect.objectContaining({search:'pro@example.test',cursor:'users-next'})));
  });

  it('loads a user session page only when activity is requested',async()=>{
    const client=apiWith(summary,users,sales,{items:[{id:'sess1',startedAt:'2026-09-25T10:00:00Z',endedAt:'2026-09-25T11:00:00Z',durationSeconds:3600}],hasMore:false,nextCursor:null});
    await bindDeboraObservability(client as any);
    document.querySelector<HTMLButtonElement>('[data-debora-user-activity="u1"]')!.click();
    await vi.waitFor(()=>expect(client.get).toHaveBeenCalledWith('/api/owner/debora-observability/users/u1/sessions',{limit:25}));
    expect(document.body.textContent).toContain('1h 00min');
  });



  it('offers consistent sales source labels and explains realized versus attributed revenue',async()=>{
    const client=apiWith(summary,users,sales);
    await bindDeboraObservability(client as any);
    expect(document.querySelector('[data-debora-sales-body]')?.textContent).toContain('Manual');
    expect(document.querySelector('[data-debora-sales-source-note]')?.textContent).toContain('Asaas');
    expect(document.querySelector('[data-debora-observability-metric="revenue"]')?.textContent).toContain('2.597,40');
    expect(document.querySelector('[data-debora-sales-results]')).not.toBeNull();
  });

  it('filters sales by inclusive dates using the existing paginated server route',async()=>{
    const client=apiWith(summary,users,sales);
    await bindDeboraObservability(client as any);
    const from=document.querySelector<HTMLInputElement>('[data-debora-sales-from]')!;
    const to=document.querySelector<HTMLInputElement>('[data-debora-sales-to]')!;
    from.value='2026-10-01';to.value='2026-10-30';to.dispatchEvent(new Event('change',{bubbles:true}));
    await vi.waitFor(()=>expect(client.get).toHaveBeenCalledWith('/api/owner/debora-observability/sales',expect.objectContaining({
      createdFrom:'2026-10-01T00:00:00.000Z',
      createdTo:'2026-10-30T23:59:59.999Z',
    })));
    expect(document.querySelector('[data-debora-sales-results]')?.textContent).toContain('1');
  });

  it('prevents reversed date filters from calling the server until fixed and supports clearing them',async()=>{
    const client=apiWith(summary,users,sales);
    await bindDeboraObservability(client as any);
    const from=document.querySelector<HTMLInputElement>('[data-debora-sales-from]')!;
    const to=document.querySelector<HTMLInputElement>('[data-debora-sales-to]')!;
    const countBefore=client.get.mock.calls.filter(([path])=>path.endsWith('/sales')).length;
    from.value='2026-10-31';to.value='2026-10-01';to.dispatchEvent(new Event('change',{bubbles:true}));
    await new Promise(resolve=>setTimeout(resolve,0));
    const countAfter=client.get.mock.calls.filter(([path])=>path.endsWith('/sales')).length;
    expect(countAfter).toBe(countBefore);
    expect(document.querySelector('[data-debora-sales-results]')?.textContent).toContain('Data inicial');
    document.querySelector<HTMLButtonElement>('[data-debora-sales-clear]')!.click();
    await vi.waitFor(()=>expect(client.get.mock.calls.filter(([path])=>path.endsWith('/sales')).length).toBeGreaterThan(countAfter));
    expect(from.value).toBe('');expect(to.value).toBe('');
  });

  it('offers a safe license shortcut from a consultant record without posting changes',async()=>{
    const form=document.createElement('form');form.id='deboraLicenseForm';form.innerHTML='<input name="email" type="email">';
    document.body.append(form);
    const client=apiWith(summary,users,sales);
    await bindDeboraObservability(client as any);
    document.querySelector<HTMLButtonElement>('[data-debora-manage-license="pro@example.test"]')!.click();
    expect((form.elements.namedItem('email') as HTMLInputElement).value).toBe('pro@example.test');
    expect(client.get).not.toHaveBeenCalledWith('/api/owner/companies');
  });

  it('degrades to an explicit telemetry warning instead of removing the section',async()=>{
    const client={get:vi.fn(async()=>{throw new Error('503')})};
    await bindDeboraObservability(client as any);
    expect(document.body.textContent).toContain('Atividade indisponível temporariamente');
    expect(document.querySelector('[data-debora-observability-root]')).not.toBeNull();
  });
});
