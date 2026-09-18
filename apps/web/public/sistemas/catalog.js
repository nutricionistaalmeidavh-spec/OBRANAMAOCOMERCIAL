(() => {
  const state = { products: [], category: 'Todos', query: '' };
  const grid = document.getElementById('catalog-grid');
  const filters = document.getElementById('catalog-filters');
  const search = document.getElementById('catalog-search');
  const empty = document.getElementById('catalog-empty');
  const error = document.getElementById('catalog-error');
  const count = document.getElementById('catalog-result-count');
  const productCount = document.getElementById('product-count');
  const dialog = document.getElementById('product-dialog');
  const dialogCategory = document.getElementById('dialog-category');
  const dialogTitle = document.getElementById('dialog-title');
  const dialogSummary = document.getElementById('dialog-summary');
  const dialogType = document.getElementById('dialog-type');
  const dialogPrice = document.getElementById('dialog-price');
  const dialogFeatures = document.getElementById('dialog-features');
  const dialogActions = document.getElementById('dialog-actions');

  const typeLabel = { desktop: 'Desktop', web: 'Web', saas: 'SaaS' };
  const statusLabel = { available: 'Disponível', managed: 'Integrado à Central', coming_soon: 'Em breve' };

  function normalize(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
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

  function createActionLink(product) {
    if (!product.accessHref) return null;
    const link = element('a', 'access-link', 'Já sou cliente');
    link.href = product.accessHref;
    if (product.accessHref.startsWith('https://')) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
    return link;
  }

  function openProduct(product) {
    dialogCategory.textContent = product.category;
    dialogTitle.textContent = product.name;
    dialogSummary.textContent = product.summary;
    dialogType.textContent = typeLabel[product.type] || product.type;
    dialogPrice.textContent = product.priceLabel;
    dialogFeatures.replaceChildren();
    for (const feature of product.features || []) dialogFeatures.appendChild(element('li', '', feature));
    dialogActions.replaceChildren();
    const access = createActionLink(product);
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

    const top = element('div', 'product-topline');
    top.appendChild(element('span', 'product-category', product.category));
    top.appendChild(element('span', 'product-status', statusLabel[product.status] || product.status));
    card.appendChild(top);

    card.appendChild(element('h3', '', product.name));
    card.appendChild(element('p', 'product-summary', product.summary));

    const meta = element('div', 'product-meta');
    meta.appendChild(element('span', 'product-type', typeLabel[product.type] || product.type));
    meta.appendChild(element('strong', 'product-price', product.priceLabel));
    card.appendChild(meta);

    const actions = element('div', 'product-actions');
    const details = element('button', 'product-button', 'Ver sistema');
    details.type = 'button';
    details.addEventListener('click', () => openProduct(product));
    actions.appendChild(details);
    const access = createActionLink(product);
    if (access) actions.appendChild(access);
    card.appendChild(actions);

    return card;
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

  async function loadCatalog() {
    try {
      const response = await fetch('./products.json');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!data || !Array.isArray(data.products)) throw new Error('Catálogo inválido');
      state.products = data.products;
      productCount.textContent = String(state.products.length);
      renderFilters();
      renderProducts();
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
