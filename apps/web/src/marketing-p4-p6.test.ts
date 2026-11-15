import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { loadCanonicalCatalog, listPrimaryLandingProducts } from '../catalog-contract.mjs';

const root = new URL('../', import.meta.url);
const read = (relative: string) => readFileSync(new URL(relative, root), 'utf8');

describe('P4/P6: Metadata canônico não altera o visual das páginas individuais', () => {
  it('normaliza somente o head e preserva o body byte a byte', async () => {
    const { instrumentMarketingHtml } = await import('../scripts/marketing-head.mjs');
    const example = '<!doctype html><html><head><title>Legado</title><meta name="description" content="antigo"><link rel="canonical" href="https://artisys.dev/oficina/"><style>.hero{color:red}</style></head><body class="unchanged"><div class="hero"><button>Comprar</button></div></body></html>';
    const updated = instrumentMarketingHtml(example, '/oficina', {page:'oficina'});
    expect(updated.slice(updated.indexOf('<body'))).toBe(example.slice(example.indexOf('<body')));
    expect(updated).toContain('<style>.hero{color:red}</style>');
    expect((updated.match(/rel="canonical"/g) || []).length).toBe(1);
    expect((updated.match(/<title>/g) || []).length).toBe(1);
    expect((updated.match(/type="application\/ld\+json"/g) || []).length).toBeGreaterThan(0);
    expect(updated).toContain('src="/sistemas/marketing-analytics.js"');
  });
  it('mapeia as oito landings e exclui URLs privadas e anúncios aposentados', async () => {
    const { approvedMarketingRoutes, instrumentMarketingHtml } = await import('../scripts/marketing-head.mjs');
    const routes = approvedMarketingRoutes();
    const names = ['catalog', ...listPrimaryLandingProducts().map(p=>p.slug)];
    expect(routes.map((entry:any)=>entry.slug).sort()).toEqual(names.sort());
    expect(routes.map((entry:any)=>entry.route)).not.toContain('/api/');
    expect(routes.some((entry:any)=>entry.route.includes('oficina-agricola'))).toBe(false);
    expect(() => instrumentMarketingHtml('<html><head></head><body>API</body></html>','/api/owner',{})).toThrow();
  });
  it('adiciona imagens sociais somente quando existe imagem local validada', async () => {
    const { approvedMarketingRoutes } = await import('../scripts/marketing-head.mjs');
    const routes = approvedMarketingRoutes();
    const catalog = loadCanonicalCatalog();
    for (const route of routes) {
      if (!route.product?.media?.cover) continue;
      expect(route.model.openGraph.image).toBe('https://artisys.dev'+route.product.media.cover.src);
      const path = decodeURIComponent(route.product.media.cover.src);
      expect(existsSync(new URL('public'+path,root))).toBe(true);
    }
    expect(catalog.products.find(p=>p.slug==='consultora-amamentacao')).toBeTruthy();
  });
  it('conserva URLs checkout e estrutura de QA existentes', () => {
    const catalog = loadCanonicalCatalog();
    for (const slug of ['pdv-artisys','pdv-nexus','obra-na-mao','artisys-finance']) {
      const item = catalog.products.find(p=>p.slug===slug);
      expect(item?.ctaHref).toContain('pagamentos-artisys-central');
    }
  });
});
