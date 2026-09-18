import { artisysSeoConfig } from './seo.config.mjs';
import { injectHomeCatalogSection } from './home-catalog.mjs';
import { buildPageSeo, renderHeadTags } from './vendor/artisys-seo/technical.mjs';

const SEO_TAGS = [/<title\b[^>]*>[\s\S]*?<\/title>\s*/gi,/<meta\b[^>]*\bname=["'](?:description|robots|twitter:[^"']+)["'][^>]*>\s*/gi,/<meta\b[^>]*\bproperty=["']og:[^"']+["'][^>]*>\s*/gi,/<link\b[^>]*\brel=["'][^"']*\bcanonical\b[^"']*["'][^>]*>\s*/gi,/<script\b[^>]*\btype=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>\s*/gi];
function stripSeoTags(html) { let output = html; for (const pattern of SEO_TAGS) output = output.replace(pattern, ''); return output; }
export function applyPublicSeoHtml(html) { const clean = injectHomeCatalogSection(stripSeoTags(html)); const tags = renderHeadTags(buildPageSeo(artisysSeoConfig, '/')); if (!/<\/head>/i.test(clean)) throw new Error('HTML sem </head> para injeção SEO.'); return clean.replace(/<\/head>/i, `${tags}\n</head>`); }
export function applyPrivateNoindexHtml(html) { const clean = html.replace(/<meta\b[^>]*\bname=["']robots["'][^>]*>\s*/gi, ''); if (!/<\/head>/i.test(clean)) throw new Error('HTML sem </head> para noindex.'); return clean.replace(/<\/head>/i, '<meta name="robots" content="noindex,nofollow">\n</head>'); }
