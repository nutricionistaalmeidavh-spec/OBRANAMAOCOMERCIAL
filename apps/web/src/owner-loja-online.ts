import { api } from './cloudflare-client';
import './owner-loja-online.css';

type LojaOnlineClient={company:{id:string;name:string};admin?:{email?:string;name?:string}|null;license:{id:string;plan?:string;status:string;startsAt?:string|null;expiresAt?:string|null;maxUsers:number;blockedReason?:string|null};accessStatus:string;accessible:boolean;userCount:number};
type LojaOnlineOverview={totalClients:number;active:number;expired:number;blocked:number;expiringSoon:number};
type LojaOnlineLicenseEvent={id:string;companyId:string;action:string;actor:string;createdAt:string;details?:Record<string,unknown>};
type CreateResponse={company:{id:string;name:string};admin?:{email?:string};license:{expiresAt?:string|null};temporaryPassword?:string};

const SEO_PANEL_URL='https://deboralactacao.com/admin/seo/?context=loja-online';
const overview:LojaOnlineOverview={totalClients:0,active:0,expired:0,blocked:0,expiringSoon:0};
const state={overview,clients:[] as LojaOnlineClient[],events:[] as LojaOnlineLicenseEvent[],loaded:false,loading:false,error:''};
let temporary:CreateResponse|null=null;
let observer:MutationObserver|null=null;
let scheduled=false;

const esc=(value:unknown)=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
const apiMessage=(error:unknown)=>{const value=error as {message?:string;response?:{data?:{error?:string;message?:string}}};return value.response?.data?.message||value.response?.data?.error||value.message||'Não foi possível concluir.'};
const dateBR=(value?:string|null)=>value?new Date(value).toLocaleDateString('pt-BR'):'Sem vencimento';
const view=()=>document.querySelector<HTMLElement>('.owner-view');
const currentView=()=>view()?.dataset.ownerCurrent||'';
const statusKey=(client:LojaOnlineClient)=>client.accessStatus==='ACTIVE'?'active':client.accessStatus==='EXPIRED'?'expired':client.accessStatus==='BLOCKED'?'blocked':'pending';
const statusText=(client:LojaOnlineClient)=>client.accessStatus==='ACTIVE'?'Ativa':client.accessStatus==='EXPIRED'?'Vencida':client.accessStatus==='BLOCKED'?'Bloqueada':'Pendente';

function observe(){if(observer)observer.observe(document.body,{childList:true,subtree:true})}
function schedule(force=false){
  if(scheduled)return;
  scheduled=true;
  queueMicrotask(()=>{
    scheduled=false;
    observer?.disconnect();
    try{enhance(force)}finally{observe()}
  });
}

async function refresh(){
  if(state.loading)return;
  state.loading=true;state.error='';
  try{
    const [o,c,a]=await Promise.all([
      api.get<LojaOnlineOverview>('/api/owner/loja-online/overview'),
      api.get<{companies:LojaOnlineClient[]}>('/api/owner/loja-online/companies'),
      api.get<{events?:LojaOnlineLicenseEvent[]}>('/api/owner/loja-online/license-audit'),
    ]);
    Object.assign(state.overview,o.data);state.clients=c.data.companies||[];state.events=a.data.events||[];state.loaded=true;
  }catch(error){state.error=apiMessage(error);state.loaded=true}
  finally{state.loading=false;schedule(true)}
}

function ensureNav(){
  const nav=document.querySelector<HTMLElement>('.owner-nav');if(!nav)return;
  let button=nav.querySelector<HTMLButtonElement>('[data-loja-owner-nav]');
  if(!button){button=document.createElement('button');button.type='button';button.className='owner-nav-item';button.dataset.lojaOwnerNav='1';button.dataset.ownerView='loja';button.textContent='Loja Online';button.onclick=()=>openLoja();nav.insertBefore(button,nav.querySelector('[data-owner-view="clients"]'))}
  const active=currentView()==='loja';button.classList.toggle('is-active',active);button.setAttribute('aria-current',active?'page':'false');
  if(active)nav.querySelectorAll<HTMLButtonElement>('.owner-nav-item:not([data-loja-owner-nav])').forEach(item=>{item.classList.remove('is-active');item.setAttribute('aria-current','false')});
}

function addMetric(key:string,increment:number){
  const node=document.querySelector<HTMLElement>(`[data-metric="${key}"] strong`);if(!node)return;
  if(node.dataset.lojaBase===undefined)node.dataset.lojaBase=String(Number(node.textContent||0)||0);
  const next=String(Number(node.dataset.lojaBase)+increment);if(node.textContent!==next)node.textContent=next;
}

function ensureOverview(){
  const grid=document.querySelector<HTMLElement>('.owner-product-grid');if(!grid)return;
  addMetric('companies',state.overview.totalClients);addMetric('licenses',state.overview.totalClients);addMetric('active',state.overview.active);
  if(grid.querySelector('[data-loja-product-card]'))return;
  const card=document.createElement('article');card.className='owner-product-card';card.dataset.lojaProductCard='1';
  card.innerHTML=`<div class="owner-product-icon owner-product-icon-loja">LO</div><div><span class="owner-product-label">VAREJO / SaaS</span><h3>Loja Online</h3><p>${state.error?esc(state.error):`${state.overview.totalClients} loja(s) · ${state.overview.active} ativa(s).`}</p></div><div class="owner-form-actions row"><a class="owner-secondary" href="${SEO_PANEL_URL}" target="_blank" rel="noopener">Abrir painel SEO</a><button type="button" class="owner-primary" data-loja-open>Gerenciar</button></div>`;
  card.querySelector<HTMLButtonElement>('[data-loja-open]')!.onclick=()=>openLoja();grid.appendChild(card);
}

function ensureOption(id:string){const select=document.getElementById(id) as HTMLSelectElement|null;if(!select||select.querySelector('option[value="loja-online"]'))return;const option=document.createElement('option');option.value='loja-online';option.textContent='Loja Online';select.appendChild(option)}
function clientCard(client:LojaOnlineClient){const status=statusKey(client);return `<article class="owner-client-card" data-owner-client data-loja-client data-product="loja-online" data-status="${status}" data-search="${esc(`${client.company.name} ${client.admin?.email||''}`.toLowerCase())}"><div class="owner-client-main"><span class="owner-product-pill loja">Loja Online</span><span class="owner-status status-${status}">${statusText(client)}</span><h3>${esc(client.company.name)}</h3><p>${esc(client.admin?.email||'Sem administrador')}</p></div><div class="owner-client-meta"><span>${esc(client.license.plan||'Manual')}</span><span>${client.userCount}/${client.license.maxUsers} usuário(s)</span><span>${dateBR(client.license.expiresAt)}</span></div><button type="button" class="owner-secondary" data-loja-manage="${esc(client.company.id)}">Gerenciar licença</button></article>`}
function licenseRow(client:LojaOnlineClient){const status=statusKey(client);return `<article class="owner-license-row" data-owner-license data-loja-license data-product="loja-online" data-status="${status}"><div><span class="owner-product-pill loja">Loja Online</span><span class="owner-status status-${status}">${statusText(client)}</span><strong>${esc(client.company.name)}</strong><small>${esc(client.admin?.email||'Sem administrador')}</small></div><div><span>${esc(client.license.plan||'Manual')}</span><small>${dateBR(client.license.expiresAt)} · ${client.userCount}/${client.license.maxUsers} usuários</small></div><button type="button" class="owner-secondary" data-loja-manage="${esc(client.company.id)}">Gerenciar</button></article>`}
const actionText=(action:string)=>({'central.client.create':'Loja criada e licença liberada','central.license.update':'Licença atualizada','central.license.extend':'Licença estendida','central.license.block':'Licença bloqueada','central.license.unblock':'Licença desbloqueada','superadmin.client.create':'Cliente criado','superadmin.license.update':'Licença atualizada','superadmin.license.extend':'Licença estendida','superadmin.license.block':'Licença bloqueada','superadmin.license.unblock':'Licença desbloqueada'} as Record<string,string>)[action]||action;
function historyRow(event:LojaOnlineLicenseEvent){const client=state.clients.find(row=>row.company.id===event.companyId);return `<article class="owner-history-row" data-loja-history><div><span class="owner-product-pill loja">Loja Online</span><strong>${esc(actionText(event.action))}</strong><small>${esc(client?.company.name||event.companyId)}</small></div><div><span>${esc(event.actor||'Central Artisys')}</span><small>${esc(new Date(event.createdAt).toLocaleString('pt-BR'))}</small></div></article>`}
function bindManageButtons(root:ParentNode=document){root.querySelectorAll<HTMLButtonElement>('[data-loja-manage]').forEach(button=>button.onclick=()=>openLoja(button.dataset.lojaManage))}

function ensureClients(){
  ensureOption('ownerClientProduct');const list=document.querySelector<HTMLElement>('.owner-client-list');if(!list)return;
  list.querySelectorAll('[data-loja-client]').forEach(node=>node.remove());list.insertAdjacentHTML('beforeend',state.clients.map(clientCard).join(''));bindManageButtons(list);
  const p=document.querySelector<HTMLElement>('.owner-view .owner-section-head p');if(p?.textContent?.includes('Obra na Mão e Débora Lactação'))p.textContent='Busca única para Obra na Mão, Débora Lactação e Loja Online. As ações continuam específicas de cada produto.';
  document.getElementById('ownerClientProduct')?.dispatchEvent(new Event('change'));
}
function ensureLicenses(){
  ensureOption('ownerLicenseProduct');const list=document.querySelector<HTMLElement>('.owner-license-list');if(list){list.querySelectorAll('[data-loja-license]').forEach(node=>node.remove());list.insertAdjacentHTML('beforeend',state.clients.map(licenseRow).join(''));bindManageButtons(list)}
  const history=document.querySelector<HTMLElement>('.owner-history-list');if(history){history.querySelectorAll('[data-loja-history]').forEach(node=>node.remove());history.insertAdjacentHTML('beforeend',state.events.map(historyRow).join(''))}
  document.getElementById('ownerLicenseProduct')?.dispatchEvent(new Event('change'));
}

function accessCard(){if(!temporary?.temporaryPassword)return '';return `<section class="owner-section loja-temp-password"><div class="owner-section-head"><div><span class="owner-eyebrow">PRIMEIRO ACESSO</span><h2>Credencial temporária gerada</h2><p>Copie agora. Esta senha só veio na resposta de criação e não é consultada novamente pela Central.</p></div></div><div class="loja-access-grid"><div><span>E-mail</span><strong>${esc(temporary.admin?.email||'')}</strong></div><div><span>Senha temporária</span><strong>${esc(temporary.temporaryPassword)}</strong></div></div><div class="owner-form-actions row"><button id="lojaCopyAccess" type="button" class="owner-secondary">Copiar acesso</button><button id="lojaHideAccess" type="button" class="owner-secondary">Ocultar</button></div></section>`}
function metrics(){const o=state.overview;return `<div class="owner-metrics"><article class="owner-metric"><span>Lojas</span><strong>${o.totalClients}</strong><small>Tenants clientes</small></article><article class="owner-metric"><span>Ativas</span><strong>${o.active}</strong><small>Acesso liberado</small></article><article class="owner-metric"><span>Vencendo</span><strong>${o.expiringSoon}</strong><small>Próximos 30 dias</small></article><article class="owner-metric"><span>Bloqueadas</span><strong>${o.blocked}</strong><small>Acesso suspenso</small></article></div>`}
function managementCards(){if(!state.clients.length)return '<div class="owner-empty">Nenhuma loja cliente cadastrada.</div>';return `<div class="owner-client-list">${state.clients.map(client=>`<article class="owner-client-card loja-management-card"><div class="owner-client-main"><span class="owner-status status-${statusKey(client)}">${statusText(client)}</span><h3>${esc(client.company.name)}</h3><p>${esc(client.admin?.email||'Sem administrador')}</p></div><div class="owner-client-meta"><span>${esc(client.license.plan||'Manual')}</span><span>${client.userCount}/${client.license.maxUsers} usuários</span><span>Validade ${dateBR(client.license.expiresAt)}</span></div><div class="owner-form-actions row"><button type="button" class="owner-secondary" data-loja-edit="${esc(client.company.id)}">Editar licença</button><button type="button" class="owner-secondary" data-loja-extend="${esc(client.company.id)}">Estender +6 meses</button>${client.accessStatus==='BLOCKED'?`<button type="button" class="owner-primary" data-loja-unblock="${esc(client.company.id)}">Desbloquear</button>`:`<button type="button" class="owner-danger" data-loja-block="${esc(client.company.id)}">Bloquear</button>`}</div></article>`).join('')}</div>`}
function lojaHtml(focusId=''){return `<div data-loja-view data-focus-id="${esc(focusId)}"><section class="owner-product-banner loja"><div><span class="owner-eyebrow">PRODUTO</span><h2>Loja Online</h2><p>Provisionamento empresarial e licenças, mantendo a Loja Online como fonte de verdade.</p></div><div class="owner-banner-stats"><strong>${state.overview.totalClients}</strong><span>lojas clientes</span><a class="owner-secondary" href="${SEO_PANEL_URL}" target="_blank" rel="noopener">Abrir painel SEO</a></div></section>${state.error?`<section class="owner-section"><div class="owner-empty">${esc(state.error)} <button id="lojaRetry" type="button" class="owner-secondary">Tentar novamente</button></div></section>`:''}${accessCard()}<section class="owner-section owner-form-section"><div class="owner-section-head"><div><span class="owner-eyebrow">LOJA ONLINE</span><h2>Nova loja cliente</h2><p>Cria tenant, administrador e licença inicial em uma única operação.</p></div></div><form id="lojaOnlineCompanyForm" class="owner-form-card"><div class="owner-form-grid"><label>Empresa / Loja<input name="companyName" required maxlength="120"></label><label>Nome do administrador<input name="adminName" required maxlength="120"></label><label>E-mail do administrador<input name="adminEmail" type="email" required></label><label>Plano<select name="plan"><option value="1_MONTH">1 mês</option><option value="3_MONTHS">3 meses</option><option value="6_MONTHS" selected>6 meses</option><option value="12_MONTHS">12 meses</option></select></label><label>Duração em meses<select name="months"><option value="1">1</option><option value="3">3</option><option value="6" selected>6</option><option value="12">12</option></select></label><label>Máximo de usuários<input name="maxUsers" type="number" min="1" max="1000" value="5" required></label></div><div class="owner-form-actions"><button type="submit" class="owner-primary">Criar loja e liberar licença</button><p id="lojaCreateResult" role="status"></p></div></form></section><section class="owner-section"><div class="owner-section-head"><div><span class="owner-eyebrow">CARTEIRA</span><h2>Lojas e licenças</h2><p>Validade, limite de usuários, bloqueio e desbloqueio sem duplicar estado no D1 da Central.</p></div></div>${metrics()}${managementCards()}</section></div>`}

function openLoja(focusId=''){const target=view();if(!target)return;target.dataset.ownerCurrent='loja';target.innerHTML=lojaHtml(focusId);ensureNav();bindLoja();if(!state.loaded&&!state.loading)void refresh();if(focusId)setTimeout(()=>document.querySelector(`[data-loja-edit="${CSS.escape(focusId)}"]`)?.scrollIntoView({behavior:'smooth',block:'center'}),0)}
function editor(client:LojaOnlineClient){let dialog=document.getElementById('lojaLicenseDialog') as HTMLDialogElement|null;if(!dialog){dialog=document.createElement('dialog');dialog.id='lojaLicenseDialog';dialog.className='loja-license-dialog';document.body.appendChild(dialog)}dialog.innerHTML=`<form method="dialog" class="owner-form-card"><div class="owner-section-head"><div><span class="owner-eyebrow">LOJA ONLINE</span><h2>Editar licença</h2><p>${esc(client.company.name)}</p></div><button type="submit" value="cancel" class="owner-secondary">Fechar</button></div><div class="owner-form-grid"><label>Plano<input name="plan" value="${esc(client.license.plan||'MANUAL')}"></label><label>Máximo de usuários<input name="maxUsers" type="number" min="1" max="1000" value="${client.license.maxUsers}"></label><label>Vencimento<input name="expiresAt" type="date" value="${esc(client.license.expiresAt?.slice(0,10)||'')}"></label></div><div class="owner-form-actions"><button type="submit" value="save" class="owner-primary">Salvar licença</button></div></form>`;dialog.addEventListener('close',async()=>{if(dialog?.returnValue!=='save')return;const form=dialog.querySelector('form') as HTMLFormElement,values=new FormData(form),date=String(values.get('expiresAt')||'');try{await api.put(`/api/owner/loja-online/companies/${encodeURIComponent(client.company.id)}/license`,{plan:values.get('plan'),maxUsers:Number(values.get('maxUsers')),expiresAt:date?`${date}T23:59:59.999Z`:null,status:client.license.status,startsAt:client.license.startsAt||null});await refresh();openLoja(client.company.id)}catch(error){alert(apiMessage(error))}},{once:true});dialog.showModal()}
async function mutate(id:string,action:'extend'|'block'|'unblock'){const client=state.clients.find(item=>item.company.id===id);if(!client)return;if(action==='block'&&!confirm(`Bloquear ${client.company.name}?`))return;if(action==='unblock'&&!confirm(`Desbloquear ${client.company.name}?`))return;try{if(action==='extend')await api.post(`/api/owner/loja-online/companies/${encodeURIComponent(id)}/extend`,{months:6});if(action==='block')await api.post(`/api/owner/loja-online/companies/${encodeURIComponent(id)}/block`,{reason:'Acesso suspenso pela Artisys'});if(action==='unblock')await api.post(`/api/owner/loja-online/companies/${encodeURIComponent(id)}/unblock`,{});await refresh();openLoja(id)}catch(error){alert(apiMessage(error))}}

function bindLoja(){
  document.getElementById('lojaRetry')?.addEventListener('click',()=>{state.loaded=false;void refresh()});
  document.getElementById('lojaHideAccess')?.addEventListener('click',()=>{temporary=null;openLoja()});
  document.getElementById('lojaCopyAccess')?.addEventListener('click',async()=>{const text=`E-mail: ${temporary?.admin?.email||''}\nSenha temporária: ${temporary?.temporaryPassword||''}`;try{await navigator.clipboard.writeText(text)}catch{} });
  const form=document.getElementById('lojaOnlineCompanyForm') as HTMLFormElement|null;if(form){const months=form.elements.namedItem('months') as HTMLSelectElement,plan=form.elements.namedItem('plan') as HTMLSelectElement;months.onchange=()=>{plan.value=months.value==='1'?'1_MONTH':`${months.value}_MONTHS`};form.onsubmit=async event=>{event.preventDefault();const button=form.querySelector<HTMLButtonElement>('button[type="submit"]')!,result=document.getElementById('lojaCreateResult')!,values=new FormData(form);button.disabled=true;result.textContent='Criando tenant e licença…';try{const response=await api.post<CreateResponse>('/api/owner/loja-online/companies',{companyName:values.get('companyName'),adminName:values.get('adminName'),adminEmail:values.get('adminEmail'),plan:values.get('plan'),months:Number(values.get('months')),maxUsers:Number(values.get('maxUsers'))});temporary=response.data;await refresh();openLoja(response.data.company.id)}catch(error){result.textContent=apiMessage(error)}finally{button.disabled=false}}}
  document.querySelectorAll<HTMLButtonElement>('[data-loja-edit]').forEach(button=>button.onclick=()=>{const client=state.clients.find(item=>item.company.id===button.dataset.lojaEdit);if(client)editor(client)});
  document.querySelectorAll<HTMLButtonElement>('[data-loja-extend]').forEach(button=>button.onclick=()=>void mutate(button.dataset.lojaExtend!,'extend'));
  document.querySelectorAll<HTMLButtonElement>('[data-loja-block]').forEach(button=>button.onclick=()=>void mutate(button.dataset.lojaBlock!,'block'));
  document.querySelectorAll<HTMLButtonElement>('[data-loja-unblock]').forEach(button=>button.onclick=()=>void mutate(button.dataset.lojaUnblock!,'unblock'));
}

function enhance(force=false){if(location.hash!=='#owner'||!document.querySelector('[data-owner-shell]'))return;ensureNav();if(!state.loaded&&!state.loading)void refresh();const current=currentView();if(force&&current==='loja'){openLoja();return}if(current==='overview')ensureOverview();if(current==='clients')ensureClients();if(current==='licenses')ensureLicenses();if(current==='loja'&&!document.querySelector('[data-loja-view]'))openLoja()}
function install(){if(location.hash!=='#owner'||observer)return;observer=new MutationObserver(()=>schedule());observe();schedule()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();