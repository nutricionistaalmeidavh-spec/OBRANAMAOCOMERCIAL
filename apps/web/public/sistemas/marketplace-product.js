(() => {
  const loading = document.getElementById('marketplace-loading');
  const errorState = document.getElementById('marketplace-error');
  const productSection = document.getElementById('marketplace-product');
  const title = document.getElementById('product-title');
  const summary = document.getElementById('product-summary');
  const price = document.getElementById('product-price');
  const sold = document.getElementById('product-sold');
  const gallery = document.getElementById('product-gallery');
  const link = document.getElementById('product-marketplace-link');

  function showError() {
    loading.hidden = true;
    productSection.hidden = true;
    errorState.hidden = false;
  }

  async function load() {
    if (!window.ArtiSysMarketplace) return showError();
    const params = new URLSearchParams(window.location.search);
    const itemId = String(params.get('item') || '').trim();
    if (!itemId) return showError();

    try {
      const items = await window.ArtiSysMarketplace.loadApprovedFeed();
      const item = items.find((candidate) => String(candidate.item_id || '') === itemId);
      if (!item || item.pageMode !== 'individual') return showError();

      document.title = `${item.name} | ArtiSys`;
      title.textContent = item.name;
      summary.textContent = 'Produto aprovado no catálogo ArtiSys. As fotos, o preço e os dados comerciais abaixo são sincronizados do anúncio atual do Mercado Livre.';
      price.textContent = window.ArtiSysMarketplace.priceLabel(item);
      sold.textContent = `${Number(item.soldQuantity || 0)} ${Number(item.soldQuantity || 0) === 1 ? 'venda' : 'vendas'}`;
      link.href = item.permalink;
      link.hidden = !String(item.permalink || '').startsWith('https://');

      gallery.replaceChildren();
      for (const src of Array.isArray(item.pictures) ? item.pictures : []) {
        if (!String(src).startsWith('https://')) continue;
        const image = document.createElement('img');
        image.src = src;
        image.alt = `Foto real de ${item.name}`;
        image.loading = 'lazy';
        gallery.appendChild(image);
      }
      gallery.hidden = gallery.children.length === 0;

      loading.hidden = true;
      errorState.hidden = true;
      productSection.hidden = false;
    } catch (cause) {
      console.info('Produto Mercado Livre indisponível; mantendo fail-closed.', cause?.message || cause);
      showError();
    }
  }

  load();
})();
