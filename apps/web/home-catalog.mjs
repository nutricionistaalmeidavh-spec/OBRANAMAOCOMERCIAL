import { readFileSync } from 'node:fs';

const catalog = JSON.parse(readFileSync(new URL('./public/sistemas/products.json', import.meta.url), 'utf8'));

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}
function typeLabel(type) {
  return ({ desktop: 'Desktop', web: 'Web', saas: 'SaaS' })[type] || type;
}
function productHref(product) {
  if (product.pageMode === 'external') return product.externalHref;
  if (product.pageMode === 'collection') {
    const collection = product.collections?.[0];
    return collection ? `/sistemas/${collection}/#${product.slug}` : '/sistemas/';
  }
  return `/sistemas/${product.slug}/`;
}
function externalAttrs(href) {
  return href.startsWith('https://') ? ' target="_blank" rel="noopener noreferrer"' : '';
}

export function renderHomeCatalogSection() {
  const featuredProducts = catalog.products.filter((product) => product.featured);
  const productCards = featuredProducts.map((product) => {
    const href = productHref(product);
    return `<article class="artisys-product-card"><div class="artisys-product-meta"><span>${escapeHtml(product.category)}</span><span>${escapeHtml(typeLabel(product.type))}</span></div><h3>${escapeHtml(product.name)}</h3><p>${escapeHtml(product.summary)}</p><div class="artisys-product-card-bottom"><strong>${escapeHtml(product.priceLabel)}</strong><a href="${escapeHtml(href)}"${externalAttrs(href)}>Ver sistema <span aria-hidden="true">↗</span></a></div></article>`;
  });

  const collectionCards = catalog.collections.filter((collection) => collection.featured).map((collection) => `<article class="artisys-product-card"><div class="artisys-product-meta"><span>Coleção</span><span>${escapeHtml(collection.category)}</span></div><h3>${escapeHtml(collection.name)}</h3><p>${escapeHtml(collection.summary)}</p><div class="artisys-product-card-bottom"><strong>${catalog.products.filter((product) => product.collections?.includes(collection.slug)).length} sistemas</strong><a href="/sistemas/${escapeHtml(collection.slug)}/">Explorar coleção <span aria-hidden="true">↗</span></a></div></article>`);

  const cards = [...productCards, ...collectionCards].join('');
  return `<section class="artisys-products-home" id="sistemas-catalogo" aria-labelledby="sistemas-catalogo-title"><div class="artisys-products-shell"><div class="artisys-products-heading"><div><p class="artisys-products-kicker">Sistemas ArtiSys</p><h2 id="sistemas-catalogo-title">Produtos prontos para entrar na operação.</h2></div><div class="artisys-products-intro"><p>Além de projetos sob medida, a ArtiSys mantém sistemas que já podem ser apresentados, contratados e implantados.</p><a href="/sistemas/">Ver todos os sistemas <span aria-hidden="true">→</span></a></div></div><div class="artisys-products-grid">${cards}</div><div class="artisys-products-footer"><span>${catalog.products.length} sistemas no catálogo atual</span><a href="/sistemas/">Explorar catálogo completo</a></div></div></section>`;
}

export function injectHomeCatalogSection(html) {
  if (html.includes('id="sistemas-catalogo"')) return html;
  if (!/<\/main>/i.test(html)) throw new Error('Home sem </main> para inserir catálogo.');
  let output = html;
  if (!output.includes('/sistemas/home-catalog.css')) output = output.replace(/<\/head>/i, '<link rel="stylesheet" href="/sistemas/home-catalog.css">\n</head>');
  if (!output.includes('href="#sistemas-catalogo"')) output = output.replace('<a href="#servicos">Soluções</a>', '<a href="#servicos">Soluções</a><a href="#sistemas-catalogo">Sistemas</a>');
  return output.replace(/<\/main>/i, `${renderHomeCatalogSection()}\n</main>`);
}
