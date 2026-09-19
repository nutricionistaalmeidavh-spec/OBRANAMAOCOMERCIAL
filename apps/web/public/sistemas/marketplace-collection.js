(() => {
  const slot = document.getElementById('marketplace-collection-extra');
  if (!slot || !window.ArtiSysMarketplace) return;

  const collectionSlug = String(slot.dataset.collection || '').trim();
  const staticSlugs = new Set(
    [...document.querySelectorAll('[data-product]')]
      .map((node) => String(node.dataset.product || '').trim())
      .filter(Boolean)
  );

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function destination(item) {
    if (item.pageMode === 'individual') return `/sistemas/produto/?item=${encodeURIComponent(item.item_id)}`;
    return item.permalink || '/sistemas/';
  }

  function card(item) {
    const article = element('article', 'product-card marketplace-card');
    article.dataset.product = item.slug;
    article.dataset.marketplaceItem = item.item_id;

    if (Array.isArray(item.pictures) && item.pictures[0]) {
      const img = document.createElement('img');
      img.className = 'product-media';
      img.src = item.pictures[0];
      img.alt = `Foto real de ${item.name}`;
      img.loading = 'lazy';
      article.appendChild(img);
    }

    const top = element('div', 'product-topline');
    top.append(element('span', 'product-category', 'Agro'), element('span', 'product-status', 'Mercado Livre'));
    article.appendChild(top);
    article.appendChild(element('h3', '', item.name));
    article.appendChild(element('p', 'product-summary', 'Produto aprovado no catálogo ArtiSys com dados sincronizados do anúncio atual.'));

    const meta = element('div', 'product-meta');
    meta.appendChild(element('span', 'product-type', 'ArtiSys'));
    meta.appendChild(element('strong', 'product-price', window.ArtiSysMarketplace.priceLabel(item)));
    article.appendChild(meta);

    const actions = element('div', 'product-actions');
    const link = element('a', 'product-button', item.pageMode === 'individual' ? 'Ver sistema' : 'Ver anúncio');
    link.href = destination(item);
    if (link.href.startsWith('http') && item.pageMode !== 'individual') {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
    actions.appendChild(link);
    article.appendChild(actions);
    return article;
  }

  async function load() {
    try {
      const items = await window.ArtiSysMarketplace.loadApprovedFeed();
      const collectionItems = items.filter((item) => item.pageMode === 'collection' && item.collection === collectionSlug && !staticSlugs.has(item.slug));
      slot.replaceChildren(...collectionItems.map(card));
      slot.hidden = collectionItems.length === 0;
    } catch (error) {
      console.info('Catálogo Mercado Livre indisponível na coleção; mantendo portfólio estático.', error?.message || error);
      slot.hidden = true;
    }
  }

  load();
})();
