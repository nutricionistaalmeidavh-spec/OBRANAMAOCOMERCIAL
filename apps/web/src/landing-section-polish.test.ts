import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const homepage = read('../index.html');
const central = read('../public/links/index.html');
const entry = read('./artisys-landing.ts');
const polish = read('./artisys-home-section-polish.css');

const part = (start: string, end: string) => homepage.split(start)[1]?.split(end)[0] ?? '';

describe('ArtiSys public homepage — visual refinement and official links', () => {
  it('removes historical sequence numbers and reduces duplicate content in the customer case', () => {
    const caseStudy = part('<section class="proof-journey container"', '</section>');
    expect(caseStudy).toContain('class="proof-kicker">NA PRÁTICA');
    expect(caseStudy).not.toContain('02 / NA PRÁTICA');
    expect(caseStudy).not.toContain('class="proof-case-label"');
    expect(caseStudy).toContain('MH Hidráulica LTDA');
    expect(caseStudy).toContain('Ribeirão Preto, SP');
    expect(caseStudy).toContain('Da obra ao escritório');
    expect(caseStudy).toContain('Gestão de obras');
    expect(caseStudy).toContain('Financeiro e documentos');
    expect(caseStudy).toContain('Capacitação da equipe');
    expect(polish).toContain('grid-template-columns:minmax(0,.92fr) minmax(0,1.08fr)');
    expect(polish).toContain('.proof-case{padding:16px 15px}');
  });

  it('uses dark readable surfaces and keeps the construction category unbroken on phones', () => {
    const systems = part('<section class="product-highlights container"', '</section>');
    expect(systems).toContain('CONSTRUÇÃO');
    expect(systems).toContain('Obra na Mão');
    expect(systems).toContain('PDV ArtiSys');
    expect(systems).toContain('NutriDesk');
    expect(polish).toContain('.product-showcase .product-heading{');
    expect(polish).toContain('background:#25304b');
    expect(polish).toContain('grid-template-areas:"kind arrow" "details arrow"');
    expect(polish).toContain('white-space:nowrap;overflow-wrap:normal;word-break:keep-all');
    expect(polish).toContain('background:#1c263e');
  });

  it('reuses exactly the public TikTok and WhatsApp destinations already in the ArtiSys link hub', () => {
    const tiktok = central.match(/href="(https:\/\/www\.tiktok\.com\/[^"]+)"[^>]+data-link-id="tiktok"/)?.[1];
    const whatsapp = central.match(/href="(https:\/\/wa\.me\/[^"]+)"[^>]+data-link-id="whatsapp-social"/)?.[1];
    expect(tiktok).toBeTruthy();
    expect(whatsapp).toBeTruthy();
    const footer = part('<footer class="footer container">','</footer>');
    expect(footer).toContain('class="footer-link-central" href="/links/"');
    expect(footer).toContain(`href="${tiktok}"`);
    expect(footer).toContain(`href="${whatsapp}"`);
    expect(footer).not.toContain('instagram.com');
    expect(footer).toContain('href="/academy"');
    expect(footer).toContain('href="/devkits/"');
    expect(footer).toContain('href="#topo"');
    expect(polish).toContain('.footer-links .footer-link-central{grid-column:1/-1;');
  });

  it('does not change APIs, subscriptions, route dispatch or authenticated application styling', () => {
    expect(entry).toContain("import './artisys-home-section-polish.css';");
    expect(polish).toContain('@media(max-width:540px)');
    expect(polish).toContain('@media(prefers-reduced-motion:reduce)');
    expect(polish).not.toMatch(/\/api\/|stripe|billing|\.app-shell|\.desktop-app/i);
    expect(homepage).toContain('class="nav-login" href="./sistema.html#portal"');
    expect(homepage.indexOf('id="academy"')).toBeLessThan(homepage.indexOf('id="devkits"'));
    expect(homepage.indexOf('id="devkits"')).toBeLessThan(homepage.indexOf('id="produtos"'));
  });
});
