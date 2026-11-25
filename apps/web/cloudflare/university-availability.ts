// Retain shared phone credential/session endpoints: Obra360 and RDO use them.
const operationalEducationRoutes = new Set([
  'POST /api/edu/login','POST /api/edu/me','POST /api/edu/access-status',
  'POST /api/edu/first-access','POST /api/edu/password',
]);
export function retiredUniversityResponse(request: Request): Response | null {
  const url = new URL(request.url);
  const path = url.pathname.toLowerCase().replace(/\/+$/, '');
  const headers = {'cache-control':'no-store','x-robots-tag':'noindex, nofollow, noarchive'};
  if (/^\/universidade(?:\.html)?$/.test(path)) {
    return new Response(null,{status:303,headers:{...headers,location:'/sistema.html#portal'}});
  }
  if ((path.startsWith('/api/edu/') && !operationalEducationRoutes.has(request.method+' '+path))
      || path === '/manifest-universidade.webmanifest' || path === '/icon-universidade.svg'
      || path.startsWith('/question-images/') || (path === '/resources/question-visual-map.json' || path === '/resources/question-visuals-manifest.json')) {
    return new Response('Conteúdo desativado.', {status:410,headers:{...headers,'content-type':'text/plain; charset=utf-8'}});
  }
  return null;
}
