import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { artisysSeoConfig } from '../seo.config.mjs';
import { listPrimaryLandingProducts, loadCanonicalCatalog } from '../catalog-contract.mjs';
import { buildPageSeo, renderHeadTags } from '../vendor/artisys-seo/technical.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const allProducts=loadCanonicalCatalog().products;
const baseUrl='https://artisys.dev';
const primary=listPrimaryLandingProducts();

export function approvedMarketingRoutes() {
  const catalog={slug:'catalog',route:'/sistemas', product:null,model:buildPageSeo(artisysSeoConfig,'/sistemas')};
  const landing=primary.map(product=>{
    const pathname=decodeURIComponent(new URL(product.href).pathname).replace(/\/$/,'');
    return {slug:product.slug,route:pathname,product,model:buildPageSeo(artisysSeoConfig,pathname)};
  });
  return [catalog,...landing];
}
const SEO_TAGS = [
  /<title\b[^>]*>[\s\S]*?<\/title>\s*/gi,
  /<meta\b[^>]*\bname=["'](?:description|robots|twitter:[^"']+)["'][^>]*>\s*/gi,
  /<meta\b[^>]*\bproperty=["']og:[^"']+["'][^>]*>\s*/gi,
  /<link\b[^>]*\brel=["'][^"']*\bcanonical\b[^"']*["'][^>]*>\s*/gi,
  /<script\b[^>]*\btype=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>\s*/gi
];
function safeJson(value) {
  return JSON.stringify(value).replaceAll('<','\\u003c').replaceAll('>','\\u003e').replaceAll('&','\\u0026');
}
export function instrumentMarketingHtml(html,route,options={}) {
  const cleanRoute=decodeURIComponent(String(route)).replace(/\/$/,'') || '/';
  const target=approvedMarketingRoutes().find(item=>item.route===cleanRoute);
  if(!target)throw Error('Rota não aprovada para alteração de metadados: '+cleanRoute);
  const headOpen=/<head\b[^>]*>/i.exec(html),headClose=/<\/head>/i.exec(html);
  if(!headOpen || !headClose || headClose.index<headOpen.index)throw Error('HTML sem <head> íntegro: '+route);
  const start=headOpen.index+headOpen[0].length;
  let oldHead=html.slice(start,headClose.index);
  if(/src=["']\/sistemas\/marketing-analytics\.js["']/.test(oldHead))throw Error('Analytics já instrumentado: '+route);
  for(const regex of SEO_TAGS)oldHead=oldHead.replace(regex,'');
  const config={
    page:target.slug,
    destinations:allProducts.map(item=>({
      slug:item.slug,
      href:new URL(item.pageMode==='external' ? item.externalHref : '/sistemas/'+item.slug+'/',baseUrl).href
    })),
    checkoutHref:target.product?.ctaHref||null
  };
  const metadata=renderHeadTags(target.model);
  const script='<script type="application/json" id="artisys-marketing-analytics-config">'+safeJson(config)+'</script>\n'+
    '<script defer src="/sistemas/marketing-analytics.js"></script>';
  const updatedHead=oldHead+'\n'+metadata+'\n'+script+'\n';
  return html.slice(0,start)+updatedHead+html.slice(headClose.index);
}
export function instrumentMarketingDist(dir=resolve(root,'dist')) {
  const result=[];
  for(const page of approvedMarketingRoutes()) {
    const folder=page.route.slice(1).replaceAll('/',sep);
    const filename=resolve(dir,folder,'index.html');
    if(!filename.startsWith(resolve(dir)+sep)) throw Error('Saída fora de dist');
    if(!existsSync(filename))throw Error('Landing ausente no build: '+page.route);
    const original=readFileSync(filename,'utf8');
    const updated=instrumentMarketingHtml(original,page.route);
    const oldBody=original.slice(original.search(/<body\b/i)),newBody=updated.slice(updated.search(/<body\b/i));
    if(oldBody!==newBody)throw Error('Bloqueado: body visual modificado em '+page.route);
    writeFileSync(filename,updated);
    result.push(page.route);
  }
  return result;
}
