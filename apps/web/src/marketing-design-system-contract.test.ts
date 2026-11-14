import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const app = new URL('../../marketing-astro/', import.meta.url);
const read = (p:string) => readFileSync(new URL(p, app), 'utf8');
describe('ArtiSys marketing P1 design system', () => {
  it('uses the MIT Astro Kit and isolated static build', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.dependencies['astro-component-kit']).toBe('0.7.1');
    expect(pkg.dependencies.astro).toMatch(/^5\./);
    expect(read('astro.config.mjs')).toContain("outDir: './dist-preview'");
    expect(read('src/components/ArtiSysBento.astro')).toContain("astro-component-kit/cards");
  });
  it('owns ArtiSys palette and respects motion/accessibility', () => {
    const css=read('src/styles/tokens.css');
    for(const color of ['#080613','#17102b','#8643ef','#aa62ff']) expect(css).toContain(color);
    expect(css).toContain('prefers-reduced-motion:reduce');
    expect(read('src/layouts/MarketingLayout.astro')).toContain('Pular para o conteúdo');
    expect(read('src/layouts/MarketingLayout.astro')).toContain('noindex,nofollow');
  });
  it('provides actual reusable sections without touching production', () => {
    for(const name of ['ArtiSysButton','ArtiSysHero','ArtiSysProductCard','ArtiSysProductGrid','ArtiSysScreenshotFrame','ArtiSysBento','ArtiSysCTA'])
      expect(existsSync(new URL('src/components/'+name+'.astro',app))).toBe(true);
    expect(read('src/data/catalog.mjs')).toContain("../../../web/catalog-contract.mjs");
    expect(read('src/pages/index.astro')).toContain('listPrimaryLandingProducts');
  });
});
