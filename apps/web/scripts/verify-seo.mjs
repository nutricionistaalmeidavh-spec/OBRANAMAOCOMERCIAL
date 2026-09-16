import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { artisysSeoConfig } from '../seo.config.mjs';
import { applyPrivateNoindexHtml, applyPublicSeoHtml } from '../seo-transform.mjs';
import { auditSeoConfig, auditSeoDocument } from '../vendor/artisys-seo/audit.mjs';
import { buildPageSeo, buildRobotsTxt, buildSitemapXml } from '../vendor/artisys-seo/technical.mjs';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const landing = read('index.html');
const transformed = applyPublicSeoHtml(landing);
const model = buildPageSeo(artisysSeoConfig, '/');

assert.equal((transformed.match(/<title\b/gi) || []).length, 1, 'landing deve ter um único title após transformação SEO');
assert.match(transformed, /<link rel="canonical" href="https:\/\/artisys\.dev\/">/i);
assert.match(transformed, /<meta property="og:title"/i);
assert.match(transformed, /<meta name="twitter:card"/i);
assert.match(transformed, /<script type="application\/ld\+json">/i);
assert.match(transformed, /<meta name="viewport"/i, 'transformação SEO não pode remover viewport');

const audit = auditSeoDocument({ html: transformed, expected: { canonical: model.canonical, index: true } });
assert.equal(audit.summary.critical, 0, JSON.stringify(audit, null, 2));
assert.equal(auditSeoConfig(artisysSeoConfig).summary.critical, 0, 'config SEO não pode ter falhas críticas');

const robots = buildRobotsTxt(artisysSeoConfig);
const sitemap = buildSitemapXml(artisysSeoConfig);
assert.match(robots, /Sitemap: https:\/\/artisys\.dev\/sitemap\.xml/);
assert.match(sitemap, /<loc>https:\/\/artisys\.dev\/<\/loc>/);
assert.doesNotMatch(sitemap, /sistema\.html|gestao\.html|obra\.html|universidade\.html/i, 'áreas internas não entram no sitemap');

for (const file of ['sistema.html', 'gestao.html', 'obra.html', 'universidade.html']) {
  const privateHtml = applyPrivateNoindexHtml(read(file));
  assert.match(privateHtml, /<meta name="robots" content="noindex,nofollow">/i, `${file} deve ser noindex`);
}

console.log(`SEO contract OK — score ${audit.score}/100, ${audit.summary.warning} warning(s)`);
