import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { PRIMARY_LANDING_SLUGS, listPrimaryLandingProducts, loadCanonicalCatalog, canonicalLandingUrl } from '../catalog-contract.mjs';
const root = new URL('../public/', import.meta.url);
describe('marketing P0 canonical contract', () => {
  it('lists eight approved commercial landings with unique URLs', () => {
    const products = listPrimaryLandingProducts();
    expect(products).toHaveLength(8);
    expect(products.map(p => p.slug)).toEqual([...PRIMARY_LANDING_SLUGS]);
    expect(new Set(products.map(p => p.href)).size).toBe(8);
    for (const product of products) {
      expect(product.href.startsWith('https://artisys.dev/')).toBe(true);
      expect(product.href.includes('oficina-agricola')).toBe(false);
    }
  });
  it('links to existing pages, not generated duplicates', () => {
    for (const product of listPrimaryLandingProducts()) {
      const pathname = new URL(product.href).pathname;
      const file = new URL(pathname.slice(1) + 'index.html', root);
      expect(existsSync(file)).toBe(true);
      if (product.pageMode === 'external') {
        expect(existsSync(new URL('sistemas/' + product.slug + '/index.html', root))).toBe(false);
      }
    }
  });
  it('preserves existing payment URLs and keeps the legacy ad out', () => {
    const catalog = loadCanonicalCatalog();
    for (const slug of ['pdv-artisys','pdv-nexus','obra-na-mao','artisys-finance']) {
      const product = catalog.products.find(p => p.slug === slug);
      expect(product.ctaHref).toContain('pagamentos-artisys-central');
      expect(canonicalLandingUrl(product)).toBe('https://artisys.dev/sistemas/' + slug + '/');
    }
    expect(catalog.products.some(p => p.slug.includes('oficina-agricola'))).toBe(false);
    const script = readFileSync(new URL('sistemas/marketplace-feed.js', root), 'utf8');
    expect(script).toContain('MLB7417818080');
  });
});
