import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { artisysSeoConfig } from '../seo.config.mjs';
import { buildPageSeo, renderHeadTags } from '../vendor/artisys-seo/technical.mjs';

const catalogUrl = new URL('../public/sistemas/products.json', import.meta.url);
const outputRoot = new URL('../public/sistemas/', import.meta.url);
const LEGACY_GENERATED_SLUGS = ['debora-lactacao'];

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}
function externalAttrs(href) {
  return href.startsWith('https://') ? ' target="_blank" rel="noopener noreferrer"' : '';
}
function renderFaq(items) {
  return (items || []).map(({ question, answer }) => `<details><summary>${escapeHtml(question)}</summary><p>${escapeHtml(answer)}</p></details>`).join('');
}
function renderSteps(items) {
  return (items || []).map((item, index) => `<li><span>${String(index + 1).padStart(2, '0')}</span><p>${escapeHtml(item)}</p></li>`).join('');
}
function typeLabel(type) {
  return ({ desktop: 'Desktop', web: 'Web', saas: 'SaaS' })[type] || type;
}
function collectionHref(product) {
  const slug = product.collections?.[0];
  return slug ? `/sistemas/${slug}/#${product.slug}` : '/sistemas/';
}
function productDestination(product) {
  if (product.pageMode === 'external') return product.externalHref;
  if (product.pageMode === 'collection') return collectionHref(product);
  return `/sistemas/${product.slug}/`;
}
function productDestinationLabel(product) {
  if (product.pageMode === 'external') return 'Conhecer o sistema';
  if (product.pageMode === 'collection') return 'Ver na coleção';
  return 'Ver página completa';
}

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
  <!-- artisys-generated:product -->
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
</html>
`;
}

function renderCollectionCard(product) {
  const href = productDestination(product);
  return `<article class="product-card" id="${escapeHtml(product.slug)}" data-product="${escapeHtml(product.slug)}">
    <div class="product-topline"><span class="product-category">${escapeHtml(product.category)}</span><span class="product-status">${product.pageMode === 'individual' ? 'Página individual' : 'Na coleção'}</span></div>
    <h3>${escapeHtml(product.name)}</h3>
    <p class="product-summary">${escapeHtml(product.summary)}</p>
    <ul class="dialog-features">${product.features.slice(0, 4).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
    <div class="product-meta"><span class="product-type">${escapeHtml(typeLabel(product.type))}</span><strong class="product-price">${escapeHtml(product.priceLabel)}</strong></div>
    <div class="product-actions"><a class="product-button" href="${escapeHtml(href)}"${externalAttrs(href)}>${escapeHtml(productDestinationLabel(product))}</a><a class="access-link" href="${escapeHtml(product.ctaHref)}"${externalAttrs(product.ctaHref)}>${escapeHtml(product.ctaLabel)}</a></div>
  </article>`;
}

function renderCollectionPage(collection, products) {
  const seo = buildPageSeo(artisysSeoConfig, `/sistemas/${collection.slug}`);
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#07111f">
  ${renderHeadTags(seo)}
  <link rel="icon" type="image/png" sizes="32x32" href="/icons/artisys-favicon-32.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/icons/artisys-apple-touch-icon.png">
  <link rel="stylesheet" href="../catalog.css">
</head>
<body>
  <!-- artisys-generated:collection -->
  <header class="catalog-header"><a class="brand" href="/" aria-label="ArtiSys, página inicial"><img src="/artisys-logo.svg" alt="ArtiSys"></a><a class="header-link" href="/sistemas/">Todos os sistemas</a></header>
  <main>
    <section class="catalog-hero" aria-labelledby="collection-title"><p class="eyebrow">${escapeHtml(collection.category)} · Coleção ArtiSys</p><h1 id="collection-title">${escapeHtml(collection.name)}</h1><p class="hero-copy">${escapeHtml(collection.summary)}</p><div class="hero-stats"><div><strong>${products.length}</strong><span>sistemas nesta coleção</span></div><div><strong>1</strong><span>página para comparar o portfólio</span></div><div><strong>Agro</strong><span>segmento especializado</span></div></div></section>
    <section class="catalog-section" aria-labelledby="collection-products-title"><div class="section-heading"><div><p class="eyebrow">Portfólio</p><h2 id="collection-products-title">Soluções para diferentes rotinas do agro</h2></div><p class="result-count">${products.length} sistemas</p></div><div class="catalog-grid">${products.map(renderCollectionCard).join('')}</div></section>
    <section class="catalog-note"><div><p class="eyebrow">ArtiSys</p><h2>Escolha pelo tipo de operação.</h2></div><p>Oficina Agrícola mantém uma página individual completa e também aparece aqui. Os demais sistemas desta coleção ficam agrupados enquanto não precisam de uma landing própria.</p></section>
  </main>
  <footer class="catalog-footer"><span>ArtiSys</span><a href="/sistemas/">Catálogo completo</a><a href="/">Página inicial</a></footer>
</body>
</html>
`;
}

function cleanGeneratedTargets(catalog) {
  for (const slug of LEGACY_GENERATED_SLUGS) rmSync(new URL(`./${slug}/`, outputRoot), { recursive: true, force: true });
  for (const product of catalog.products) {
    if (product.pageMode !== 'individual') rmSync(new URL(`./${product.slug}/`, outputRoot), { recursive: true, force: true });
  }
}

export function generateCatalogPages() {
  const catalog = JSON.parse(readFileSync(catalogUrl, 'utf8'));
  if (!Array.isArray(catalog.products) || !Array.isArray(catalog.collections)) throw new Error('Catálogo de produtos inválido.');
  cleanGeneratedTargets(catalog);

  const individualProducts = catalog.products.filter((product) => product.pageMode === 'individual');
  for (const product of individualProducts) {
    const dir = new URL(`./${product.slug}/`, outputRoot);
    mkdirSync(dir, { recursive: true });
    writeFileSync(new URL('index.html', dir), renderProductPage(product), 'utf8');
  }

  for (const collection of catalog.collections) {
    const products = catalog.products.filter((product) => product.collections?.includes(collection.slug));
    const dir = new URL(`./${collection.slug}/`, outputRoot);
    mkdirSync(dir, { recursive: true });
    writeFileSync(new URL('index.html', dir), renderCollectionPage(collection, products), 'utf8');
  }

  return { individualPages: individualProducts.length, collectionPages: catalog.collections.length };
}

export function generateProductPages() {
  return generateCatalogPages().individualPages;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const result = generateCatalogPages();
  console.log(`Catalog pages generated: ${result.individualPages} individual, ${result.collectionPages} collection`);
}
