import { hydrateQuestionVisuals } from './question-image-loader-v2';
import { navigationItems } from './navigation-model';

export type GuideContext='home'|'tracks'|'lesson'|'diagnostic'|'development'|'tasks';
export type ShellParticipant={name:string;jobRole:string;diagnosticCompletedAt?:string|null;role?:'superadmin'|'admin'|'rh'|'gestor'|'colaborador'};

export function universityErrorMessage(value:unknown){
  const item=value as{response?:{data?:{error?:string;message?:string}};message?:string;code?:string};
  return item.response?.data?.error||item.response?.data?.message||item.message||item.code||'Não foi possível concluir o acesso.';
}

function guideCopy(context:GuideContext){
  return({
    home:['Um passo de cada vez','Sua próxima atividade já está pronta.'],
    tracks:['Escolha seu próximo passo','A recomendação fica em destaque.'],
    lesson:['Você consegue','Leia o apoio e tente no seu ritmo.'],
    diagnostic:['Vamos começar','Não é prova: é só um ponto de partida.'],
    development:['Seu caminho aparece aqui','Cada atividade fortalece uma habilidade.'],
    tasks:['Tarefa de hoje','Poucos minutos já contam.']
  }as Record<GuideContext,[string,string]>)[context];
}
function guideHtml(context:GuideContext,compact=false){const[title,text]=guideCopy(context);return'<aside class="edu-mh-guide '+(compact?'edu-mh-guide--compact':'')+'" data-guide-context="'+context+'"><div class="edu-mh-avatar" aria-hidden="true"><img class="edu-mh-frame" src="./guide/mh-neutral.webp" alt=""></div><div class="edu-mh-bubble"><small>GUIA MH</small><strong>'+title+'</strong><p>'+text+'</p></div></aside>'}
function inferredGuide(active:string,html:string):GuideContext|undefined{if(active==='tarefas')return'tasks';if(active==='diagnostico')return'diagnostic';if(active==='evolucao')return'development';if(active==='trilhas'&&!html.includes('edu-area-hero'))return html.includes('edu-lesson')||html.includes('edu-question-support')?'lesson':'tracks';return undefined}
function upgradeLegacyGuide(root:ParentNode=document){root.querySelectorAll<HTMLElement>('.edu-mh-mascot').forEach(node=>{node.className='edu-mh-avatar';node.innerHTML='<img class="edu-mh-frame" src="./guide/mh-neutral.webp" alt="">'})}
function addPortalLink(root:ParentNode=document){const header=root.querySelector('.edu-top');if(header&&!header.querySelector('.edu-portal-link'))header.insertAdjacentHTML('beforeend','<a class="edu-portal-link" href="./index.html#portal" aria-label="Voltar ao Portal MH">Portal MH</a>')}
function pageContent(html:string,guide?:GuideContext){if(guide==='home'){const marker='<section class="edu-home-journey">',end='</section>',start=html.indexOf(marker);if(start>=0){const close=html.indexOf(end,start)+end.length;return html.slice(0,start)+'<div class="edu-home-overview">'+html.slice(start,close)+guideHtml('home')+'</div>'+html.slice(close)}}return(guide?guideHtml(guide,true):'')+html}
function arrangeHomeGuide(root:ParentNode=document){const guide=root.querySelector<HTMLElement>('.edu-mh-guide[data-guide-context="home"]'),journey=root.querySelector<HTMLElement>('.edu-home-journey');if(!guide||!journey||journey.parentElement?.classList.contains('edu-home-overview'))return;const wrap=document.createElement('div');wrap.className='edu-home-overview';journey.parentNode?.insertBefore(wrap,journey);wrap.append(journey,guide)}
function bindGuideAnimation(root:ParentNode=document){const img=root.querySelector<HTMLImageElement>('.edu-mh-frame');if(!img||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;const frames=['./guide/mh-neutral.webp','./guide/mh-blink.webp','./guide/mh-wave.webp','./guide/mh-breathe.webp'];frames.slice(1).forEach(src=>{const preload=new Image();preload.src=src});let index=0;window.setInterval(()=>{if(!document.body.contains(img))return;index=(index+1)%frames.length;img.src=frames[index]},1800)}

export function createUniversityShell(input:{participant:()=>ShellParticipant|null;onNavigate:(id:string)=>void}){
  const notify=(message:string)=>{let element=document.getElementById('eduToast');if(!element){element=document.createElement('div');element.id='eduToast';document.body.append(element)}element.textContent=message;element.className='edu-toast show';setTimeout(()=>element?.classList.remove('show'),2500)};
  const render=(title:string,html:string,active='inicio',guide?:GuideContext)=>{
    const participant=input.participant(),nav=navigationItems({diagnosticCompleted:!!participant?.diagnosticCompletedAt,role:participant?.role}),pageGuide=guide||inferredGuide(active,html);
    document.body.className='edu-body';
    document.body.innerHTML='<div class="edu-app"><aside class="edu-side"><div class="edu-brand"><b>MH</b><span>INSTALAÇÕES<br>HIDRÁULICAS</span></div><nav aria-label="Navegação principal">'+nav.map(item=>'<button data-nav="'+item.id+'" class="'+(active===item.id?'active':'')+'" '+(active===item.id?'aria-current="page"':'')+'>'+item.label+'</button>').join('')+'</nav></aside><main><header class="edu-top"><strong>'+title+'</strong><span>'+(participant?.name||'')+'<small>'+(participant?.jobRole||'')+'</small></span></header><section class="edu-content">'+pageContent(html,pageGuide)+'</section></main></div><div id="eduToast" class="edu-toast" role="status" aria-live="polite"></div>';
    upgradeLegacyGuide(document);arrangeHomeGuide(document);addPortalLink(document);
    document.querySelectorAll<HTMLElement>('[data-nav]').forEach(item=>item.onclick=()=>input.onNavigate(item.dataset.nav||'inicio'));
    bindGuideAnimation(document);void hydrateQuestionVisuals(document);
  };
  return{notify,errorMessage:universityErrorMessage,render};
}
