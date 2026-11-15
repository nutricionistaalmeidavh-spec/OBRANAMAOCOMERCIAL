import { describe, expect, it, vi } from 'vitest';
import { loadCanonicalCatalog } from '../catalog-contract.mjs';
import {
  handlePublicMarketingEvent, handleOwnerMarketingAnalytics,
  summarizeMarketingAnalytics
} from './marketing-analytics';

const fixedNow = new Date('2026-11-14T19:30:00.000Z');
const endpoint = 'https://artisys.dev/api/marketing/metrics';
const ownerEndpoint = 'https://artisys.dev/api/owner/marketing-analytics?days=7';
const authOwner = async () => new Response(JSON.stringify({role:'owner'}),{status:200});
const post = (value:unknown,headers:Record<string,string> = {}) => new Request(endpoint,{
  method:'POST',headers:{origin:'https://artisys.dev','content-type':'text/plain;charset=UTF-8',...headers},body:JSON.stringify(value)
});
function env() {
  const counts = new Map<string,number>();
  const prepare = vi.fn((sql:string)=>({
    bind: (...args:unknown[])=>({
      run:async()=>{if(!sql.includes('ON CONFLICT')) throw Error('non atomic count');
        const key=String(args[1]);counts.set(key,(counts.get(key)||0)+1);},
      all:async()=>({results:[...counts].filter(([key])=>key>=String(args[1]) && key<String(args[2]))
        .map(([id,count])=>({id,count}))})
    })
  }));
  return {DB:{prepare},counts};
}
describe('P5: contadores canônicos e anônimos da vitrine ArtiSys',()=>{
  it('não intercepta APIs existentes e rejeita origem cruzada', async()=>{
    const db=env();
    expect(await handlePublicMarketingEvent(new Request('https://artisys.dev/api/central/access'), db as never, fixedNow)).toBeNull();
    expect((await handlePublicMarketingEvent(post({type:'view',product:'catalog'},{origin:'https://external.test'}),db as never,fixedNow))?.status).toBe(403);
    expect(db.DB.prepare).not.toHaveBeenCalled();
  });
  it('rejeita email, UTM, URLs arbitrárias, IDs falsos e eventos inválidos',async()=>{
    const db=env();
    for(const payload of [
      {type:'view',product:'catalog',email:'secret@example.test'},
      {type:'view',product:'oficina-agricola'},
      {type:'checkout_click',product:'catalog'},
      {type:'checkout_click',product:'pdv-artisys',url:'https://example.com'},
      {type:'unapproved',product:'wppprospector'},
      {type:'gallery_click',product:'foo'},
      {type:'view',product:'../../private'},
      {type:'site_click',product:'pdv-artisys',destination:'sistemas'},
      {type:'site_click',product:'home',destination:'evil'},
      {type:'view',product:'home',destination:'links'},
      {type:'checkout_click',product:'home'},
      {type:'site_click',product:'home',destination:'sistemas',email:'x@y.tld'}
    ]) expect((await handlePublicMarketingEvent(post(payload),db as never,fixedNow))?.status).toBe(400);
    expect(db.DB.prepare).not.toHaveBeenCalled();
  });
  it('faz contagem diária sem IP, cookies ou dados de visitantes',async()=>{
    const db=env();
    const events=[
      {type:'view',product:'catalog'}, {type:'view',product:'pdv-artisys'},
      {type:'product_click',product:'pdv-artisys'}, {type:'checkout_click',product:'pdv-artisys'},
      {type:'checkout_click',product:'pdv-artisys'},{type:'contact_click',product:'oficina'}
    ];
    for(const e of events) expect((await handlePublicMarketingEvent(post(e),db as never,fixedNow))?.status).toBe(204);
    expect(db.counts.get('2026-11-14:checkout_click:pdv-artisys')).toBe(2);
    expect(JSON.stringify([...db.counts])).not.toMatch(/@|cookie|utm|ip|useragent|referrer/i);
    const response=await handleOwnerMarketingAnalytics(new Request(ownerEndpoint),db as never,authOwner,fixedNow);
    expect(response?.status).toBe(200);
    const body=await response!.json() as any;
    expect(body.summary).toMatchObject({views:2,productClicks:1,checkoutClicks:2,contactClicks:1});
    expect(body.products.find((p:any)=>p.slug==='pdv-artisys')).toMatchObject({views:1,productClicks:1,checkoutClicks:2});
    expect(body.daily.at(-1).date).toBe('2026-11-14');
    expect(body.confirmedSales).toBeUndefined();
  });
  it('mantém home separada do catálogo e registra apenas cliques a destinos permitidos',async()=>{
    const db=env();
    for(const payload of [
      {type:'view',product:'home'},
      {type:'view',product:'home'},
      {type:'site_click',product:'home',destination:'sistemas'},
      {type:'view',product:'catalog'}
    ])expect((await handlePublicMarketingEvent(post(payload),db as never,fixedNow))?.status).toBe(204);
    const result=await handleOwnerMarketingAnalytics(new Request(ownerEndpoint),db as never,authOwner,fixedNow);
    const body=await result!.json() as any;
    expect(body.summary.views).toBe(1);
    expect(body.home).toMatchObject({views:2,clicks:1});
    expect(body.home.destinations.find((x:any)=>x.id==='sistemas').clicks).toBe(1);
    expect(body.homeDaily.at(-1)).toMatchObject({views:2,clicks:1});
    expect(db.counts.has('2026-11-14:site_click:home:sistemas')).toBe(true);
    expect(JSON.stringify([...db.counts])).not.toMatch(/cookie|@|utm|ip|referrer/i);
  });
  it('identifica a origem de cada botão WhatsApp sem contar como visita ou contato duplicado',async()=>{
    const db=env();
    for(const e of [
      {type:'whatsapp_click',product:'home',cta:'contato-projeto'},
      {type:'whatsapp_click',product:'home',cta:'footer-whatsapp'},
      {type:'whatsapp_click',product:'wppprospector',cta:'nav-contato'},
      {type:'funnel_step',product:'diagnostico',step:'page_open'},
      {type:'funnel_step',product:'diagnostico',step:'quick_open'},
      {type:'funnel_step',product:'diagnostico',step:'quick_submitted'}
    ])expect((await handlePublicMarketingEvent(post(e),db as never,fixedNow))?.status).toBe(204);
    const body=await (await handleOwnerMarketingAnalytics(new Request(ownerEndpoint),db as never,authOwner,fixedNow))!.json() as any;
    expect(body.whatsapp.total).toBe(3);
    expect(body.whatsapp.byButton.find((x:any)=>x.page==='home'&&x.cta==='contato-projeto')?.clicks).toBe(1);
    expect(body.diagnostic.stages.find((x:any)=>x.step==='quick_submitted')?.count).toBe(1);
    expect(body.summary.contactClicks).toBe(0);
    expect(body.summary.views).toBe(0);
    expect(db.counts.has('2026-11-14:whatsapp_click:home:contato-projeto')).toBe(true);
    expect(db.counts.has('2026-11-14:funnel_step:diagnostico:quick_submitted')).toBe(true);
  });
  it('rejeita CTA ou etapa não permitidos e payloads com texto de mensagem/telefone',async()=>{
    const db=env();
    for(const payload of [
      {type:'whatsapp_click',product:'home',cta:'fake'},
      {type:'whatsapp_click',product:'unknown',cta:'outro-botao'},
      {type:'whatsapp_click',product:'home',cta:'contato-projeto',phone:'55169'},
      {type:'funnel_step',product:'diagnostico',step:'quick_unknown'},
      {type:'funnel_step',product:'diagnostico',step:'quick_submitted',email:'a@example.com'}
    ])expect((await handlePublicMarketingEvent(post(payload),db as never,fixedNow))?.status).toBe(400);
    expect(db.counts.size).toBe(0);
  });
  it('nega consulta de analytics sem papel owner e sem sessão',async()=>{
    for(const auth of [async()=>new Response('{}',{status:403}),async()=>new Response(JSON.stringify({role:'admin'}))]){
      const db=env();
      expect((await handleOwnerMarketingAnalytics(new Request(ownerEndpoint),db as never,auth,fixedNow))?.status).toBe(403);
      expect(db.DB.prepare).not.toHaveBeenCalled();
    }
  });
  it('não aceita períodos arbitrários',async()=>{
    const db=env();
    expect((await handleOwnerMarketingAnalytics(new Request('https://artisys.dev/api/owner/marketing-analytics?days=365'),db as never,authOwner,fixedNow))?.status).toBe(400);
  });
  it('não confunde intenção de compra com venda confirmada',()=>{
    const result=summarizeMarketingAnalytics([{id:'2026-11-14:checkout_click:pdv-artisys',count:7}],7,fixedNow,loadCanonicalCatalog().products);
    expect(result.summary.checkoutClicks).toBe(7);
    expect(result).not.toHaveProperty('confirmedSales');
    expect(result.products.find((x:any)=>x.slug==='pdv-artisys')?.checkoutClicks).toBe(7);
  });
});
