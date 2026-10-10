import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../public/sistemas/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../public/sistemas/catalog.css', import.meta.url), 'utf8');
const script = readFileSync(new URL('../public/sistemas/catalog.js', import.meta.url), 'utf8');

describe('ArtiSys systems catalog — editorial design parity', () => {
  it('uses landing and DevKits palette, font, breadcrumbs and accessible navigation', () => {
    expect(html).toContain('fonts.googleapis.com/css2?family=Outfit');
    expect(css).toContain('--bg:#080613');
    expect(css).toContain('--purple:#aa62ff');
    expect(html).toContain('class="catalog-showcase"');
    expect(html).toContain('class="breadcrumbs"');
    expect(html).toContain('href="/devkits/"');
    expect(html).toContain('href="/sistema.html#portal"');
    expect(html).toContain('class="skip-link" href="#catalogo"');
  });
  it('retains canonical product and collection loading, filters and quick details', () => {
    for (const id of ['product-count','collection-count','collection-grid','catalog-search','catalog-filters','catalog-grid','catalog-result-count','product-dialog','dialog-actions']) {
      expect(html).toContain('id="' + id + '"');
    }
    expect(script).toContain("fetch('./products.json')");
    expect(script).toContain("fetch('./collections.json')");
    expect(script).toContain('ArtiSysMarketplace.mergeApprovedFeed');
    expect(script).toContain('dialog.showModal()');
  });
  it('respects list-based catalog layout, responsive widths and reduced-motion preference', () => {
    expect(css).toContain('.catalog-grid{display:grid;grid-template-columns:1fr;gap:12px}');
    expect(css).toContain('.product-card{position:relative;min-width:0;display:grid');
    expect(css).toContain('@media(max-width:650px)');
    expect(css).toContain('@media(prefers-reduced-motion:reduce)');
    expect(css).toContain('[hidden]{display:none!important}');
  });
});
