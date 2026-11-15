import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const landing = read('../index.html');
const marketing = read('./artisys-marketing-2026.css');

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

  it('makes the systems catalog discoverable without promoting discontinued kits', () => {
    expect(landing).toContain('href="/sistemas/"');
    expect(landing).not.toContain('href="/devkits/"');
    expect(landing).not.toContain('id="devkit-title"');
    expect(landing).toContain('id="products-title"');
    expect(landing).toContain('class="button primary" href="/sistemas/"');
    expect(landing).toContain('class="button secondary" href="#contato"');
    for (const slug of ['obra-na-mao','pdv-artisys','nutridesk']) {
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

  it('does not render retired kit imagery, links or duplicated hero cards', () => {
    expect(landing).not.toContain('devkit-tools-profissional.avif');
    expect(landing).not.toContain('class="devkit-feature-illustration"');
    expect(landing).not.toContain('class="viral-devkit-illustration"');
    expect(landing).not.toContain('class="viral-preview-machine"');
    expect(landing).toContain('class="nav-login" href="./sistema.html#portal"');
  });

  it('keeps the MH Hidráulica case while removing the circled three-step marketing process', () => {
    expect(landing.match(/<section class="proof-journey container"/g)).toHaveLength(1);
    expect(landing).toContain('id="prova"');
    expect(landing).toContain('MH Hidráulica LTDA');
    expect(landing).toContain('Ribeirão Preto, SP');
    expect(landing).toContain('class="proof-evidence"');
    for (const label of ['+50','Sistemas vendidos','Sistemas em uso real']) expect(landing).toContain(label);
    expect(landing).not.toContain('class="proof-case"');
    expect(landing).not.toContain('id="processo"');
    expect(landing).not.toContain('class="proof-process"');
    expect(landing).not.toContain('Próximo de você.');
    expect(landing).not.toContain('Primeiro, a sua realidade.');
    expect(landing).not.toContain('Depois, a ideia ganha forma.');
    expect(landing).not.toContain('Por fim, pronta para a rotina.');
    const styles = read('./artisys-editorial-violet.css');
    expect(read('./artisys-home-section-polish.css')).toContain('.proof-evidence{');
    expect(styles).not.toContain('.proof-process{');
    expect(styles).toContain('@media(max-width:800px)');
    expect(landing).toContain('class="nav-login" href="./sistema.html#portal"');
  });

  it('keeps commercial systems routes without the discontinued DevKitTools showcase', () => {
    expect(landing).not.toContain('DKT-DOC-005');
    expect(landing).not.toContain('href="/devkits/"');
    expect(landing).toContain('Sistemas prontos.<br><em>Para sua empresa.</em>');
    expect(landing).toContain('Para sua empresa');
    expect(landing).toContain('Projeto personalizado');
    expect(landing).toContain('class="button primary" href="/sistemas/"');
    expect(landing).toContain('class="button secondary" href="#contato"');
    expect(landing).toContain('href="./sistema.html#portal"');
    expect(landing).not.toContain('class="capabilities container"');
    expect(read('./artisys-clarity-2026.css')).toContain('.hero.viral-hero .hero-actions{');
  });
 it('alterna superfícies claras e mantém os módulos autenticados isolados',()=>{
   const clarity=read('./artisys-clarity-2026.css');
   for(const token of [
     '--clarity-paper:#f4f1fa','.devkit-feature{','.product-showcase{',
     '.product-list-panel{','.proof-journey{','.contact-section{',
     '@media(max-width:540px)','@media(prefers-reduced-motion:reduce)',
     ':focus-visible'])expect(clarity).toContain(token);
   expect(landing).toContain('MH Hidráulica LTDA');
   expect(landing).toContain('Conhecer sistemas prontos');
   expect(landing).toContain('href="/sistemas/obra-na-mao/"');
   expect(landing).toContain('href="/sistemas/pdv-artisys/"');
   expect(landing).toContain('href="/sistemas/nutridesk/"');
   expect(clarity).not.toContain('/v1/');
   expect(clarity).not.toContain('oauth');
 });

});
