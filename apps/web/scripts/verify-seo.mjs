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
assert.doesNotMatch(transformed, /id="sistemas-catalogo"/i, 'home não deve inserir cards do catálogo durante o build');
assert.doesNotMatch(transformed, /id="dos-videos"|id="servicos"/i, 'home não deve reexibir seções removidas');
assert.match(transformed, /class="button secondary" href="\/sistemas\/"/i, 'home deve apresentar CTA de sistemas prontos');
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

assert.match(sitemap, /<loc>https:\/\/artisys\.dev\/links\/<\/loc>/, 'Central ArtiSys deve estar no sitemap');
assert.match(sitemap, /<loc>https:\/\/artisys\.dev\/guia\/<\/loc>/, 'Guia ArtiSys deve estar no sitemap');
assert.match(read('public/guia/index.html'), /<link rel="canonical" href="https:\/\/artisys\.dev\/guia\/">/, 'Guia precisa ter URL canonica propria');
const linksHtml = read('public/links/index.html');
const linksModel = buildPageSeo(artisysSeoConfig, '/links');
const linksAudit = auditSeoDocument({ html: linksHtml, expected: { canonical: linksModel.canonical, index: true } });
assert.equal(linksAudit.summary.critical, 0, 'Central ArtiSys com falha SEO: ' + JSON.stringify(linksAudit, null, 2));

// WppProspector is a self-contained static marketing page, never part of the authenticated CRM.
assert.match(sitemap, /<loc>https:\/\/artisys\.dev\/wppprospector\/<\/loc>/, 'CRM WppProspector ausente do sitemap');
const crmHtml = read('public/wppprospector/index.html');
const crmCss = read('public/wppprospector/style.css');
const crmModel = buildPageSeo(artisysSeoConfig, '/wppprospector');
const crmAudit = auditSeoDocument({ html: crmHtml, expected: { canonical: crmModel.canonical, index: true } });
assert.equal(crmAudit.summary.critical, 0, 'WppProspector com falha SEO: ' + JSON.stringify(crmAudit, null, 2));
assert.match(crmHtml, /<link rel="canonical" href="https:\/\/artisys\.dev\/wppprospector\/">/i);
assert.match(crmHtml, /"@type":"SoftwareApplication"/, 'CRM exige schema SoftwareApplication');
const crmMotion = read('public/wppprospector/motion.js');
const crmHeroBuilder = read('scripts/generate-wppprospector-hero.py');
assert.match(crmHtml, /Capturas de QA com dados fictícios/, 'landing deve declarar origem e dados de teste');
assert.match(crmHtml, /WhatsApp e IA opcionais/, 'integrações devem permanecer opcionais');
assert.match(crmHtml, /class="hero-art-image"/, 'hero precisa exibir imagem cinematográfica integrada');
assert.doesNotMatch(crmHtml, /class="laptop-device"|class="phone-device"|picsum\.photos|systemshifthq/i, 'não usar dispositivos simulados antigos nem telas de terceiros');
assert.match(crmHtml, /Baileys: open source e não oficial/, 'Baileys não é API oficial');
assert.match(crmHtml, /custos externos/, 'Meta pode cobrar pelo serviço externo');
assert.match(crmHtml, /não sincronizam dados automaticamente/, 'não prometer bancos compartilhados');
assert.match(crmHtml, /id="galeria"/, 'galeria de telas reais ausente');
assert.match(crmHtml, /id="galeria-anterior"/, 'navegação anterior ausente');
assert.match(crmHtml, /id="galeria-proxima"/, 'navegação próxima ausente');
for (const filename of ['painel-real.webp','kanban-real.webp','leads-real.webp','inteligencia-real.webp','kanban-mobile-real.webp','hero-showcase-real.webp','hero-showcase-mobile-real.webp']) {
  const image = readFileSync(new URL(`../public/wppprospector/media/${filename}`, import.meta.url));
  assert.ok(image.length > 5000, `captura ou composição inválida: ${filename}`);
  assert.equal(image.toString('ascii', 0, 4), 'RIFF', `cabeçalho WebP inválido: ${filename}`);
  assert.equal(image.toString('ascii', 8, 12), 'WEBP', `formato WebP inválido: ${filename}`);
  const usedIn = crmHtml.includes(`/wppprospector/media/${filename}`) || crmHeroBuilder.includes(filename);
  assert.ok(usedIn, `captura não está usada na landing ou no compositor: ${filename}`);
}
assert.match(crmHeroBuilder, /QA captures/, 'arte do hero deve ser construída de screenshots reais');
assert.doesNotMatch(crmHeroBuilder, /picsum|unsplash|systemshifthq/i, 'não substituir a interface por stock ou marcas de terceiros');
assert.ok(crmHtml.length < 13500, 'reduzir blocos textuais da landing');
assert.doesNotMatch(crmHtml, /class="proof shell"/, 'benefícios repetidos não devem retornar');
assert.match(crmCss, /prefers-reduced-motion/, 'acessibilidade de motion obrigatória');
assert.match(crmMotion, /IntersectionObserver/, 'animações progressivas obrigatórias');
assert.match(crmMotion, /hero-art-image/, 'efeito de entrada deve trabalhar com a arte integrada');
assert.match(crmMotion, /prefers-reduced-motion/, 'respeitar preferência do visitante');

assert.match(sitemap, /<loc>https:\/\/artisys\.dev\/devkits\/<\/loc>/, 'página DevKit deve estar no sitemap');
const devkitHtml = read('public/devkits/index.html');
const devkitModel = buildPageSeo(artisysSeoConfig, '/devkits');
const devkitAudit = auditSeoDocument({ html: devkitHtml, expected: { canonical: devkitModel.canonical, index: true } });
assert.equal(devkitAudit.summary.critical, 0, 'página DevKit com falha SEO: ' + JSON.stringify(devkitAudit, null, 2));
assert.match(devkitHtml, /DevKit Tool.s/, 'página DevKit precisa identificar a categoria');
assert.match(transformed, /href="\/devkits\/"/i, 'landing deve levar à página DevKit');

const devkitCatalog = JSON.parse(read('public/devkits/kits.json'));
assert.equal(devkitCatalog.items.length, 63, 'página DevKit precisa manter 63 kits');
assert.equal(new Set(devkitCatalog.items.map(x => x.category)).size, 10, 'categorias DevKit');
assert.equal(devkitCatalog.items.filter(x => Number.isFinite(x.price)).length, 63, 'preços DevKit');
assert.match(devkitHtml, /id="kit-grid"/, 'página DevKit deve conter catálogo');
assert.match(devkitHtml, /Guia Open Source/, 'página DevKit deve conter guia');
assert.doesNotMatch(devkitHtml, /github.com\/nutricionistaalmeidavh-spec\/DevKitTools|MATRIZ-KITS|\.zip|SHA-256/i);
assert.ok(!sitemap.includes('<loc>https://artisys.dev/devkits/catalogo/</loc>'), 'sitemap não pode indexar URL antiga');
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
