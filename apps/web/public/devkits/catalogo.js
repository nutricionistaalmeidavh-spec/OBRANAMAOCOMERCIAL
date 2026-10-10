import { compareCanonicalPrice } from './catalog-pricing.mjs';

const repoSearch=document.getElementById('repo-search');
if(repoSearch){
 const repoItems=[...document.querySelectorAll('.repo-guide-item')];
 const counter=document.getElementById('repo-count');
 const empty=document.getElementById('repo-empty');
 repoSearch.addEventListener('input',()=>{
   const term=norm(repoSearch.value.trim());let found=0;
   repoItems.forEach(node=>{const ok=!term||norm(node.dataset.search).includes(term);node.hidden=!ok;if(ok)found++;});
   counter.textContent=found+' de '+repoItems.length+' referências';
   empty.hidden=found!==0;
 });
}

const source = '/devkits/kits.json';
const search = document.getElementById('kit-search');
const sort = document.getElementById('kit-sort');
const cats = document.getElementById('kit-categories');
const categorySelect = document.getElementById('kit-category-select');
const grid = document.getElementById('kit-grid');
const count = document.getElementById('result-count');
const more = document.getElementById('load-more');
const reset = document.getElementById('reset-filters');
const empty = document.getElementById('empty-result');
const emptyReset = document.getElementById('empty-reset');
const PAGE_SIZE = 12;
const PHONE = '5516982338805';
const CHECKOUT_BASE = 'https://pagamentos-artisys-central.nutricionistaalmeidavh.workers.dev';
const CHECKOUT_CATALOG = CHECKOUT_BASE + '/v1/catalog';
const offerKey = value => norm(value).replace(/[^a-z0-9]/g,'');
let activeOffers = new Map();


const formatter = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
let items=[], selected='all', visible=PAGE_SIZE;
function el(tag,cls,txt){const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e;}
function btn(tag,cls,label,href){const a=el(tag,cls,label);if(href)a.href=href;return a;}
function norm(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
function consultLink(item){return 'https://wa.me/'+PHONE+'?text='+encodeURIComponent('Olá, vim pelo catálogo DevKit Tool’s da ArtiSys e gostaria de consultar o kit '+item.title+' ('+item.id+'), disponibilidade e condições comerciais.');}
function card(item){
 const offer=activeOffers.get(offerKey(item.title));
 const article=el('article','kit-card');article.id=item.id;
 const top=el('div','card-top');top.append(el('span','category',item.category),el('span','id',item.id.replace('kit-','#')));
 article.append(top,el('h3','',item.title),el('p','summary',item.summary));
 const meta=el('div','card-meta'),info=el('div','');
 info.append(el('small','',offer?'Preço':'Disponibilidade'),el('strong','',offer?formatter.format(offer.priceCents/100):'Em breve'));
 let action;
 if(offer){
  const url=CHECKOUT_BASE+'/comprar?oferta='+encodeURIComponent(offer.id);
  action=btn('a','','Comprar ↗',url);
  action.setAttribute('aria-label','Comprar '+item.title+' por '+formatter.format(offer.priceCents/100));
  action.referrerPolicy='no-referrer';
 }else{
  action=el('span','purchase-pending','Ainda não disponível');
  action.setAttribute('aria-label',item.title+' ainda não disponível para compra');
 }
 meta.append(info,action);article.append(meta);
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
 else if(sort.value==='price-asc'||sort.value==='price-desc'){
  const direction=sort.value==='price-asc'?1:-1;
  r.sort((a,b)=>compareCanonicalPrice(a,b,direction,activeOffers,offerKey));
 }
 return r;
}
function render(){
 const matching=filtered(),showing=matching.slice(0,visible);
 grid.replaceChildren(...showing.map(card));
 const available=items.reduce((n,x)=>n+Number(activeOffers.has(offerKey(x.title))),0);
 count.textContent=matching.length===items.length
  ?matching.length+' kits no catálogo · '+available+' disponíveis para compra'
  :matching.length+' kits encontrados de '+items.length+' · '+available+' à venda';
 more.hidden=matching.length<=showing.length;more.textContent='Ver mais kits ('+(matching.length-showing.length)+') ↓';
 empty.hidden=matching.length!==0;grid.hidden=matching.length===0;
 reset.hidden=selected==='all'&&!search.value&&sort.value==='default';
}
function clear(){search.value='';selected='all';sort.value='default';visible=PAGE_SIZE;updateCategory();render();}
function updateCategory(){cats.querySelectorAll('button[data-category]').forEach(b=>{const yes=b.dataset.category===selected;b.classList.toggle('selected',yes);b.setAttribute('aria-pressed',String(yes));});if(categorySelect)categorySelect.value=selected;}
function categories(){
 const counts=new Map();items.forEach(x=>counts.set(x.category,(counts.get(x.category)||0)+1));
 [...counts.entries()].forEach(([category,n])=>{const b=el('button','category-pill',category+' · '+n);b.type='button';b.dataset.category=category;b.setAttribute('aria-pressed','false');cats.append(b);if(categorySelect){const option=el('option','',category+' ('+n+')');option.value=category;categorySelect.append(option);}});
 cats.addEventListener('click',e=>{const b=e.target.closest('button[data-category]');if(!b)return;selected=b.dataset.category;visible=PAGE_SIZE;updateCategory();render();});
 categorySelect?.addEventListener('change',()=>{selected=categorySelect.value;visible=PAGE_SIZE;updateCategory();render();});
}
search.addEventListener('input',()=>{visible=PAGE_SIZE;render();});
sort.addEventListener('change',()=>{visible=PAGE_SIZE;render();});
more.addEventListener('click',()=>{visible+=PAGE_SIZE;render();});
reset.addEventListener('click',clear);emptyReset.addEventListener('click',clear);
try{
 const response=await fetch(source,{cache:'default'});if(!response.ok)throw new Error('HTTP '+response.status);
 const data=await response.json();
 if(!Array.isArray(data.items)||data.items.length!==63||data.items.some(x=>!x.id||!x.title||!x.category||!Number.isFinite(x.price)))throw new Error('Catálogo indisponível');
 items=data.items;categories();render();
 // O endpoint público expõe SOMENTE ofertas efetivamente publicadas no D1.
 // Não usar IDs de ZIPs, hashes ou rotas do R2 no código público.
 try{
  const publicResponse=await fetch(CHECKOUT_CATALOG,{mode:'cors',credentials:'omit',cache:'no-store'});
  if(!publicResponse.ok)throw new Error('checkout_catalog_http_'+publicResponse.status);
  const payload=await publicResponse.json();
  if(!Array.isArray(payload.offers))throw new Error('checkout_catalog_invalid');
  const candidates=new Map();
  for(const offer of payload.offers){
   if(!offer||typeof offer.id!=='string'||typeof offer.name!=='string'||!Number.isSafeInteger(offer.priceCents)||offer.priceCents<=0)continue;
   if(offer.deliveryMode!=='download'||offer.saleType!=='one_time')continue;
   const key=offerKey(offer.name);
   if(candidates.has(key)){candidates.delete(key);continue;}
   candidates.set(key,offer);
  }
  activeOffers=new Map(items.map(item=>[offerKey(item.title),candidates.get(offerKey(item.title))]).filter(([,offer])=>offer));
  render();
 }catch(error){
  console.warn('Vitrine sem confirmação de ofertas publicadas',error);
  // Falha fechada: nada de link de checkout para rascunhos ou catálogo indisponível.
 }
}catch(error){count.textContent='Não foi possível carregar os kits agora.';grid.querySelector('.loading strong').textContent='Catálogo temporariamente indisponível';console.error('DevKit catalog unavailable',error);}
