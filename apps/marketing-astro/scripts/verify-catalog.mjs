import { existsSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { listPrimaryLandingProducts } from '../../web/catalog-contract.mjs';
const products=listPrimaryLandingProducts();
assert.equal(products.length,8);
assert.equal(new Set(products.map(p=>p.href)).size,8);
for(const p of products) {
  assert.ok(p.href.startsWith('https://artisys.dev/'));
  if(p.pageMode==='external'){
    const pathname = new URL(p.href).pathname;
    assert.ok(existsSync(new URL('../../web/public/'+pathname.slice(1)+'index.html', import.meta.url)),p.slug+' page missing');
  }
}
const tokens=readFileSync(new URL('../src/styles/tokens.css',import.meta.url),'utf8');
for(const hex of ['#080613','#17102b','#8643ef','#aa62ff']) assert.ok(tokens.includes(hex));
assert.ok(tokens.includes('prefers-reduced-motion'));
console.log('Marketing P0/P1 contract verified for '+products.length+' landing destinations');
