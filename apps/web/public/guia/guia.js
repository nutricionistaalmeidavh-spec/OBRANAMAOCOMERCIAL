'use strict';
(() => {
const byId = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const source = '/guia/conteudo.json';
const completedKey = 'artisys-guide-read-v1';
const currentKey = 'artisys-guide-current-v1';
const readState=()=>{try{return new Set(JSON.parse(localStorage.getItem(completedKey)||'[]').map(Number).filter(n=>n>=1&&n<=40))}catch{return new Set()}};
const state={book:null,read:readState(),current:0};
let initialRoute=true;
function save(){try{localStorage.setItem(completedKey,JSON.stringify([...state.read]));if(state.current)localStorage.setItem(currentKey,String(state.current))}catch{}}
function codeBlock(raw,index) {
 const kind=/^name:\s/i.test(raw)?'YAML / GITHUB ACTIONS':/^>\s/.test(raw)?'COMANDOS / TERMINAL':'CÓDIGO / EXEMPLO';
 const source=String(raw);
 return `<figure class="code-example" aria-label="Exemplo de código"><figcaption class="code-toolbar"><span>${kind}</span><button class="copy-code" type="button" data-code="${esc(source)}" aria-label="Copiar exemplo de código">Copiar código</button></figcaption><pre tabindex="0"><code>${esc(source)}</code></pre><p class="code-hint">Exemplo didático: confira as dependências e teste numa branch ou ambiente local antes de aplicar ao seu projeto.</p></figure>`;
}
function codeLike(raw) {
 const val=String(raw).trim();
 return (/^(name:\s|>\s*(?:git|npm|node|npx)\b|(?:git|npm|node|npx)\s|\.github\/workflows\/)/i.test(val) || /\n\s*(?:runs-on:|steps:|- uses:|- run:)/.test(val));
}
function htmlContent(blocks){
 let out='',lead=true;
 for(let i=0;i<blocks.length;i++){
  const raw=String(blocks[i]||'').trim();if(!raw)continue;
  const normalized=raw.replace(/\s+/g,' ').trim();
  if(codeLike(raw)){out+=codeBlock(raw,i);lead=false;continue}
  if(/^PROMPT (PARA USAR|REUTILIZÁVEL|DO AGENTE|PARA O AGENTE)/i.test(normalized)||normalized==='PROMPT PARA USAR COM SEU AGENTE'){
    const prompt=String(blocks[++i]||'').trim().replace(/^[“"]|[”"]$/g,'');
    out+=`<div class="prompt-box"><div class="prompt-bar">PROMPT PARA COPIAR <button class="copy-prompt" type="button" data-prompt="${esc(prompt)}">Copiar prompt</button></div><div class="prompt-text">${esc(prompt)}</div></div>`;continue;
  }
  if(/^ROTA R\$\s*0/i.test(normalized)||/^NÚCLEO R\$\s*0/i.test(normalized)){
    const next=String(blocks[++i]||'').trim();out+=`<aside class="callout"><b>CAMINHO R$ 0</b>${esc(next)}</aside>`;continue;
  }
  if(/^ANTES DE CONFIAR/i.test(normalized)){
    const next=String(blocks[++i]||'').trim();out+=`<aside class="callout warning"><b>ANTES DE CONFIAR</b>${esc(next)}</aside>`;continue;
  }
  if(/^(CASO OU DECISÃO CENTRAL|HISTÓRIA DO USUÁRIO|COMO OS DADOS CIRCULAM|TERMINAL \/|CHECKLIST DE ACEITE|O QUE VOCÊ VAI APRENDER|NOSSO COMPROMISSO|REGRA DO GUIA)/i.test(normalized)){
    out+=`<div class="content-label">${esc(normalized)}</div>`;continue;
  }
  if(/^0[1-9]\s*\n/.test(raw)){
    const lines=raw.split('\n');out+=`<div class="step-card"><span class="step-n">${esc(lines.shift())}</span><div class="step-copy">${esc(lines.join('\n'))}</div></div>`;continue;
  }
  if(/^0[1-9]$/.test(normalized)&&i+1<blocks.length){
    const detail=[String(blocks[i+1]||''),String(blocks[i+2]||'')].filter(Boolean);
    out+=`<div class="step-card"><span class="step-n">${esc(normalized)}</span><div class="step-copy">${esc(detail.join('\n'))}</div></div>`;i+=2;continue;
  }
  const c=lead?'content-block content-lead':'content-block';
  out+=`<div class="${c}">${esc(raw)}</div>`;lead=false;
 }
 return out;
}
function chapterNav(){
 const dest=byId('chapter-nav'),grid=byId('overview-groups');
 dest.innerHTML=state.book.groups.map(g=>`<div class="nav-group"><div class="nav-group-title"><span>${esc(g.title)}</span><span>${g.from}–${g.to}</span></div>${state.book.pages.filter(p=>p.number>=g.from&&p.number<=g.to).map(p=>`<a class="nav-page" href="#pagina-${String(p.number).padStart(2,'0')}" data-number="${p.number}"><span class="nav-num">${String(p.number).padStart(2,'0')}</span><span>${esc(p.title)}</span></a>`).join('')}</div>`).join('');
 grid.innerHTML=state.book.groups.map((g,i)=>`<a class="group-card" href="#pagina-${String(g.from).padStart(2,'0')}"><span class="group-range">CAPÍTULO ${String(i+1).padStart(2,'0')} / PÁGINAS ${g.from}–${g.to}</span><div><strong>${esc(g.title)} ↗</strong><p>${g.to-g.from+1} lições práticas para explorar.</p></div></a>`).join('');
}
function progress(){
 byId('progress-bar').style.width=`${state.read.size/40*100}%`;
 byId('progress-label').textContent=`${state.read.size} de 40 páginas concluídas`;
 document.querySelectorAll('.nav-page').forEach(link=>link.classList.toggle('done',state.read.has(Number(link.dataset.number))));
}
function showOverview(){
 state.current=0;byId('overview').hidden=false;byId('reader').hidden=true;byId('breadcrumb-current').textContent='VISÃO GERAL';
 document.title='Do Prompt ao Software | Guia gratuito Artisys';
 document.querySelectorAll('.nav-page').forEach(x=>x.classList.remove('active'));
 let n=0;try{n=Number(localStorage.getItem(currentKey)||0)}catch{}
 const resume=byId('resume-button');resume.hidden=!(n>=1&&n<=40);
 if(!resume.hidden)resume.onclick=()=>{location.hash=`pagina-${String(n).padStart(2,'0')}`};
}
function showPage(n){
 const page=state.book.pages.find(p=>p.number===n);if(!page)return showOverview();
 state.current=n;save();byId('overview').hidden=true;byId('reader').hidden=false;
 const reader=byId('reader');
 reader.dataset.theme=n%2===0?'light':'dark';
 byId('reader-theme-toggle').textContent=reader.dataset.theme==='light'?'Usar fundo roxo':'Usar fundo claro';
 reader.dataset.density=page.blocks.join(' ').length>900||page.blocks.length>=18?'dense':'regular';
 byId('lesson-goal').textContent=page.objective;
 byId('lesson-task').textContent=page.exercise;
 byId('lesson-status').textContent='';
 byId('breadcrumb-current').textContent=page.chapter.toUpperCase();
 byId('reader-category').textContent=page.chapter.toUpperCase();
 byId('reader-page').textContent=`${String(n).padStart(2,'0')} / 40`;
 byId('reader-title').textContent=page.title;
 byId('reader-body').innerHTML=htmlContent(page.blocks);
 const button=byId('read-button');
 button.textContent=state.read.has(n)?'✓ Concluída · desfazer':'Marcar lição como concluída ✓';
 button.setAttribute('aria-pressed',String(state.read.has(n)));
 byId('prev-page').href=n===1?'#':'#pagina-'+String(n-1).padStart(2,'0');
 byId('prev-page').textContent=n===1?'← Visão geral':'← Página '+String(n-1).padStart(2,'0');
 byId('next-page').href=n===40?'#':'#pagina-'+String(n+1).padStart(2,'0');
 byId('next-page').textContent=n===40?'Voltar ao início ↗':'Próxima página →';
 document.title=`${page.title} | Guia Artisys`;
 document.querySelectorAll('.nav-page').forEach(link=>{const current=Number(link.dataset.number)===n;link.classList.toggle('active',current);if(current)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current')});
}
function route(){
 if(!state.book)return;
 const m=(location.hash||'').match(/^#pagina-(\d{1,2})$/);
 const n=m?Number(m[1]):0;
 if(n>=1&&n<=40)showPage(n);else showOverview();
 byId('sidebar').classList.remove('open');byId('menu-button').setAttribute('aria-expanded','false');
 byId('nav-backdrop').hidden=true;
 window.scrollTo({top:0,behavior:'instant'});
 if(!initialRoute&&state.current)byId('reader-title').focus({preventScroll:true});
 initialRoute=false;
}
function search(query){
 const box=byId('search-results');let q=query.toLocaleLowerCase('pt-BR').trim();if(!q){box.hidden=true;box.innerHTML='';return}
 const results=state.book.pages.filter(p=>(p.title+' '+p.chapter+' '+p.objective+' '+p.exercise+' '+p.blocks.join(' ')).toLocaleLowerCase('pt-BR').includes(q));
 const list=results.slice(0,12);
 box.innerHTML=list.length?'<p class="search-count">'+(results.length>12?'Exibindo 12 de '+results.length+' resultados. Refine a busca.':results.length+' resultado(s)')+'</p>'+list.map(p=>`<a class="search-result" href="#pagina-${String(p.number).padStart(2,'0')}"><small>PÁGINA ${p.number}</small>${esc(p.title)}</a>`).join(''):'<p class="search-result">Nenhum resultado encontrado.</p>';
 box.hidden=false;
}
async function init(){
 try{
 const response=await fetch(source,{cache:'no-cache'});if(!response.ok)throw Error('HTTP '+response.status);
 state.book=await response.json();
 if(!Array.isArray(state.book.pages)||state.book.pages.length!==40)throw Error('Índice incompleto');
 chapterNav();progress();route();
 byId('search').addEventListener('input',e=>search(e.target.value));
 window.addEventListener('hashchange',route);
 byId('read-button').addEventListener('click',()=>{
 if(!state.current)return;
 const n=state.current,done=state.read.has(n);
 if(done)state.read.delete(n);else state.read.add(n);
 save();progress();showPage(n);
 byId('lesson-status').textContent=done?
 `Lição ${n} desmarcada neste navegador.`:`Lição ${n} concluída neste navegador.`;
 });
 byId('print-button').addEventListener('click',()=>window.print());
 byId('reader-theme-toggle').addEventListener('click',()=>{
 const reader=byId('reader');
 reader.dataset.theme=reader.dataset.theme==='light'?'dark':'light';
 byId('reader-theme-toggle').textContent=reader.dataset.theme==='light'?'Usar fundo roxo':'Usar fundo claro';
 });
 const closeMenu=()=>{byId('sidebar').classList.remove('open');byId('nav-backdrop').hidden=true;byId('menu-button').setAttribute('aria-expanded','false')};
 byId('menu-button').addEventListener('click',()=>{const open=byId('sidebar').classList.toggle('open');byId('nav-backdrop').hidden=!open;byId('menu-button').setAttribute('aria-expanded',String(open))});
 byId('nav-backdrop').addEventListener('click',closeMenu);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&byId('sidebar').classList.contains('open')){closeMenu();byId('menu-button').focus()}});

 document.addEventListener('click',event=>{
  const btn=event.target.closest?.('[data-prompt], [data-code]');
  if(btn){
    const t=btn.getAttribute(btn.hasAttribute('data-code')?'data-code':'data-prompt')||'';
    if(!navigator.clipboard?.writeText){btn.textContent='Selecione e copie manualmente';return}
    navigator.clipboard.writeText(t).then(()=>{btn.textContent='Copiado ✓';btn.setAttribute('aria-label','Texto copiado')}).catch(()=>{btn.textContent='Selecione e copie manualmente'});
    return
  }
  if(event.target.closest?.('.nav-page,.search-result,.group-card'))closeMenu()
 });
 }catch(e){byId('overview').innerHTML='<h1>Não foi possível carregar o guia.</h1><p>Atualize a página ou tente novamente mais tarde.</p>';console.error(e)}
}
init();
})();