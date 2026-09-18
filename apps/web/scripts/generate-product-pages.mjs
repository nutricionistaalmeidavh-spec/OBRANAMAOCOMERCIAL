import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { artisysSeoConfig } from '../seo.config.mjs';
import { buildPageSeo, renderHeadTags } from '../vendor/artisys-seo/technical.mjs';

const catalogUrl = new URL('../public/sistemas/products.json', import.meta.url);
const outputRoot = new URL('../public/sistemas/', import.meta.url);

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}
function externalAttrs(href) { return href.startsWith('https://') ? ' target="_blank" rel="noopener noreferrer"' : ''; }
function renderFaq(items) { return items.map(({ question, answer }) => `<details><summary>${escapeHtml(question)}</summary><p>${escapeHtml(answer)}</p></details>`).join(''); }
function renderSteps(items) { return items.map((item, index) => `<li><span>${String(index + 1).padStart(2, '0')}</span><p>${escapeHtml(item)}</p></li>`).join(''); }
function typeLabel(type) { return ({ desktop: 'Desktop', web: 'Web', saas: 'SaaS' })[type] || type; }

function renderProductPage(product) {
  const seo = buildPageSeo(artisysSeoConfig, `/sistemas/${product.slug}`);
  const access = product.accessHref ? `<a class="button secondary" href="${escapeHtml(product.accessHref)}"${externalAttrs(product.accessHref)}>Já sou cliente</a>` : '';
  const status = product.status === 'available' ? 'Disponível' : 'Integrado à Central';
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#07111f">
  ${renderHeadTags(seo)}
  <link rel="icon" type="image/png" sizes="32x32" href="/icons/artisys-favicon-32.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/icons/artisys-apple-touch-icon.png">
  <link rel="stylesheet" href="../product-page.css">
</head>
<body>
  <header class="product-header"><a class="brand" href="/" aria-label="ArtiSys, página inicial"><img src="/artisys-logo.svg" alt="ArtiSys"></a><a class="back-link" href="/sistemas/">Todos os sistemas</a></header>
  <main>
    <section class="product-hero" aria-labelledby="product-title">
      <div class="hero-copy"><p class="eyebrow">${escapeHtml(product.category)} · ${escapeHtml(typeLabel(product.type))}</p><h1 id="product-title">${escapeHtml(product.name)}</h1><p class="hero-summary">${escapeHtml(product.summary)}</p><div class="hero-actions"><a class="button primary" data-product-cta href="${escapeHtml(product.ctaHref)}"${externalAttrs(product.ctaHref)}>${escapeHtml(product.ctaLabel)}</a>${access}</div></div>
      <aside class="product-facts" aria-label="Resumo comercial"><div><span>Status</span><strong>${escapeHtml(status)}</strong></div><div><span>Formato</span><strong>${escapeHtml(typeLabel(product.type))}</strong></div><div><span>Investimento</span><strong>${escapeHtml(product.priceLabel)}</strong></div></aside>
    </section>
    <section class="content-section split-section" aria-labelledby="audience-title"><div><p class="section-kicker">Para quem é</p><h2 id="audience-title">Feito para uma rotina real.</h2></div><p class="large-copy">${escapeHtml(product.audience)}</p></section>
    <section class="content-section" aria-labelledby="benefits-title"><p class="section-kicker">O que melhora</p><h2 id="benefits-title">Menos improviso. Mais clareza na operação.</h2><div class="benefit-grid">${product.benefits.map((item, index) => `<article><span>${String(index + 1).padStart(2, '0')}</span><p>${escapeHtml(item)}</p></article>`).join('')}</div></section>
    <section class="content-section" aria-labelledby="features-title"><p class="section-kicker">Funcionalidades</p><h2 id="features-title">O essencial do produto, sem rodeios.</h2><div class="feature-grid">${product.features.map((item) => `<article><span aria-hidden="true">✓</span><h3>${escapeHtml(item)}</h3></article>`).join('')}</div></section>
    <section class="content-section" aria-labelledby="steps-title"><p class="section-kicker">Como funciona</p><h2 id="steps-title">Da configuração ao uso.</h2><ol class="steps-list">${renderSteps(product.steps)}</ol></section>
    <section class="content-section faq-section" aria-labelledby="faq-title"><p class="section-kicker">Perguntas frequentes</p><h2 id="faq-title">Antes de começar.</h2><div class="faq-list">${renderFaq(product.faq)}</div></section>
    <section class="product-cta" aria-labelledby="cta-title"><div><p class="section-kicker">ArtiSys</p><h2 id="cta-title">Quer colocar ${escapeHtml(product.name)} na sua operação?</h2></div><div class="hero-actions"><a class="button primary" data-product-cta href="${escapeHtml(product.ctaHref)}"${externalAttrs(product.ctaHref)}>${escapeHtml(product.ctaLabel)}</a>${access}</div></section>
  </main>
  <footer class="product-footer"><span>ArtiSys</span><a href="/sistemas/">Catálogo de sistemas</a><a href="/">Página inicial</a></footer>
</body>
</html>\n`;
}

export function generateProductPages() {
  const catalog = JSON.parse(readFileSync(catalogUrl, 'utf8'));
  if (!Array.isArray(catalog.products)) throw new Error('Catálogo de produtos inválido.');
  for (const product of catalog.products) {
    const dir = new URL(`./${product.slug}/`, outputRoot);
    mkdirSync(dir, { recursive: true });
    writeFileSync(new URL('index.html', dir), renderProductPage(product), 'utf8');
  }
  return catalog.products.length;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const count = generateProductPages();
  console.log(`Product pages generated: ${count}`);
}
