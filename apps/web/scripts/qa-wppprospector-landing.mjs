import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve, sep } from 'node:path';
import { chromium } from 'playwright';

const root = resolve(fileURLToPath(new URL('../public/', import.meta.url)));
const out = fileURLToPath(new URL('../qa-artifacts/wppprospector/', import.meta.url));
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};

function extension(file) {
  return file.slice(file.lastIndexOf('.'));
}

const server = createServer(async (req, res) => {
  let url;
  try { url = new URL(req.url || '/', 'http://localhost'); } catch {
    res.writeHead(400); res.end(); return;
  }
  const suffix = url.pathname.endsWith('/') ? 'index.html' : '';
  const requested = decodeURIComponent(url.pathname + suffix);
  const filepath = resolve(root, '.' + requested);
  if (!filepath.startsWith(root + sep)) {
    res.writeHead(403); res.end(); return;
  }
  try {
    const data = await readFile(filepath);
    res.writeHead(200, { 'Content-Type': types[extension(filepath)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
});

await new Promise((resolveReady) => server.listen(0, '127.0.0.1', resolveReady));
const address = server.address();
const url = 'http://127.0.0.1:' + address.port + '/wppprospector/';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [320, 390, 768, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      deviceScaleFactor: 1,
      reducedMotion: 'reduce'
    });
    const page = await context.newPage();
    const exceptions = [];
    const analyticsRequests = [];
    const blockedFiles = [];
    page.on('pageerror', (error) => exceptions.push(error.message));
    page.on('request', (request) => {
      if (request.url().includes('/analytics/')) analyticsRequests.push(request.url());
    });
    page.on('response', (response) => {
      if (response.status() >= 400 && response.url().includes('/wppprospector/')) {
        blockedFiles.push(response.url() + ' ' + response.status());
      }
    });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.locator('#crm-hero-visual .hero-art-image').waitFor({ state: 'visible' });
    await page.locator('#crm-hero-visual .hero-art-image').evaluate((img) => img.decode());
    try {
      await page.locator('.crm-embla-slide').first().waitFor({ state: 'attached', timeout: 12000 });
      await page.locator('#crm-connection-bento .crm-bento-grid').waitFor({ state: 'attached', timeout: 12000 });
    } catch (error) {
      throw new Error('CRM React island failed at ' + width + 'px: ' + JSON.stringify({ exceptions, blockedFiles }) + '; ' + error.message);
    }
    const health = await page.evaluate(() => ({
      title: document.querySelector('h1')?.innerText || '',
      scrollWidth: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
      h1Lines: (() => {
        const h1 = document.querySelector('h1');
        return h1.getBoundingClientRect().height / parseFloat(getComputedStyle(h1).lineHeight);
      })(),
      hero: (() => {
        const image = document.querySelector('#crm-hero-visual .hero-art-image');
        return {
          loaded: image.complete && image.naturalWidth > 0,
          url: image.currentSrc,
          hasStage: !!document.querySelector('[data-hero-stage]'),
          reactLoaded: !!document.querySelector('.crm-hero-motion')
        };
      })(),
      screenshots: [...document.querySelectorAll('.crm-embla-slide img')].map((image) => ({
        loaded: image.complete && image.naturalWidth > 0,
        path: image.getAttribute('src')
      }))
    }));
    assert.match(health.title, /Transforme conversas/);
    assert.ok(health.scrollWidth <= health.viewport + 2, width + 'px horizontal page overflow');
    assert.ok(health.hero.loaded, width + 'px hero must use real screenshot');
    assert.ok(health.hero.url.includes(width <= 640 ? 'hero-showcase-mobile-real.webp' : 'hero-showcase-real.webp'));
    assert.ok(health.hero.hasStage && health.hero.reactLoaded, 'React should progressively enhance authentic CRM hero');
    if (width >= 768) assert.ok(health.h1Lines < 3.2, 'hero heading should occupy max three lines');
    assert.equal(health.screenshots.length, 3, 'real QA gallery contains three screens');
    for (const image of health.screenshots) {
      const imageElement = page.locator('.crm-embla-slide img[src="' + image.path + '"]');
      await imageElement.scrollIntoViewIfNeeded();
      await imageElement.evaluate((img) => img.decode());
      const loaded = await imageElement.evaluate(img => img.complete && img.naturalWidth > 0);
      assert.ok(loaded, 'image failed to load: ' + image.path);
    }
    const bentoHealth = await page.locator('#crm-connection-bento').evaluate((el) => {
      const bento = el.querySelector('.crm-bento-grid');
      return { width: el.getBoundingClientRect().width, bentoWidth: bento.getBoundingClientRect().width, cards: bento.children.length };
    });
    assert.equal(bentoHealth.cards, 3, 'bento must contain manual, Baileys, and Meta options');
    assert.ok(bentoHealth.bentoWidth > bentoHealth.width * .95, 'bento should occupy full connection container');
    assert.deepEqual(analyticsRequests, [], 'Umami must not track without explicit opt-in at ' + width + 'px');
    assert.deepEqual(blockedFiles, [], 'all self-hosted experience assets must resolve at ' + width + 'px');
    assert.deepEqual(exceptions, [], 'browser JS errors at ' + width + 'px');
    if (width === 1440) {
      await page.locator('#telas').scrollIntoViewIfNeeded();
      const previous = page.locator('.crm-embla-controls button').first();
      const next = page.locator('.crm-embla-controls button').last();
      assert.equal(await previous.count(), 1, 'shadcn navigation controls must render');
      assert.equal(await next.count(), 1, 'Emblas next button must render');
      await next.click();
      await page.waitForTimeout(350);
      assert.equal(await previous.isEnabled(), true, 'Embla must advance the screenshot gallery');
      await previous.click();
    }
    if ([390, 1440].includes(width)) {
      await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }));
      await page.waitForTimeout(150);
      await page.screenshot({ path: join(out, 'landing-' + width + '.png'), fullPage: true, animations: 'disabled' });
    }
    await context.close();
  }
  console.log('WppProspector screenshot landing QA passed: 320/390/768/1440');
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
}
