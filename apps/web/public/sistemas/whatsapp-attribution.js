/* 100% first-party: one canonical WhatsApp click per activation. No cookies or personal identifiers. */
(() => {
 'use strict';
 const ctas={"home":["contato-projeto","footer-whatsapp","outro-botao"],"wppprospector":["nav-contato","licenca","hero-contato","outro-botao"],"oficina":["nav-contato","licenca","outro-botao"],"gestao-holerites":["nav-licenca","hero-aquisicao","outro-botao"],"devkits":["catalogo-kits","ajuda-kits","outro-botao"],"links":["social-whatsapp","outro-botao"],"diagnostico":["avaliacao-whatsapp","privacidade","outro-botao"],"catalog":["outro-botao"],"pdv-artisys":["outro-botao"],"pdv-nexus":["outro-botao"],"obra-na-mao":["outro-botao"],"artisys-finance":["outro-botao"],"nutridesk":["outro-botao"]};
 const labels={
 home:'Página inicial',wppprospector:'WppProspector',oficina:'ArtiSys Oficina',
 'gestao-holerites':'Gestão de Holerites',devkits:'DevKit Tools',links:'Central de links',
 diagnostico:'Diagnóstico Gratuito',catalog:'Vitrine de sistemas',
 'pdv-artisys':'PDV ArtiSys','pdv-nexus':'PDV Nexus','obra-na-mao':'Obra na Mão',
 'artisys-finance':'ArtiSys Financeiro',nutridesk:'NutriDesk'
 };
 function pageOf(path) {
   let name;try{name=decodeURIComponent(path)}catch{return null}
   const routes={
    '/':'home','/index.html':'home','/wppprospector/':'wppprospector',
    '/oficina/':'oficina','/gestãoholerites/':'gestao-holerites',
    '/links/':'links','/links/diagnostico/':'diagnostico',
    '/devkits/':'devkits','/sistemas/':'catalog'
   };
   const normalized=name.endsWith('/')?name:name+'/';
   return routes[name]||routes[normalized]||(/^\/sistemas\/([a-z0-9-]+)\/$/.exec(normalized)?.[1]||null);
 }
 const page=pageOf(location.pathname);
 if(!page||!ctas[page])return;
 function isWhatsApp(a){
   try {const host=new URL(a.href,location.href).hostname.toLowerCase();
     return host==='wa.me'||host==='api.whatsapp.com'||host==='web.whatsapp.com';
   }catch{return false}
 }
 function ctaFor(a) {
   const existing=a.getAttribute('data-wa-cta');
   if(existing&&ctas[page].includes(existing))return existing;
   const index=Array.from(document.querySelectorAll('a[href]')).filter(isWhatsApp).indexOf(a);
   return ctas[page][index]||'outro-botao';
 }
 function prepare(a) {
   if(!isWhatsApp(a))return null;
   const cta=ctaFor(a);
   a.dataset.waCta=cta;
   if(a.dataset.waPrepared)return cta;
   try {
     const url=new URL(a.href,location.href);
     let msg=url.searchParams.get('text')||'Olá! Gostaria de conversar com a ArtiSys.';
     if(!msg.includes('Origem ArtiSys:')) {
       const label=cta.replaceAll('-',' ');
       msg+='\n\nOrigem ArtiSys: '+(labels[page]||page)+' | Botão: '+label;
       url.searchParams.set('text',msg);
       a.href=url.toString();
     }
     a.dataset.waPrepared='true';
   }catch{ /* No navigation blocking. */ }
   return cta;
 }
 const all=()=>document.querySelectorAll('a[href]');
 all().forEach(prepare);
 function record(cta) {
   const payload=JSON.stringify({type:'whatsapp_click',product:page,cta});
   try {
     if(navigator.sendBeacon?.('/api/marketing/metrics',new Blob([payload],{type:'text/plain;charset=UTF-8'})))return;
     void fetch('/api/marketing/metrics',{method:'POST',mode:'same-origin',credentials:'omit',
       keepalive:true,referrerPolicy:'no-referrer',headers:{'content-type':'text/plain;charset=UTF-8'},body:payload}).catch(()=>{});
   }catch{/* Measurement must not block WhatsApp. */}
 }
 document.addEventListener('click',e=>{
   const t=e.target;
   if(!(t instanceof Element))return;
   const a=t.closest('a[href]');
   if(!a||!isWhatsApp(a))return;
   const cta=prepare(a);
   if(cta)record(cta);
 },{capture:true});
})();
