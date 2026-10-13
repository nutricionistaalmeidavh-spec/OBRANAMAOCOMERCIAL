'use strict';
(()=>{
const $=id=>document.getElementById(id);
const text=(tag,cls,value)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(value!==undefined)node.textContent=String(value);return node};
const append=(parent,...nodes)=>{for(const n of nodes)parent.appendChild(n);return parent};
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const paths=['/guia/aulas/01-10.json','/guia/aulas/11-20.json','/guia/aulas/21-30.json','/guia/aulas/31-40.json'];
const progressKey='artisys-guide-read-v2',currentKey='artisys-guide-current-v2',checksKey='artisys-guide-checks-v2';
const localRead=(key,defaultValue)=>{try{return JSON.parse(localStorage.getItem(key)||'null')??defaultValue}catch{return defaultValue}};
const state={pages:[],groups:[],current:0,done:new Set(localRead(progressKey,[])),checks:localRead(checksKey,{}),firstRoute:true};
const two=n=>String(n).padStart(2,'0');
const save=()=>{try{localStorage.setItem(progressKey,JSON.stringify([...state.done]));localStorage.setItem(checksKey,JSON.stringify(state.checks));if(state.current)localStorage.setItem(currentKey,String(state.current))}catch{}};
function copied(button,value){
 if(!navigator.clipboard?.writeText){button.textContent='Selecione o texto para copiar';return}
 navigator.clipboard.writeText(value).then(()=>{button.textContent='Copiado ✓'}).catch(()=>{button.textContent='Selecione o texto para copiar'});
}
function codeFigure(title,content){
 const fig=text('figure','lesson-code');
 const head=append(text('figcaption','lesson-code-head'),text('span','',title),text('button','lesson-copy','Copiar'));
 head.querySelector('button').type='button';
 head.querySelector('button').addEventListener('click',e=>copied(e.currentTarget,content));
 const code=text('code','',content);const pre=append(text('pre','lesson-code-pre'),code);pre.tabIndex=0;
 return append(fig,head,pre);
}
function subsection(title,body){
 const section=text('section','lesson-section');section.appendChild(text('h2','lesson-h2',title));section.appendChild(text('p','lesson-body-text',body));return section;
}
function cards(){
 $('chapter-nav').replaceChildren();$('overview-groups').replaceChildren();
 for(const [i,g] of state.groups.entries()){
   const wrap=text('div','nav-group');const hdr=text('div','nav-group-title');
   append(hdr,text('span','',g.title),text('span','',g.from+'–'+g.to));wrap.appendChild(hdr);
   for(const p of state.pages.filter(x=>x.number>=g.from&&x.number<=g.to)){
      const link=text('a','nav-page');link.href='#pagina-'+two(p.number);link.dataset.number=String(p.number);
      append(link,text('span','nav-num',two(p.number)),text('span','',p.title));wrap.appendChild(link);
   }$('chapter-nav').appendChild(wrap);
   const card=text('a','group-card');card.href='#pagina-'+two(g.from);
   const meta=text('span','group-range','CAPÍTULO '+two(i+1)+' / AULAS '+g.from+'–'+g.to);
   const bottom=append(text('div',''),text('strong','',g.title+' ↗'),text('p','',(g.to-g.from+1)+' aulas práticas, exemplos e testes'));
   append(card,meta,bottom);$('overview-groups').appendChild(card);
 }
}
function progress(){
 $('progress-label').textContent=state.done.size+' de 40 aulas concluídas';
 $('progress-bar').style.width=(state.done.size/40*100)+'%';
 for(const a of document.querySelectorAll('.nav-page')){
  a.classList.toggle('done',state.done.has(Number(a.dataset.number)));
  a.classList.toggle('active',Number(a.dataset.number)===state.current);
  if(Number(a.dataset.number)===state.current)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');
 }
}
function setTheme(theme){$('reader').dataset.theme=theme;$('reader-theme-toggle').textContent=theme==='light'?'Usar fundo roxo':'Usar fundo claro'}
function showOverview(){
 state.current=0;$('overview').hidden=false;$('reader').hidden=true;$('breadcrumb-current').textContent='VISÃO GERAL';
 document.title='Do Prompt ao Software | Guia gratuito Artisys';
 let prior=0;try{prior=Number(localStorage.getItem(currentKey)||0)}catch{}
 const resume=$('resume-button');resume.hidden=!(prior>=1&&prior<=40);
 if(!resume.hidden)resume.onclick=()=>{location.hash='pagina-'+two(prior)};
 progress();
}
function renderLesson(page){
 const root=$('reader-body');root.replaceChildren();
 const intro=append(text('div','lesson-introduction'),text('p','lesson-lead',page.lead));
 root.appendChild(intro);
 const stepsSection=text('section','lesson-section');
 append(stepsSection,text('div','lesson-eyebrow','SEQUÊNCIA REPRODUZÍVEL'),text('h2','lesson-h2','Faça em ordem'));
 const list=text('ol','lesson-steps');
 page.steps.forEach((step,i)=>{
   const item=text('li','lesson-step');
   append(item,text('span','lesson-step-number',two(i+1)),text('p','lesson-step-text',step));
   list.appendChild(item);
 });stepsSection.appendChild(list);root.appendChild(stepsSection);
 const example=text('section','lesson-section');
 append(example,text('div','lesson-eyebrow','ARTEFATO / EXEMPLO'),text('h2','lesson-h2','Veja um resultado concreto'));
 if(page.example.includes('\n'))example.appendChild(codeFigure(page.example.startsWith('name:')?'EXEMPLO YAML — LEIA ANTES DE USAR':'EXEMPLO DIDÁTICO — ADAPTE AO SEU PROJETO',page.example));
 else example.appendChild(text('p','lesson-body-text',page.example));
 root.appendChild(example);
 const prompt=text('section','lesson-section');
 append(prompt,text('div','lesson-eyebrow','COPIE, REVISE E PERSONALIZE'),text('h2','lesson-h2','Prompt para o agente'));
 prompt.appendChild(codeFigure('PROMPT REUTILIZÁVEL',page.prompt));root.appendChild(prompt);
 const costs=text('section','lesson-section');
 append(costs,text('div','lesson-eyebrow','ESCOLHAS DE IMPLEMENTAÇÃO'),text('h2','lesson-h2','Como fazer sem pagar'));
 const costGrid=text('div','lesson-cost-grid');
 for(const [cls,title,body] of [['free','CAMINHO LOCAL / R$ 0 DE SOFTWARE',page.free],['optional','SERVIÇO OU PAGO OPCIONAL',page.optional],['caution','ANTES DE CONFIAR',page.caution]]){
  const card=text('div','lesson-cost '+cls);append(card,text('h3','',title),text('p','',body));costGrid.appendChild(card)
 }costs.appendChild(costGrid);root.appendChild(costs);
 const exercise=text('section','lesson-section lesson-checks');
 append(exercise,text('div','lesson-eyebrow','NÃO BASTA LER'),text('h2','lesson-h2','Verifique o aprendizado'));
 const desc=text('p','lesson-body-text','Marque apenas o que você conseguiu confirmar. Este checklist é uma autoavaliação: não significa que o software foi testado automaticamente.');
 exercise.appendChild(desc);
 const checks=state.checks[String(page.number)]||[];
 const listChecks=text('div','lesson-check-list');
 page.checks.forEach((statement,i)=>{
  const label=text('label','lesson-check');
  const box=document.createElement('input');box.type='checkbox';box.checked=!!checks[i];
  box.addEventListener('change',()=>{
   const saved=Array.from({length:page.checks.length},(_,j)=>j===i?box.checked:!!(state.checks[String(page.number)]||[])[j]);
   state.checks[String(page.number)]=saved;save();updateCheckFeedback(page);
  });
  append(label,box,text('span','',statement));listChecks.appendChild(label);
 });
 exercise.appendChild(listChecks);
 exercise.appendChild(text('p','lesson-check-feedback',''));root.appendChild(exercise);
 if(page.links?.length){
  const resources=text('section','lesson-section');append(resources,text('h2','lesson-h2','Documentação para consultar'));
  const links=text('ul','lesson-resources');
  page.links.forEach(l=>{
    if(!/^https:\/\//.test(l.url))return;
    const a=text('a','',l.label+' ↗');a.href=l.url;a.target='_blank';a.rel='noopener noreferrer';
    links.appendChild(append(text('li',''),a));
  });resources.appendChild(links);root.appendChild(resources);
 }
 updateCheckFeedback(page);
}
function updateCheckFeedback(page){
 const checks=state.checks[String(page.number)]||[];
 const count=page.checks.filter((_,i)=>!!checks[i]).length;
 const feedback=$('reader-body').querySelector('.lesson-check-feedback');
 if(feedback)feedback.textContent=count+' de '+page.checks.length+' evidências verificadas por você.';
}
function showPage(n){
 const page=state.pages.find(p=>p.number===n);if(!page){showOverview();return}
 state.current=n;save();$('overview').hidden=true;$('reader').hidden=false;
 setTheme(n%2===0?'light':'dark');$('reader').dataset.density='dense';
 $('reader-category').textContent=page.chapter.toUpperCase();$('reader-page').textContent=two(n)+' / 40';
 $('breadcrumb-current').textContent=page.chapter.toUpperCase();
 $('reader-title').textContent=page.title;$('lesson-goal').textContent=page.objective||'Completar a aula e verificar o resultado descrito.';
 $('lesson-task').textContent=page.exercise||'Faça o exercício proposto e registre seus resultados.';
 $('lesson-status').textContent='';
 renderLesson(page);
 $('read-button').textContent=state.done.has(n)?'✓ Concluída — desmarcar':'Marcar aula como concluída ✓';
 $('read-button').setAttribute('aria-pressed',String(state.done.has(n)));
 $('prev-page').href=n===1?'#':'#pagina-'+two(n-1);
 $('prev-page').textContent=n===1?'← Visão geral':'← Aula '+two(n-1);
 $('next-page').href=n===40?'#':'#pagina-'+two(n+1);
 $('next-page').textContent=n===40?'Voltar ao índice ↗':'Próxima aula →';
 document.title=page.title+' | Guia Artisys';progress();
}
function route(){
 if(!state.pages.length)return;
 const match=(location.hash||'').match(/^#pagina-(\d{1,2})$/);
 const n=match?Number(match[1]):0;
 if(n>=1&&n<=40)showPage(n);else showOverview();
 closeMenu();
 window.scrollTo({top:0,behavior:'instant'});
 if(!state.firstRoute&&state.current)$('reader-title').focus({preventScroll:true});
 state.firstRoute=false;
}
function search(q){
 const box=$('search-results'),term=norm(q);
 box.replaceChildren();
 if(!term){box.hidden=true;return}
 const results=state.pages.filter(p=>norm([p.title,p.lead,...p.steps,p.prompt,p.example,p.free,p.optional,p.exercise].join(' ')).includes(term));
 box.appendChild(text('p','search-count',results.length+' aula(s) encontrada(s)'+(results.length>12?' · mostrando 12':'') ));
 for(const p of results.slice(0,12)){
 const link=text('a','search-result');link.href='#pagina-'+two(p.number);
 append(link,text('small','','AULA '+two(p.number)),text('span','',p.title));box.appendChild(link);
 }
 if(!results.length)box.appendChild(text('p','search-count','Tente outra palavra ou consulte o índice.'));
 box.hidden=false;
}
function closeMenu(){$('sidebar').classList.remove('open');$('nav-backdrop').hidden=true;$('menu-button').setAttribute('aria-expanded','false')}
async function init(){
 try{
  const responses=await Promise.all(paths.map(path=>fetch(path,{cache:'no-cache'})));
  if(responses.some(r=>!r.ok))throw Error('Falha ao baixar material didático');
  const chapters=await Promise.all(responses.map(r=>r.json()));
  const lessons=chapters.flat().sort((a,b)=>a.number-b.number);
  if(lessons.length!==40||lessons.some((p,i)=>p.number!==i+1||p.steps.length<5||p.checks.length<3||!p.prompt||!p.example))throw Error('Trilha didática incompleta');
  const old=await fetch('/guia/conteudo.json',{cache:'no-cache'});
  if(!old.ok)throw Error('Não foi possível carregar o índice');
  const original=await old.json();state.groups=original.groups;
  state.pages=lessons.map((p,i)=>({...p,chapter:original.pages[i].chapter,objective:original.pages[i].objective,exercise:original.pages[i].exercise}));
  cards();progress();route();
  $('search').addEventListener('input',e=>search(e.target.value));
  window.addEventListener('hashchange',route);
  $('read-button').addEventListener('click',()=>{
   if(!state.current)return;const n=state.current,wasDone=state.done.has(n);
   if(wasDone)state.done.delete(n);else state.done.add(n);save();showPage(n);
   $('lesson-status').textContent=wasDone?'Conclusão desmarcada neste navegador.':'Aula marcada como concluída neste navegador; confirme as evidências em seu próprio ambiente.';
  });
  $('print-button').addEventListener('click',()=>window.print());
  $('reader-theme-toggle').addEventListener('click',()=>setTheme($('reader').dataset.theme==='light'?'dark':'light'));
  $('menu-button').addEventListener('click',()=>{const open=$('sidebar').classList.toggle('open');$('nav-backdrop').hidden=!open;$('menu-button').setAttribute('aria-expanded',String(open))});
  $('nav-backdrop').addEventListener('click',closeMenu);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('sidebar').classList.contains('open')){closeMenu();$('menu-button').focus()}});
  document.addEventListener('click',e=>{if(e.target.closest?.('.nav-page,.search-result,.group-card'))closeMenu()});
 }catch(error){console.error(error);$('overview').replaceChildren(text('h1','','Não foi possível carregar as aulas.'),text('p','','Atualize a página. Se persistir, consulte o repositório e confira os arquivos /guia/aulas/.'))}
}
init();
})();
