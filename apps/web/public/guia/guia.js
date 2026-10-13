'use strict';
(() => {
const byId = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const source = '/guia/conteudo.json';
const completedKey = 'artisys-guide-read-v1';
const currentKey = 'artisys-guide-current-v1';
const readState=()=>{try{return new Set(JSON.parse(localStorage.getItem(completedKey)||'[]').map(Number).filter(n=>n>=1&&n<=40))}catch{return new Set()}};
const learningGoals=["Entender a proposta do guia","Reconhecer o papel da IA e da validação humana","Visualizar as etapas até a publicação","Distinguir rotas de R$ 0 e alternativas opcionais","Investigar o problema antes de programar","Pesquisar concorrentes com evidências","Documentar escopo para humanos e agentes","Definir um MVP que possa ser testado","Selecionar a plataforma mais adequada","Escolher arquitetura por consequências","Entender o que torna um assistente um agente","Avaliar agentes e modelos conforme a necessidade","Produzir contexto que reduza retrabalho","Entender integrações, apps e MCP","Diferenciar Git de GitHub","Entender acessos e limites de integração","Organizar um repositório sustentável","Comparar repositórios públicos e privados","Entender o funcionamento do GitHub Actions","Ler um workflow YAML mínimo","Investigar um pipeline com método","Compreender deploy automático no Pages","Separar interface estática de backend","Planejar recuperação e reversão","Avaliar custos por componente","Montar uma stack gratuita","Proteger dados por modelagem e backup","Entender as peças da IA local","Revisar dados obtidos por OCR","Desenhar uma automação rastreável","Aprender com a geração de documentos de RH","Compreender o fluxo operacional de um PDV","Entender os limites de um app desktop-web","Relacionar testes e risco de release","Tratar segredos e permissões com cuidado","Definir critérios do miniestoque","Compreender a arquitetura do exemplo","Executar e conferir o projeto","Separar verificações de publicação","Consolidar o aprendizado"];
const learningTasks=["Escreva um problema real que você gostaria de resolver.","Separe duas decisões em que a IA ajuda e a validação humana é indispensável.","Desenhe as seis etapas do fluxo de desenvolvimento.","Identifique qual caminho sem assinaturas é viável no seu computador.","Descreva o problema de um usuário sem falar em telas ou código.","Compare dois concorrentes com fonte e data verificáveis.","Rascunhe um PRD de uma página para sua ideia.","Escreva critérios de aceite para uma regra válida e uma inválida.","Explique se seu caso pede script, desktop ou web.","Peça três arquiteturas e justifique a escolhida.","Liste as ferramentas que seu agente pode realmente acionar.","Compare IA local e agente online em termos de limites e custos.","Escreva um prompt com contexto, restrições e evidências de pronto.","Liste permissões mínimas para uma integração.","Faça um commit local e explique a diferença de um push.","Separe as permissões de ler, editar e publicar no GitHub.","Desenhe a estrutura src, tests e docs do projeto.","Escolha público ou privado e aponte os riscos de exposição.","Identifique evento, runner, job e passos de um workflow.","Rascunhe um YAML mínimo que testa o projeto.","Registre um erro real e a evidência de correção.","Desenhe como GitHub e Cloudflare participam do deploy.","Marque o que roda no navegador e o que precisa de backend.","Escreva como voltaria à última versão funcional.","Separe custo obrigatório de serviço pago opcional.","Desenhe frontend, API e banco para um MVP local.","Planeje uma restauração testada do banco.","Explique por que um modelo local sozinho não edita o Git.","Liste os campos que um OCR precisa validar.","Trace entrada, validação, geração e conferência de um documento.","Escreva como evitar troca de documentos entre funcionários.","Trace o efeito de uma venda em caixa e estoque.","Separe as funções do desktop e do portal online.","Escolha um teste funcional e um de carga.","Aponte quais dados nunca devem aparecer no repositório.","Defina as regras mínimas de um miniestoque.","Desenhe browser → API Node → SQLite.","Faça entrada 10, saída 3 e verifique saldo 7.","Diferencie Actions de deploy e informe qual preview publica.","Use o checklist final para planejar a próxima versão."];
const state={book:null,read:readState(),current:0};
let initialRoute=true;
function save(){try{localStorage.setItem(completedKey,JSON.stringify([...state.read]));if(state.current)localStorage.setItem(currentKey,String(state.current))}catch{}}
function htmlContent(blocks){
 let out='',lead=true;
 for(let i=0;i<blocks.length;i++){
  const raw=String(blocks[i]||'').trim();if(!raw)continue;
  const normalized=raw.replace(/\s+/g,' ').trim();
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
 byId('lesson-goal').textContent=learningGoals[n-1];
 byId('lesson-task').textContent=learningTasks[n-1];
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
 const list=state.book.pages.filter(p=>(p.title+' '+p.chapter+' '+p.blocks.join(' ')).toLocaleLowerCase('pt-BR').includes(q)).slice(0,12);
 box.innerHTML=list.length?'<p class="search-count">'+list.length+' resultado(s)</p>'+list.map(p=>`<a class="search-result" href="#pagina-${String(p.number).padStart(2,'0')}"><small>PÁGINA ${p.number}</small>${esc(p.title)}</a>`).join(''):'<p class="search-result">Nenhum resultado encontrado.</p>';
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
  const btn=event.target.closest?.('[data-prompt]');
  if(btn){
    const t=btn.getAttribute('data-prompt')||'';
    if(!navigator.clipboard?.writeText){btn.textContent='Selecione e copie o texto acima';return}
    navigator.clipboard.writeText(t).then(()=>{btn.textContent='Copiado ✓'}).catch(()=>{btn.textContent='Selecione e copie o texto acima'});
    return
  }
  if(event.target.closest?.('.nav-page,.search-result,.group-card'))closeMenu()
 });
 }catch(e){byId('overview').innerHTML='<h1>Não foi possível carregar o guia.</h1><p>Atualize a página ou tente novamente mais tarde.</p>';console.error(e)}
}
init();
})();