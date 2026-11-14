import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { Window } from 'happy-dom';

const feedSource = readFileSync(new URL('../public/sistemas/marketplace-feed.js', import.meta.url), 'utf8');
const collectionSource = readFileSync(new URL('../public/sistemas/marketplace-collection.js', import.meta.url), 'utf8');
const obsolete = {
  item_id: 'MLB7417818080',
  slug: 'software-oficina-agricola-e-maquinas-pesadas-com-os',
  name: 'Software Oficina Agrícola E Máquinas Pesadas Com Os',
  pageMode: 'collection',
  collection: 'agro',
  permalink: 'https://produto.mercadolivre.com.br/MLB-7417818080-_JM',
  pictures: [],
  price: 79.90,
};
const current = {
  item_id: 'MLB5063204651',
  slug: 'software-controle-de-frota-com-manutencao-e-abastecimento',
  name: 'Software Controle De Frota Com Manutenção E Abastecimento',
  pageMode: 'collection',
  collection: 'agro',
  permalink: 'https://produto.mercadolivre.com.br/MLB-5063204651-_JM',
  pictures: [],
  price: 89.90,
};
function setup() {
  const browser = new Window({ url: 'https://artisys.dev/sistemas/agro/' });
  const slot = browser.document.createElement('div');
  slot.id = 'marketplace-collection-extra';
  slot.dataset.collection = 'agro';
  browser.document.body.appendChild(slot);
  const env = {
    window: browser,
    document: browser.document,
    fetch: async () => ({ ok: true, json: async () => ({ items: [obsolete, current] }) }),
    AbortController,
    setTimeout,
    clearTimeout,
    console,
  };
  runInNewContext(feedSource, env);
  return { browser, slot, env };
}
describe('website marketplace legacy products', () => {
  it('removes the retired Oficina Agrícola ad from the main catalog feed while keeping other agro products', () => {
    const { browser } = setup();
    const products = browser.ArtiSysMarketplace.mergeApprovedFeed([], [obsolete, current]);
    expect(products.map((product) => product.marketplaceItemId)).toEqual(['MLB5063204651']);
  });
  it('does not reinsert the retired ad in the Agro collection after JavaScript loads', async () => {
    const { slot, env } = setup();
    runInNewContext(collectionSource, env);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const ids = [...slot.querySelectorAll('[data-marketplace-item]')].map((node) => node.getAttribute('data-marketplace-item'));
    expect(ids).toEqual(['MLB5063204651']);
  });
});
