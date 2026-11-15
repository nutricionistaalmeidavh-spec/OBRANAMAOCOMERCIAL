/* ArtiSys marketing: anonymous first-party aggregate counters. No cookies, UTM, IP or vendor tracker. */
(() => {
  'use strict';
  const configNode = document.getElementById('artisys-marketing-analytics-config');
  if (!configNode) return;
  let config;
  try { config = JSON.parse(configNode.textContent || '{}'); } catch { return; }
  if (!/^(catalog|[a-z0-9-]{2,45})$/.test(config.page || '')) return;
  const endpoint = '/api/marketing/metrics';
  const valid = new Set(['view','product_click','checkout_click','contact_click','gallery_click']);
  const destinationMap = new Map();
  for (const item of config.destinations || []) {
    if (!item || typeof item.href !== 'string' || typeof item.slug !== 'string') continue;
    try { destinationMap.set(new URL(item.href, location.origin).origin + new URL(item.href, location.origin).pathname, item.slug); }
    catch { /* Ignore malformed optional entry. */ }
  }

  function consentGranted() {
    const permission = document.body?.dataset?.analyticsConsent;
    return permission === undefined || permission === 'allowed';
  }
  function record(type, product) {
    if (!valid.has(type) || !consentGranted() || !product) return;
    const payload = JSON.stringify({type, product});
    try {
      void fetch(endpoint, {
        method:'POST',credentials:'omit',keepalive:true,mode:'same-origin',
        referrerPolicy:'no-referrer',
        headers:{'content-type':'text/plain;charset=UTF-8'},
        body:payload
      }).catch(() => {});
    } catch { /* Telemetry never blocks navigation or purchases. */ }
  }

  let viewed = false;
  function recordViewOnce() {
    if (viewed || !consentGranted()) return;
    viewed = true;
    record('view',config.page);
  }
  recordViewOnce();
  if (document.body?.dataset?.analyticsConsent === 'pending') {
    document.getElementById('analytics-allow')?.addEventListener('click', () => {
      queueMicrotask(recordViewOnce);
    });
  }

  document.addEventListener('click',event=>{
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest('a[href]');
    if (!anchor || !consentGranted()) return;
    let href;
    try { href = new URL(anchor.href,location.href); } catch { return; }
    const base = href.origin + href.pathname;
    if (config.page === 'catalog') {
      const slug=destinationMap.get(base);
      if (slug) record('product_click',slug);
      return;
    }
    if (typeof config.checkoutHref === 'string' && config.checkoutHref) {
      try {
        if (href.href === new URL(config.checkoutHref,location.origin).href) {
          record('checkout_click',config.page);return;
        }
      } catch { /* Ignore invalid checkout config. */ }
    }
    if (/^(www\.)?mercadolivre\.com\.br$|^produto\.mercadolivre\.com\.br$/.test(href.hostname) ||
        (href.pathname.startsWith('/comprar') && href.hostname.endsWith('.workers.dev'))) {
      record('checkout_click',config.page);return;
    }
    if (href.hostname==='wa.me' || href.hash==='#contato' ||
        anchor.hasAttribute('data-crm-cta') || anchor.hasAttribute('data-product-cta')) {
      record('contact_click',config.page);return;
    }
    if (/^#(telas|galeria|screenshots|financeiro-em-acao|crm-screenshots)/.test(href.hash)) {
      record('gallery_click',config.page);
    }
  },{capture:true});
})();
