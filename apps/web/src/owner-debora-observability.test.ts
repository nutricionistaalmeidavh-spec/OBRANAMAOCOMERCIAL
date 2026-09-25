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

  it('degrades to an explicit telemetry warning instead of removing the section',async()=>{
    const client={get:vi.fn(async()=>{throw new Error('503')})};
    await bindDeboraObservability(client as any);
    expect(document.body.textContent).toContain('Atividade indisponível temporariamente');
    expect(document.querySelector('[data-debora-observability-root]')).not.toBeNull();
  });
});
