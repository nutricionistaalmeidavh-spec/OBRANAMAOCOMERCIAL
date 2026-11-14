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
    page.on('pageerror', (error) => exceptions.push(error.message));
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.locator('.hero-figure img').waitFor({ state: 'visible' });
    const health = await page.evaluate(() => ({
      title: document.querySelector('h1')?.innerText || '',
      scrollWidth: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
      h1Lines: (() => {
        const h1 = document.querySelector('h1');
        return h1.getBoundingClientRect().height / parseFloat(getComputedStyle(h1).lineHeight);
      })(),
      hero: (() => {
        const image = document.querySelector('.hero-figure img');
        return { loaded: image.complete && image.naturalWidth > 0, url: image.currentSrc };
      })(),
      screenshots: [...document.querySelectorAll('.shot-card img')].map((image) => ({
        loaded: image.complete && image.naturalWidth > 0,
        path: image.getAttribute('src')
      }))
    }));
    assert.match(health.title, /Seu comercial/);
    assert.ok(health.scrollWidth <= health.viewport + 2, width + 'px horizontal page overflow');
    assert.ok(health.hero.loaded, width + 'px hero must use real screenshot');
    assert.ok(health.hero.url.includes(width <= 640 ? 'kanban-mobile-real.webp' : 'painel-real.webp'));
    if (width >= 768) assert.ok(health.h1Lines < 3.2, 'hero heading should occupy max three lines');
    assert.equal(health.screenshots.length, 3, 'real QA gallery contains three screens');
    for (const image of health.screenshots) {
      await page.locator('img[src="' + image.path + '"]').scrollIntoViewIfNeeded();
      const loaded = await page.locator('img[src="' + image.path + '"]').evaluate(img => img.complete && img.naturalWidth > 0);
      assert.ok(loaded, 'image failed to load: ' + image.path);
    }
    assert.deepEqual(exceptions, [], 'browser JS errors at ' + width + 'px');
    if (width === 1440) {
      await page.locator('#telas').scrollIntoViewIfNeeded();
      await page.locator('#galeria').evaluate(el => el.scrollTo({ left: 0, behavior: 'instant' }));
      await page.waitForTimeout(130);
      const before = await page.locator('#galeria').evaluate(el => el.scrollLeft);
      await page.locator('#galeria-proxima').click();
      await page.waitForTimeout(220);
      const after = await page.locator('#galeria').evaluate(el => el.scrollLeft);
      assert.ok(after > before, 'next gallery arrow must scroll to a real screenshot');
      await page.locator('#galeria-anterior').click();
    }
    if ([390, 1440].includes(width)) {
      await page.screenshot({ path: join(out, 'landing-' + width + '.png'), fullPage: true, animations: 'disabled' });
    }
    await context.close();
  }
  console.log('WppProspector screenshot landing QA passed: 320/390/768/1440');
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
}
