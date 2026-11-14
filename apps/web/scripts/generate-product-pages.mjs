import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { artisysSeoConfig } from '../seo.config.mjs';
import { productBelongsToCollection, withCanonicalCollections } from '../catalog-collections.mjs';
import { buildPageSeo, renderHeadTags } from '../vendor/artisys-seo/technical.mjs';

const catalogUrl = new URL('../public/sistemas/products.json', import.meta.url);
const outputRoot = new URL('../public/sistemas/', import.meta.url);
const LEGACY_GENERATED_SLUGS = ['debora-lactacao', 'loja-online', 'oficina-agricola', 'sistema-lavoura', 'pecuaria', 'maquinas-agricolas', 'frota-manutencao'];

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


/** Real screenshots only: captured by the Windows Electron QA run (14 Nov 2026).
 * Media is imported from verified GitHub Actions artifact, not generated mockups.
 * Static HTML; no client scripts, observers, or extra API calls.
 */
function renderFinanceGallery() {
  const media = './media/';
  const image = (file, alt, eager = false) => `<img src="${media}${file}" alt="${escapeHtml(alt)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async" width="1440" height="900">`;
  return `<section class="finance-gallery" id="financeiro-em-acao" aria-labelledby="finance-gallery-title">
    <div class="finance-gallery-heading">
      <div><p class="section-kicker">Capturas reais do aplicativo</p><h2 id="finance-gallery-title">Conheça o Financeiro por dentro.</h2></div>
      <p>Telas do ArtiSys Financeiro para Windows, registradas em testes reais do aplicativo com dados demonstrativos.</p>
    </div>
    <div class="finance-gallery-grid" id="finance-react-carousel" data-gallery-source="electron-qa">
      <figure class="finance-gallery-card finance-gallery-card--wide">
        <div class="finance-gallery-screen">${image('crm-funil-real.webp','CRM ArtiSys: funil Kanban, oportunidades, propostas e vinculação de recebíveis mediante confirmação.')}</div>
        <figcaption><strong>CRM e funil de vendas</strong><span>Leads, oportunidades, propostas e histórico comercial na mesma operação.</span><a href="${media}crm-funil-real.webp" target="_blank" rel="noopener noreferrer">Ampliar captura real</a></figcaption>
      </figure>
      <figure class="finance-gallery-card">
        <div class="finance-gallery-screen">${image('contas-real.webp','Tela real de contas a pagar e receber do ArtiSys Financeiro.')}</div>
        <figcaption><strong>Pagar e receber</strong><span>Controle financeiro por conta, valor e vencimento.</span><a href="${media}contas-real.webp" target="_blank" rel="noopener noreferrer">Ampliar captura real</a></figcaption>
      </figure>
      <figure class="finance-gallery-card">
        <div class="finance-gallery-screen">${image('dre-real.webp','Tela real da DRE no ArtiSys Financeiro.')}</div>
        <figcaption><strong>DRE e resultados</strong><span>Indicadores financeiros baseados em lançamentos confirmados.</span><a href="${media}dre-real.webp" target="_blank" rel="noopener noreferrer">Ampliar captura real</a></figcaption>
      </figure>
      <figure class="finance-gallery-card">
        <div class="finance-gallery-screen">${image('crm-agenda-real.webp','Tela real da agenda e follow-ups do módulo CRM comercial.')}</div>
        <figcaption><strong>Agenda comercial</strong><span>Compromissos e próximos passos de cada oportunidade.</span><a href="${media}crm-agenda-real.webp" target="_blank" rel="noopener noreferrer">Ampliar captura real</a></figcaption>
      </figure>
      <figure class="finance-gallery-card">
        <div class="finance-gallery-screen">${image('crm-indicadores-real.webp','Tela real de indicadores do CRM com taxa de fechamento e projeções comerciais.')}</div>
        <figcaption><strong>Indicadores do CRM</strong><span>Taxas de conversão, metas e previsão ponderada.</span><a href="${media}crm-indicadores-real.webp" target="_blank" rel="noopener noreferrer">Ampliar captura real</a></figcaption>
      </figure>
    </div>
    <section class="finance-conversion" aria-labelledby="finance-conversion-title">
      <div><p class="section-kicker">CRM + Financeiro</p><h3 id="finance-conversion-title">A venda avança. O lançamento depende de você.</h3><p>O CRM acompanha a negociação e sugere recebíveis quando a venda é ganha. A conta a receber só nasce depois de sua confirmação explícita, evitando previsões comerciais no saldo, caixa ou DRE.</p></div>
      <ol aria-label="Etapas da conversão comercial"><li>Lead cadastrado</li><li>Oportunidade e proposta</li><li>Venda ganha</li><li>Revisão e confirmação</li><li>Recebível no Financeiro</li></ol>
    </section>
    <p class="finance-gallery-disclaimer">Imagens autênticas da versão de testes do ArtiSys Financeiro; valores e contatos são demonstrativos. A interface pode variar conforme atualizações.</p>
  </section>`;
}


/** Editorial Financeiro hero keeps all imagery from real, self-hosted Electron captures. */
function renderFinanceHero(product, access, status) {
  return `<section class="product-hero" aria-labelledby="product-title">
    <div class="finance-hero-inner">
      <div class="hero-copy finance-hero-copy">
        <p class="eyebrow">CRM e gestão financeira no mesmo aplicativo</p>
        <h1 id="product-title">Vendas e finanças.<span> Conectadas.</span></h1>
        <p class="hero-summary">Do primeiro lead ao controle do caixa. Organize propostas, recebimentos e resultados com a segurança de decidir quando uma venda entra no financeiro.</p>
        <div class="hero-actions">
          <a class="button primary" data-product-cta data-umami-event="finance_checkout" href="${escapeHtml(product.ctaHref)}"${externalAttrs(product.ctaHref)}>${escapeHtml(product.ctaLabel)}</a>
          <a class="button secondary" data-umami-event="finance_gallery" href="#financeiro-em-acao">Ver telas reais <span aria-hidden="true">↗</span></a>
          ${access}
        </div>
        <p class="finance-hero-assurance">Licença do aplicativo para Windows · Sem assinatura obrigatória</p>
      </div>
      <div class="finance-hero-media">
        <div id="finance-particles" aria-hidden="true"></div>
        <figure class="finance-hero-screenshot">
          <div class="finance-device-frame">
            <img src="./media/dashboard-real.webp" width="1440" height="900" fetchpriority="high" decoding="async" alt="Captura real do dashboard ArtiSys Financeiro, com indicadores de caixa e contas.">
          </div>
          <figcaption>Dashboard real · dados de demonstração</figcaption>
        </figure>
        <figure class="finance-hero-screenshot-secondary" aria-label="Tela real do CRM integrada ao Financeiro">
          <img src="./media/crm-funil-real.webp" width="1440" height="900" loading="lazy" decoding="async" alt="Captura real do funil comercial do CRM ArtiSys.">
        </figure>
      </div>
    </div>
    <svg class="finance-wave" viewBox="0 0 1440 165" preserveAspectRatio="none" focusable="false" aria-hidden="true"><path fill="#f4f1fa" d="M0,48 C190,20 325,28 476,82 C615,130 726,160 853,148 C1005,132 1093,70 1226,60 C1318,52 1383,68 1440,77 L1440,165 L0,165 Z"></path></svg>
  </section>
  <aside class="product-facts" aria-label="Resumo comercial">
    <div><span>Produto</span><strong>Financeiro + CRM integrado</strong></div>
    <div><span>Formato</span><strong>${escapeHtml(typeLabel(product.type))}</strong></div>
    <div><span>Investimento</span><strong>${escapeHtml(product.priceLabel)}</strong></div>
  </aside>`;
}

function renderFinanceFeatures() {
  const media = './media/';
  return `<section class="finance-feature-section" aria-labelledby="finance-feature-heading">
    <div class="finance-section-heading">
      <p>Uma operação conectada</p>
      <h2 id="finance-feature-heading">Do contato ao resultado. Sem perder o controle.</h2>
    </div>
    <div class="finance-feature-grid">
      <article class="finance-feature finance-feature--crm">
        <div class="finance-feature-art"><img src="${media}crm-funil-real.webp" loading="lazy" decoding="async" width="1440" height="900" alt="Funil de vendas real, com oportunidades e etapas comerciais"></div>
        <div class="finance-feature-copy"><span>01 / Vendas</span><h3>CRM que acompanha cada negociação.</h3><p>Leads, propostas, tarefas e funil de vendas no mesmo sistema.</p></div>
      </article>
      <article class="finance-feature finance-feature--accounts">
        <div class="finance-feature-art"><img src="${media}contas-real.webp" loading="lazy" decoding="async" width="1440" height="900" alt="Tela real de contas a pagar e receber"></div>
        <div class="finance-feature-copy"><span>02 / Controle</span><h3>Financeiro organizado por você.</h3><p>Contas, recorrências e conciliação em uma visão centralizada.</p></div>
      </article>
      <article class="finance-feature finance-feature--insights">
        <div class="finance-feature-art"><img src="${media}dre-real.webp" loading="lazy" decoding="async" width="1440" height="900" alt="DRE real do sistema"></div>
        <div class="finance-feature-copy"><span>03 / Resultado</span><h3>Decisões com números de verdade.</h3><p>DRE, fluxo de caixa e indicadores sem inflar valores com previsões comerciais.</p></div>
      </article>
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
  ${product.slug === 'artisys-finance' ? '<link rel="stylesheet" href="../artisys-finance-gallery.css">' : ''}
  ${product.slug === 'artisys-finance' ? '<link rel="stylesheet" href="../artisys-finance-island.css">' : ''}
  ${product.slug === 'artisys-finance' ? '<script type="module" src="/assets/finance-landing.js"></script>' : ''}
  ${product.slug === 'artisys-finance' ? '<script src="../artisys-finance-motion.js" defer></script>' : ''}
  ${product.slug === 'artisys-finance' ? '<meta name="color-scheme" content="light">' : ''}
</head>
<body${product.slug === 'artisys-finance' ? ' class="finance-page"' : ''}>
  <!-- artisys-generated:product -->
  <a class="skip-link" href="#product-title">Ir para o produto</a>
  ${product.slug === 'artisys-finance' ? '<header class="product-header"><div class="finance-header-inner"><a class="brand" href="/" aria-label="ArtiSys, página inicial"><img src="/artisys-logo.svg" alt="ArtiSys"></a><nav class="finance-nav" aria-label="Navegação Financeiro"><a href="#finance-feature-heading">Benefícios</a><a href="#financeiro-em-acao">Telas reais</a><a href="#finance-conversion-title">Integração CRM</a></nav><a class="back-link" href="/sistemas/">Todos os sistemas</a></div></header>' : '<header class="product-header"><a class="brand" href="/" aria-label="ArtiSys, página inicial"><img src="/artisys-logo.svg" alt="ArtiSys"></a><a class="back-link" href="/sistemas/">Todos os sistemas</a></header>'}
  <main${product.slug === 'artisys-finance' ? ' class="finance-motion-root" data-smooth-scroll="false" data-particles-enabled="false" data-tilt-enabled="false"' : ''}>
    ${product.slug === 'artisys-finance' ? renderFinanceHero(product, access, status) : `<section class="product-hero${product.slug === 'pdv-artisys' ? ' product-hero--pdv' : ''}" aria-labelledby="product-title">
      <div class="hero-copy"><p class="eyebrow">${escapeHtml(product.category)} · ${escapeHtml(typeLabel(product.type))}</p><h1 id="product-title">${escapeHtml(product.name)}</h1><p class="hero-summary">${escapeHtml(product.summary)}</p><div class="hero-actions"><a class="button primary" data-product-cta${product.slug === 'artisys-finance' ? ' data-umami-event="finance_checkout"' : ''} href="${escapeHtml(product.ctaHref)}"${externalAttrs(product.ctaHref)}>${escapeHtml(product.ctaLabel)}</a>${access}</div></div>
      ${product.slug === 'pdv-artisys' ? '<figure class="pdv-featured-picture"><div class="pdv-photo pdv-photo--overview" role="img" aria-label="PDV ArtiSys em notebook com periféricos de caixa, balança, leitor de código e QR Code."></div><figcaption>PDV ArtiSys · visão geral e periféricos</figcaption></figure>' : ''}
      ${product.slug === 'artisys-finance' ? '<figure class="finance-featured-picture"><a href="#financeiro-em-acao" aria-label="Conhecer as capturas reais do ArtiSys Financeiro"><img src="./media/dashboard-real.webp" width="1440" height="900" alt="Dashboard real do ArtiSys Financeiro com saldos, contas a pagar e receber e fluxo de caixa." fetchpriority="high" decoding="async"></a><figcaption>Dashboard real do aplicativo · dados de demonstração</figcaption></figure>' : ''}
      <aside class="product-facts" aria-label="Resumo comercial"><div><span>Status</span><strong>${escapeHtml(status)}</strong></div><div><span>Formato</span><strong>${escapeHtml(typeLabel(product.type))}</strong></div><div><span>Investimento</span><strong>${escapeHtml(product.priceLabel)}</strong></div></aside>
    </section>`}
    ${product.slug === 'artisys-finance' ? renderFinanceFeatures() : ''}
    ${product.slug === 'pdv-artisys' ? renderPdvGallery() : ''}
    ${product.slug === 'artisys-finance' ? '<div class="finance-gallery-shell">' + renderFinanceGallery() + '</div>' : ''}
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
    <section class="catalog-hero" aria-labelledby="collection-title"><p class="eyebrow">${escapeHtml(segmentLabel)} · Coleção ArtiSys</p><h1 id="collection-title">${escapeHtml(collection.name)}</h1><p class="hero-copy">${escapeHtml(collection.summary)}</p>${products.length ? `<div class="hero-stats"><div><strong>${products.length}</strong><span>sistemas nesta coleção</span></div><div><strong>1</strong><span>página para comparar o portfólio</span></div><div><strong>${escapeHtml(segmentLabel)}</strong><span>segmento especializado</span></div></div>` : ''}</section>
    <section class="catalog-section" aria-labelledby="collection-products-title"><div class="section-heading"><div><p class="eyebrow">Portfólio</p><h2 id="collection-products-title">Soluções para diferentes rotinas de ${escapeHtml(segmentLabel.toLowerCase())}</h2></div><p class="result-count">Portfólio ArtiSys + aprovados no Mercado Livre</p></div><div class="catalog-grid">${products.map(renderCollectionCard).join('')}</div>${products.length ? '' : '<p class="catalog-empty">Não há sistemas desta área publicados para venda direta no momento.</p>'}<div id="marketplace-collection-extra" data-collection="${escapeHtml(collection.slug)}" class="catalog-grid marketplace-extra" hidden></div></section>
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
