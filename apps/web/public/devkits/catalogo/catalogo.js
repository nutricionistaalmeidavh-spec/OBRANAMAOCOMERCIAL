const source = '/devkits/catalogo/kits.json';
const search = document.getElementById('kit-search');
const sort = document.getElementById('kit-sort');
const cats = document.getElementById('kit-categories');
const grid = document.getElementById('kit-grid');
const count = document.getElementById('result-count');
const more = document.getElementById('load-more');
const reset = document.getElementById('reset-filters');
const empty = document.getElementById('empty-result');
const emptyReset = document.getElementById('empty-reset');
const PAGE_SIZE = 12;
const PHONE = '5516982338805';
const formatter = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
let items=[], selected='all', visible=PAGE_SIZE;
function el(tag,cls,txt){const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e;}
function btn(tag,cls,label,href){const a=el(tag,cls,label);if(href)a.href=href;return a;}
function norm(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
function consultLink(item){return 'https://wa.me/'+PHONE+'?text='+encodeURIComponent('Olá, vim pelo catálogo DevKit Tool’s da ArtiSys e gostaria de consultar o kit '+item.title+' ('+item.id+'), disponibilidade e condições comerciais.');}
function card(item){
 const article=el('article','kit-card');article.id=item.id;
 const top=el('div','card-top');top.append(el('span','category',item.category),el('span','id',item.id.replace('kit-','#')));
 const icon=el('div','card-symbol','</>');icon.setAttribute('aria-hidden','true');
 article.append(top,icon,el('h3','',item.title),el('p','summary',item.summary));
 const meta=el('div','card-meta'),info=el('div','');
 info.append(el('small','','Preço sugerido'),el('strong','',formatter.format(item.suggestedPrice)));
 const link=btn('a','','Consultar ↗',consultLink(item));link.target='_blank';link.rel='noopener noreferrer';link.setAttribute('aria-label','Consultar '+item.title+' no WhatsApp');
 meta.append(info,link);article.append(meta);
 const details=el('details','technical'),sum=el('summary','','Detalhes técnicos');
 details.append(sum,el('p','',item.language+' · versão '+item.version));
 const tags=el('div','tech-tags');(item.technologies||[]).forEach(t=>tags.append(el('span','',t)));
 details.append(tags);article.append(details);
 return article;
}
function filtered(){
 const query=norm(search.value).trim();
 let r=items.filter(x=>(selected==='all'||x.category===selected)&&(!query||norm([x.title,x.category,x.summary,x.language,...x.technologies].join(' ')).includes(query)));
 if(sort.value==='name')r.sort((a,b)=>a.title.localeCompare(b.title,'pt-BR'));
 else if(sort.value==='price-asc')r.sort((a,b)=>a.suggestedPrice-b.suggestedPrice||a.id.localeCompare(b.id));
 else if(sort.value==='price-desc')r.sort((a,b)=>b.suggestedPrice-a.suggestedPrice||a.id.localeCompare(b.id));
 return r;
}
function render(){
 const matching=filtered(),showing=matching.slice(0,visible);
 grid.replaceChildren(...showing.map(card));
 count.textContent=matching.length===items.length?'63 kits disponíveis para explorar':matching.length+' kits encontrados de '+items.length;
 more.hidden=matching.length<=showing.length;more.textContent='Ver mais kits ('+(matching.length-showing.length)+') ↓';
 empty.hidden=matching.length!==0;grid.hidden=matching.length===0;
 reset.hidden=selected==='all'&&!search.value&&sort.value==='default';
}
function clear(){search.value='';selected='all';sort.value='default';visible=PAGE_SIZE;updateCategory();render();}
function updateCategory(){cats.querySelectorAll('button[data-category]').forEach(b=>{const yes=b.dataset.category===selected;b.classList.toggle('selected',yes);b.setAttribute('aria-pressed',String(yes));});}
function categories(){
 const counts=new Map();items.forEach(x=>counts.set(x.category,(counts.get(x.category)||0)+1));
 [...counts.entries()].forEach(([category,n])=>{const b=el('button','category-pill',category+' · '+n);b.type='button';b.dataset.category=category;b.setAttribute('aria-pressed','false');cats.append(b);});
 cats.addEventListener('click',e=>{const b=e.target.closest('button[data-category]');if(!b)return;selected=b.dataset.category;visible=PAGE_SIZE;updateCategory();render();});
}
search.addEventListener('input',()=>{visible=PAGE_SIZE;render();});
sort.addEventListener('change',()=>{visible=PAGE_SIZE;render();});
more.addEventListener('click',()=>{visible+=PAGE_SIZE;render();});
reset.addEventListener('click',clear);emptyReset.addEventListener('click',clear);
try{
 const response=await fetch(source,{cache:'default'});if(!response.ok)throw new Error('HTTP '+response.status);
 const data=await response.json();
 if(!Array.isArray(data.items)||data.items.length!==63||data.items.some(x=>!x.id||!x.title||!x.category||!Number.isFinite(x.suggestedPrice)))throw new Error('Catálogo indisponível');
 items=data.items;categories();render();
}catch(error){count.textContent='Não foi possível carregar os kits agora.';grid.querySelector('.loading strong').textContent='Catálogo temporariamente indisponível';console.error('DevKit catalog unavailable',error);}
