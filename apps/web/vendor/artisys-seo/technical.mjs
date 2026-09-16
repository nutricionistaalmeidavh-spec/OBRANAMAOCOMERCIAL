import { getSeoPage } from './config.mjs';

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeXml(value) {
  return escapeHtml(value);
}

function pageUrl(siteUrl, path) {
  return new URL(path, `${siteUrl}/`).href;
}

function imageFor(config, page) {
  return page.openGraph?.image || page.image || config.site.defaultImage;
}

function identitySchema(config, kind) {
  const value = config.site[kind];
  if (!value) return undefined;
  const type = kind === 'professional' ? 'Person' : 'Organization';
  const suffix = kind === 'professional' ? 'professional' : 'organization';
  const schema = {
    '@context': 'https://schema.org',
    '@type': type,
    '@id': `${config.site.url}/#${suffix}`,
    name: value.name,
    url: value.url || `${config.site.url}/`
  };
  for (const key of ['jobTitle', 'telephone', 'email', 'image']) {
    if (value[key] !== undefined) schema[key] = value[key];
  }
  return schema;
}

export function buildPageSeo(config, path) {
  const page = getSeoPage(config, path);
  const canonical = page.canonical || pageUrl(config.site.url, page.path);
  const image = imageFor(config, page);
  const openGraph = {
    title: page.openGraph?.title || page.title,
    description: page.openGraph?.description || page.description,
    url: canonical,
    type: page.openGraph?.type || 'website',
    siteName: config.site.name
  };
  if (image) openGraph.image = image;

  const twitter = {
    card: page.twitter?.card || (image ? 'summary_large_image' : 'summary'),
    title: page.twitter?.title || page.title,
    description: page.twitter?.description || page.description
  };
  if (image) twitter.image = page.twitter?.image || image;
  if (config.site.twitterSite) twitter.site = config.site.twitterSite;

  const websiteId = `${config.site.url}/#website`;
  const webpageId = `${canonical}#webpage`;
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': websiteId,
      name: config.site.name,
      url: `${config.site.url}/`,
      inLanguage: config.site.language
    }
  ];

  const organization = identitySchema(config, 'organization');
  const professional = identitySchema(config, 'professional');
  if (organization) jsonLd.push(organization);
  if (professional) jsonLd.push(professional);

  const webPage = {
    '@context': 'https://schema.org',
    '@type': page.schemaType,
    '@id': webpageId,
    url: canonical,
    name: page.title,
    description: page.description,
    inLanguage: config.site.language,
    isPartOf: { '@id': websiteId }
  };
  if (image) webPage.primaryImageOfPage = { '@type': 'ImageObject', url: image };
  if (professional) webPage.about = { '@id': professional['@id'] };
  else if (organization) webPage.about = { '@id': organization['@id'] };
  jsonLd.push(webPage);
  if (page.jsonLd) jsonLd.push(...page.jsonLd);

  return {
    title: page.title,
    description: page.description,
    canonical,
    robots: `${page.index ? 'index' : 'noindex'},${page.follow ? 'follow' : 'nofollow'}`,
    openGraph,
    twitter,
    jsonLd
  };
}

function meta(nameType, name, content) {
  return `<meta ${nameType}="${escapeHtml(name)}" content="${escapeHtml(content)}">`;
}

function safeJsonLd(value) {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026');
}

export function renderHeadTags(model) {
  if (!model || typeof model !== 'object') throw new TypeError('model must be an object');
  const lines = [
    `<title>${escapeHtml(model.title)}</title>`,
    meta('name', 'description', model.description),
    `<link rel="canonical" href="${escapeHtml(model.canonical)}">`,
    meta('name', 'robots', model.robots),
    meta('property', 'og:title', model.openGraph.title),
    meta('property', 'og:description', model.openGraph.description),
    meta('property', 'og:url', model.openGraph.url),
    meta('property', 'og:type', model.openGraph.type),
    meta('property', 'og:site_name', model.openGraph.siteName)
  ];
  if (model.openGraph.image) lines.push(meta('property', 'og:image', model.openGraph.image));
  for (const key of ['card', 'title', 'description', 'image', 'site']) {
    if (model.twitter[key] !== undefined) lines.push(meta('name', `twitter:${key}`, model.twitter[key]));
  }
  for (const entry of model.jsonLd || []) lines.push(`<script type="application/ld+json">${safeJsonLd(entry)}</script>`);
  return lines.join('\n');
}

export function buildRobotsTxt(config) {
  return `User-agent: *\nAllow: /\n\nSitemap: ${config.site.url}/sitemap.xml\n`;
}

export function buildSitemapXml(config) {
  const urls = config.pages
    .filter((page) => page.index)
    .map((page) => {
      const model = buildPageSeo(config, page.path);
      const lines = ['  <url>', `    <loc>${escapeXml(model.canonical)}</loc>`];
      if (page.lastModified) lines.push(`    <lastmod>${escapeXml(page.lastModified)}</lastmod>`);
      if (page.changeFrequency) lines.push(`    <changefreq>${page.changeFrequency}</changefreq>`);
      if (page.priority !== undefined) lines.push(`    <priority>${page.priority}</priority>`);
      lines.push('  </url>');
      return lines.join('\n');
    });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}
