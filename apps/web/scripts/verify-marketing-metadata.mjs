import assert from 'node:assert/strict';
import { readFileSync,existsSync } from 'node:fs';
import { resolve,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { approvedMarketingRoutes } from './marketing-head.mjs';
const webRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const dist=resolve(webRoot,'dist');
const normalize = html => html.slice(html.search(/<body\b/i));
const regex = name => new RegExp('<meta\\b[^>]*'+name+'[^>]*>','gi');
for (const item of approvedMarketingRoutes()) {
  const folder=item.route.replace(/^\//,'');
  const filename=resolve(dist,folder,'index.html');
  assert.ok(existsSync(filename),'landing built and instrumented missing: '+item.route);
  const html=readFileSync(filename,'utf8');
  const head=html.slice(0,html.search(/<\/head>/i));
  assert.equal((head.match(/<title\b/gi)||[]).length,1,'duplicate title: '+item.route);
  assert.equal((head.match(/rel="canonical"/gi)||[]).length,1,'duplicate canonical: '+item.route);
  assert.equal((head.match(/name="description"/gi)||[]).length,1,'duplicate description: '+item.route);
  assert.equal((head.match(/name="robots"/gi)||[]).length,1,'duplicate robots: '+item.route);
  assert.match(head,/application\/ld\+json/i,'missing JSON-LD: '+item.route);
  assert.match(head,/artisys-marketing-analytics-config/,'missing first-party analytics: '+item.route);
  assert.match(head,/src="\/sistemas\/marketing-analytics\.js"/,'missing first-party client: '+item.route);
  assert.ok(head.includes(item.model.canonical),'canonical mismatch: '+item.route);
  assert.ok(head.includes('index,follow'),'public page accidentally noindexed: '+item.route);
  if(item.product) {
    const original=resolve(webRoot,'public',folder,'index.html');
    assert.ok(existsSync(original),'original landing missing '+item.route);
    assert.equal(normalize(html),normalize(readFileSync(original,'utf8')),'layout/body mutated on '+item.route);
    if(item.product.media?.cover) assert.ok(head.includes('og:image'),'missing verified real OG image: '+item.slug);
  }
}
const analytics=resolve(dist,'sistemas/marketing-analytics.js');
assert.ok(existsSync(analytics),'first-party analytics script missing from Vite output');
const code=readFileSync(analytics,'utf8');
assert.doesNotMatch(code,/document\.cookie|localStorage\.setItem|MutationObserver|innerHTML\s*=|navigator\.userAgent/i);
console.log('P4/P5/P6 metadata and anonymous analytics verified for',approvedMarketingRoutes().length,'routes without body or style changes');
