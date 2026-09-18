import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const publicRoot = new URL('../public/', import.meta.url);
const readPublic = (relativePath) => readFileSync(new URL(relativePath, publicRoot), 'utf8');
const readCatalog = (relativePath) => readPublic(`sistemas/${relativePath}`);
const html = readCatalog('index.html');
const css = readCatalog('catalog.css');
const js = readCatalog('catalog.js');
const catalog = JSON.parse(readCatalog('products.json'));
assert.equal(catalog.version, 2); assert.equal(catalog.products.length, 5);
const allowedTypes = new Set(['desktop','web','saas']); const slugs = new Set();
for (const product of catalog.products) {
  assert.match(product.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/); assert.ok(!slugs.has(product.slug)); slugs.add(product.slug); assert.ok(allowedTypes.has(product.type));
  assert.equal(typeof product.name,'string'); assert.equal(typeof product.category,'string'); assert.equal(typeof product.status,'string'); assert.equal(typeof product.priceLabel,'string'); assert.equal(typeof product.summary,'string'); assert.equal(typeof product.audience,'string');
  assert.ok(Array.isArray(product.features) && product.features.length >= 4); assert.ok(Array.isArray(product.benefits) && product.benefits.length >= 3); assert.ok(Array.isArray(product.steps) && product.steps.length >= 3); assert.ok(Array.isArray(product.faq) && product.faq.length >= 3); assert.equal(typeof product.featured,'boolean'); assert.equal(typeof product.ctaLabel,'string'); assert.ok(product.ctaHref.startsWith('/') || product.ctaHref.startsWith('https://')); assert.equal(typeof product.seo?.title,'string'); assert.equal(typeof product.seo?.description,'string');
  if (product.accessHref) assert.ok(product.accessHref.startsWith('/') || product.accessHref.startsWith('https://'));
  const page = readCatalog(`${product.slug}/index.html`); const canonical = `https://artisys.dev/sistemas/${product.slug}/`;
  assert.ok(page.includes(product.name)); assert.ok(page.includes(`<link rel="canonical" href="${canonical}">`)); assert.match(page, /<meta property="og:title"/i); assert.match(page, /<meta name="twitter:card"/i); assert.match(page, /<script type="application\/ld\+json">/i); assert.match(page, /class="product-hero"/i); assert.match(page, /class="feature-grid"/i); assert.match(page, /class="faq-list"/i); assert.match(page, /data-product-cta/i); assert.doesNotMatch(page, /\/src\/|cloudflare-client|\/api\/|portal\.ts|owner\.ts|field\.ts|type="module"/i);
}
assert.match(html, /<title>.*ArtiSys.*Sistemas.*<\/title>/i); assert.match(html, /rel="canonical" href="https:\/\/artisys\.dev\/sistemas\/"/i); assert.match(html, /<meta property="og:title"/i); assert.match(html, /<meta name="twitter:card"/i); assert.match(html, /<script type="application\/ld\+json">/i); assert.match(html, /href="\.\/catalog\.css"/i); assert.match(html, /src="\.\/catalog\.js"/i); assert.match(html, /id="catalog-search"/i); assert.match(html, /id="catalog-filters"/i); assert.match(html, /id="catalog-grid"/i); assert.match(html, /id="product-dialog"/i); assert.doesNotMatch(html, /\/src\/|cloudflare-client|type="module"/i);
assert.match(js, /fetch\(['"]\.\/products\.json['"]\)/i); assert.match(js, /`\.\/\$\{product\.slug\}\//i); assert.doesNotMatch(js, /cloudflare-client|\/api\/|portal\.ts|owner\.ts|field\.ts/i); assert.ok(css.length > 3000); new Function(js);
console.log('Public catalog contract OK:', { products: catalog.products.length, individualPages: slugs.size, isolated: true });
