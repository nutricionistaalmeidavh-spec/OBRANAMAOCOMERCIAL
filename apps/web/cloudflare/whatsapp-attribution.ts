import mapping from '../public/sistemas/whatsapp-ctas.json';
export const WHATSAPP_CTA_ROUTES = mapping;
const canonical = (path:string):string|null => {
  let decoded: string;
  try {decoded=decodeURIComponent(path)}catch{return null}
  const routes: Record<string,string>={
    '/':'home','/index.html':'home',
    '/wppprospector/':'wppprospector','/oficina/':'oficina',
    '/gestãoholerites/':'gestao-holerites',
    '/links/':'links','/links/diagnostico/':'diagnostico',
    '/devkits/':'devkits','/sistemas/':'catalog'
  };
  const route=decoded.endsWith('/')?decoded:decoded+'/';
  return routes[decoded]||routes[route]||(/^\/sistemas\/([a-z0-9-]+)\/$/.exec(route)?.[1]??null);
};
export function identifyWhatsappCta(path:string,hostname:string,cta:string){
  if(!['wa.me','api.whatsapp.com','web.whatsapp.com'].includes(hostname))return null;
  const page=canonical(path);
  if(!page || !Object.prototype.hasOwnProperty.call(mapping,page))return null;
  const approved=(mapping as Record<string,string[]>)[page];
  return approved.includes(cta)?{page,cta}:null;
}
export function validWhatsappEvent(product:unknown,cta:unknown):product is string{
  return typeof product==='string' && typeof cta==='string' && identifyWhatsappCta(
    product==='home'?'/':product==='diagnostico'?'/links/diagnostico/':
    product==='links'?'/links/':product==='devkits'?'/devkits/':
    product==='gestao-holerites'?'/gestãoholerites/':
    product==='catalog'?'/sistemas/':
    ['oficina','wppprospector'].includes(product)?'/'+product+'/':
    '/sistemas/'+product+'/','wa.me',cta)!==null;
}
