import { api } from './cloudflare-client';
import './owner-loja-online.css';

type LojaOnlineClient={
  company:{id:string;name:string};
  admin?:{id?:string;email?:string;name?:string;active?:boolean}|null;
  license:{id:string;plan?:string;status:string;startsAt?:string|null;expiresAt?:string|null;maxUsers:number;blockedReason?:string|null};
  accessStatus:string;
  accessible:boolean;
  userCount:number;
};
type LojaOnlineOverview={totalClients:number;active:number;expired:number;blocked:number;expiringSoon:number};
type LojaOnlineLicenseEvent={id:string;companyId:string;action:string;actor:string;createdAt:string;details?:Record<string,unknown>};
type LojaState={overview:LojaOnlineOverview;clients:LojaOnlineClient[];events:LojaOnlineLicenseEvent[];loaded:boolean;loading:boolean;error:string};

type CreateResponse={company:{id:string;name:string};admin?:{email?:string};license:{expiresAt?:string|null};temporaryPassword?:string};

const lojaState:LojaState={overview:{totalClients:0,active:0,expired:0,blocked:0,expiringSoon:0},clients:[],events:[],loaded:false,loading:false,error:''};
const esc=(value:unknown)=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
const formatDate=(value?:string|null)=>value?new Date(value).toLocaleDateString('pt-BR'):'Sem vencimento';
const message=(error:unknown)=>{const value=error as {message?:string;response?:{data?:{error?:string;message?:string}}};return value.response?.data?.message||value.response?.data?.error||value.message||'Não foi possível concluir.'};
const statusKey=(client:LojaOnlineClient)=>client.accessStatus==='ACTIVE'?'active':client.accessStatus==='EXPIRED'?'expired':client.accessStatus==='BLOCKED'?'blocked':'pending';
const statusLabel=(client:LojaOnlineClient)=>client.accessStatus==='ACTIVE'?'Ativa':client.accessStatus==='EXPIRED'?'Vencida':client.accessStatus==='BLOCKED'?'Bloqueada':client.accessStatus==='PENDING'?'Pendente':client.accessStatus;
const productLabel='Loja Online';

let observer:MutationObserver|null=null;
let scheduled=false;
let lastTemporaryAccess:CreateResponse|null=null;

async function refreshLojaOnline(){
  if(lojaState.loading)return;
  lojaState.loading=true;lojaState.error='';
  try{
    const [overview,companies,audit]=await Promise.all([
      api.get<LojaOnlineOverview>('/api/owner/loja-online/overview'),
      api.get<{companies:LojaOnlineClient[]}>('/api/owner/loja-online/companies'),
      api.get<{events?:LojaOnlineLicenseEvent[]}>('/api/owner/loja-online/license-audit'),
    ]);
    lojaState.overview=overview.data;
    lojaState.clients=companies.data.companies||[];
    lojaState.events=audit.data.events||[];
    lojaState.loaded=true;
  }catch(error){
    lojaState.error=message(error);
    lojaState.loaded=true;
  }finally{
    lojaState.loading=false;
    scheduleEnhance(true);
  }
}

function scheduleEnhance(forceLoja=false){
  if(scheduled)return;
  scheduled=true;
  queueMicrotask(()=>{scheduled=false;enhanceOwner(forceLoja)});
}

function currentView(){return document.querySelector<HTMLElement>('.owner-view')?.dataset.ownerCurrent||''}
function shellReady(){return location.hash==='#owner'&&Boolean(document.querySelector('[data-owner-shell]'))}

function ensureNav(){
  const nav=document.querySelector<HTMLElement>('.owner-nav');if(!nav)return;
  let button=nav.querySelector<HTMLButtonElement>('[data-loja-owner-nav]');
  if(!button){
    button=document.createElement('button');button.type='button';button.className='owner-nav-item';button.dataset.lojaOwnerNav='1';button.dataset.ownerView='loja';button.textContent=productLabel;
    const clients=nav.querySelector('[data-owner-view="clients"]');nav.insertBefore(button,clients||null);
    button.onclick=()=>openLojaView();
  }
  const active=currentView()==='loja';
  button.classList.toggle('is-active',active);button.setAttribute('aria-current',active?'page':'false');
  if(active)nav.querySelectorAll<HTMLButtonElement>('.owner-nav-item:not([data-loja-owner-nav])').forEach(item=>{item.classList.remove('is-active');item.setAttribute('aria-current','false')});
}

function metricAdd(key:string,increment:number){
  const strong=document.querySelector<HTMLElement>(`[data-metric="${key}"] strong`);if(!strong)return;
  if(!strong.dataset.lojaBase)strong.dataset.lojaBase=String(Number(strong.textContent||0)||0);
  const target=String(Number(strong.dataset.lojaBase||0)+increment);
  if(strong.textContent!==target)strong.textContent=target;
}

function ensureOverview(){
  const grid=document.querySelector<HTMLElement>('.owner-product-grid');if(!grid)return;
  metricAdd('companies',lojaState.overview.totalClients);
  metricAdd('licenses',lojaState.overview.totalClients);
  metricAdd('active',lojaState.overview.active);
  let card=grid.querySelector<HTMLElement>('[data-loja-product-card]');
  if(card)return;
  card=document.createElement('article');card.className='owner-product-card';card.dataset.lojaProductCard='1';
  const detail=lojaState.error?'Integração indisponível — abrir para tentar novamente.':`${lojaState.overview.totalClients} loja(s) cliente(s) · ${lojaState.overview.active} ativa(s).`;
  card.innerHTML=`<div class="owner-product-icon owner-product-icon-loja">LO</div><div><span class="owner-product-label">VAREJO / SaaS</span><h3>Loja Online</h3><p>${esc(detail)}</p></div><button type="button" class="owner-primary" data-loja-open>Gerenciar</button>`;
  card.querySelector<HTMLButtonElement>('[data-loja-open]')!.onclick=()=>openLojaView();
  grid.appendChild(card);
}

function ensureProductFilter(selectId:string){
  const select=document.getElementById(selectId) as HTMLSelectElement|null;if(!select||select.querySelector('option[value="loja-online"]'))return;
  const option=document.createElement('option');option.value='loja-online';option.textContent=productLabel;select.appendChild(option);
}

function lojaClientCard(client:LojaOnlineClient){
  const status=statusKey(client),search=`${client.company.name} ${client.admin?.email||''}`.toLowerCase();
  return `<article class="owner-client-card" data-owner-client data-loja-client-card data-product="loja-online" data-status="${status}" data-search="${esc(search)}"><div class="owner-client-main"><span class="owner-product-pill loja">Loja Online</span><span class="owner-status status-${status}">${esc(statusLabel(client))}</span><h3>${esc(client.company.name)}</h3><p>${esc(client.admin?.email||'Sem administrador')}</p></div><div class="owner-client-meta"><span>${esc(client.license.plan||'Manual')}</span><span>${client.userCount}/${client.license.maxUsers} usuário(s)</span><span>${client.license.expiresAt?`Validade ${esc(formatDate(client.license.expiresAt))}`:'Sem vencimento'}</span></div><button class="owner-secondary" type="button" data-loja-manage="${esc(client.company.id)}">Gerenciar licença</button></article>`;
}

function ensureClients(){
  ensureProductFilter('ownerClientProduct');
  const list=document.querySelector<HTMLElement>('.owner-client-list');if(!list)return;
  const paragraph=document.querySelector<HTMLElement>('.owner-view .owner-section-head p');if(paragraph&&paragraph.textContent?.includes('Obra na Mão e Débora Lactação'))paragraph.textContent='Busca única para Obra na Mão, Débora Lactação e Loja Online. As ações continuam específicas de cada produto.';
  list.querySelectorAll('[data-loja-client-card]').forEach(node=>node.remove());
  list.insertAdjacentHTML('beforeend',lojaState.clients.map(lojaClientCard).join(''));
  list.querySelectorAll<HTMLButtonElement>('[data-loja-manage]').forEach(button=>button.onclick=()=>openLojaView(button.dataset.lojaManage));
  document.getElementById('ownerClientProduct')?.dispatchEvent(new Event('change'));
}

function lojaLicenseRow(client:LojaOnlineClient){
  const status=statusKey(client);
  return `<article class="owner-license-row" data-owner-license data-loja-license-row data-product="loja-online" data-status="${status}"><div><span class="owner-product-pill loja">Loja Online</span><span class="owner-status status-${status}">${esc(statusLabel(client))}</span><strong>${esc(client.company.name)}</strong><small>${esc(client.admin?.email||'Sem administrador')}</small></div><div><span>${esc(client.license.plan||'Manual')}</span><small>${client.license.expiresAt?`Validade ${esc(formatDate(client.license.expiresAt))}`:'Sem vencimento definido'} · ${client.userCount}/${client.license.maxUsers} usuários</small></div><button class="owner-secondary" type="button" data-loja-manage="${esc(client.company.id)}">Gerenciar</button></article>`;
}

const actionLabel=(action:string)=>({
  'central.client.create':'Loja criada e licença liberada',
  'central.license.update':'Licença atualizada',
  'central.license.extend':'Licença estendida',
  'central.license.block':'Licença bloqueada',
  'central.license.unblock':'Licença desbloqueada',
  'superadmin.client.create':'Cliente criado',
  'superadmin.license.update':'Licença atualizada',
  'superadmin.license.extend':'Licença estendida',
  'superadmin.license.block':'Licença bloqueada',
  'superadmin.license.unblock':'Licença desbloqueada',
} as Record<string,string>)[action]||action;
function lojaHistoryRows(){
  return lojaState.events.map(event=>{
    const client=lojaState.clients.find(row=>row.company.id===event.companyId);
    return `<article class="owner-history-row" data-loja-history-row><div><span class="owner-product-pill loja">Loja Online</span><strong>${esc(actionLabel(event.action))}</strong><small>${esc(client?.company.name||event.companyId)}</small></div><div><span>${esc(event.actor||'Central Artisys')}</span><small>${esc(new Date(event.createdAt).toLocaleString('pt-BR'))}</small></div></article>`;
  }).join('');
}

function ensureLicenses(){
  ensureProductFilter('ownerLicenseProduct');
  const list=document.querySelector<HTMLElement>('.owner-license-list');if(list){list.querySelectorAll('[data-loja-license-row]').forEach(node=>node.remove());list.insertAdjacentHTML('beforeend',lojaState.clients.map(lojaLicenseRow).join(''));list.querySelectorAll<HTMLButtonElement>('[data-loja-manage]').forEach(button=>button.onclick=()=>openLojaView(button.dataset.lojaManage));}
  const history=document.querySelector<HTMLElement>('.owner-history-list');if(history){history.querySelectorAll('[data-loja-history-row]').forEach(node=>node.remove());history.insertAdjacentHTML('beforeend',lojaHistoryRows())}
  const paragraphs=[...document.querySelectorAll<HTMLElement>('.owner-view .owner-section-head p')];for(const p of paragraphs)if(p.textContent?.includes('dois produtos'))p.textContent='Últimos eventos de licenciamento dos três produtos.';
  document.getElementById('ownerLicenseProduct')?.dispatchEvent(new Event('change'));
}

function tempAccessCard(){
  if(!lastTemporaryAccess?.temporaryPassword)return '';
  return `<section class="owner-section loja-temp-password"><div class="owner-section-head"><div><span class="owner-eyebrow">PRIMEIRO ACESSO</span><h2>Credencial temporária gerada</h2><p>Copie agora e entregue ao administrador da loja. A senha não fica exposta novamente pela Central.</p></div></div><div class="loja-access-grid"><div><span>E-mail</span><strong>${esc(lastTemporaryAccess.admin?.email||'')}</strong></div><div><span>Senha temporária</span><strong id="lojaTemporaryPassword">${esc(lastTemporaryAccess.temporaryPassword)}</strong></div></div><button type="button" class="owner-secondary" id="lojaCopyAccess">Copiar acesso</button></section>`;
}

function lojaOverviewMetrics(){
  const o=lojaState.overview;
  return `<div class="owner-metrics"><article class="owner-metric"><span>Lojas</span><strong>${o.totalClients}</strong><small>Tenants clientes</small></article><article class="owner-metric"><span>Ativas</span><strong>${o.active}</strong><small>Acesso liberado</small></article><article class="owner-metric"><span>Vencendo</span><strong>${o.expiringSoon}</strong><small>Próximos 30 dias</small></article><article class="owner-metric"><span>Bloqueadas</span><strong>${o.blocked}</strong><small>Acesso suspenso</small></article></div>`;
}

function lojaTable(){
  if(!lojaState.clients.length)return '<div class="owner-empty">Nenhuma loja cliente cadastrada.</div>';
  return `<div class="owner-client-list">${lojaState.clients.map(client=>`<article class="owner-client-card loja-management-card"><div class="owner-client-main"><span class="owner-status status-${statusKey(client)}">${esc(statusLabel(client))}</span><h3>${esc(client.company.name)}</h3><p>${esc(client.admin?.email||'Sem administrador')}</p></div><div class="owner-client-meta"><span>${esc(client.license.plan||'Manual')}</span><span>${client.userCount}/${client.license.maxUsers} usuários</span><span>Validade ${esc(formatDate(client.license.expiresAt))}</span></div><div class="owner-form-actions row"><button type="button" class="owner-secondary" data-loja-edit="${esc(client.company.id)}">Editar licença</button><button type="button" class="owner-secondary" data-loja-extend="${esc(client.company.id)}">Estender +6 meses</button>${client.accessStatus==='BLOCKED'?`<button type="button" class="owner-primary" data-loja-unblock="${esc(client.company.id)}">Desbloquear</button>`:`<button type="button" class="owner-danger" data-loja-block="${esc(client.company.id)}">Bloquear</button>`}</div></article>`).join('')}</div>`;
}

function lojaViewHtml(focusId?:string){
  const error=lojaState.error?`<section class="owner-section"><div class="owner-empty">${esc(lojaState.error)} <button class="owner-secondary" type="button" id="lojaRetry">Tentar novamente</button></div></section>`:'';
  return `<div data-loja-view data-focus-id="${esc(focusId||'')}"><section class="owner-product-banner loja"><div><span class="owner-eyebrow">PRODUTO</span><h2>Loja Online</h2><p>Provisionamento empresarial, usuários e licenças. A Loja Online permanece como fonte de verdade.</p></div><div class="owner-banner-stats"><strong>${lojaState.overview.totalClients}</strong><span>lojas clientes</span></div></section>${error}${tempAccessCard()}<section class="owner-section owner-form-section"><div class="owner-section-head"><div><span class="owner-eyebrow">LOJA ONLINE</span><h2>Nova loja cliente</h2><p>Cria o tenant, o administrador e a licença inicial em uma única operação.</p></div></div><form id="lojaOnlineCompanyForm" class="owner-form-card"><div class="owner-form-grid"><label>Empresa / Loja<input name="companyName" required maxlength="120" placeholder="Nome da loja"></label><label>Nome do administrador<input name="adminName" required maxlength="120" placeholder="Nome do responsável"></label><label>E-mail do administrador<input name="adminEmail" type="email" required placeholder="admin@loja.com"></label><label>Plano<select name="plan"><option value="1_MONTH">1 mês</option><option value="3_MONTHS">3 meses</option><option value="6_MONTHS" selected>6 meses</option><option value="12_MONTHS">12 meses</option></select></label><label>Duração em meses<select name="months"><option value="1">1 mês</option><option value="3">3 meses</option><option value="6" selected>6 meses</option><option value="12">12 meses</option></select></label><label>Máximo de usuários<input name="maxUsers" type="number" min="1" max="1000" value="5" required></label></div><div class="owner-form-actions"><button class="owner-primary" type="submit">Criar loja e liberar licença</button><p id="lojaCreateResult" role="status"></p></div></form></section><section class="owner-section"><div class="owner-section-head"><div><span class="owner-eyebrow">CARTEIRA</span><h2>Lojas e licenças</h2><p>Gerencie validade, limite de usuários e bloqueio sem duplicar os dados no banco da Central.</p></div></div>${lojaOverviewMetrics()}${lojaTable()}</section></div>`;
}

function openLojaView(focusId?:string){
  const view=document.querySelector<HTMLElement>('.owner-view');if(!view)return;
  view.dataset.ownerCurrent='loja';view.innerHTML=lojaViewHtml(focusId);ensureNav();bindLojaView();
  if(!lojaState.loaded&&!lojaState.loading)void refreshLojaOnline();
  if(focusId)window.setTimeout(()=>document.querySelector(`[data-loja-edit="${CSS.escape(focusId)}"]`)?.scrollIntoView({behavior:'smooth',block:'center'}),0);
}

function showLicenseEditor(client:LojaOnlineClient){
  let dialog=document.getElementById('lojaLicenseDialog') as HTMLDialogElement|null;
  if(!dialog){dialog=document.createElement('dialog');dialog.id='lojaLicenseDialog';dialog.className='loja-license-dialog';document.body.appendChild(dialog)}
  dialog.innerHTML=`<form method="dialog" class="owner-form-card"><div class="owner-section-head"><div><span class="owner-eyebrow">LOJA ONLINE</span><h2>Editar licença</h2><p>${esc(client.company.name)}</p></div><button value="cancel" class="owner-secondary" type="submit">Fechar</button></div><div class="owner-form-grid"><label>Plano<input name="plan" value="${esc(client.license.plan||'MANUAL')}"></label><label>Máximo de usuários<input name="maxUsers" type="number" min="1" max="1000" value="${client.license.maxUsers}"></label><label>Vencimento<input name="expiresAt" type="date" value="${esc(client.license.expiresAt?.slice(0,10)||'')}"></label></div><div class="owner-form-actions"><button value="save" class="owner-primary" type="submit">Salvar licença</button></div></form>`;
  dialog.addEventListener('close',async()=>{if(dialog?.returnValue!=='save')return;const form=dialog.querySelector('form') as HTMLFormElement,values=new FormData(form),expires=String(values.get('expiresAt')||'');try{await api.put(`/api/owner/loja-online/companies/${encodeURIComponent(client.company.id)}/license`,{plan:values.get('plan'),maxUsers:Number(values.get('maxUsers')),expiresAt:expires?`${expires}T23:59:59.999Z`:null,status:client.license.status,startsAt:client.license.startsAt||null});await refreshLojaOnline();openLojaView(client.company.id)}catch(error){alert(message(error))}},{once:true});
  dialog.showModal();
}

async function mutateCompany(id:string,action:'extend'|'block'|'unblock'){
  const client=lojaState.clients.find(item=>item.company.id===id);if(!client)return;
  if(action==='block'&&!window.confirm(`Bloquear o acesso da loja ${client.company.name}?`))return;
  if(action==='unblock'&&!window.confirm(`Desbloquear o acesso da loja ${client.company.name}?`))return;
  try{
    if(action==='extend')await api.post(`/api/owner/loja-online/companies/${encodeURIComponent(id)}/extend`,{months:6});
    if(action==='block')await api.post(`/api/owner/loja-online/companies/${encodeURIComponent(id)}/block`,{reason:'Acesso suspenso pela Artisys'});
    if(action==='unblock')await api.post(`/api/owner/loja-online/companies/${encodeURIComponent(id)}/unblock`,{});
    await refreshLojaOnline();openLojaView(id);
  }catch(error){alert(message(error))}
}

function bindLojaView(){
  document.getElementById('lojaRetry')?.addEventListener('click',()=>{lojaState.loaded=false;void refreshLojaOnline()});
  const copy=document.getElementById('lojaCopyAccess');if(copy)copy.addEventListener('click',async()=>{const email=lastTemporaryAccess?.admin?.email||'',password=lastTemporaryAccess?.temporaryPassword||'';try{await navigator.clipboard.writeText(`E-mail: ${email}\nSenha temporária: ${password}`);copy.textContent='Acesso copiado'}catch{copy.textContent='Copie os dados acima'}});
  const form=document.getElementById('lojaOnlineCompanyForm') as HTMLFormElement|null;
  if(form){
    const months=form.elements.namedItem('months') as HTMLSelectElement,plan=form.elements.namedItem('plan') as HTMLSelectElement;
    months.onchange=()=>{plan.value=months.value==='1'?'1_MONTH':`${months.value}_MONTHS`};
    form.onsubmit=async event=>{event.preventDefault();const submit=form.querySelector<HTMLButtonElement>('button[type="submit"]')!,result=document.getElementById('lojaCreateResult')!,values=new FormData(form);submit.disabled=true;result.textContent='Criando tenant e licença…';try{const response=await api.post<CreateResponse>('/api/owner/loja-online/companies',{companyName:values.get('companyName'),adminName:values.get('adminName'),adminEmail:values.get('adminEmail'),plan:values.get('plan'),months:Number(values.get('months')),maxUsers:Number(values.get('maxUsers'))});lastTemporaryAccess=response.data;result.textContent='Loja criada e licença liberada.';form.reset();await refreshLojaOnline();openLojaView(response.data.company.id)}catch(error){result.textContent=message(error)}finally{submit.disabled=false}};
  }
  document.querySelectorAll<HTMLButtonElement>('[data-loja-edit]').forEach(button=>button.onclick=()=>{const client=lojaState.clients.find(item=>item.company.id===button.dataset.lojaEdit);if(client)showLicenseEditor(client)});
  document.querySelectorAll<HTMLButtonElement>('[data-loja-extend]').forEach(button=>button.onclick=()=>void mutateCompany(button.dataset.lojaExtend!,'extend'));
  document.querySelectorAll<HTMLButtonElement>('[data-loja-block]').forEach(button=>button.onclick=()=>void mutateCompany(button.dataset.lojaBlock!,'block'));
  document.querySelectorAll<HTMLButtonElement>('[data-loja-unblock]').forEach(button=>button.onclick=()=>void mutateCompany(button.dataset.lojaUnblock!,'unblock'));
}

function enhanceOwner(forceLoja=false){
  if(!shellReady())return;
  ensureNav();
  const view=currentView();
  if(!lojaState.loaded&&!lojaState.loading)void refreshLojaOnline();
  if(forceLoja&&view==='loja'){openLojaView();return}
  if(view==='overview')ensureOverview();
  if(view==='clients')ensureClients();
  if(view==='licenses')ensureLicenses();
  if(view==='loja'&&!document.querySelector('[data-loja-view]'))openLojaView();
}

function install(){
  if(location.hash!=='#owner'||observer)return;
  observer=new MutationObserver(()=>scheduleEnhance());observer.observe(document.body,{subtree:true,childList:true});scheduleEnhance();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
