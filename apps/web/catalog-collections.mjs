import { readFileSync } from 'node:fs';

const canonicalCollectionsUrl = new URL('./public/sistemas/collections.json', import.meta.url);

export function loadCanonicalCollections() {
  const source = JSON.parse(readFileSync(canonicalCollectionsUrl, 'utf8'));
  if (!Array.isArray(source.collections)) throw new Error('Fonte canônica de coleções inválida.');
  return source.collections;
}

export function productBelongsToCollection(product, collection) {
  if (product.collections?.includes(collection.slug)) return true;
  return Array.isArray(collection.categories) && collection.categories.includes(product.category);
}

export function withCanonicalCollections(catalog) {
  return { ...catalog, collections: loadCanonicalCollections() };
}
