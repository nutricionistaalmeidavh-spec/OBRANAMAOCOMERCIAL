import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const publicRoot = new URL('../public/', import.meta.url);
const readPublic = (relativePath) => readFileSync(new URL(relativePath, publicRoot), 'utf8');
const readCatalog = (relativePath) => readPublic(`sistemas/${relativePath}`);
const html = readCatalog('index.html');
const css = readCatalog('catalog.css');
const js = readCatalog('catalog.js');
const detailCss = readCatalog('product-page.css');
assert.match(detailCss, /--bg:#0d0a1d/, 'product page uses the unified ArtiSys dark shell');
assert.match(detailCss, /--paper:#f4f1fa/, 'product page includes a light reading surface');
assert.match(detailCss, /--accent:#7037ad/, 'primary buttons use the ArtiSys violet palette');
assert.match(detailCss, /font-family:"Outfit"/, 'unified typography');
assert.match(detailCss, /\.product-facts\{[\s\S]*?grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/, 'compact facts grid');
assert.match(detailCss, /@media\(max-width:560px\)/, 'mobile layout is explicitly supported');
assert.match(detailCss, /:focus-visible/, 'keyboard focus must remain visible');
assert.match(detailCss, /prefers-reduced-motion:reduce/, 'reduced motion preference must be preserved');
assert.doesNotMatch(detailCss, /#55d6a8|#8cf0cc|#07111f/i, 'outdated mint and blue palette removed');

const atlasPath = new URL('sistemas/pdv-artisys/media/pdv-gallery-atlas.avif', publicRoot);
assert.ok(existsSync(atlasPath), 'original PDV ArtiSys gallery atlas must be published');
const atlas = readFileSync(atlasPath);
assert.ok(atlas.byteLength > 5500 && atlas.byteLength < 160000, 'gallery atlas must be compact but nonempty');
assert.equal(atlas.subarray(4, 12).toString(), 'ftypavif', 'gallery must be a real AVIF image');
const pdvCss = readCatalog('pdv-artisys-gallery.css');
assert.match(pdvCss, /pdv-gallery-atlas\.avif/, 'gallery references uploaded image asset');
assert.match(pdvCss, /@media\(max-width:650px\)/, 'mobile gallery stays compact');
assert.match(pdvCss, /\.product-hero--pdv/, 'gallery affects PDV hero only');
assert.doesNotMatch(pdvCss, /javascript:|url\(['"]?https?:/i, 'gallery must not load scripts or remote images');
const catalog = JSON.parse(readCatalog('products.json'));

assert.equal(catalog.version, 3, 'catalog version must be 3 after presentation-mode rollout');
assert.equal(catalog.products.length, 11, 'catalog must contain the 11 approved systems');
assert.equal(catalog.collections.length, 1, 'only Agro collection is approved for this rollout');
assert.equal(catalog.collections[0].slug, 'agro');

const excluded = ['compatibiliza-bim', 'wpp-prospector', 'republica'];
for (const slug of excluded) assert.ok(!catalog.products.some((product) => product.slug === slug), `${slug} must stay out of the catalog`);

const allowedTypes = new Set(['desktop', 'web', 'saas']);
const allowedModes = new Set(['individual', 'external', 'collection']);
const slugs = new Set();
const individual = [];
for (const product of catalog.products) {
  assert.match(product.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.ok(!slugs.has(product.slug), `duplicate slug: ${product.slug}`);
  slugs.add(product.slug);
  assert.ok(allowedTypes.has(product.type), `invalid type: ${product.slug}`);
  assert.ok(allowedModes.has(product.pageMode), `invalid page mode: ${product.slug}`);
  assert.equal(typeof product.name, 'string');
  assert.equal(typeof product.category, 'string');
  assert.equal(typeof product.status, 'string');
  assert.equal(typeof product.priceLabel, 'string');
  assert.equal(typeof product.summary, 'string');
  assert.equal(typeof product.audience, 'string');
  assert.ok(Array.isArray(product.features) && product.features.length >= 3, `${product.slug} needs features`);
  assert.equal(typeof product.featured, 'boolean');
  assert.equal(typeof product.ctaLabel, 'string');
  assert.ok(product.ctaHref.startsWith('/') || product.ctaHref.startsWith('https://'));
  assert.equal(typeof product.seo?.title, 'string');
  assert.equal(typeof product.seo?.description, 'string');
  if (product.collections) assert.ok(product.collections.every((slug) => catalog.collections.some((collection) => collection.slug === slug)), `${product.slug} references unknown collection`);
  if (product.accessHref) assert.ok(product.accessHref.startsWith('/') || product.accessHref.startsWith('https://'));

  if (product.pageMode === 'individual') {
    individual.push(product.slug);
    const page = readCatalog(`${product.slug}/index.html`);
    const canonical = `https://artisys.dev/sistemas/${product.slug}/`;
    assert.ok(page.includes(product.name));
    assert.ok(page.includes(`<link rel="canonical" href="${canonical}">`));
    assert.match(page, /<meta property="og:title"/i);
    assert.match(page, /<meta name="twitter:card"/i);
    assert.match(page, /<script type="application\/ld\+json">/i);
    assert.match(page, /class="product-hero(?: product-hero--pdv)?"/i);
    assert.match(page, /data-product-cta/i);
    if (product.slug === 'pdv-artisys') {
      assert.match(page, /class="product-hero product-hero--pdv"/, 'PDV receives compact editorial hero only');
      assert.match(page, /href="\.\.\/pdv-artisys-gallery\.css"/, 'PDV includes scoped gallery stylesheet');
      assert.match(page, /id="pdv-em-acao"/, 'PDV gallery section is present');
      assert.equal((page.match(/class="pdv-gallery-card"/g) || []).length, 3, 'gallery shows three secondary previews');
      for (const name of ['Balcão e caixa', 'Mesas e comandas', 'Garçom e cozinha']) assert.ok(page.includes(name), 'PDV gallery missing ' + name);
      assert.match(page, /pdv-photo--overview/, 'PDV hero references the overview quadrant');
      assert.doesNotMatch(page, /<script[^>]*src=|fetch\(|MutationObserver|createElement\(/i, 'gallery is static with no browser mutations');
    } else {
      assert.doesNotMatch(page, /pdv-artisys-gallery\.css|pdv-em-acao|pdv-photo|product-hero--pdv/, 'other product pages must remain unchanged');
    }

    assert.match(page, /<meta name="theme-color" content="#0d0a1d">/, 'shared theme-color');
    assert.match(page, /<link rel="stylesheet" href="\.\.\/product-page\.css">/, 'common generated stylesheet');
    assert.match(page, /family=Outfit/, 'brand typography');
    assert.match(page, /<div class="product-details">/, 'readable light content wrapper');
    assert.match(page, /<aside class="product-facts" aria-label="Resumo comercial">/, 'facts remain accessible');
    assert.match(page, /<a class="back-link" href="\/sistemas\/">Todos os sistemas<\/a>/, 'catalogue back-link preserved');
    assert.match(page, /<a class="brand" href="\/" aria-label="ArtiSys, página inicial">/, 'home link preserved');
    assert.ok(page.includes(`<strong>${product.priceLabel}</strong>`), 'commercial price unchanged');
    assert.equal((page.match(/data-product-cta/g) || []).length, 2, 'both original CTA locations remain');
    assert.ok(page.includes(`href="${product.ctaHref}"`), 'the original call-to-action URL remains unchanged');
    assert.ok(page.includes(`>${product.ctaLabel}</a>`), 'CTA copy must remain unchanged');
    if (product.accessHref) {
      assert.ok(page.includes(`href="${product.accessHref}"`), 'customer portal URL must remain unchanged');
      assert.equal((page.match(/>Já sou cliente<\/a>/g) || []).length, 2);
    }

    assert.doesNotMatch(page, /\/src\/|cloudflare-client|\/api\/|portal\.ts|owner\.ts|field\.ts|type="module"/i);
  }
}

assert.deepEqual(individual.sort(), ['artisys-finance', 'loja-online', 'nutridesk', 'obra-na-mao', 'oficina-agricola', 'pdv-artisys'].sort());

const lactation = catalog.products.find((product) => product.slug === 'consultora-amamentacao');
assert.ok(lactation, 'Consultora de Amamentação must exist');
assert.equal(lactation.name, 'Consultora de Amamentação');
assert.equal(lactation.pageMode, 'external');
assert.equal(lactation.externalHref, 'https://deboralactacao.com/comercial/');
assert.ok(!existsSync(new URL('sistemas/consultora-amamentacao/index.html', publicRoot)), 'external product must not generate duplicate ArtiSys landing');

const oficina = catalog.products.find((product) => product.slug === 'oficina-agricola');
assert.equal(oficina.pageMode, 'individual');
assert.ok(oficina.collections.includes('agro'), 'Oficina Agrícola must also belong to Agro collection');

for (const slug of ['sistema-lavoura', 'pecuaria', 'maquinas-agricolas', 'frota-manutencao']) {
  const product = catalog.products.find((candidate) => candidate.slug === slug);
  assert.ok(product, `${slug} missing`);
  assert.equal(product.pageMode, 'collection');
  assert.ok(product.collections.includes('agro'));
}

const agro = readCatalog('agro/index.html');
assert.match(agro, /<link rel="canonical" href="https:\/\/artisys\.dev\/sistemas\/agro\/">/i);
for (const name of ['Oficina Agrícola', 'Sistema Lavoura', 'Pecuária', 'Máquinas Agrícolas', 'Frota e Manutenção']) assert.ok(agro.includes(name), `${name} missing from Agro collection`);
assert.doesNotMatch(agro, /cloudflare-client|\/api\/|portal\.ts|owner\.ts|field\.ts/i);

assert.match(html, /<title>.*ArtiSys.*Sistemas.*<\/title>/i);
assert.match(html, /id="product-count">11</i);
assert.match(html, /rel="canonical" href="https:\/\/artisys\.dev\/sistemas\/"/i);
assert.match(html, /id="catalog-grid"/i);
assert.match(html, /src="\.\/marketplace-feed\.js"/i, 'catalog must load shared approved marketplace feed client');
assert.match(js, /fetch\(['"]\.\/products\.json['"]\)/i);
assert.match(js, /function productDestination/i);
assert.match(js, /ArtiSysMarketplace/i, 'catalog must enrich static products from approved marketplace feed');
assert.doesNotMatch(js, /fetch\(['"]\/api\//i, 'site must never call a local private API route');
assert.doesNotMatch(js, /cloudflare-client|portal\.ts|owner\.ts|field\.ts/i);
assert.ok(css.length > 3000);
new Function(js);

assert.ok(existsSync(new URL('sistemas/marketplace-feed.js', publicRoot)), 'shared marketplace feed client missing');
const feedClient = readCatalog('marketplace-feed.js');
assert.match(feedClient, /artisys-mercadolivre\.nutricionistaalmeidavh\.workers\.dev\/api\/site-catalog\/feed/i);
assert.match(feedClient, /AbortController/i, 'marketplace feed must have a timeout/fallback boundary');
assert.match(feedClient, /mergeApprovedFeed/i, 'approved marketplace data must merge without duplicating static slugs');
assert.doesNotMatch(feedClient, /item\.collection\s*!==\s*['"]agro['"]/i, 'marketplace feed must accept every published canonical collection');
assert.doesNotMatch(feedClient, /ADMIN_|password|token|authorization/i, 'public feed client must not contain credentials');
new Function(feedClient);

assert.match(agro, /id="marketplace-collection-extra"/i, 'Agro collection must have a dynamic approved-feed slot');
assert.match(agro, /src="\.\.\/marketplace-feed\.js"/i);
assert.match(agro, /src="\.\.\/marketplace-collection\.js"/i);
const collectionClient = readCatalog('marketplace-collection.js');
assert.match(collectionClient, /marketplace-collection-extra/);
assert.match(collectionClient, /collection === collectionSlug/);
new Function(collectionClient);

assert.ok(existsSync(new URL('sistemas/produto/index.html', publicRoot)), 'generic approved marketplace product page missing');
const marketplacePage = readCatalog('produto/index.html');
assert.match(marketplacePage, /<meta name="robots" content="noindex,follow">/i, 'query-based marketplace product detail must stay noindex');
assert.match(marketplacePage, /src="\.\.\/marketplace-feed\.js"/i);
assert.match(marketplacePage, /src="\.\.\/marketplace-product\.js"/i);
const productClient = readCatalog('marketplace-product.js');
assert.match(productClient, /URLSearchParams/);
assert.match(productClient, /item_id/);
assert.match(productClient, /pictures/);
assert.match(productClient, /permalink/);
new Function(productClient);

console.log('Public catalog contract OK:', {
  products: catalog.products.length,
  individualPages: individual.length,
  collections: catalog.collections.length,
  externalProducts: catalog.products.filter((product) => product.pageMode === 'external').length,
  marketplaceFeed: true,
  isolated: true
});
