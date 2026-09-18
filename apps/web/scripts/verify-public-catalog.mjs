import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const publicRoot = new URL('../public/', import.meta.url);
const readPublic = (relativePath) => readFileSync(new URL(relativePath, publicRoot), 'utf8');
const readCatalog = (relativePath) => readPublic(`sistemas/${relativePath}`);
const html = readCatalog('index.html');
const css = readCatalog('catalog.css');
const js = readCatalog('catalog.js');
const catalog = JSON.parse(readCatalog('products.json'));

assert.equal(catalog.version, 2, 'catalog version must be 2 after product-page rollout');
assert.ok(Array.isArray(catalog.products), 'products must be an array');
assert.equal(catalog.products.length, 5, 'catalog must contain five initial products');

const allowedTypes = new Set(['desktop', 'web', 'saas']);
const slugs = new Set();
for (const product of catalog.products) {
  assert.match(product.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `invalid slug: ${product.slug}`);
  assert.ok(!slugs.has(product.slug), `duplicate slug: ${product.slug}`);
  slugs.add(product.slug);
  assert.equal(typeof product.name, 'string');
  assert.equal(typeof product.category, 'string');
  assert.ok(allowedTypes.has(product.type), `invalid type for ${product.slug}`);
  assert.equal(typeof product.status, 'string');
  assert.equal(typeof product.priceLabel, 'string');
  assert.equal(typeof product.summary, 'string');
  assert.equal(typeof product.audience, 'string', `${product.slug} needs audience`);
  assert.ok(Array.isArray(product.features) && product.features.length >= 4, `${product.slug} needs features`);
  assert.ok(Array.isArray(product.benefits) && product.benefits.length >= 3, `${product.slug} needs benefits`);
  assert.ok(Array.isArray(product.steps) && product.steps.length >= 3, `${product.slug} needs steps`);
  assert.ok(Array.isArray(product.faq) && product.faq.length >= 3, `${product.slug} needs FAQ`);
  assert.equal(typeof product.featured, 'boolean');
  assert.equal(typeof product.ctaLabel, 'string');
  assert.ok(product.ctaHref.startsWith('/') || product.ctaHref.startsWith('https://'), `unsafe ctaHref for ${product.slug}`);
  assert.equal(typeof product.seo?.title, 'string', `${product.slug} needs SEO title`);
  assert.equal(typeof product.seo?.description, 'string', `${product.slug} needs SEO description`);
  if (product.accessHref) {
    assert.ok(product.accessHref.startsWith('/') || product.accessHref.startsWith('https://'), `unsafe accessHref for ${product.slug}`);
    assert.ok(!/^javascript:/i.test(product.accessHref), `javascript accessHref forbidden for ${product.slug}`);
  }

  const page = readCatalog(`${product.slug}/index.html`);
  const canonical = `https://artisys.dev/sistemas/${product.slug}/`;
  assert.match(page, new RegExp(`<title>[^<]*${product.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^<]*<\\/title>`, 'i'), `${product.slug} title missing`);
  assert.ok(page.includes(`<link rel="canonical" href="${canonical}">`), `${product.slug} canonical missing`);
  assert.match(page, /<meta property="og:title"/i, `${product.slug} Open Graph missing`);
  assert.match(page, /<meta name="twitter:card"/i, `${product.slug} Twitter metadata missing`);
  assert.match(page, /<script type="application\/ld\+json">/i, `${product.slug} JSON-LD missing`);
  assert.match(page, /class="product-hero"/i, `${product.slug} hero missing`);
  assert.match(page, /class="feature-grid"/i, `${product.slug} features missing`);
  assert.match(page, /class="faq-list"/i, `${product.slug} FAQ missing`);
  assert.match(page, /data-product-cta/i, `${product.slug} CTA missing`);
  assert.doesNotMatch(page, /\/src\/|cloudflare-client|\/api\/|portal\.ts|owner\.ts|field\.ts|type="module"/i, `${product.slug} must stay isolated from operational runtime`);
}

assert.match(html, /<title>.*ArtiSys.*Sistemas.*<\/title>/i);
assert.match(html, /rel="canonical" href="https:\/\/artisys\.dev\/sistemas\/"/i);
assert.match(html, /<meta property="og:title"/i);
assert.match(html, /<meta name="twitter:card"/i);
assert.match(html, /<script type="application\/ld\+json">/i);
assert.match(html, /href="\.\/catalog\.css"/i);
assert.match(html, /src="\.\/catalog\.js"/i);
assert.match(html, /id="catalog-search"/i);
assert.match(html, /id="catalog-filters"/i);
assert.match(html, /id="catalog-grid"/i);
assert.match(html, /id="product-dialog"/i);
assert.doesNotMatch(html, /\/src\/|cloudflare-client|type="module"/i, 'public catalog must not import operational runtime');
assert.match(js, /fetch\(['"]\.\/products\.json['"]\)/i);
assert.match(js, /\.\/\$\{product\.slug\}\//i, 'catalog cards must link to individual product pages');
assert.doesNotMatch(js, /cloudflare-client|\/api\/|portal\.ts|owner\.ts|field\.ts/i, 'catalog JS must not call private runtime');
assert.ok(css.length > 3000, 'catalog CSS unexpectedly small');
new Function(js);

console.log('Public catalog contract OK:', { products: catalog.products.length, individualPages: slugs.size, isolated: true });
