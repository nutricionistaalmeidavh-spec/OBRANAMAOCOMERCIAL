import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { summarizeMarketingAnalytics } from '../cloudflare/marketing-analytics';
import { summarizeLinksAnalytics } from '../cloudflare/links-analytics';
import { validateConsolidatedSources } from './marketing-analytics-canonical';

const products=[{slug:'pdv-artisys',name:'PDV ArtiSys'},{slug:'oficina',name:'ArtiSys Oficina'}];
const now=new Date('2026-11-15T18:00:00.000Z');
const counters = [
  { id:'2026-11-15:view:home',count:30 },
  { id:'2026-11-15:site_click:home:sistemas',count:8 },
  { id:'2026-11-15:site_click:home:devkits',count:4 },
  { id:'2026-11-15:view:catalog',count:12 },
  { id:'2026-11-15:view:pdv-artisys',count:4 },
  { id:'2026-11-15:product_click:pdv-artisys',count:2 },
  { id:'2026-11-15:checkout_click:pdv-artisys',count:1 }
];
const linkCounters=[
  { id:'2026-11-15:view',count:7 },
  { id:'2026-11-15:click:academy',count:4 },
  { id:'2026-11-15:click:site-logo',count:2 }
];
describe('Canonicidade do Analytics ArtiSys unificado',()=>{
  it('reaproveita as fontes existentes sem misturar home, catálogo, sistemas e /links',()=>{
    const marketing=summarizeMarketingAnalytics(counters,7,now,products);
    const links=summarizeLinksAnalytics(linkCounters,7,now);
    expect(marketing.summary.views).toBe(16);
    expect(marketing.catalog.views).toBe(12);
    expect(marketing.products.find(x=>x.slug==='pdv-artisys')?.views).toBe(4);
    expect(marketing.home.views).toBe(30);
    expect(marketing.home.clicks).toBe(12);
    expect(marketing.home.destinations.find(x=>x.id==='sistemas')?.clicks).toBe(8);
    expect(marketing.homeDaily.at(-1)).toMatchObject({views:30,clicks:12});
    expect(links).toMatchObject({views:7,clicks:6});
    expect(validateConsolidatedSources(marketing,links)).toEqual({valid:true,issues:[]});
  });
  it('rejeita totais inconsistentes sem desenhar cartões de números inventados',()=>{
    const marketing=summarizeMarketingAnalytics(counters,7,now,products);
    const links=summarizeLinksAnalytics(linkCounters,7,now);
    expect(validateConsolidatedSources({...marketing,summary:{...marketing.summary,views:17}},links).valid).toBe(false);
    expect(validateConsolidatedSources(marketing,{...links,clicks:99}).valid).toBe(false);
    expect(validateConsolidatedSources(marketing,{...links,timezone:'UTC'}).valid).toBe(false);
    expect(validateConsolidatedSources({...marketing,home:{...marketing.home,views:31}},links).valid).toBe(false);
    expect(validateConsolidatedSources(marketing,{...links,interactionRate:77}).valid).toBe(false);
    expect(validateConsolidatedSources(marketing,{...links,daily:[...links.daily.slice(0,-1),{...links.daily.at(-1)!,clicks:-1}]}).valid).toBe(false);
  });
  it('diferencia abertura de clique, lead e venda em todas as legendas do painel',()=>{
    const page=readFileSync(new URL('./owner-marketing.ts',import.meta.url),'utf8');
    expect(page).toContain('/api/owner/links-analytics');
    expect(page).toContain('Página inicial');
    expect(page).toContain('/links/');
    expect(page).toContain('não são visitantes únicos');
    expect(page).toContain('não representam vendas');
    expect(page).not.toContain("['Visitas aos sistemas'");
  });
  it('instrumenta somente o head da homepage e não altera o corpo visual',()=>{
    const page=readFileSync(new URL('../index.html',import.meta.url),'utf8');
    const script=readFileSync(new URL('../public/sistemas/home-analytics.js',import.meta.url),'utf8');
    expect((page.match(/src="\/sistemas\/home-analytics\.js"/g)||[])).toHaveLength(1);
    expect(page.indexOf('/sistemas/home-analytics.js')).toBeLessThan(page.indexOf('</head>'));
    expect(script).toContain("location.pathname");
    expect(script).toContain("type:'view',product:'home'");
    expect(script).toContain("type:'site_click',product:'home'");
    expect(script).not.toMatch(/localStorage|document\.cookie|navigator\.userAgent|MutationObserver/);
  });
});
