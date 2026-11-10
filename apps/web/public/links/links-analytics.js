/* Central ArtiSys /links — contadores agregados sem cookies, identificadores ou bibliotecas externas. */
(() => {
  'use strict';
  const endpoint = '/api/links/metrics';
  const ids = new Set([
    'site-logo', 'site-principal', 'diagnostico', 'academy', 'tiktok', 'whatsapp-social'
  ]);

  function record(payload) {
    const message = JSON.stringify(payload);
    try {
      // O Beacon mantém o envio na navegação para outros sites.
      if (typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([message], { type: 'text/plain;charset=UTF-8' });
        if (navigator.sendBeacon(endpoint, blob)) return;
      }
      void fetch(endpoint, {
        method: 'POST', credentials: 'omit', keepalive: true,
        headers: { 'content-type': 'text/plain;charset=UTF-8' },
        body: message
      }).catch(() => {});
    } catch {
      // Telemetria nunca pode interromper navegação, login ou links externos.
    }
  }

  record({ type: 'view' });
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const link = target.closest('a[data-link-id]');
    const linkId = link?.getAttribute('data-link-id') || '';
    if (!ids.has(linkId)) return;
    record({ type: 'click', linkId });
  }, { capture: true });
})();
