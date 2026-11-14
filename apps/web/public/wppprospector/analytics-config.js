/* Public configuration only. Do not store secrets, API tokens, or customer data here. */
window.ARTISYS_CRM_CONFIG = Object.freeze({
  features: Object.freeze({
    desktopTilt: true,
    desktopSmoothScroll: false
  }),
  umami: Object.freeze({
    enabled: false,
    scriptUrl: '/analytics/script.js',
    websiteId: '',
    allowExternal: false
  })
});
