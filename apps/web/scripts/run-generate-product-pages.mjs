import { generateCatalogPages } from './generate-product-pages.mjs';

const result = generateCatalogPages();
console.log(`Catalog pages generated: ${result.individualPages} individual, ${result.collectionPages} collection`);
