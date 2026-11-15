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
  if (url.pathname === '/api/public/diagnostico' && req.method === 'POST') {
    let body='';
    for await (const chunk of req)body+=String(chunk);
    let parsed;
    try {parsed=JSON.parse(body)}catch {res.writeHead(400).end('Invalid JSON');return}
    if(parsed.kind!=='quick' || !parsed.contact || !parsed.goal) {
      res.writeHead(422,{'Content-Type':'application/json'}).end(JSON.stringify({ok:false,message:'Dados inválidos'}));
      return;
    }
    res.writeHead(201,{'Content-Type':'application/json'}).end(JSON.stringify({ok:true,protocol:'QA123456'}));
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
  const homeLink=homePage.locator('a.button.primary[href="/sistemas/"]').first();
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

  // P0-P2 conversion QA: visual design from reference, short lead, attribution and privacy.
  for (const width of [320,390,1440]) {
    const context=await browser.newContext({viewport:{width,height:920},reducedMotion:'reduce',deviceScaleFactor:1});
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base+'/links/diagnostico/',{waitUntil:'networkidle'});
    assert.ok(await page.locator('#choice-title').isVisible(), 'Choice-first diagnosis must be visible: '+width);
    assert.equal(await page.locator('#full-diagnostic-panel').isVisible(),false,'Long form must be opt-in');
    assert.ok(telemetry.some(x=>x.type==='funnel_step'&&x.step==='page_open'),'Diagnosis view not tracked');
    const whatsappHref=await page.locator('#whatsapp-start').getAttribute('href');
    const whatsappMessage=whatsappHref ? new URL(whatsappHref).searchParams.get('text') : '';
    assert.ok(whatsappMessage && whatsappMessage.includes('Origem ArtiSys: Diagnóstico Gratuito') &&
      whatsappMessage.includes('Botão: avaliacao whatsapp'),
      'WhatsApp source and CTA label must be embedded, actual='+whatsappMessage+' jsErrors='+JSON.stringify(errors));
    const wa=page.locator('#whatsapp-start');
    await wa.evaluate(a=>a.addEventListener('click',e=>e.preventDefault(),{once:true}));
    const waResponse=page.waitForResponse(x=>x.url().endsWith('/api/marketing/metrics')&&x.status()===204);
    await wa.click();await waResponse;
    assert.ok(telemetry.some(x=>x.type==='whatsapp_click'&&x.product==='diagnostico'&&x.cta==='avaliacao-whatsapp'),'Precise WhatsApp attribution absent');
    await page.screenshot({path:join(output,'diagnostic-choices-'+width+'.png'),fullPage:true,animations:'disabled'});
    await page.locator('#quick-diagnostic-open').click();
    assert.ok(await page.locator('#quick-diagnostic-panel').isVisible(),'Quick form must open');
    assert.equal((await page.locator('#quick-diagnostic-panel .wizard-time').innerText()).trim(),'4 campos',
      'Quick four-field heading must not be modified by the five-step wizard');
    await page.locator('#full-diagnostic-open').click();
    assert.ok(await page.locator('#full-diagnostic-panel').isVisible(),'Optional legacy wizard must open');
    await page.locator('#quick-diagnostic-open').click();
    assert.ok(await page.locator('#quick-diagnostic-panel').isVisible(),'Quick path must reopen without data loss');
    assert.equal(await page.locator('#full-diagnostic-panel').isVisible(),false,'Full wizard must stay hidden');
    const quick=page.locator('#quick-diagnostic-form');
    assert.equal(await quick.locator('input[name],textarea[name]').filter({hasNot:page.locator('[name="website"]')}).count()>=4,true);
    await page.screenshot({path:join(output,'diagnostic-quick-'+width+'.png'),fullPage:true,animations:'disabled'});
    await page.locator('#quick-name').fill('Empresa QA');
    await page.locator('#quick-company').fill('Loja de Teste');
    await page.locator('#quick-contact').fill('qa@example.com');
    await page.locator('#quick-goal').fill('Quero automatizar os pedidos recebidos e reduzir erros de comunicação.');
    const submitted=page.waitForResponse(x=>x.url().endsWith('/api/public/diagnostico')&&x.status()===201);
    await page.locator('#quick-submit').click();
    await submitted;
    // A resposta HTTP 201 pode chegar antes de a UI finalizar o await response.json().
    await page.locator('#quick-diagnostic-success').waitFor({state:'visible',timeout:7000});
    assert.ok(await page.locator('#quick-diagnostic-success').isVisible(),'Short form success after 201 only');
    assert.equal(await page.locator('#quick-protocol').textContent(),'QA123456');
    assert.ok(telemetry.some(x=>x.type==='funnel_step'&&x.step==='quick_submitted'),'Quick conversion stage missing');
    const dimensions=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
    assert.ok(dimensions.scroll<=dimensions.width+2,'Horizontal overflow in conversion flow '+width+': '+JSON.stringify(dimensions));
    await page.screenshot({path:join(output,'diagnostic-success-'+width+'.png'),fullPage:true,animations:'disabled'});
    assert.deepEqual(errors,[],'Diagnostic JavaScript errors at '+width);
    console.log('Diagnostic P0-P2 QA OK',width,'px');
    await context.close();
  }

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
