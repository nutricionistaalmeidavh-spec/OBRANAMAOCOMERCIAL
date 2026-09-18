import { readFileSync } from 'node:fs';
import { defineSeoConfig } from './vendor/artisys-seo/config.mjs';

const catalog = JSON.parse(readFileSync(new URL('./public/sistemas/products.json', import.meta.url), 'utf8'));
const applicationCategory = { 'Comércio': 'BusinessApplication', 'Construção': 'BusinessApplication', 'Saúde': 'HealthApplication', 'Agro': 'BusinessApplication' };
const productPages = catalog.products.map((product) => {
  const software = {
    '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: product.name, description: product.summary,
    applicationCategory: applicationCategory[product.category] || 'BusinessApplication',
    operatingSystem: product.type === 'desktop' ? 'Windows' : 'Web',
    url: `https://artisys.dev/sistemas/${product.slug}/`, provider: { '@id': 'https://artisys.dev/#organization' }
  };
  if (Number.isFinite(product.priceAmount)) software.offers = { '@type': 'Offer', priceCurrency: 'BRL', price: String(product.priceAmount), availability: 'https://schema.org/InStock', url: `https://artisys.dev/sistemas/${product.slug}/` };
  return { path: `/sistemas/${product.slug}`, canonical: `https://artisys.dev/sistemas/${product.slug}/`, title: product.seo.title, description: product.seo.description, schemaType: 'WebPage', changeFrequency: 'weekly', priority: product.featured ? 0.85 : 0.75, jsonLd: [software] };
});

export const artisysSeoConfig = defineSeoConfig({
  site: { name: 'ArtiSys', url: 'https://artisys.dev', language: 'pt-BR', organization: { name: 'ArtiSys', url: 'https://artisys.dev/' } },
  pages: [
    { path: '/', title: 'ArtiSys | Sistemas, sites e automações para negócios', description: 'A ArtiSys cria sistemas sob medida, sites profissionais e automações para empresas que querem vender, organizar e crescer.', schemaType: 'WebPage', changeFrequency: 'weekly', priority: 1 },
    { path: '/sistemas', canonical: 'https://artisys.dev/sistemas/', title: 'ArtiSys | Sistemas para empresas', description: 'Conheça os sistemas ArtiSys para comércio, construção, agro, saúde e serviços.', schemaType: 'CollectionPage', changeFrequency: 'weekly', priority: 0.9, jsonLd: [{ '@context': 'https://schema.org', '@type': 'ItemList', name: 'Sistemas ArtiSys', itemListElement: catalog.products.map((product, index) => ({ '@type': 'ListItem', position: index + 1, name: product.name, url: `https://artisys.dev/sistemas/${product.slug}/` })) }] },
    ...productPages
  ]
});
