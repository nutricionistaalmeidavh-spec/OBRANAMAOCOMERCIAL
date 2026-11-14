import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listPrimaryLandingProducts, loadCanonicalCatalog } from '../catalog-contract.mjs';

const app = new URL('../../marketing-astro/', import.meta.url);
const read = (p: string) => readFileSync(new URL(p, app), 'utf8');

describe('P2 central ArtiSys storefront', () => {
  it('renders the primary eight systems using static HTML and canonical destinations', () => {
    const page = read('src/pages/index.astro');
    expect(page).toContain('listPrimaryLandingProducts');
    expect(page).toContain('preview={false}');
    expect(page).toContain('<ArtiSysProductGrid');
    expect(page).toContain('<ArtiSysScreenshotGallery');
    expect(page).toContain('ItemList');
    expect(listPrimaryLandingProducts()).toHaveLength(8);
    expect(new Set(listPrimaryLandingProducts().map(p => p.href)).size).toBe(8);
  });
  it('filters server-rendered cards without a duplicated in-browser product store', () => {
    const grid = read('src/components/ArtiSysProductGrid.astro');
    const card = read('src/components/ArtiSysProductCard.astro');
    expect(grid).toContain('catalog-search');
    expect(grid).toContain('catalog-filter');
    expect(card).toContain('data-catalog-item');
    expect(card).toContain('data-category');
    const client = read('src/scripts/marketing-interactions.ts');
    expect(client).toContain('aria-pressed');
    expect(client).toContain('.hidden');
    expect(client).not.toContain('MutationObserver');
    expect(client).not.toContain('innerHTML');
    expect(client).not.toContain('insertAdjacentHTML');
  });
  it('retains the approved external lactation solution without restoring the retired Oficina Agrícola item', () => {
    const catalog = loadCanonicalCatalog();
    expect(catalog.products.find(p => p.slug === 'consultora-amamentacao')?.externalHref).toBe('https://deboralactacao.com/comercial/');
    expect(catalog.products.some(p => p.slug === 'oficina-agricola' || p.marketplaceItemId === 'MLB7417818080')).toBe(false);
  });
});

describe('P3 real captures and client-side motion', () => {
  it('uses only existing approved screenshots with alt text, all sourced from the canonical catalog', () => {
    const catalog = loadCanonicalCatalog();
    const screenshotProducts = catalog.products.filter(p => p.media?.cover);
    expect(screenshotProducts.length).toBeGreaterThanOrEqual(4);
    for (const product of screenshotProducts) {
      const pictures = [product.media.cover, ...(product.media.gallery || [])];
      for (const picture of pictures) {
        expect(picture.src.startsWith('/')).toBe(true);
        expect(picture.alt.length).toBeGreaterThan(12);
        expect(existsSync(new URL('../public' + picture.src, import.meta.url))).toBe(true);
      }
    }
    expect(read('src/components/ArtiSysProductGrid.astro')).not.toContain('const screenshots:');
  });
  it('provides Embla keyboard controls and Motion with reduced-motion protection', () => {
    const source = read('src/components/ArtiSysScreenshotGallery.astro');
    expect(source).toContain('data-embla');
    expect(source).toContain('aria-label');
    expect(source).toContain('aria-live');
    const js = read('src/scripts/marketing-interactions.ts');
    expect(js).toContain('embla-carousel');
    expect(js).toContain("from 'motion'");
    expect(js).toContain('prefers-reduced-motion');
  });
});

describe('P2/P3 safe static overlay', () => {
  it('copies only /sistemas/index.html and isolated Astro assets, leaving API and existing landing pages unchanged', async () => {
    const { overlayMarketingAssets } = await import('../scripts/integrate-marketing-astro.mjs');
    const base = mkdtempSync(join(tmpdir(), 'artisys-marketing-'));
    try {
      const website = join(base,'web');
      const astro = join(base,'astro');
      mkdirSync(join(website,'sistemas'), {recursive:true});
      mkdirSync(join(website,'api'), {recursive:true});
      mkdirSync(join(website,'oficina'), {recursive:true});
      mkdirSync(join(astro,'_artisys-marketing'), {recursive:true});
      writeFileSync(join(website,'sistemas/index.html'), 'OLD CATALOG');
      writeFileSync(join(website,'api/health'), 'KEEP API');
      writeFileSync(join(website,'oficina/index.html'), 'KEEP OFICINA');
      writeFileSync(join(astro,'index.html'), '<!doctype html><html data-artisys-marketing="p2-p3"><head><link rel="canonical" href="https://artisys.dev/sistemas/"></head><body><h1>Vitrine</h1><article data-catalog-item>Produto</article></body></html>');
      writeFileSync(join(astro,'_artisys-marketing/index.css'), 'body{color:purple}');
      const result = overlayMarketingAssets({productionDir:website,astroDir:astro});
      expect(result.assets).toBe(1);
      expect(readFileSync(join(website,'sistemas/index.html'),'utf8')).toContain('data-artisys-marketing="p2-p3"');
      expect(readFileSync(join(website,'api/health'),'utf8')).toBe('KEEP API');
      expect(readFileSync(join(website,'oficina/index.html'),'utf8')).toBe('KEEP OFICINA');
    } finally { rmSync(base, {recursive:true,force:true}); }
  });
});
