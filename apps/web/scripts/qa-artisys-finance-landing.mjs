import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const webRoot = resolve(fileURLToPath(new URL('../public/', import.meta.url)));
const output = fileURLToPath(new URL('../qa-artifacts/artisys-finance/', import.meta.url));

execFileSync(process.execPath, ['scripts/run-generate-product-pages.mjs'], {
  cwd: resolve(fileURLToPath(new URL('../', import.meta.url))),
  stdio: 'inherit'
});

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};
const server = createServer(async (req, response) => {
  let url;
  try { url = new URL(req.url || '/', 'http://localhost'); } catch {
    response.writeHead(400); response.end(); return;
  }
  const requested = decodeURIComponent(url.pathname + (url.pathname.endsWith('/') ? 'index.html' : ''));
  const filePath = resolve(webRoot, '.' + requested);
  if (!filePath.startsWith(webRoot + sep)) {
    response.writeHead(403); response.end(); return;
  }
  try {
    const data = await readFile(filePath);
    const extension = filePath.slice(filePath.lastIndexOf('.'));
    response.writeHead(200, { 'Content-Type': types[extension] || 'application/octet-stream' });
    response.end(data);
  } catch {
    response.writeHead(404); response.end('Not found');
  }
});

await new Promise((ready) => server.listen(0, '127.0.0.1', ready));
const address = server.address();
const url = 'http://127.0.0.1:' + address.port + '/sistemas/artisys-finance/';
const browser = await chromium.launch({ headless: true });
await mkdir(output, { recursive: true });

try {
  for (const width of [320, 390, 768, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      deviceScaleFactor: 1,
      reducedMotion: 'reduce'
    });
    const page = await context.newPage();
    const exceptions = [];
    page.on('pageerror', (error) => exceptions.push(error.message));
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const heroImage = page.locator('.finance-hero-screenshot img');
    await heroImage.evaluate((element) => element.decode());
    await page.locator('.finance-hero-screenshot-secondary img').evaluate((element) => element.decode());

    const data = await page.evaluate(() => {
      const h1 = document.querySelector('#product-title');
      const image = document.querySelector('.finance-hero-screenshot img');
      const gallery = document.querySelector('.finance-gallery');
      const cards = document.querySelectorAll('.finance-feature');
      const getLines = (element) => element.getBoundingClientRect().height / parseFloat(getComputedStyle(element).lineHeight);
      return {
        body: document.body.className,
        title: h1?.textContent || '',
        h1Lines: getLines(h1),
        viewport: document.documentElement.clientWidth,
        documentWidth: document.documentElement.scrollWidth,
        imageLoaded: image.complete && image.naturalWidth > 0,
        imageSrc: image.getAttribute('src'),
        featureCards: cards.length,
        galleryCards: gallery.querySelectorAll('.finance-gallery-card').length,
        wave: !!document.querySelector('svg.finance-wave path'),
        motionScript: !!document.querySelector('script[src="../artisys-finance-motion.js"]'),
        ctaLinks: [...document.querySelectorAll('[data-product-cta]')].map((link) => link.getAttribute('href')),
        crmCopy: document.querySelector('#finance-conversion-title')?.textContent || '',
        mobileColumnCount: getComputedStyle(document.querySelector('.finance-feature-grid')).gridTemplateColumns.split(' ').length
      };
    });

    assert.equal(data.body, 'finance-page', 'Financeiro-only body styling');
    assert.match(data.title, /Vendas e finanças/);
    assert.equal(data.imageLoaded, true, width + 'px genuine dashboard image missing');
    assert.equal(data.imageSrc, './media/dashboard-real.webp');
    assert.equal(data.wave, true);
    assert.equal(data.featureCards, 3);
    assert.equal(data.galleryCards, 5);
    assert.equal(data.motionScript, true);
    assert.equal(data.ctaLinks.length, 2, 'preserve 2 canonical checkout links');
    assert.ok(data.ctaLinks.every((link) => link === 'https://pagamentos-artisys-central.nutricionistaalmeidavh.workers.dev/comprar?oferta=artisys-sistema-financeiro'));
    assert.match(data.crmCopy, /A venda avança/);
    assert.ok(data.documentWidth <= data.viewport + 2, width + 'px horizontal overflow: ' + data.documentWidth);
    if (width >= 768) assert.ok(data.h1Lines < 3.4, 'hero text must fit 2-3 lines');
    if (width <= 768) assert.equal(data.mobileColumnCount, 1, 'benefit cards must stack on tablet/mobile');

    for (const image of await page.locator('.finance-gallery-card img, .finance-feature-art img').all()) {
      await image.scrollIntoViewIfNeeded();
      await image.evaluate((element) => element.decode());
      const loaded = await image.evaluate((element) => element.complete && element.naturalWidth > 0);
      assert.equal(loaded, true, 'real screenshot failed to load');
    }
    assert.deepEqual(exceptions, [], width + 'px script errors');

    if ([390, 1440].includes(width)) {
      await page.screenshot({
        path: join(output, 'financeiro-full-' + width + '.png'),
        fullPage: true, animations: 'disabled'
      });
      await page.locator('.product-hero').screenshot({
        path: join(output, 'financeiro-hero-' + width + '.png'),
        animations: 'disabled'
      });
    }
    await context.close();
    console.log('PASS Financeiro landing mobile/desktop width=' + width + ' h1Lines=' + data.h1Lines.toFixed(1));
  }

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'no-preference'
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(250);
  const activeMotion = await page.locator('.finance-hero-copy h1').evaluate((element) => element.getAnimations().length);
  assert.ok(activeMotion > 0, 'native motion should animate when allowed');
  await page.locator('.finance-feature').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(180);
  assert.deepEqual(errors, [], 'motion-enabled page must run without exceptions');
  await context.close();
  console.log('PASS Financeiro motion enabled without runtime dependencies');
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
}
