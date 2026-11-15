/* Anônimo: mede o percurso sem coletar o conteúdo dos campos. */
(() => {
 'use strict';
 const form=document.getElementById('quick-diagnostic-form');
 const panel=document.getElementById('quick-diagnostic-panel');
 const chooser=document.getElementById('quick-diagnostic-open');
 if(!form||!panel||!chooser)return;
 const quickMessage=document.getElementById('quick-message');
 const submit=document.getElementById('quick-submit');
 const fields=['name','company','contact','goal'];
 const sourceKeys=['utm_source','utm_medium','utm_campaign','utm_content','utm_term','video_tiktok'];
 const sent=new Set();
 const analytics='/api/marketing/metrics';
 function trackDiagnosticStep(step,once=true){
   if(once&&sent.has(step))return;
   if(once)sent.add(step);
   const payload=JSON.stringify({type:'funnel_step',product:'diagnostico',step});
   try {
     if(navigator.sendBeacon?.(analytics,new Blob([payload],{type:'text/plain;charset=UTF-8'})))return;
     void fetch(analytics,{method:'POST',credentials:'omit',mode:'same-origin',keepalive:true,
       headers:{'content-type':'text/plain;charset=UTF-8'},body:payload,
       referrerPolicy:'no-referrer'}).catch(()=>{});
   }catch{ /* Métricas nunca bloqueiam o contato. */ }
 }
 trackDiagnosticStep('page_open');
 function openQuick(){
   panel.hidden=false;
   chooser.setAttribute('aria-expanded','true');
   trackDiagnosticStep('quick_open');
   document.getElementById('quick-diagnostic-title')?.focus({preventScroll:true});
   panel.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
 }
 chooser.addEventListener('click',openQuick);
 document.getElementById('quick-back')?.addEventListener('click',()=>{
   panel.hidden=true;
   chooser.setAttribute('aria-expanded','false');
   chooser.focus();
 });
 let started=false,sending=false;
 form.addEventListener('input',()=>{
   if(!started){started=true;trackDiagnosticStep('quick_started');}
   quickMessage.textContent='';
 });
 form.addEventListener('submit',async e=>{
   e.preventDefault();
   if(sending)return;
   const data=new FormData(form);
   let valid=true;
   for(const key of fields) {
     const field=form.elements.namedItem(key);
     if(field instanceof HTMLElement && 'checkValidity' in field && !field.checkValidity()) {
       field.setAttribute('aria-invalid','true');
       field.focus();valid=false;break;
     }
   }
   if(!valid){quickMessage.textContent='Confira os campos obrigatórios.';trackDiagnosticStep('quick_error',false);return;}
   const payload={kind:'quick'};
   for(const key of fields)payload[key]=String(data.get(key)||'').trim();
   payload.website=String(data.get('website')||'');
   const qs=new URLSearchParams(window.location.search);
   for(const key of sourceKeys) {
     const value=qs.get(key);
     if(value)payload[key]=value.slice(0,120);
   }
   sending=true;submit.disabled=true;quickMessage.textContent='Registrando sua solicitação...';
   try {
     const response=await fetch('/api/public/diagnostico',{
       method:'POST',credentials:'omit',headers:{'content-type':'application/json'},
       body:JSON.stringify(payload)
     });
     const result=await response.json();
     if(!response.ok||result.ok!==true)throw new Error(result.message||'Não foi possível concluir a avaliação.');
     trackDiagnosticStep('quick_submitted');
     form.hidden=true;
     panel.querySelector('.wizard-head').hidden=true;
     document.getElementById('quick-protocol').textContent=result.protocol;
     const success=document.getElementById('quick-diagnostic-success');
     success.hidden=false;
     success.querySelector('h2')?.focus();
   }catch(error){
     trackDiagnosticStep('quick_error',false);
     quickMessage.textContent=error instanceof Error?error.message:'Tente novamente em instantes.';
   }finally{sending=false;submit.disabled=false;}
 });
})();
