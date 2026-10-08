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
      title: 'ArtiSys | Sistemas reais, DevKits e ferramentas para desenvolver',
      description: 'Conheça os sistemas ArtiSys, DevKit Tool’s e projetos open source apresentados nos vídeos. Ferramentas para desenvolver e software para operações reais.',
      schemaType: 'WebPage',
      changeFrequency: 'weekly',
      priority: 1
    },
    {
      path: '/devkits',
      canonical: 'https://artisys.dev/devkits/',
      title: 'DevKit Tool’s ArtiSys | Kits técnicos para desenvolvedores',
      description: 'Conheça os DevKit Tool’s ArtiSys: módulos técnicos reutilizáveis para PDF, OCR, backup, testes, interfaces, desktop e muito mais. Consulte disponibilidade pelo WhatsApp.',
      schemaType: 'CollectionPage',
      changeFrequency: 'monthly',
      priority: 0.9,
      jsonLd: [{
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Exemplos DevKit Tool’s ArtiSys',
        itemListElement: ['Geração e Leitura de PDFs', 'Reconhecimento de Texto (OCR)', 'Backup e Restauração', 'Testes e Controle de Qualidade'].map((name, index) => ({
          '@type': 'ListItem', position: index + 1, name
        }))
      }]
    },
    {
      path: '/devkits/catalogo',
      canonical: 'https://artisys.dev/devkits/catalogo/',
      title: 'Catálogo DevKit Tool’s | 63 kits técnicos ArtiSys',
      description: 'Explore 63 kits técnicos ArtiSys em 10 categorias: PDF, OCR, APIs, automação, interface, desktop e gestão. Filtre por área e consulte disponibilidade pelo WhatsApp.',
      schemaType: 'CollectionPage',
      changeFrequency: 'monthly',
      priority: 0.9,
      jsonLd: [{
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'DevKit Tool’s ArtiSys',
        numberOfItems: 63
      }]
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
