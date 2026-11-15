import { describe, expect, it, vi } from 'vitest';
import {
  marketingPages, updateSeoHead, handleOwnerMarketingSeo, handlePublicMarketingSeo
} from './marketing-seo';

const html = '<!doctype html><html lang="pt-BR"><head><title>Old title</title><meta name="description" content="Old description"><link rel="canonical" href="https://artisys.dev/oficina/"><meta property="og:title" content="Old social"><script type="application/ld+json">{"@type":"SoftwareApplication","name":"ArtiSys Oficina"}</script></head><body><main class="unchanged"><h1>Original design</h1><a href="/comprar">Comprar</a></main></body></html>';
const now=new Date('2026-11-15T01:00:00Z');
const owner=async()=>new Response(JSON.stringify({role:'owner'}),{status:200});
const denied=async()=>new Response(JSON.stringify({role:'debora'}),{status:200});
const url='https://artisys.dev/api/owner/marketing-seo';
const save = (slug:string,body:unknown,headers:Record<string,string>={})=>new Request(url+'?slug='+slug,{
  method:'PUT',headers:{origin:'https://artisys.dev','content-type':'application/json',...headers},body:JSON.stringify(body)
});
function environment() {
  const records=new Map<string,string>();
  const prepare=vi.fn((sql:string)=>({
    bind:(...args:unknown[])=>({
      first:async()=>{const key=String(args[1]);return records.has(key)?{record_json:records.get(key)}:null;},
      all:async()=>({results:[...records].map(([id,record_json])=>({id,record_json}))}),
      run:async()=>{
        const key=String(args[1]);
        if(sql.startsWith('DELETE')) {
          const prev=JSON.parse(records.get(key)||'null');
          if(!prev || prev.version!==args[2])return {meta:{changes:0}};
          records.delete(key);return {meta:{changes:1}};
        }
        const next=JSON.parse(String(args[2]));
        const prev=JSON.parse(records.get(key)||'null');
        const expected=args[5];
        if(prev && prev.version!==expected)return {meta:{changes:0}};
        if(!prev && expected!==0)return {meta:{changes:0}};
        records.set(key,JSON.stringify(next));
        return {meta:{changes:1}};
      }
    })
  }));
  const assets={
    fetch:vi.fn(async(req:Request)=>new Response(html,{status:200,headers:{'content-type':'text/html; charset=utf-8','etag':'"old"'}}))
  };
  return {DB:{prepare},ASSETS:assets,records};
}
const seo={
  title:'ArtiSys Oficina | Controle de ordens e peças',
  description:'Organize ordens de serviço, peças, estoque e vendas com um sistema offline para oficinas e equipes de manutenção.',
  ogTitle:'ArtiSys Oficina para empresas',
  ogDescription:'Explore o ArtiSys Oficina e conheça as funcionalidades disponíveis.',
  image:'/oficina/media/dashboard.webp'
};
describe('Marketing SEO owner dashboard backend',()=>{
  it('limits routes to the eight local landings plus catalog',()=>{
    expect(marketingPages()).toHaveLength(9);
    expect(marketingPages().map(p=>p.slug)).toContain('gestao-holerites');
    expect(marketingPages().map(p=>p.slug)).not.toContain('consultora-amamentacao');
    expect(marketingPages().map(p=>p.slug)).not.toContain('oficina-agricola');
    expect(marketingPages().find(p=>p.slug==='oficina')?.path).toBe('/oficina/');
  });
  it('protects metadata and mutations behind existing owner role',async()=>{
    const env=environment();
    const bad=await handleOwnerMarketingSeo(new Request(url),env as never,denied,now);
    expect(bad?.status).toBe(403);
    const badSave=await handleOwnerMarketingSeo(save('oficina',{expectedVersion:0,...seo}),env as never,denied,now);
    expect(badSave?.status).toBe(403);
    expect(env.DB.prepare).not.toHaveBeenCalled();
  });
  it('returns all nine pages and editable source metadata without needing a paid service',async()=>{
    const env=environment();
    const list=await handleOwnerMarketingSeo(new Request(url),env as never,owner,now);
    expect(list?.status).toBe(200);
    const data=await list!.json() as any;
    expect(data.pages).toHaveLength(9);
    const detail=await handleOwnerMarketingSeo(new Request(url+'?slug=oficina'),env as never,owner,now);
    const state=await detail!.json() as any;
    expect(state.page.original.title).toBe('Old title');
    expect(state.page.canonical).toBe('https://artisys.dev/oficina/');
    expect(state.page.images).toContain('/oficina/media/dashboard.webp');
    expect(state.page.version).toBe(0);
  });
  it('publishes an edit, applies changes to head only and retains schema, canonical, body and checkout',async()=>{
    const env=environment();
    const response=await handleOwnerMarketingSeo(save('oficina',{expectedVersion:0,...seo}),env as never,owner,now);
    expect(response?.status).toBe(200);
    const record=await response!.json() as any;
    expect(record.page.version).toBe(1);
    const publicResponse=await handlePublicMarketingSeo(new Request('https://artisys.dev/oficina/'),env as never);
    expect(publicResponse?.status).toBe(200);
    const published=await publicResponse!.text();
    expect(published).toContain('<title>ArtiSys Oficina | Controle de ordens e peças</title>');
    expect(published).toContain('https://artisys.dev/oficina/');
    expect(published).toContain('/oficina/media/dashboard.webp');
    expect((published.match(/<title>/g)||[])).toHaveLength(1);
    expect((published.match(/name="description"/g)||[])).toHaveLength(1);
    expect(published.slice(published.indexOf('<body'))).toBe(html.slice(html.indexOf('<body')));
    expect(published).toContain('application/ld+json');
    expect(publicResponse?.headers.get('cache-control')).toContain('no-store');
  });
  it('rejects cross-site writes, injection, arbitrary images, robots and canonical changes',async()=>{
    const env=environment();
    for(const payload of [
      {expectedVersion:0,...seo,title:'<script>alert(1)</script>'},
      {expectedVersion:0,...seo,image:'https://evil.example/track.png'},
      {expectedVersion:0,...seo,canonical:'https://evil.example/'},
      {expectedVersion:0,...seo,robots:'noindex'},
      {expectedVersion:0,...seo,description:'tiny'}
    ]){
      const response=await handleOwnerMarketingSeo(save('oficina',payload),env as never,owner,now);
      expect(response?.status).toBe(400);
    }
    expect((await handleOwnerMarketingSeo(save('oficina',{expectedVersion:0,...seo},{origin:'https://evil.test'}),env as never,owner,now))?.status).toBe(403);
    expect(env.records.size).toBe(0);
  });
  it('prevents overwriting newer changes and supports confirmed reset',async()=>{
    const env=environment();
    expect((await handleOwnerMarketingSeo(save('oficina',{expectedVersion:0,...seo}),env as never,owner,now))?.status).toBe(200);
    expect((await handleOwnerMarketingSeo(save('oficina',{expectedVersion:0,...seo,title:'Stale edit'}),env as never,owner,now))?.status).toBe(409);
    const reset=new Request(url+'?slug=oficina&version=1',{method:'DELETE',headers:{origin:'https://artisys.dev'}});
    expect((await handleOwnerMarketingSeo(reset,env as never,owner,now))?.status).toBe(200);
    const response=await handlePublicMarketingSeo(new Request('https://artisys.dev/oficina/'),env as never);
    expect(await response?.text()).toBe(html);
  });
  it('never touches login, payment or non-approved assets',async()=>{
    const env=environment();
    expect(await handlePublicMarketingSeo(new Request('https://artisys.dev/api/central/access'),env as never)).toBeNull();
    expect(await handlePublicMarketingSeo(new Request('https://artisys.dev/oficina/style.css'),env as never)).toBeNull();
    expect(await handlePublicMarketingSeo(new Request('https://artisys.dev/sistemas/oficina-agricola/'),env as never)).toBeNull();
    expect(await handlePublicMarketingSeo(new Request('https://artisys.dev/oficina/',{method:'POST'}),env as never)).toBeNull();
  });
  it('escapes HTML entities even when called directly',()=>{
    const out=updateSeoHead(html,{...seo,title:'Products & <views>',description:seo.description});
    expect(out).toContain('Products &amp; &lt;views&gt;');
    expect(out.slice(out.indexOf('<body'))).toBe(html.slice(html.indexOf('<body')));
  });
});
