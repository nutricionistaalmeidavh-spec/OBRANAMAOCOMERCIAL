import { readFileSync, statSync, existsSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import assert from 'node:assert/strict';
import { loadCanonicalCatalog } from '../../web/catalog-contract.mjs';

const root = resolve(process.cwd(), '../web/public');
const products = loadCanonicalCatalog().products;
let verified = 0;
for (const product of products) {
  if (!product.media) continue;
  const images = [product.media.hero, product.media.cover, ...(product.media.gallery||[])].filter(Boolean);
  for (const media of images) {
    assert.ok(typeof media.alt==='string' && media.alt.length>12, 'accessible alt missing: '+product.slug);
    assert.ok(typeof media.src==='string' && media.src.startsWith('/') && !media.src.startsWith('//'),'local media only: '+product.slug);
    const target = resolve(root, decodeURIComponent(media.src.slice(1)));
    assert.ok(target.startsWith(root + sep), 'unsafe path: '+media.src);
    assert.ok(existsSync(target), 'real screenshot missing: '+media.src);
    assert.ok(statSync(target).size > 3000, 'screenshot unexpectedly empty: '+media.src);
    assert.ok(/\.(webp|avif|png|jpg)$/i.test(media.src),'unsupported format: '+media.src);
    verified++;
  }
}
assert.ok(verified >= 12, 'too few verified first-party screenshots');
console.log('Verified',verified,'canonical, local and nonempty real screenshots');
