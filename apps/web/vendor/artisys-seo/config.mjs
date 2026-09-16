const CHANGE_FREQUENCIES = new Set(['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never']);

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object`);
  return value;
}

function requireText(value, label) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${label} is required`);
  return value.trim();
}

function normalizeAbsoluteHttpUrl(value, label) {
  const text = requireText(value, label);
  let url;
  try {
    url = new URL(text);
  } catch {
    throw new TypeError(`${label} must be an absolute HTTP(S) URL`);
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new TypeError(`${label} must be an absolute HTTP(S) URL`);
  }
  return url;
}

function normalizeSiteUrl(value) {
  const url = normalizeAbsoluteHttpUrl(value, 'site.url');
  if (url.search || url.hash || (url.pathname && url.pathname !== '/')) {
    throw new TypeError('site.url must be the site origin without path, query or hash');
  }
  return url.origin;
}

function resolveHttpUrl(value, base, label) {
  const text = requireText(value, label);
  let url;
  try {
    url = new URL(text, `${base}/`);
  } catch {
    throw new TypeError(`${label} must resolve to an HTTP(S) URL`);
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new TypeError(`${label} must resolve to an HTTP(S) URL`);
  }
  return url.href;
}

export function normalizeSeoPath(value) {
  const text = requireText(value, 'page.path');
  if (text.includes('?') || text.includes('#')) throw new TypeError('page.path cannot contain query or hash');
  const withSlash = text.startsWith('/') ? text : `/${text}`;
  const collapsed = withSlash.replace(/\/{2,}/g, '/');
  return collapsed === '/' ? '/' : collapsed.replace(/\/$/, '');
}

function cloneJson(value, label) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    throw new TypeError(`${label} must be JSON serializable`);
  }
}

function normalizeIdentity(value, label, siteUrl) {
  if (value === undefined) return undefined;
  const source = requireObject(value, label);
  const result = { name: requireText(source.name, `${label}.name`) };
  for (const key of ['jobTitle', 'telephone', 'email']) {
    if (source[key] !== undefined) result[key] = requireText(source[key], `${label}.${key}`);
  }
  if (source.url !== undefined) result.url = resolveHttpUrl(source.url, siteUrl, `${label}.url`);
  if (source.image !== undefined) result.image = resolveHttpUrl(source.image, siteUrl, `${label}.image`);
  return result;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function normalizePage(source, siteUrl) {
  requireObject(source, 'page');
  const page = {
    path: normalizeSeoPath(source.path),
    title: requireText(source.title, 'page.title'),
    description: requireText(source.description, 'page.description'),
    index: source.index !== false,
    follow: source.follow !== false,
    schemaType: source.schemaType === undefined ? 'WebPage' : requireText(source.schemaType, 'page.schemaType')
  };

  if (source.canonical !== undefined) page.canonical = normalizeAbsoluteHttpUrl(source.canonical, 'page.canonical').href;
  if (source.image !== undefined) page.image = resolveHttpUrl(source.image, siteUrl, 'page.image');
  if (source.lastModified !== undefined) {
    const lastModified = requireText(source.lastModified, 'page.lastModified');
    if (Number.isNaN(Date.parse(lastModified))) throw new TypeError('page.lastModified must be a valid date');
    page.lastModified = lastModified;
  }
  if (source.changeFrequency !== undefined) {
    const changeFrequency = requireText(source.changeFrequency, 'page.changeFrequency');
    if (!CHANGE_FREQUENCIES.has(changeFrequency)) throw new TypeError('page.changeFrequency is invalid');
    page.changeFrequency = changeFrequency;
  }
  if (source.priority !== undefined) {
    if (!Number.isFinite(source.priority) || source.priority < 0 || source.priority > 1) throw new RangeError('page.priority must be between 0 and 1');
    page.priority = source.priority;
  }
  if (source.openGraph !== undefined) {
    page.openGraph = cloneJson(requireObject(source.openGraph, 'page.openGraph'), 'page.openGraph');
    if (page.openGraph.image !== undefined) page.openGraph.image = resolveHttpUrl(page.openGraph.image, siteUrl, 'page.openGraph.image');
  }
  if (source.twitter !== undefined) page.twitter = cloneJson(requireObject(source.twitter, 'page.twitter'), 'page.twitter');
  if (source.jsonLd !== undefined) {
    if (!Array.isArray(source.jsonLd) || source.jsonLd.some((entry) => !entry || typeof entry !== 'object' || Array.isArray(entry))) {
      throw new TypeError('page.jsonLd must be an array of objects');
    }
    page.jsonLd = cloneJson(source.jsonLd, 'page.jsonLd');
  }
  return page;
}

export function defineSeoConfig(input) {
  const source = requireObject(input, 'config');
  const siteSource = requireObject(source.site, 'site');
  const siteUrl = normalizeSiteUrl(siteSource.url);
  const site = {
    name: requireText(siteSource.name, 'site.name'),
    url: siteUrl,
    language: siteSource.language === undefined ? 'pt-BR' : requireText(siteSource.language, 'site.language')
  };

  if (siteSource.defaultImage !== undefined) site.defaultImage = resolveHttpUrl(siteSource.defaultImage, siteUrl, 'site.defaultImage');
  if (siteSource.twitterSite !== undefined) site.twitterSite = requireText(siteSource.twitterSite, 'site.twitterSite');
  const professional = normalizeIdentity(siteSource.professional, 'site.professional', siteUrl);
  const organization = normalizeIdentity(siteSource.organization, 'site.organization', siteUrl);
  if (professional) site.professional = professional;
  if (organization) site.organization = organization;

  if (!Array.isArray(source.pages) || source.pages.length === 0) throw new TypeError('pages must be a non-empty array');
  const pages = source.pages.map((page) => normalizePage(page, siteUrl));
  const seen = new Set();
  for (const page of pages) {
    if (seen.has(page.path)) throw new Error(`duplicate page path: ${page.path}`);
    seen.add(page.path);
  }

  return deepFreeze({ site, pages });
}

export function getSeoPage(config, path) {
  requireObject(config, 'config');
  const normalized = normalizeSeoPath(path);
  const page = config.pages?.find((candidate) => candidate.path === normalized);
  if (!page) throw new Error(`SEO page not found: ${normalized}`);
  return page;
}
