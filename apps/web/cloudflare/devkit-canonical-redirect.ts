/** Redirect legacy public DevKit catalog URLs before performing app bootstrap or DB work. */
export function handleDevkitLegacyRedirect(request: Request): Response | null {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;
  const current = new URL(request.url);
  const base = '/devkits/catalogo';
  if (current.pathname !== base && !current.pathname.startsWith(base + '/')) return null;
  const filename = current.pathname.slice((base + '/').length);
  const allowedAssets = new Set(['catalogo.css', 'catalogo.js', 'kits.json']);
  const target = new URL(allowedAssets.has(filename) ? '/devkits/' + filename : '/devkits/', current.origin);
  target.search = current.search;
  return Response.redirect(target.toString(), 301);
}
