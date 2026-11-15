/* First-party analytics for artisys.dev homepage; no cookies or paid external analytics. */
(() => {
  'use strict';
  if (location.pathname !== '/' && location.pathname !== '/index.html') return;
  const endpoint='/api/marketing/metrics';
  const routes=[
    {name:'sistemas',path:'/sistemas'},
    {name:'devkits',path:'/devkits'},
    {name:'academy',path:'/academy'},
    {name:'links',path:'/links'}
  ];
  function record(event) {
    const body=JSON.stringify(event);
    try {
      if (typeof navigator.sendBeacon==='function') {
        const sent=navigator.sendBeacon(endpoint,new Blob([body],{type:'text/plain;charset=UTF-8'}));
        if(sent)return;
      }
      void fetch(endpoint,{
        method:'POST', credentials:'omit', mode:'same-origin', keepalive:true,
        headers:{'content-type':'text/plain;charset=UTF-8'},
        body,referrerPolicy:'no-referrer'
      }).catch(()=>{});
    } catch { /* Analytics never interferes with navigation or page content. */ }
  }
  record({type:'view',product:'home'});
  document.addEventListener('click',event=>{
    const el=event.target;
    if(!(el instanceof Element))return;
    const anchor=el.closest('a[href]');
    if(!anchor)return;
    let href;
    try{href=new URL(anchor.href,location.href)}catch{return}
    let destination='';
    if(href.hash==='#contato' || href.hostname==='wa.me')destination='contato';
    else if(href.origin===location.origin) {
      const path=href.pathname.replace(/\/$/,'');
      const matched=routes.find(r=>path===r.path || path.startsWith(r.path+'/'));
      if(matched)destination=matched.name;
    }
    if(destination)record({type:'site_click',product:'home',destination});
  },{capture:true});
})();
