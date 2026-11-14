import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
// Astro bundles server-side imports into dist-preview/pages. Resolve the source by
// the build's working directory rather than import.meta.url, which moves on bundling.
const candidates = [
  resolve(process.cwd(), 'public/sistemas/products.json'),
  resolve(process.cwd(), '../web/public/sistemas/products.json'),
  resolve(process.cwd(), 'apps/web/public/sistemas/products.json')
];
function canonicalCatalogPath() {
  const filename = candidates.find(existsSync);
  if (!filename) throw new Error('Fonte canônica de produtos não encontrada; nenhuma cópia alternativa será criada.');
  return filename;
}
export const PRIMARY_LANDING_SLUGS = Object.freeze([
  'wppprospector','pdv-artisys','pdv-nexus','obra-na-mao',
  'artisys-finance','nutridesk','gestao-holerites','oficina'
]);
export function loadCanonicalCatalog() {
  const data = JSON.parse(readFileSync(canonicalCatalogPath(), 'utf8'));
  if (!Array.isArray(data.products)) throw new Error('products.json inválido');
  const seen = new Set();
  for (const product of data.products) {
    if (!product.slug || seen.has(product.slug)) throw new Error('Slug ausente/duplicado: ' + product.slug);
    if (product.slug === 'oficina-agricola' || product.marketplaceItemId === 'MLB7417818080') {
      throw new Error('Oficina Agrícola legada não pode retornar ao catálogo');
    }
    seen.add(product.slug);
  }
  return data;
}
export function landingHref(product) {
  if (product.pageMode === 'external') {
    if (!product.externalHref) throw new Error('Landing externa sem URL: ' + product.slug);
    return product.externalHref;
  }
  if (product.pageMode === 'collection') {
    return product.collections?.length ? '/sistemas/' + product.collections[0] + '/#' + product.slug : '/sistemas/';
  }
  return '/sistemas/' + product.slug + '/';
}
export function canonicalLandingUrl(product) {
  return new URL(landingHref(product), 'https://artisys.dev').href;
}
export function listPrimaryLandingProducts() {
  const catalog = loadCanonicalCatalog();
  return PRIMARY_LANDING_SLUGS.map(slug => {
    const product = catalog.products.find(p => p.slug === slug);
    if (!product) throw new Error('Página requerida sem produto canônico: ' + slug);
    return { ...product, href: canonicalLandingUrl(product) };
  });
}
