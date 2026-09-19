import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { generateCatalogPages } from './generate-product-pages.mjs';

const publicRoot = new URL('../public/sistemas/', import.meta.url);
const source = JSON.parse(readFileSync(new URL('collections.json', publicRoot), 'utf8'));
const slugs = source.collections.map((collection) => collection.slug);

assert.deepEqual(slugs, ['agro', 'negocios', 'saude']);
assert.equal(new Set(slugs).size, slugs.length, 'collection slugs must be unique');
for (const collection of source.collections) {
  assert.match(collection.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.equal(typeof collection.name, 'string');
  assert.equal(typeof collection.summary, 'string');
  assert.equal(typeof collection.seo?.title, 'string');
  assert.equal(typeof collection.seo?.description, 'string');
}

const generated = generateCatalogPages();
assert.equal(generated.collectionPages, 3, 'all canonical collections must generate a public page');
for (const slug of slugs) {
  const pageUrl = new URL(`${slug}/index.html`, publicRoot);
  assert.ok(existsSync(pageUrl), `${slug} collection page missing`);
  const html = readFileSync(pageUrl, 'utf8');
  assert.match(html, new RegExp(`<link rel="canonical" href="https://artisys\\.dev/sistemas/${slug}/">`, 'i'));
  assert.match(html, new RegExp(`data-collection="${slug}"`, 'i'));
}

console.log('Canonical collections contract OK:', slugs.join(', '));
