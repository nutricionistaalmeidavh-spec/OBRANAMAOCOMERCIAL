import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const webRoot = resolve(fileURLToPath(new URL('../public/', import.meta.url)));
const distRoot = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));

const output = fileURLToPath(new URL('../qa-artifacts/artisys-finance/', import.meta.url));

execFileSync(process.execPath, ['scripts/run-generate-product-pages.mjs'], {
  cwd: resolve(fileURLToPath(new URL('../', import.meta.url))),
  stdio: 'inherit'
});
execFileSync('npm', ['run', 'build'], {
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
  const asset = requested.startsWith('/assets/');
  const base = asset ? distRoot : webRoot;
  const filePath = resolve(base, '.' + requested);
  if (!filePath.startsWith(base + sep)) {
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
    page.on('console', (message) => { if (message.type() === 'error') exceptions.push('console: ' + message.text()); });
    page.on('requestfailed', (request) => exceptions.push('request: ' + request.url() + ': ' + request.failure()?.errorText));
    page.on('response', (response) => { if (response.status() >= 400) exceptions.push('http ' + response.status() + ': ' + response.url()); });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    try {
    await page.locator('.finance-embla-root').waitFor({ state: 'visible', timeout: 12000 });
    } catch (error) {
      const diagnostics = await page.evaluate(() => ({
        ready: document.readyState,
        html: document.querySelector('#finance-react-carousel')?.outerHTML.slice(0, 500),
        script: document.querySelector('script[src="/assets/finance-landing.js"]')?.outerHTML,
        moduleScriptCount: document.querySelectorAll('script[type="module"]').length,
        reactRoots: document.querySelectorAll('.finance-embla-root').length
      }));
      console.error('Financeiro carousel mount diagnostics:', JSON.stringify({ diagnostics, exceptions }, null, 2));
      throw error;
    }
    const heroImage = page.locator('.finance-hero-screenshot img');
    await heroImage.evaluate((element) => element.decode());
    await page.locator('.finance-hero-screenshot-secondary img').evaluate((element) => element.decode());

    const data = await page.evaluate(() => {
      const h1 = document.querySelector('#product-title');
      const image = document.querySelector('.finance-hero-screenshot img');
      const gallery = document.querySelector('.finance-gallery');
      const cards = document.querySelectorAll('.finance-feature');
      const getLines = (element) => element.getBoundingClientRect().height / parseFloat(getComputedStyle(element).lineHeight);
      const rgb = (value) => (value.match(/\d+(?:\.\d+)?/g) || []).slice(0, 3).map(Number);
      const luminance = (value) => {
        const channels = rgb(value).map((c) => {
          const v = c / 255;
          return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        });
        return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
      };
      const contrast = (fg, bg) => {
        const light = Math.max(luminance(fg), luminance(bg));
        const dark = Math.min(luminance(fg), luminance(bg));
        return (light + 0.05) / (dark + 0.05);
      };
      const computed = (selector) => getComputedStyle(document.querySelector(selector));
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
        sliderMounted: !!document.querySelector('#finance-react-carousel .finance-embla-root'),
        slideCount: document.querySelectorAll('.finance-embla-slide').length,
        nextButton: !!document.querySelector('button[aria-label="Próxima tela"]'),
        localBundle: [...document.querySelectorAll('script[type="module"]')].some((script) => script.src.endsWith('/assets/finance-landing.js')),
        wave: !!document.querySelector('svg.finance-wave path'),
        motionScript: !!document.querySelector('script[src="../artisys-finance-motion.js"]'),
        ctaLinks: [...document.querySelectorAll('[data-product-cta]')].map((link) => link.getAttribute('href')),
        crmCopy: document.querySelector('#finance-conversion-title')?.textContent || '',
        mobileColumnCount: getComputedStyle(document.querySelector('.finance-feature-grid')).gridTemplateColumns.split(' ').length,
        checkoutTitleColor: getComputedStyle(document.querySelector('.product-cta h2')).color,
        headerBackground: computed('.product-header').backgroundColor,
        heroGradient: computed('.product-hero').backgroundImage,
        waveFill: computed('.finance-wave path').fill,
        pageBackground: computed('.finance-page').backgroundColor,
        featureBackground: computed('.finance-feature-section').backgroundColor,
        featureCardBackground: computed('.finance-feature').backgroundColor,
        galleryBackground: computed('.finance-gallery-shell').backgroundColor,
        galleryCardBackground: computed('.finance-gallery-card').backgroundColor,
        detailsBackground: computed('.product-details').backgroundColor,
        detailsAlternateBackground: computed('.product-details .content-section:nth-child(2)').backgroundColor,
        galleryHeadingContrast: contrast(computed('.finance-gallery-heading h2').color, computed('.finance-gallery-shell').backgroundColor),
        galleryCopyContrast: contrast(computed('.finance-gallery-heading > p').color, computed('.finance-gallery-shell').backgroundColor),
        galleryCardContrast: contrast(computed('.finance-gallery-card strong').color, computed('.finance-gallery-card').backgroundColor),
        galleryLinkContrast: contrast(computed('.finance-gallery-card figcaption a').color, computed('.finance-gallery-card').backgroundColor),
        featureCopyContrast: contrast(computed('.finance-feature-copy p').color, computed('.finance-feature').backgroundColor),
        backLinkHeight: document.querySelector('.back-link').getBoundingClientRect().height,
        galleryLinkHeight: document.querySelector('.finance-gallery-card figcaption a').getBoundingClientRect().height
      };
    });

    assert.equal(data.body, 'finance-page', 'Financeiro-only body styling');
    assert.match(data.title, /Vendas e finanças/);
    assert.equal(data.imageLoaded, true, width + 'px genuine dashboard image missing');
    assert.equal(data.imageSrc, './media/dashboard-real.webp');
    assert.equal(data.wave, true);
    assert.equal(data.featureCards, 3);
    assert.equal(data.galleryCards, 5);
    assert.equal(data.sliderMounted, true, 'actual Embla React gallery must mount');
    assert.equal(data.slideCount, 5, 'Embla must use five canonical screenshots from server HTML');
    assert.equal(data.nextButton, true, 'shadcn style controls must be accessible');
    assert.equal(data.localBundle, true, 'React island must be delivered by local Vite bundle');
    assert.equal(data.motionScript, true);
    assert.equal(data.checkoutTitleColor, 'rgb(255, 255, 255)', 'final purchase CTA must be legible on violet');
    assert.equal(data.headerBackground, 'rgb(13, 10, 29)', 'header must use canonical ArtiSys night');
    assert.ok(data.heroGradient.includes('rgb(13, 10, 29)'), 'hero must start with ArtiSys night');
    assert.ok(data.heroGradient.includes('rgb(112, 55, 173)'), 'hero must finish with canonical purple');
    assert.equal(data.pageBackground, 'rgb(244, 241, 250)', 'page uses brand paper, not white on white');
    assert.equal(data.waveFill, 'rgb(244, 241, 250)', 'wave matches paper below the hero');
    assert.equal(data.featureBackground, 'rgb(244, 241, 250)', 'benefits have an off-white section');
    assert.equal(data.featureCardBackground, 'rgb(255, 255, 255)', 'benefit cards stand out against paper');
    assert.equal(data.galleryBackground, 'rgb(13, 10, 29)', 'CRM gallery is a distinct full-width night section');
    assert.equal(data.galleryCardBackground, 'rgb(33, 22, 47)', 'dark gallery cards are distinct from screenshots');
    assert.equal(data.detailsBackground, 'rgb(244, 241, 250)', 'detail sections use branded paper');
    assert.equal(data.detailsAlternateBackground, 'rgb(255, 255, 255)', 'detail sections alternate surfaces');
    for (const [name, value] of Object.entries({
      galleryHeading: data.galleryHeadingContrast,
      galleryCopy: data.galleryCopyContrast,
      galleryCard: data.galleryCardContrast,
      galleryLink: data.galleryLinkContrast,
      featureCopy: data.featureCopyContrast
    })) assert.ok(value >= 4.5, name + ' text contrast below WCAG AA: ' + value.toFixed(2));
    assert.ok(data.backLinkHeight >= 44, 'back link tap target below 44px');
    assert.ok(data.galleryLinkHeight >= 44, 'gallery link tap target below 44px');
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
  await page.locator('.finance-embla-root').waitFor({ state: 'visible', timeout: 12000 });
  const activeMotion = await page.locator('.finance-hero-copy h1').evaluate((element) => element.getAnimations().length);
  assert.ok(activeMotion > 0, 'native motion should animate when allowed');
  const current = page.locator('.finance-embla-count');
  const before = await current.textContent();
  await page.getByRole('button', { name: 'Próxima tela' }).click();
  await page.waitForTimeout(450);
  const after = await current.textContent();
  assert.notEqual(before, after, 'Embla Next must navigate screenshots');
  await page.getByRole('button', { name: 'Tela anterior' }).click();
  await page.waitForTimeout(450);
  assert.equal(await current.textContent(), before, 'Embla Previous must work');

  await page.locator('.finance-feature').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(180);
  assert.deepEqual(errors, [], 'motion-enabled page must run without exceptions');
  await context.close();
  console.log('PASS Financeiro motion enabled without runtime dependencies');
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
}
