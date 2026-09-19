import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { artisysSeoConfig } from '../seo.config.mjs';
import { applyPrivateNoindexHtml, applyPublicSeoHtml } from '../seo-transform.mjs';
import { auditSeoConfig, auditSeoDocument } from '../vendor/artisys-seo/audit.mjs';
import { buildPageSeo, buildRobotsTxt, buildSitemapXml } from '../vendor/artisys-seo/technical.mjs';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const catalog = JSON.parse(read('public/sistemas/products.json'));
const landing = read('index.html');
const transformed = applyPublicSeoHtml(landing);
const model = buildPageSeo(artisysSeoConfig, '/');

assert.equal((transformed.match(/<title\b/gi) || []).length, 1, 'landing deve ter um único title após transformação SEO');
assert.match(transformed, /<link rel="canonical" href="https:\/\/artisys\.dev\/">/i);
assert.match(transformed, /<meta property="og:title"/i);
assert.match(transformed, /<meta name="twitter:card"/i);
assert.match(transformed, /<script type="application\/ld\+json">/i);
assert.match(transformed, /<meta name="viewport"/i);
assert.match(transformed, /id="sistemas-catalogo"/i, 'home deve receber seção pública de sistemas');
assert.match(transformed, /href="\/sistemas\/"/i, 'home deve apontar para o catálogo público');

const audit = auditSeoDocument({ html: transformed, expected: { canonical: model.canonical, index: true } });
assert.equal(audit.summary.critical, 0, JSON.stringify(audit, null, 2));
assert.equal(auditSeoConfig(artisysSeoConfig).summary.critical, 0, 'config SEO não pode ter falhas críticas');

const robots = buildRobotsTxt(artisysSeoConfig);
const sitemap = buildSitemapXml(artisysSeoConfig);
assert.match(robots, /Sitemap: https:\/\/artisys\.dev\/sitemap\.xml/);
assert.match(sitemap, /<loc>https:\/\/artisys\.dev\/<\/loc>/);
assert.match(sitemap, /<loc>https:\/\/artisys\.dev\/sistemas\/<\/loc>/);
assert.match(sitemap, /<loc>https:\/\/artisys\.dev\/sistemas\/agro\/<\/loc>/);
assert.doesNotMatch(sitemap, /sistema\.html|gestao\.html|obra\.html|universidade\.html/i);
assert.doesNotMatch(sitemap, /consultora-amamentacao|deboralactacao\.com/i, 'landing externa não deve virar URL ArtiSys duplicada');
for (const slug of ['sistema-lavoura', 'pecuaria', 'maquinas-agricolas', 'frota-manutencao']) {
  assert.ok(!sitemap.includes(`https://artisys.dev/sistemas/${slug}/`), `${slug} deve permanecer apenas na coleção Agro`);
}

const catalogIndex = read('public/sistemas/index.html');
const catalogModel = buildPageSeo(artisysSeoConfig, '/sistemas');
const catalogAudit = auditSeoDocument({ html: catalogIndex, expected: { canonical: catalogModel.canonical, index: true } });
assert.equal(catalogAudit.summary.critical, 0, `catálogo público com falha SEO: ${JSON.stringify(catalogAudit, null, 2)}`);

const individualProducts = catalog.products.filter((product) => product.pageMode === 'individual');
for (const product of individualProducts) {
  const pagePath = `/sistemas/${product.slug}`;
  const productModel = buildPageSeo(artisysSeoConfig, pagePath);
  const productHtml = read(`public/sistemas/${product.slug}/index.html`);
  const productAudit = auditSeoDocument({ html: productHtml, expected: { canonical: productModel.canonical, index: true } });
  assert.equal(productAudit.summary.critical, 0, `${product.slug} com falha SEO: ${JSON.stringify(productAudit, null, 2)}`);
  assert.ok(sitemap.includes(`<loc>${productModel.canonical}</loc>`), `${product.slug} ausente do sitemap`);
  assert.match(productHtml, /"@type":"SoftwareApplication"/i, `${product.slug} precisa de SoftwareApplication JSON-LD`);
}

for (const collection of catalog.collections) {
  const pagePath = `/sistemas/${collection.slug}`;
  const collectionModel = buildPageSeo(artisysSeoConfig, pagePath);
  const collectionHtml = read(`public/sistemas/${collection.slug}/index.html`);
  const collectionAudit = auditSeoDocument({ html: collectionHtml, expected: { canonical: collectionModel.canonical, index: true } });
  assert.equal(collectionAudit.summary.critical, 0, `${collection.slug} com falha SEO: ${JSON.stringify(collectionAudit, null, 2)}`);
  assert.ok(sitemap.includes(`<loc>${collectionModel.canonical}</loc>`), `${collection.slug} ausente do sitemap`);
  assert.match(collectionHtml, /"@type":"ItemList"/i, `${collection.slug} precisa de ItemList JSON-LD`);
}

for (const file of ['sistema.html', 'gestao.html', 'obra.html', 'universidade.html']) {
  const privateHtml = applyPrivateNoindexHtml(read(file));
  assert.match(privateHtml, /<meta name="robots" content="noindex,nofollow">/i, `${file} deve ser noindex`);
}

console.log(`SEO contract OK — home ${audit.score}/100, ${individualProducts.length} páginas individuais e ${catalog.collections.length} coleção indexável`);
