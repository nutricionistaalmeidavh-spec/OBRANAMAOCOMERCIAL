import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const homepage = read('../index.html');
const central = read('../public/links/index.html');
const entry = read('./artisys-landing.ts');
const polish = read('./artisys-home-section-polish.css');

const part = (start: string, end: string) => homepage.split(start)[1]?.split(end)[0] ?? '';

describe('ArtiSys public homepage — visual refinement and official links', () => {
  it('shows the three real proof points without invented testimonials or legacy copy', () => {
    const proof = part('<section class="proof-journey container"', '</section>');
    expect(proof).toContain('class="proof-kicker">RESULTADOS REAIS');
    expect(proof).toContain('ArtiSys <span>na prática.</span>');
    expect(proof).toContain('class="proof-evidence-number" aria-label="Mais de 50">+50');
    expect(proof).toContain('Sistemas vendidos');
    expect(proof).toContain('MH Hidráulica LTDA');
    expect(proof).toContain('Ribeirão Preto, SP');
    expect(proof).toContain('Sistemas em uso real');
    expect(proof).toContain('Clientes utilizando no dia a dia');
    expect(proof.match(/class="proof-evidence-item /g)).toHaveLength(3);
    expect(proof).not.toMatch(/02 \/ NA PRÁTICA|Depoimento|Mercado Livre|PDVs vendidos|CLIENTE ARTISYS|APLICAÇÃO REAL/);
    expect(proof).not.toContain('<blockquote');
    expect(proof).not.toContain('class="proof-case"');
    expect(polish).toContain('grid-template-columns:1.07fr 1fr 1fr');
    expect(polish).toContain('.proof-evidence-item{min-height:74px;');
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
