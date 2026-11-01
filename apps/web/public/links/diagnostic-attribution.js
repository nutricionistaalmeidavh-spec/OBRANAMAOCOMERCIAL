/* Preserve UTM attribution from the ArtiSys /links page to the existing diagnostic form. */
(() => {
  'use strict';
  const link = document.querySelector('a[data-link-id="diagnostico"]');
  if (!link) return;
  const source = new URLSearchParams(window.location.search);
  const destination = new URL(link.getAttribute('href'), window.location.origin);
  for (const key of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','video_tiktok']) {
    const value = source.get(key);
    if (value) destination.searchParams.set(key, value.slice(0,120));
  }
  link.setAttribute('href', destination.pathname + destination.search);
})();
