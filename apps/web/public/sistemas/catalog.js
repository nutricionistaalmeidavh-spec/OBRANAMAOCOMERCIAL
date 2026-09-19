(() => {
  const state = { products: [], collections: [], category: 'Todos', query: '' };
  const grid = document.getElementById('catalog-grid');
  const collectionGrid = document.getElementById('collection-grid');
  const filters = document.getElementById('catalog-filters');
  const search = document.getElementById('catalog-search');
  const empty = document.getElementById('catalog-empty');
  const error = document.getElementById('catalog-error');
  const count = document.getElementById('catalog-result-count');
  const productCount = document.getElementById('product-count');
  const collectionCount = document.getElementById('collection-count');
  const dialog = document.getElementById('product-dialog');
  const dialogCategory = document.getElementById('dialog-category');
  const dialogTitle = document.getElementById('dialog-title');
  const dialogSummary = document.getElementById('dialog-summary');
  const dialogType = document.getElementById('dialog-type');
  const dialogPrice = document.getElementById('dialog-price');
  const dialogFeatures = document.getElementById('dialog-features');
  const dialogActions = document.getElementById('dialog-actions');
  const typeLabel = { desktop: 'Desktop', web: 'Web', saas: 'SaaS', marketplace: 'ArtiSys' };
  const statusLabel = { available: 'Disponível', managed: 'Integrado à Central', coming_soon: 'Em breve' };

  function normalize(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function productDestination(product) {
    if (product.marketplaceOnly && product.pageMode === 'individual') {
      return { href: `./produto/?item=${encodeURIComponent(product.marketplaceItemId)}`, label: 'Ver sistema', external: false };
    }
    if (product.pageMode === 'external') {
      const href = product.externalHref || product.permalink || './';
      return { href, label: product.marketplaceOnly ? 'Ver produto' : 'Conhecer sistema', external: href.startsWith('https://') };
    }
    if (product.pageMode === 'collection') {
      const collection = product.collections?.[0];
      return { href: collection ? `./${collection}/#${product.slug}` : './', label: 'Ver na coleção', external: false };
    }
    return { href: `./${product.slug}/`, label: 'Ver sistema', external: false };
  }

  function visibleProducts() {
    const query = normalize(state.query);
    return state.products.filter((product) => {
      const categoryMatches = state.category === 'Todos' || product.category === state.category;
      if (!categoryMatches) return false;
      if (!query) return true;
      const haystack = normalize([product.name, product.category, product.summary, ...(product.features || [])].join(' '));
      return haystack.includes(query);
    });
  }

  function createLink(className, text, destination) {
    const link = element('a', className, text);
    link.href = destination.href;
    if (destination.external || destination.href.startsWith('https://')) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
    return link;
  }

  function createAccessLink(product) {
    if (!product.accessHref) return null;
    return createLink('access-link', 'Já sou cliente', { href: product.accessHref, external: product.accessHref.startsWith('https://') });
  }

  function openProduct(product) {
    dialogCategory.textContent = product.category;
    dialogTitle.textContent = product.name;
    dialogSummary.textContent = product.summary;
    dialogType.textContent = typeLabel[product.type] || product.type;
    dialogPrice.textContent = product.priceLabel;
    dialogFeatures.replaceChildren();
    const features = product.features || [];
    if (features.length) {
      for (const feature of features) dialogFeatures.appendChild(element('li', '', feature));
    } else {
      dialogFeatures.appendChild(element('li', '', 'Fotos, preço e disponibilidade sincronizados do anúncio aprovado.'));
    }

    dialogActions.replaceChildren();
    const destination = productDestination(product);
    dialogActions.appendChild(createLink('', destination.label, destination));

    if (product.permalink && product.marketplaceItemId) {
      dialogActions.appendChild(createLink('secondary', 'Ver anúncio', { href: product.permalink, external: true }));
    }

    const access = createAccessLink(product);
    if (access) dialogActions.appendChild(access);

    const close = element('button', 'secondary', 'Continuar vendo sistemas');
    close.type = 'button';
    close.addEventListener('click', () => dialog.close());
    dialogActions.appendChild(close);
    dialog.showModal();
  }

  function createCard(product) {
    const card = element('article', 'product-card');
    card.dataset.product = product.slug;
    if (product.marketplaceItemId) card.dataset.marketplaceItem = product.marketplaceItemId;

    if (Array.isArray(product.pictures) && product.pictures[0]) {
      const image = document.createElement('img');
      image.className = 'product-media';
      image.src = product.pictures[0];
      image.alt = `Foto real de ${product.name}`;
      image.loading = 'lazy';
      card.appendChild(image);
    }

    const top = element('div', 'product-topline');
    top.appendChild(element('span', 'product-category', product.category));
    top.appendChild(element('span', 'product-status', product.marketplaceItemId ? 'Sincronizado' : (statusLabel[product.status] || product.status)));
    card.appendChild(top);

    card.appendChild(element('h3', '', product.name));
    card.appendChild(element('p', 'product-summary', product.summary));

    const meta = element('div', 'product-meta');
    meta.appendChild(element('span', 'product-type', typeLabel[product.type] || product.type));
    meta.appendChild(element('strong', 'product-price', product.priceLabel));
    card.appendChild(meta);

    const actions = element('div', 'product-actions');
    const destination = productDestination(product);
    actions.appendChild(createLink('product-button', destination.label, destination));

    const quick = element('button', 'access-link', 'Resumo rápido');
    quick.type = 'button';
    quick.addEventListener('click', () => openProduct(product));
    actions.appendChild(quick);

    const access = createAccessLink(product);
    if (access) actions.appendChild(access);
    card.appendChild(actions);
    return card;
  }

  function createCollectionCard(collection) {
    const card = element('article', 'product-card');
    card.dataset.collection = collection.slug;
    const top = element('div', 'product-topline');
    top.appendChild(element('span', 'product-category', 'Coleção'));
    top.appendChild(element('span', 'product-status', collection.category));
    card.appendChild(top);
    card.appendChild(element('h3', '', collection.name));
    card.appendChild(element('p', 'product-summary', collection.summary));
    const actions = element('div', 'product-actions');
    actions.appendChild(createLink('product-button', 'Explorar coleção', { href: `./${collection.slug}/`, external: false }));
    card.appendChild(actions);
    return card;
  }

  function renderCollections() {
    collectionGrid?.replaceChildren(...state.collections.map(createCollectionCard));
    if (collectionCount) collectionCount.textContent = String(state.collections.length);
  }

  function renderProducts() {
    const products = visibleProducts();
    grid.replaceChildren(...products.map(createCard));
    empty.hidden = products.length !== 0;
    count.textContent = `${products.length} ${products.length === 1 ? 'sistema' : 'sistemas'}`;
  }

  function renderFilters() {
    const categories = ['Todos', ...new Set(state.products.map((product) => product.category))];
    filters.replaceChildren();
    for (const category of categories) {
      const button = element('button', 'filter-chip', category);
      button.type = 'button';
      button.setAttribute('aria-pressed', String(category === state.category));
      button.addEventListener('click', () => {
        state.category = category;
        renderFilters();
        renderProducts();
      });
      filters.appendChild(button);
    }
  }

  async function enrichWithMarketplace() {
    if (!window.ArtiSysMarketplace) return;
    try {
      const approvedItems = await window.ArtiSysMarketplace.loadApprovedFeed();
      state.products = window.ArtiSysMarketplace.mergeApprovedFeed(state.products, approvedItems);
      productCount.textContent = String(state.products.length);
      renderFilters();
      renderProducts();
    } catch (cause) {
      console.info('Feed Mercado Livre indisponível; mantendo catálogo estático ArtiSys.', cause?.message || cause);
    }
  }

  async function loadCatalog() {
    try {
      const [productsResponse, collectionsResponse] = await Promise.all([
        fetch('./products.json'),
        fetch('./collections.json')
      ]);
      if (!productsResponse.ok) throw new Error(`products HTTP ${productsResponse.status}`);
      if (!collectionsResponse.ok) throw new Error(`collections HTTP ${collectionsResponse.status}`);
      const [data, collectionSource] = await Promise.all([productsResponse.json(), collectionsResponse.json()]);
      if (!data || !Array.isArray(data.products)) throw new Error('Catálogo inválido');
      if (!collectionSource || !Array.isArray(collectionSource.collections)) throw new Error('Coleções inválidas');
      state.products = data.products;
      state.collections = collectionSource.collections;
      productCount.textContent = String(state.products.length);
      renderCollections();
      renderFilters();
      renderProducts();
      await enrichWithMarketplace();
    } catch (cause) {
      console.error('Falha ao carregar catálogo público ArtiSys.', cause);
      error.hidden = false;
      grid.hidden = true;
      count.textContent = '';
    }
  }

  search.addEventListener('input', () => {
    state.query = search.value;
    renderProducts();
  });

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  loadCatalog();
})();