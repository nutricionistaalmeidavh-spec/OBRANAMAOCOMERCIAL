(() => {
  const FEED_URL = 'https://artisys-mercadolivre.nutricionistaalmeidavh.workers.dev/api/site-catalog/feed';
  // Só no site público: vincula anúncios legados aos produtos canônicos, sem alterar o painel Mercado Livre.
  const CANONICAL_MARKETPLACE_ITEMS = Object.freeze({
    MLB5225444179: 'pdv-artisys',
    MLB7387378512: 'pdv-nexus'
  });

  function installMarketplaceStyles() {
    if (document.getElementById('artisys-marketplace-style')) return;
    const style = document.createElement('style');
    style.id = 'artisys-marketplace-style';
    style.textContent = '.product-media{display:block;width:calc(100% + 44px);height:180px;margin:-22px -22px 18px;object-fit:cover;border-bottom:1px solid rgba(255,255,255,.11);background:#0d1a2a}.marketplace-extra{margin-top:18px}.marketplace-card{min-height:380px}@media(min-width:900px){.product-media{width:calc(100% + 52px);margin:-26px -26px 20px;height:200px}}';
    document.head.appendChild(style);
  }

  function priceLabel(item) {
    if (item.priceMode === 'contact') return 'Sob consulta';
    if (item.priceMode === 'hidden') return 'Consulte detalhes';
    if (!Number.isFinite(Number(item.price))) return 'Sob consulta';
    try {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: item.currency || 'BRL' }).format(Number(item.price));
    } catch {
      return `R$ ${Number(item.price).toFixed(2).replace('.', ',')}`;
    }
  }

  function marketplaceCategory(item) {
    const categories = { agro: 'Agro', negocios: 'Negócios', saude: 'Saúde' };
    return categories[item.collection] || 'ArtiSys';
  }

  function marketplaceProduct(item) {
    return {
      slug: String(item.slug || item.item_id || '').trim(),
      name: String(item.name || 'Produto ArtiSys').trim(),
      category: marketplaceCategory(item),
      type: 'marketplace',
      status: 'available',
      priceLabel: priceLabel(item),
      summary: 'Solução comercializada pela ArtiSys com fotos, preço e disponibilidade sincronizados do Mercado Livre.',
      audience: 'Consulte os detalhes do produto e do anúncio para confirmar se esta solução atende à sua operação.',
      features: [],
      featured: Boolean(item.featured),
      pageMode: item.pageMode,
      collections: item.collection ? [item.collection] : [],
      externalHref: item.pageMode === 'external' ? item.permalink : undefined,
      marketplaceOnly: true,
      marketplaceItemId: String(item.item_id || ''),
      permalink: String(item.permalink || ''),
      pictures: Array.isArray(item.pictures) ? item.pictures.filter((url) => String(url).startsWith('https://')) : [],
      soldQuantity: Number(item.soldQuantity || 0),
      priceMode: item.priceMode || 'marketplace'
    };
  }

  function enrichStaticProduct(product, item) {
    const enriched = { ...product };
    enriched.marketplaceItemId = String(item.item_id || '');
    enriched.permalink = String(item.permalink || '');
    enriched.pictures = Array.isArray(item.pictures) ? item.pictures.filter((url) => String(url).startsWith('https://')) : [];
    enriched.soldQuantity = Number(item.soldQuantity || 0);
    enriched.priceMode = item.priceMode || 'marketplace';
    if (!product.checkoutOfferId && item.priceMode === 'marketplace' && Number.isFinite(Number(item.price))) enriched.priceLabel = priceLabel(item);
    return enriched;
  }

  const HIDDEN_UNLINKED_SLUGS = new Set(['loja-online', 'oficina-agricola', 'sistema-lavoura', 'pecuaria', 'maquinas-agricolas', 'frota-manutencao']);

  function mergeApprovedFeed(staticProducts, feedItems) {
    const result = (staticProducts || []).map((product) => ({ ...product }));
    const bySlug = new Map(result.map((product, index) => [String(product.slug || ''), index]));
    for (const item of feedItems || []) {
      if (item.pageMode === 'digital') continue;
      // O anúncio MLB7387378512 é do Nexus Clássico, não do Nexus normal: nunca copiar imagens/preços dele.
      if (String(item.item_id||'') === 'MLB7387378512') continue;
      const slug = CANONICAL_MARKETPLACE_ITEMS[String(item.item_id || '')] || String(item.slug || '').trim();
      if (!slug || HIDDEN_UNLINKED_SLUGS.has(slug)) continue;
      if (bySlug.has(slug)) {
        const index = bySlug.get(slug);
        result[index] = enrichStaticProduct(result[index], item);
        continue;
      }
      const product = marketplaceProduct(item);
      if (!product.slug || !product.marketplaceItemId) continue;
      bySlug.set(product.slug, result.length);
      result.push(product);
    }
    return result;
  }

  async function loadApprovedFeed({ timeoutMs = 2800 } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(FEED_URL, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-store',
        signal: controller.signal,
        headers: { accept: 'application/json' }
      });
      if (!response.ok) throw new Error(`Mercado Livre feed HTTP ${response.status}`);
      const data = await response.json();
      return Array.isArray(data?.items) ? data.items : [];
    } finally {
      clearTimeout(timer);
    }
  }

  installMarketplaceStyles();
  window.ArtiSysMarketplace = Object.freeze({
    feedUrl: FEED_URL,
    loadApprovedFeed,
    mergeApprovedFeed,
    priceLabel,
    canonicalProductSlugForItemId: id => CANONICAL_MARKETPLACE_ITEMS[String(id || '')] || null
  });
})();
