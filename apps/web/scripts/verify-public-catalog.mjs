import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (relativePath) => readFileSync(new URL(`../public/sistemas/${relativePath}`, import.meta.url), 'utf8');
const html = read('index.html');
const css = read('catalog.css');
const js = read('catalog.js');
const catalog = JSON.parse(read('products.json'));

assert.equal(catalog.version, 1, 'catalog version must be 1');
assert.ok(Array.isArray(catalog.products), 'products must be an array');
assert.equal(catalog.products.length, 5, 'phase 3 catalog must contain five initial products');

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
  assert.ok(Array.isArray(product.features) && product.features.length >= 2, `${product.slug} needs features`);
  assert.equal(typeof product.featured, 'boolean');
  if (product.accessHref) {
    assert.ok(product.accessHref.startsWith('/') || product.accessHref.startsWith('https://'), `unsafe accessHref for ${product.slug}`);
    assert.ok(!/^javascript:/i.test(product.accessHref), `javascript accessHref forbidden for ${product.slug}`);
  }
}

assert.match(html, /<title>.*ArtiSys.*Sistemas.*<\/title>/i);
assert.match(html, /href="\.\/catalog\.css"/i);
assert.match(html, /src="\.\/catalog\.js"/i);
assert.match(html, /id="catalog-search"/i);
assert.match(html, /id="catalog-filters"/i);
assert.match(html, /id="catalog-grid"/i);
assert.match(html, /id="product-dialog"/i);
assert.doesNotMatch(html, /\/src\/|cloudflare-client|type="module"/i, 'public catalog must not import operational runtime');
assert.match(js, /fetch\(['"]\.\/products\.json['"]\)/i);
assert.doesNotMatch(js, /cloudflare-client|\/api\/|portal\.ts|owner\.ts|field\.ts/i, 'catalog JS must not call private runtime');
assert.ok(css.length > 3000, 'catalog CSS unexpectedly small');
new Function(js);

console.log('Public catalog contract OK:', { products: catalog.products.length, isolated: true });
