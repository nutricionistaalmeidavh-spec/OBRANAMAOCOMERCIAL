import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, join, sep } from 'node:path';
import { chromium } from 'playwright';
import { listPrimaryLandingProducts, loadCanonicalCatalog } from '../catalog-contract.mjs';

const root = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const output = fileURLToPath(new URL('../qa-artifacts/marketing-storefront/', import.meta.url));
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.webp':'image/webp', '.avif':'image/avif', '.png':'image/png', '.svg':'image/svg+xml', '.ico':'image/x-icon', '.woff2':'font/woff2' };
const server = createServer(async (req, res) => {
  let url;
  try { url = new URL(req.url || '/', 'http://127.0.0.1'); } catch { res.writeHead(400).end(); return; }
  const path = decodeURIComponent(url.pathname + (url.pathname.endsWith('/') ? 'index.html' : ''));
  const target = resolve(root, '.' + path);
  if (!target.startsWith(root + sep)) { res.writeHead(403).end(); return; }
  try {
    const contents = await readFile(target);
    const ext = target.substring(target.lastIndexOf('.')).toLowerCase();
    res.writeHead(200, {'Content-Type':mime[ext] || 'application/octet-stream'}).end(contents);
  } catch { res.writeHead(404).end('Not Found'); }
});

await new Promise(resolveReady => server.listen(0,'127.0.0.1',resolveReady));
await mkdir(output,{recursive:true});
const port = server.address().port;
const base = 'http://127.0.0.1:' + port;
const browser = await chromium.launch({headless:true});
const expected = loadCanonicalCatalog().products.length;

try {
  for (const width of [320,390,768,1440]) {
    const context = await browser.newContext({
      viewport:{width,height:900},
      reducedMotion:'reduce',
      deviceScaleFactor:1
    });
    const page = await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push('JS '+error.message));
    page.on('response',response=>{
      if(response.url().startsWith(base) && response.status()>=400) errors.push('HTTP '+response.status()+' '+response.url());
    });
    await page.goto(base+'/sistemas/',{waitUntil:'networkidle'});
    assert.match(await page.title(),/Sistemas ArtiSys/);
    assert.equal(await page.locator('[data-catalog-item]').count(),expected, 'missing static cards at '+width);
    const h1 = await page.locator('h1').innerText();
    assert.ok(h1.length>=15);
    for (const product of listPrimaryLandingProducts()) {
      const link = page.locator('[data-product="'+product.slug+'"] a').first();
      assert.equal(await link.count(),1,'primary landing missing: '+product.slug);
      assert.equal(new URL(await link.getAttribute('href'),base).href, product.href);
    }
    const hero = page.locator('.as-hero img').first();
    assert.equal(await hero.count(),1,'real screenshot hero missing');
    await hero.evaluate(img=>img.decode());
    assert.ok(await hero.evaluate(img=>img.naturalWidth>20),'screenshot failed to decode at '+width);
    const search = page.locator('#catalog-search');
    await search.fill('holerite');
    assert.equal(await page.locator('[data-catalog-item]:visible').count(),1,'search not applied');
    await search.fill('');
    await page.locator('[data-catalog-filter][data-value="RH"]').click();
    assert.equal(await page.locator('[data-catalog-item]:visible').count(),1,'RH filter failed');
    assert.equal(await page.locator('[data-catalog-filter][data-value="RH"]').getAttribute('aria-pressed'),'true');
    await page.locator('[data-catalog-filter][data-value="Todos"]').click();
    assert.equal(await page.locator('[data-catalog-item]:visible').count(),expected,'all products not restored');
    const progress = page.locator('[data-embla-progress]');
    const prior = await progress.innerText();
    await page.locator('[data-embla-next]').click();
    await page.waitForFunction(before=>document.querySelector('[data-embla-progress]')?.textContent !== before,prior,{timeout:6000});
    assert.notEqual(await progress.innerText(),prior,'carousel navigation did not work');
    await page.locator('[data-embla-prev]').click();
    const metrics=await page.evaluate(()=>({
      total:document.documentElement.scrollWidth,
      viewport:document.documentElement.clientWidth,
      cards:document.querySelectorAll('[data-catalog-item]').length
    }));
    assert.ok(metrics.total<=metrics.viewport+2,'horizontal overflow '+width+': '+JSON.stringify(metrics));
    await page.screenshot({path:join(output,'storefront-'+width+'.png'),fullPage:true,animations:'disabled'});
    assert.deepEqual(errors,[],'console/network failures at '+width);
    console.log('Marketing storefront QA OK:',width+'px',JSON.stringify(metrics));
    await context.close();
  }
} finally {
  await browser.close();
  await new Promise(done=>server.close(done));
}
