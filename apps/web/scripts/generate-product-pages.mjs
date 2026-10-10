import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { artisysSeoConfig } from '../seo.config.mjs';
import { productBelongsToCollection, withCanonicalCollections } from '../catalog-collections.mjs';
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

// Galeria editorial estática do PDV ArtiSys. Não usa JS, renderização no cliente nem mutations.
function renderPdvGallery() {
  return `<section class="pdv-gallery" id="pdv-em-acao" aria-labelledby="pdv-gallery-title">
    <div class="pdv-gallery-heading"><div><p class="section-kicker">Veja o PDV em ação</p><h2 id="pdv-gallery-title">Conheça as telas do sistema.</h2></div><p>Do balcão aos pedidos de mesa: conheça algumas das rotinas do PDV ArtiSys.</p></div>
    <div class="pdv-gallery-grid">
      <figure class="pdv-gallery-card">
        <div class="pdv-photo pdv-photo--balcao" role="img" aria-label="Tela do Balcão do PDV ArtiSys: produtos, carrinho e formas de pagamento."></div>
        <figcaption><strong>Balcão e caixa</strong><span>Venda rápida, produtos e finalização de pedidos.</span></figcaption>
      </figure>
      <figure class="pdv-gallery-card">
        <div class="pdv-photo pdv-photo--mesas" role="img" aria-label="Tela Mesas e comandas do PDV ArtiSys, com mapa de mesas e acompanhamento dos pedidos."></div>
        <figcaption><strong>Mesas e comandas</strong><span>Atendimento e controle de pedidos por mesa.</span></figcaption>
      </figure>
      <figure class="pdv-gallery-card">
        <div class="pdv-photo pdv-photo--mobile" role="img" aria-label="Duas telas mobile do PDV ArtiSys: acesso do garçom e painel de cozinha."></div>
        <figcaption><strong>Garçom e cozinha</strong><span>Rotinas móveis de atendimento e preparo.</span></figcaption>
      </figure>
    </div>
  </section>`;
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
  <meta name="theme-color" content="#0d0a1d">
  ${renderHeadTags(seo)}
  <link rel="icon" type="image/png" sizes="32x32" href="/icons/artisys-favicon-32.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/icons/artisys-apple-touch-icon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../product-page.css">
  ${product.slug === 'pdv-artisys' ? '<link rel="stylesheet" href="../pdv-artisys-gallery.css">' : ''}
</head>
<body>
  <!-- artisys-generated:product -->
  <a class="skip-link" href="#product-title">Ir para o produto</a>
  <header class="product-header"><a class="brand" href="/" aria-label="ArtiSys, página inicial"><img src="/artisys-logo.svg" alt="ArtiSys"></a><a class="back-link" href="/sistemas/">Todos os sistemas</a></header>
  <main>
    <section class="product-hero${product.slug === 'pdv-artisys' ? ' product-hero--pdv' : ''}" aria-labelledby="product-title">
      <div class="hero-copy"><p class="eyebrow">${escapeHtml(product.category)} · ${escapeHtml(typeLabel(product.type))}</p><h1 id="product-title">${escapeHtml(product.name)}</h1><p class="hero-summary">${escapeHtml(product.summary)}</p><div class="hero-actions"><a class="button primary" data-product-cta href="${escapeHtml(product.ctaHref)}"${externalAttrs(product.ctaHref)}>${escapeHtml(product.ctaLabel)}</a>${access}</div></div>
      ${product.slug === 'pdv-artisys' ? '<figure class="pdv-featured-picture"><div class="pdv-photo pdv-photo--overview" role="img" aria-label="PDV ArtiSys em notebook com periféricos de caixa, balança, leitor de código e QR Code."></div><figcaption>PDV ArtiSys · visão geral e periféricos</figcaption></figure>' : ''}
      <aside class="product-facts" aria-label="Resumo comercial"><div><span>Status</span><strong>${escapeHtml(status)}</strong></div><div><span>Formato</span><strong>${escapeHtml(typeLabel(product.type))}</strong></div><div><span>Investimento</span><strong>${escapeHtml(product.priceLabel)}</strong></div></aside>
    </section>
    ${product.slug === 'pdv-artisys' ? renderPdvGallery() : ''}
    <div class="product-details">
    <section class="content-section split-section" aria-labelledby="audience-title"><div><p class="section-kicker">Para quem é</p><h2 id="audience-title">Feito para uma rotina real.</h2></div><p class="large-copy">${escapeHtml(product.audience)}</p></section>
    <section class="content-section" aria-labelledby="benefits-title"><p class="section-kicker">O que melhora</p><h2 id="benefits-title">Menos improviso. Mais clareza na operação.</h2><div class="benefit-grid">${product.benefits.map((item, index) => `<article><span>${String(index + 1).padStart(2, '0')}</span><p>${escapeHtml(item)}</p></article>`).join('')}</div></section>
    <section class="content-section" aria-labelledby="features-title"><p class="section-kicker">Funcionalidades</p><h2 id="features-title">O essencial do produto, sem rodeios.</h2><div class="feature-grid">${product.features.map((item) => `<article><span aria-hidden="true">✓</span><h3>${escapeHtml(item)}</h3></article>`).join('')}</div></section>
    <section class="content-section" aria-labelledby="steps-title"><p class="section-kicker">Como funciona</p><h2 id="steps-title">Da configuração ao uso.</h2><ol class="steps-list">${renderSteps(product.steps)}</ol></section>
    <section class="content-section faq-section" aria-labelledby="faq-title"><p class="section-kicker">Perguntas frequentes</p><h2 id="faq-title">Antes de começar.</h2><div class="faq-list">${renderFaq(product.faq)}</div></section>
    </div>
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
  const segmentLabel = collection.category || collection.name;
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
    <section class="catalog-hero" aria-labelledby="collection-title"><p class="eyebrow">${escapeHtml(segmentLabel)} · Coleção ArtiSys</p><h1 id="collection-title">${escapeHtml(collection.name)}</h1><p class="hero-copy">${escapeHtml(collection.summary)}</p><div class="hero-stats"><div><strong>${products.length}+</strong><span>sistemas nesta coleção</span></div><div><strong>1</strong><span>página para comparar o portfólio</span></div><div><strong>${escapeHtml(segmentLabel)}</strong><span>segmento especializado</span></div></div></section>
    <section class="catalog-section" aria-labelledby="collection-products-title"><div class="section-heading"><div><p class="eyebrow">Portfólio</p><h2 id="collection-products-title">Soluções para diferentes rotinas de ${escapeHtml(segmentLabel.toLowerCase())}</h2></div><p class="result-count">Portfólio ArtiSys + aprovados no Mercado Livre</p></div><div class="catalog-grid">${products.map(renderCollectionCard).join('')}</div><div id="marketplace-collection-extra" data-collection="${escapeHtml(collection.slug)}" class="catalog-grid marketplace-extra" hidden></div></section>
    <section class="catalog-note"><div><p class="eyebrow">ArtiSys</p><h2>Escolha pelo tipo de operação.</h2></div><p>Os produtos do portfólio ArtiSys aparecem aqui junto dos itens aprovados para esta coleção no catálogo comercial conectado.</p></section>
  </main>
  <footer class="catalog-footer"><span>ArtiSys</span><a href="/sistemas/">Catálogo completo</a><a href="/">Página inicial</a></footer>
  <script src="../marketplace-feed.js" defer></script>
  <script src="../marketplace-collection.js" defer></script>
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
  const catalog = withCanonicalCollections(JSON.parse(readFileSync(catalogUrl, 'utf8')));
  if (!Array.isArray(catalog.products) || !Array.isArray(catalog.collections)) throw new Error('Catálogo de produtos inválido.');
  cleanGeneratedTargets(catalog);

  const individualProducts = catalog.products.filter((product) => product.pageMode === 'individual');
  for (const product of individualProducts) {
    const dir = new URL(`./${product.slug}/`, outputRoot);
    mkdirSync(dir, { recursive: true });
    writeFileSync(new URL('index.html', dir), renderProductPage(product), 'utf8');
  }

  for (const collection of catalog.collections) {
    const products = catalog.products.filter((product) => productBelongsToCollection(product, collection));
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
