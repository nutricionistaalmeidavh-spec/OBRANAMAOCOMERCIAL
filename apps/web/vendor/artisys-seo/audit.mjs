import { buildPageSeo } from './technical.mjs';

function attributes(tag) {
  const result = {};
  const pattern = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match;
  while ((match = pattern.exec(tag))) result[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  return result;
}

function allTags(html, name) {
  return [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map((match) => match[0]);
}

function metaValue(html, key, value) {
  for (const tag of allTags(html, 'meta')) {
    const attrs = attributes(tag);
    if ((attrs[key] || '').toLowerCase() === value.toLowerCase()) return attrs.content;
  }
  return undefined;
}

function canonicalValue(html) {
  for (const tag of allTags(html, 'link')) {
    const attrs = attributes(tag);
    if ((attrs.rel || '').toLowerCase().split(/\s+/).includes('canonical')) return attrs.href;
  }
  return undefined;
}

function titleValue(html) {
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].replace(/<[^>]+>/g, '').trim() : '';
}

function jsonLdScripts(html) {
  const scripts = [];
  const pattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = pattern.exec(html))) {
    const attrs = attributes(`<script ${match[1]}>`);
    if ((attrs.type || '').toLowerCase() === 'application/ld+json') scripts.push(match[2].trim());
  }
  return scripts;
}

function createCollector() {
  const checks = [];
  function add(id, ok, severity, weight, message) {
    checks.push({ id, status: ok ? 'pass' : 'fail', severity, weight, message });
  }
  function report() {
    const failed = checks.filter((check) => check.status === 'fail');
    const score = Math.max(0, 100 - failed.reduce((sum, check) => sum + check.weight, 0));
    const summary = {
      passed: checks.length - failed.length,
      failed: failed.length,
      critical: failed.filter((check) => check.severity === 'critical').length,
      warning: failed.filter((check) => check.severity === 'warning').length,
      info: failed.filter((check) => check.severity === 'info').length
    };
    return {
      score,
      checks,
      issues: failed.map(({ id, severity, message }) => ({ id, severity, message })),
      summary
    };
  }
  return { add, report };
}

export function auditSeoDocument(input) {
  if (!input || typeof input !== 'object' || typeof input.html !== 'string') throw new TypeError('html is required');
  const html = input.html;
  const expected = input.expected || {};
  const collector = createCollector();

  const title = titleValue(html);
  collector.add('title-present', title.length > 0, 'critical', 12, 'A página precisa de um <title> não vazio.');

  const description = metaValue(html, 'name', 'description');
  collector.add('description-present', typeof description === 'string' && description.trim().length > 0, 'warning', 10, 'A página precisa de meta description.');

  const canonical = canonicalValue(html);
  collector.add('canonical-present', typeof canonical === 'string' && canonical.trim().length > 0, 'critical', 12, 'A página precisa de canonical.');
  if (expected.canonical !== undefined) {
    collector.add('canonical-match', canonical === expected.canonical, 'warning', 8, 'O canonical deve corresponder à URL esperada.');
  }

  const robots = (metaValue(html, 'name', 'robots') || '').toLowerCase();
  const isNoindex = robots.split(',').map((item) => item.trim()).includes('noindex');
  const expectedIndex = expected.index !== false;
  collector.add('index-directive', expectedIndex ? !isNoindex : isNoindex, 'critical', 15, expectedIndex ? 'A página esperada como indexável não deve usar noindex.' : 'A página esperada como privada deve usar noindex.');

  const h1Count = (html.match(/<h1\b[^>]*>/gi) || []).length;
  collector.add('single-h1', h1Count === 1, 'warning', 10, 'A página deve ter exatamente um H1.');

  const images = allTags(html, 'img').map(attributes);
  const imagesHaveAlt = images.every((attrs) => typeof attrs.alt === 'string' && attrs.alt.trim().length > 0);
  collector.add('image-alt', imagesHaveAlt, 'warning', 8, 'Todas as imagens devem possuir atributo alt não vazio.');

  const ogTitle = metaValue(html, 'property', 'og:title');
  collector.add('open-graph-title', typeof ogTitle === 'string' && ogTitle.trim().length > 0, 'warning', 6, 'A página deve fornecer og:title.');

  const scripts = jsonLdScripts(html);
  let validJsonLd = scripts.length > 0;
  for (const script of scripts) {
    try {
      JSON.parse(script);
    } catch {
      validJsonLd = false;
      break;
    }
  }
  collector.add('jsonld-valid', validJsonLd, 'warning', 6, 'A página deve possuir JSON-LD válido.');

  const anchors = allTags(html, 'a').map(attributes).map((attrs) => attrs.href).filter(Boolean);
  const unsafeHttpLinks = anchors.filter((href) => /^http:\/\//i.test(href));
  collector.add('https-links', unsafeHttpLinks.length === 0, 'info', 3, 'Links HTTP externos devem usar HTTPS quando possível.');

  return collector.report();
}

function duplicates(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value);
}

export function auditSeoConfig(config) {
  if (!config || typeof config !== 'object' || !Array.isArray(config.pages)) throw new TypeError('config must be a normalized SEO config');
  const collector = createCollector();
  const titles = duplicates(config.pages.map((page) => page.title));
  const descriptions = duplicates(config.pages.map((page) => page.description));
  const canonicals = duplicates(config.pages.map((page) => buildPageSeo(config, page.path).canonical));
  collector.add('duplicate-title', titles.length === 0, 'warning', 15, titles.length ? `Títulos duplicados: ${titles.join(', ')}` : 'Títulos são únicos.');
  collector.add('duplicate-description', descriptions.length === 0, 'warning', 10, descriptions.length ? `Descriptions duplicadas: ${descriptions.join(', ')}` : 'Descriptions são únicas.');
  collector.add('duplicate-canonical', canonicals.length === 0, 'critical', 20, canonicals.length ? `Canonicals duplicados: ${canonicals.join(', ')}` : 'Canonicals são únicos.');
  return collector.report();
}
