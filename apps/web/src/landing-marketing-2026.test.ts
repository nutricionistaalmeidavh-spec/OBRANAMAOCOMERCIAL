import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const landing = read('../index.html');
const marketing = read('./artisys-marketing-2026.css');
const devkits = read('../public/devkits/index.html');

describe('public ArtiSys landing — conversion and access guardrails', () => {
  it('preserves Obra na Mão access in the header, independently of the mobile menu', () => {
    const access = landing.match(/<a class="nav-login"[^>]+>/)?.[0] ?? '';
    expect(access).toContain('href="./sistema.html#portal"');
    expect(access).toContain('aria-label="Acessar sistema Obra na Mão"');
    expect(landing).toContain('class="nav-login-mobile">Acessar sistema');
    expect(landing).toContain('https://wa.me/5516982338805?text=');
    expect(landing.match(/https:\/\/wa\.me\/5516982338805\?text=/g)).toHaveLength(2);
    expect(landing).not.toContain('5516999999999');
    expect(marketing).toMatch(/@media\(max-width:800px\)/);
    expect(marketing).toContain('.nav-login-mobile{display:inline}');
  });

  it('makes the catalog and the developer-kit destination discoverable', () => {
    expect(landing).toContain('href="/sistemas/"');
    expect(landing).toContain('href="/devkits/"');
    expect(landing).toContain('id="devkit-title"');
    expect(landing).toContain('id="products-title"');
    expect(landing).not.toContain('id="dos-videos"');
    expect(landing).not.toContain('id="servicos"');
    expect(landing).not.toContain('href="#dos-videos"');
    expect(landing).not.toContain('href="#servicos"');
    expect(landing).toContain('class="button secondary" href="/sistemas/"');
    expect(landing).toContain('Conhecer sistemas prontos');
    expect(landing).toContain('class="button primary" href="/devkits/"');
    expect(landing).not.toContain('class="viral-preview-machine"');
    expect(landing).not.toContain('class="viral-floating-product"');
    expect(landing).not.toContain('class="viral-hero-visual"');
    for (const slug of ['obra-na-mao', 'pdv-artisys', 'nutridesk']) {
      expect(landing).toContain(`href="/sistemas/${slug}/"`);
    }
  });

  it('displays systems in a compact, linked list matching the DevKit structure', () => {
    const section = landing.split('<section class="product-highlights container"')[1]?.split('</section>')[0] ?? '';
    expect(section).toContain('class="product-showcase"');
    expect(section).toContain('class="product-list-panel"');
    expect(section).toContain('class="product-list-top"');
    expect(section).toContain('class="product-list-body"');
    expect(section).not.toContain('product-feature-grid');
    expect(section.match(/class="product-list-item"/g)).toHaveLength(3);
    for (const slug of ['obra-na-mao', 'pdv-artisys', 'nutridesk']) {
      expect(section).toContain(`class="product-list-item" href="/sistemas/${slug}/"`);
    }
    expect(section).toContain('href="/sistemas/"');
    for (const category of ['agro', 'negocios', 'saude']) {
      expect(section).toContain(`href="/sistemas/${category}/"`);
    }
    const css = read('./artisys-editorial-violet.css');
    expect(css).toContain('.product-showcase{display:grid');
    expect(css).toContain('.product-list-item{display:grid');
    expect(css).toContain('@media(max-width:540px)');
    expect(landing).toContain('href="./sistema.html#portal"');
  });

  it('keeps the local DevKit illustration in its section without the old hero cards', () => {
    const path = '/images/devkit-tools-profissional.avif';
    expect(landing.match(new RegExp('src="' + path + '"', 'g'))).toHaveLength(1);
    expect(landing).not.toContain('class="viral-devkit-illustration"');
    expect(landing).toContain('class="devkit-feature-illustration"');
    const image = readFileSync(new URL('../public/images/devkit-tools-profissional.avif', import.meta.url));
    expect(image.byteLength).toBeGreaterThan(1000);
    expect(image.byteLength).toBeLessThan(20_000);
    expect(landing).toContain('class="nav-login" href="./sistema.html#portal"');
    expect(landing).not.toContain('class="viral-preview-console"');
    expect(landing).toContain('class="devkit-module"');
  });

  it('unifies the client proof and workflow into one violet mobile-first section', () => {
    expect(landing.match(/<section class="proof-journey container"/g)).toHaveLength(1);
    expect(landing).not.toContain('class="case-section container"');
    expect(landing).not.toContain('class="process-section container"');
    expect(landing).toContain('id="prova"');
    expect(landing).toContain('id="processo"');
    expect(landing).toContain('MH Hidráulica LTDA');
    expect(landing).toContain('Ribeirão Preto, SP');
    expect(landing).toContain('class="proof-journey-content"');
    expect(landing).toContain('class="proof-case"');
    expect(landing).toContain('class="proof-process"');
    expect(landing.match(/class="proof-step-num"/g)).toHaveLength(3);
    for (const label of ['Gestão de obras', 'Financeiro e documentos', 'Capacitação da equipe']) expect(landing).toContain(label);
    for (const step of ['Primeiro, a sua realidade.', 'Depois, a ideia ganha forma.', 'Por fim, pronta para a rotina.']) expect(landing).toContain(step);
    const styles = read('./artisys-editorial-violet.css');
    expect(styles).toContain('.proof-journey-content{display:grid');
    expect(styles).toContain('@media(max-width:800px)');
    expect(styles).toContain('.proof-journey-content{grid-template-columns:1fr}');
    expect(styles).toContain('.proof-process{');
    expect(styles).toContain('background:#0d0a1b');
    expect(landing).toContain('class="nav-login" href="./sistema.html#portal"');
  });

  it('keeps developer-kit claims precise and sends visitors to a real catalog', () => {
    for (const sku of ['DKT-DOC-005', 'DKT-DOC-008', 'DKT-PLAT-006', 'DKT-QUAL-005']) {
      expect(landing).toContain(sku);
    }
    expect(devkits).not.toContain('github.com/nutricionistaalmeidavh-spec/DevKitTools');
    expect(devkits).toContain('https://wa.me/5516982338805?text=');
    expect(devkits).toContain('rel="canonical" href="https://artisys.dev/devkits/"');
    expect(devkits).toContain('id="kit-grid"');
    expect(devkits).toContain('Guia Open Source');
    expect(devkits).toContain('href="https://github.com/rclone/rclone"');
    expect(devkits).not.toContain('href="/devkits/catalogo/"');

  });
});
