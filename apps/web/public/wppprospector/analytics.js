/* Optional Umami self-hosted analytics; never loads without explicit configuration. */
(() => {
  'use strict';
  const config = window.ARTISYS_CRM_CONFIG && window.ARTISYS_CRM_CONFIG.umami;
  if (!config || config.enabled !== true) return;

  const id = String(config.websiteId || '');
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) {
    console.warn('CRM Umami disabled: invalid website ID.');
    return;
  }

  let source;
  try { source = new URL(config.scriptUrl || '', window.location.origin); }
  catch { console.warn('CRM Umami disabled: invalid script URL.'); return; }
  if (source.protocol !== 'https:' && !(window.location.hostname === 'localhost' && source.protocol === 'http:')) {
    console.warn('CRM Umami disabled: HTTPS endpoint required.');
    return;
  }
  if (source.origin !== window.location.origin && config.allowExternal !== true) {
    console.warn('CRM Umami disabled: first-party tracking only by default.');
    return;
  }
  if (source.username || source.password || source.search || source.hash) {
    console.warn('CRM Umami disabled: URL must not contain credentials or parameters.');
    return;
  }

  window.__artisysCRMTrack = (name, props = {}) => {
    if (typeof window.umami?.track !== 'function') return;
    if (!/^crm_[a-z_]{2,40}$/.test(name)) return;
    const safe = {};
    for (const [key, value] of Object.entries(props)) {
      if (!/^[a-z_]{2,20}$/.test(key)) continue;
      if (typeof value === 'number' && Number.isFinite(value)) safe[key] = value;
      else if (typeof value === 'string' && /^[a-zA-Z0-9 _-]{1,60}$/.test(value)) safe[key] = value;
    }
    window.umami.track(name, { page: 'wppprospector', ...safe });
  };

  const script = document.createElement('script');
  script.src = source.href;
  script.async = true;
  script.dataset.websiteId = id;
  script.dataset.autoTrack = 'true';
  script.referrerPolicy = 'strict-origin-when-cross-origin';
  document.head.appendChild(script);

  document.addEventListener('click', (event) => {
    const link = event.target?.closest?.('a[data-crm-cta]');
    if (!link) return;
    window.__artisysCRMTrack('crm_cta_click', { destination: link.dataset.crmCta });
  }, { passive: true });
})();
