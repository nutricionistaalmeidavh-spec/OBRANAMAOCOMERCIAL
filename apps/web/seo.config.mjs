import { readFileSync } from 'node:fs';
import { defineSeoConfig } from './vendor/artisys-seo/config.mjs';
import { productBelongsToCollection, withCanonicalCollections } from './catalog-collections.mjs';

const catalog = withCanonicalCollections(JSON.parse(readFileSync(new URL('./public/sistemas/products.json', import.meta.url), 'utf8')));
const applicationCategory = {
  'Comércio': 'BusinessApplication',
  'Construção': 'BusinessApplication',
  'Saúde': 'HealthApplication',
  'Agro': 'BusinessApplication',
  'Financeiro': 'BusinessApplication'
};

function productPublicUrl(product) {
  if (product.pageMode === 'external') return product.externalHref;
  if (product.pageMode === 'collection') {
    const collection = product.collections?.[0];
    return collection ? `https://artisys.dev/sistemas/${collection}/#${product.slug}` : 'https://artisys.dev/sistemas/';
  }
  return `https://artisys.dev/sistemas/${product.slug}/`;
}

const individualProducts = catalog.products.filter((product) => product.pageMode === 'individual');
const productPages = individualProducts.map((product) => {
  const url = `https://artisys.dev/sistemas/${product.slug}/`;
  const software = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: product.name,
    description: product.summary,
    applicationCategory: applicationCategory[product.category] || 'BusinessApplication',
    operatingSystem: product.type === 'desktop' ? 'Windows' : 'Web',
    url,
    provider: { '@id': 'https://artisys.dev/#organization' }
  };
  if (Number.isFinite(product.priceAmount)) {
    software.offers = {
      '@type': 'Offer',
      priceCurrency: 'BRL',
      price: String(product.priceAmount),
      availability: 'https://schema.org/InStock',
      url
    };
  }
  return {
    path: `/sistemas/${product.slug}`,
    canonical: url,
    title: product.seo.title,
    description: product.seo.description,
    schemaType: 'WebPage',
    changeFrequency: 'weekly',
    priority: product.featured ? 0.85 : 0.75,
    jsonLd: [software]
  };
});

const collectionPages = catalog.collections.map((collection) => {
  const products = catalog.products.filter((product) => productBelongsToCollection(product, collection));
  return {
    path: `/sistemas/${collection.slug}`,
    canonical: `https://artisys.dev/sistemas/${collection.slug}/`,
    title: collection.seo.title,
    description: collection.seo.description,
    schemaType: 'CollectionPage',
    changeFrequency: 'weekly',
    priority: collection.featured ? 0.82 : 0.7,
    jsonLd: [{
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: collection.name,
      itemListElement: products.map((product, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: product.name,
        url: productPublicUrl(product)
      }))
    }]
  };
});

export const artisysSeoConfig = defineSeoConfig({
  site: {
    name: 'ArtiSys',
    url: 'https://artisys.dev',
    language: 'pt-BR',
    organization: { name: 'ArtiSys', url: 'https://artisys.dev/' }
  },
  pages: [
    {
      path: '/',
      title: 'ArtiSys | Sistemas, sites e automações para negócios',
      description: 'A ArtiSys cria sistemas sob medida, sites profissionais e automações para empresas que querem vender, organizar e crescer.',
      schemaType: 'WebPage',
      changeFrequency: 'weekly',
      priority: 1
    },
    {
      path: '/sistemas',
      canonical: 'https://artisys.dev/sistemas/',
      title: 'ArtiSys | Sistemas para empresas',
      description: 'Conheça os sistemas ArtiSys para comércio, construção, agro, saúde e gestão financeira.',
      schemaType: 'CollectionPage',
      changeFrequency: 'weekly',
      priority: 0.9,
      jsonLd: [{
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Sistemas ArtiSys',
        itemListElement: catalog.products.map((product, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: product.name,
          url: productPublicUrl(product)
        }))
      }]
    },
    ...collectionPages,
    ...productPages
  ]
});
