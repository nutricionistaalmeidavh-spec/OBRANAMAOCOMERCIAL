import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { listPrimaryLandingProducts, loadCanonicalCatalog } from '../catalog-contract.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const page = readFileSync(resolve(dist,'sistemas/index.html'),'utf8');
const primary = listPrimaryLandingProducts();
assert.ok(page.includes('data-artisys-marketing="p2-p3"'), 'new Astro catalog not copied');
assert.ok(page.includes('href="https://artisys.dev/sistemas/"'), 'canonical missing');
assert.ok(page.includes('content="index,follow"'), 'public catalog accidentally noindexed');
assert.ok(page.includes('application/ld+json'), 'structured data absent');
assert.ok(page.includes('data-catalog-filter'), 'static filter absent');
assert.ok(page.includes('data-embla'), 'real screenshot carousel absent');
assert.ok(!page.includes('data-marketplace-item="MLB7417818080"'), 'retired Oficina marketplace item has returned');
const productCount = (page.match(/data-catalog-item/g) || []).length;
assert.equal(productCount, loadCanonicalCatalog().products.length, 'not all canonical products are in the static storefront');
for (const product of primary) {
  const path = new URL(product.href).pathname;
  assert.ok(page.includes('href="' + path + '"') || page.includes('href="' + product.href + '"'), 'system link absent: ' + product.slug);
}
for (const entry of ['index.html','oficina/index.html','gest%C3%A3oholerites/index.html']) {
  if (entry === 'index.html') assert.ok(existsSync(resolve(dist,entry)), 'site root missing');
  if (entry.startsWith('oficina')) assert.ok(existsSync(resolve(dist,entry)), 'Oficina landing missing');
}
assert.ok(readdirSync(resolve(dist,'_artisys-marketing')).length > 0, 'isolated JS/CSS missing');
console.log('ArtiSys marketing P2/P3 built and verified, products:',productCount,'primary landings:',primary.length);
