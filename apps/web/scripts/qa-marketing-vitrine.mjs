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
const telemetry = [];
const server = createServer(async (req, res) => {
  let url;
  try { url = new URL(req.url || '/', 'http://127.0.0.1'); } catch { res.writeHead(400).end(); return; }
  // Local QA captures the first-party request; no metrics are sent to production.
  if (url.pathname === '/api/marketing/metrics' && req.method === 'POST') {
    let payload = '';
    for await (const chunk of req) payload += String(chunk);
    try { telemetry.push(JSON.parse(payload)); res.writeHead(204).end(); }
    catch { res.writeHead(400).end('Invalid analytics event'); }
    return;
  }
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
  // Validate homepage first-party events with the same local endpoint: no production counters are touched.
  const homeContext=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  const homePage=await homeContext.newPage();
  const homeViewed=homePage.waitForResponse(response=>
    response.url()===base+'/api/marketing/metrics'&&response.status()===204
  );
  await homePage.goto(base+'/',{waitUntil:'domcontentloaded'});
  await homeViewed;
  assert.ok(telemetry.some(event=>event.type==='view'&&event.product==='home'),
    'Homepage must emit only its canonical view:home event');
  const homeLink=homePage.locator('a.button.secondary[href="/sistemas/"]').first();
  assert.equal(await homeLink.count()>0,true,'Home must link to canonical systems collection');
  await homeLink.evaluate(anchor=>anchor.addEventListener('click',event=>event.preventDefault(),{once:true}));
  const homeClick=homePage.waitForResponse(response=>
    response.url()===base+'/api/marketing/metrics'&&response.status()===204
  );
  await homeLink.click();
  await homeClick;
  assert.ok(telemetry.some(event=>event.type==='site_click'&&event.product==='home'&&event.destination==='sistemas'),
    'Homepage click must be counted as home -> sistemas, not as catalog/product view');
  await homeContext.close();
  console.log('Home analytics QA OK: anonymous pageview and classified outbound click (no double counting)');

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
    const beforeViews = telemetry.length;
    await page.goto(base+'/sistemas/',{waitUntil:'networkidle'});
    assert.ok(telemetry.slice(beforeViews).some(event => event.type === 'view' && event.product === 'catalog'),
      'anonymous catalog page view not registered at '+width);

    assert.match(await page.title(),/Sistemas ArtiSys/);
    assert.equal(await page.locator('[data-catalog-item]').count(),expected, 'missing static cards at '+width);
    const h1 = await page.locator('h1').innerText();
    assert.ok(h1.length>=15);
    for (const product of listPrimaryLandingProducts()) {
      const link = page.locator('[data-product="'+product.slug+'"] a').first();
      assert.equal(await link.count(),1,'primary landing missing: '+product.slug);
      assert.equal(new URL(await link.getAttribute('href'),base).href, product.href);
    }
    // One real click must be counted as catalog interest; prevent navigation in QA.
    const cardLink = page.locator('[data-product="pdv-artisys"] a').first();
    await cardLink.evaluate(anchor => anchor.addEventListener('click', event => event.preventDefault(), {once:true}));
    const clickResponse = page.waitForResponse(response =>
      response.url().endsWith('/api/marketing/metrics') && response.status() === 204
    );
    await cardLink.click();
    await clickResponse;
    assert.ok(telemetry.some(event => event.type === 'product_click' && event.product === 'pdv-artisys'),
      'anonymous product click not registered at '+width);
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
