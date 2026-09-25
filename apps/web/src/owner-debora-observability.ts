type OwnerApi={get:<T=any>(path:string,query?:Record<string,unknown>)=>Promise<{data:T}>;post?:<T=any>(path:string,body?:unknown)=>Promise<{data:T}>};
type Page<T>={items:T[];hasMore:boolean;nextCursor:string|null};
type DeboraSummary={
  accounts?:{total?:number;createdToday?:number;created7d?:number;created30d?:number};
  presence?:{onlineNow?:number;activeToday?:number;active7d?:number;active30d?:number};
  usage?:{sessionsToday?:number;activeSecondsToday?:number;activeSeconds7d?:number;activeSeconds30d?:number};
  pro?:{total?:number;monthly?:number;annual?:number;manual6m?:number};
  plans?:{freemium?:number;proMonthly?:number;proAnnual?:number;proManual6m?:number};
  sales?:{paid?:number;automaticPaid?:number;manualPaid?:number;realizedRevenueCents?:number};
};
type DeboraUser={
  userId:string;email:string;createdAt?:string|null;lastSignInAt?:string|null;lastSeenAt?:string|null;online?:boolean;
  planCode?:string;subscriptionStatus?:string;effectiveLicense?:{planCode?:string;status?:string;source?:string;expiresAt?:string|null}|null;
  manualSale?:{acquisitionChannel?:string;paymentStatus?:string;amountCents?:number|null;externalOrderRef?:string|null}|null;
  sessionsToday?:number;activeSecondsToday?:number;activeSeconds7d?:number;activeSeconds30d?:number;
};
type DeboraSale={id:string;email?:string;source?:string;planCode?:string;status?:string;amountCents?:number|null;acquisitionChannel?:string;externalOrderRef?:string|null;createdAt?:string};
type DeboraSession={id:string;startedAt?:string;lastSeenAt?:string;endedAt?:string|null;durationSeconds?:number};

type TableState={cursor:string|null;stack:(string|null)[];nextCursor:string|null;hasMore:boolean};
const usersState:TableState={cursor:null,stack:[],nextCursor:null,hasMore:false};
const salesState:TableState={cursor:null,stack:[],nextCursor:null,hasMore:false};
let activeApi:OwnerApi|null=null;
let searchTimer:number|undefined;

const esc=(value:unknown)=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
const num=(value:unknown)=>Number.isFinite(Number(value))?Number(value):0;
const fmtMoney=(cents:unknown)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(num(cents)/100);
const fmtDateTime=(value?:string|null)=>value?new Date(value).toLocaleString('pt-BR'):'—';
export function formatUsageSeconds(value:unknown){const seconds=Math.max(0,Math.floor(num(value))),hours=Math.floor(seconds/3600),minutes=Math.floor((seconds%3600)/60);return hours?`${hours}h ${String(minutes).padStart(2,'0')}min`:`${minutes}min`}
const channelLabel=(value?:string)=>({mercado_livre:'Mercado Livre',mercado_livre_manual:'Manual (legado)',direct_sale:'Venda direta',shopee:'Shopee',gumroad:'Gumroad',courtesy:'Cortesia',partnership:'Parceria',other:'Outro',asaas:'Asaas',cadastro:'Cadastro'} as Record<string,string>)[String(value||'')]||String(value||'—');
const paymentLabel=(value?:string)=>({paid:'Pago',pending:'Pendente',unpaid:'Não pago',not_applicable:'Não se aplica',unknown:'Não informado',active:'Ativo',past_due:'Em atraso',cancelled:'Cancelado',expired:'Expirado',failed:'Falhou',checkout_created:'Checkout criado'} as Record<string,string>)[String(value||'')]||String(value||'—');
const planLabel=(value?:string)=>({pro_monthly:'Pro mensal',pro_annual:'Pro anual',pro_6m:'Pro 6 meses',freemium:'Freemium'} as Record<string,string>)[String(value||'')]||String(value||'Freemium');
function brlToCents(value:unknown){const text=String(value??'').trim();if(!text)return null;const normalized=(text.includes(',')?text.replace(/\./g,'').replace(',','.'):text).replace(/[^0-9.-]/g,'');const amount=Number(normalized);if(!Number.isFinite(amount)||amount<0)throw new Error('Informe um valor válido.');return Math.round(amount*100)}

function channelOptions(includeAutomatic=true){return `${includeAutomatic?'<option value="asaas">Asaas</option>':''}<option value="mercado_livre">Mercado Livre</option><option value="direct_sale">Venda direta</option><option value="shopee">Shopee</option><option value="gumroad">Gumroad</option><option value="courtesy">Cortesia</option><option value="partnership">Parceria</option><option value="other">Outro</option>${includeAutomatic?'<option value="mercado_livre_manual">Manual legado</option>':''}`}

export function deboraObservabilitySection(){return `<section class="owner-section owner-debora-observability" data-debora-observability-root>
  <div class="owner-section-head"><div><span class="owner-eyebrow">USO E VENDAS</span><h2>Observabilidade da Débora</h2><p>Contas, presença, sessões e vendas. Dados clínicos não fazem parte deste painel.</p></div></div>
  <p class="owner-debora-observability-status" data-debora-observability-status role="status">Carregando atividade…</p>
  <div class="owner-debora-observability-metrics" data-debora-observability-metrics></div>
  <div class="owner-debora-observability-panels">
    <section class="owner-debora-observability-panel"><div class="owner-debora-observability-panel-head"><div><h3>Usuários</h3><small>Paginação e filtros executados no servidor.</small></div></div>
      <div class="owner-debora-observability-filters"><label>Buscar e-mail<input type="search" data-debora-users-search placeholder="cliente@exemplo.com"></label><label>Plano<select data-debora-users-plan><option value="">Todos</option><option value="freemium">Freemium</option><option value="pro_monthly">Pro mensal</option><option value="pro_annual">Pro anual</option><option value="pro_6m">Pro 6 meses</option></select></label><label>Origem<select data-debora-users-origin><option value="">Todas</option>${channelOptions(true)}</select></label><label>Pagamento<select data-debora-users-payment><option value="">Todos</option><option value="paid">Pago</option><option value="pending">Pendente</option><option value="unpaid">Não pago</option><option value="not_applicable">Não se aplica</option><option value="unknown">Não informado</option></select></label><label>Presença<select data-debora-users-online><option value="">Todos</option><option value="true">Online</option><option value="false">Offline</option></select></label></div>
      <div class="owner-debora-table-wrap"><table class="owner-debora-table"><thead><tr><th>Usuário</th><th>Plano</th><th>Origem</th><th>Pagamento</th><th>Presença</th><th>Último acesso</th><th>Conta criada</th><th></th></tr></thead><tbody data-debora-users-body></tbody></table></div>
      <div class="owner-debora-observability-pager"><button type="button" class="owner-secondary" data-debora-users-prev>Anterior</button><button type="button" class="owner-secondary" data-debora-users-next>Próxima</button></div>
      <div data-debora-classification-panel></div>
      <div data-debora-user-activity-panel></div>
    </section>
    <section class="owner-debora-observability-panel"><div class="owner-debora-observability-panel-head"><div><h3>Vendas</h3><small>Asaas e vendas manuais em uma linha do tempo única.</small></div></div>
      <div class="owner-debora-observability-filters"><label>Canal<select data-debora-sales-channel><option value="">Todos</option>${channelOptions(true)}</select></label><label>Status<select data-debora-sales-status><option value="">Todos</option><option value="paid">Pago</option><option value="pending">Pendente</option><option value="unpaid">Não pago</option><option value="not_applicable">Não se aplica</option><option value="failed">Falhou</option><option value="expired">Expirou</option></select></label></div>
      <div class="owner-debora-table-wrap"><table class="owner-debora-table"><thead><tr><th>Data</th><th>Cliente</th><th>Canal</th><th>Plano</th><th>Valor</th><th>Status</th><th>Referência</th></tr></thead><tbody data-debora-sales-body></tbody></table></div>
      <div class="owner-debora-observability-pager"><button type="button" class="owner-secondary" data-debora-sales-prev>Anterior</button><button type="button" class="owner-secondary" data-debora-sales-next>Próxima</button></div>
    </section>
  </div>
</section>`}

function renderSummary(summary:DeboraSummary){
  const target=document.querySelector<HTMLElement>('[data-debora-observability-metrics]');if(!target)return;
  const values=[
    ['Online agora',num(summary.presence?.onlineNow),'online'],['Contas totais',num(summary.accounts?.total),'accounts'],
    ['Freemium',num(summary.plans?.freemium),'freemium'],['Pro ativos',num(summary.pro?.total),'pro'],
    ['Vendas pagas',num(summary.sales?.paid),'sales'],['Receita realizada',fmtMoney(summary.sales?.realizedRevenueCents),'revenue'],
    ['Ativos hoje',num(summary.presence?.activeToday),'active-today'],['Sessões hoje',num(summary.usage?.sessionsToday),'sessions-today'],
    ['Tempo hoje',formatUsageSeconds(summary.usage?.activeSecondsToday),'usage-today'],
  ];
  target.innerHTML=values.map(([label,value,key])=>`<article class="owner-debora-observability-metric" data-debora-observability-metric="${esc(key)}"><span>${esc(label)}</span><strong>${esc(value)}</strong></article>`).join('');
}

function userQuery(){
  const query:Record<string,unknown>={limit:50};
  const search=document.querySelector<HTMLInputElement>('[data-debora-users-search]')?.value.trim();
  const plan=document.querySelector<HTMLSelectElement>('[data-debora-users-plan]')?.value;
  const origin=document.querySelector<HTMLSelectElement>('[data-debora-users-origin]')?.value;
  const payment=document.querySelector<HTMLSelectElement>('[data-debora-users-payment]')?.value;
  const online=document.querySelector<HTMLSelectElement>('[data-debora-users-online]')?.value;
  if(search)query.search=search;if(plan)query.plan=plan;if(origin)query.origin=origin;if(payment)query.payment=payment;if(online)query.online=online;if(usersState.cursor)query.cursor=usersState.cursor;
  return query;
}
function saleQuery(){
  const query:Record<string,unknown>={limit:50},status=document.querySelector<HTMLSelectElement>('[data-debora-sales-status]')?.value,channel=document.querySelector<HTMLSelectElement>('[data-debora-sales-channel]')?.value;
  if(status)query.status=status;if(channel)query.channel=channel;if(salesState.cursor)query.cursor=salesState.cursor;return query;
}
function effectivePlan(user:DeboraUser){return user.effectiveLicense?.planCode||user.planCode||'freemium'}
function isLegacyManual(user:DeboraUser){return user.effectiveLicense?.planCode==='pro_6m'&&!user.manualSale}
function userOrigin(user:DeboraUser){return user.manualSale?.acquisitionChannel||user.effectiveLicense?.source||(user.subscriptionStatus?'asaas':'cadastro')}
function userPayment(user:DeboraUser){if(user.manualSale)return user.manualSale.paymentStatus||'unknown';if(isLegacyManual(user))return'unknown';if(['active','trialing'].includes(String(user.subscriptionStatus||'')))return'paid';if(user.subscriptionStatus==='past_due')return'pending';if(['cancelled','expired'].includes(String(user.subscriptionStatus||'')))return'unpaid';return''}

async function loadUsers(){
  if(!activeApi)return;const {data}=await activeApi.get<Page<DeboraUser>>('/api/owner/debora-observability/users',userQuery());
  usersState.hasMore=Boolean(data.hasMore);usersState.nextCursor=data.nextCursor||null;
  const body=document.querySelector<HTMLElement>('[data-debora-users-body]');if(body)body.innerHTML=(data.items||[]).map(user=>`<tr><td><strong>${esc(user.email)}</strong></td><td>${esc(planLabel(effectivePlan(user)))}</td><td>${esc(channelLabel(userOrigin(user)))}</td><td>${esc(paymentLabel(userPayment(user)))}</td><td><span class="owner-debora-presence ${user.online?'is-online':'is-offline'}">${user.online?'Online':'Offline'}</span></td><td>${esc(fmtDateTime(user.lastSeenAt||user.lastSignInAt))}</td><td>${esc(fmtDateTime(user.createdAt))}</td><td><div class="owner-debora-row-actions"><button type="button" class="owner-secondary" data-debora-user-activity="${esc(user.userId)}" data-debora-user-email="${esc(user.email)}">Ver atividade</button>${isLegacyManual(user)?`<button type="button" class="owner-secondary" data-debora-classify-manual="${esc(user.email)}">Classificar pagamento</button>`:''}</div></td></tr>`).join('')||'<tr><td colspan="8">Nenhum usuário encontrado.</td></tr>';
  const prev=document.querySelector<HTMLButtonElement>('[data-debora-users-prev]'),next=document.querySelector<HTMLButtonElement>('[data-debora-users-next]');if(prev)prev.disabled=!usersState.stack.length;if(next)next.disabled=!usersState.hasMore;
  document.querySelectorAll<HTMLButtonElement>('[data-debora-user-activity]').forEach(button=>button.onclick=()=>void loadActivity(button.dataset.deboraUserActivity||'',button.dataset.deboraUserEmail||''));
  document.querySelectorAll<HTMLButtonElement>('[data-debora-classify-manual]').forEach(button=>button.onclick=()=>openLegacyClassification(button.dataset.deboraClassifyManual||''));
}

async function loadSales(){
  if(!activeApi)return;const {data}=await activeApi.get<Page<DeboraSale>>('/api/owner/debora-observability/sales',saleQuery());
  salesState.hasMore=Boolean(data.hasMore);salesState.nextCursor=data.nextCursor||null;
  const body=document.querySelector<HTMLElement>('[data-debora-sales-body]');if(body)body.innerHTML=(data.items||[]).map(sale=>`<tr><td>${esc(fmtDateTime(sale.createdAt))}</td><td>${esc(sale.email||'—')}</td><td>${esc(channelLabel(sale.acquisitionChannel||sale.source))}</td><td>${esc(planLabel(sale.planCode))}</td><td>${sale.amountCents===null||sale.amountCents===undefined?'—':esc(fmtMoney(sale.amountCents))}</td><td>${esc(paymentLabel(sale.status))}</td><td>${esc(sale.externalOrderRef||'—')}</td></tr>`).join('')||'<tr><td colspan="7">Nenhuma venda encontrada.</td></tr>';
  const prev=document.querySelector<HTMLButtonElement>('[data-debora-sales-prev]'),next=document.querySelector<HTMLButtonElement>('[data-debora-sales-next]');if(prev)prev.disabled=!salesState.stack.length;if(next)next.disabled=!salesState.hasMore;
}

async function loadActivity(userId:string,email:string){
  const panel=document.querySelector<HTMLElement>('[data-debora-user-activity-panel]');if(!panel||!activeApi||!userId)return;panel.innerHTML='<p>Carregando sessões…</p>';
  try{const {data}=await activeApi.get<Page<DeboraSession>>(`/api/owner/debora-observability/users/${encodeURIComponent(userId)}/sessions`,{limit:25});panel.innerHTML=`<div class="owner-debora-activity"><div class="owner-debora-observability-panel-head"><div><h4>Atividade · ${esc(email)}</h4><small>Histórico detalhado paginado, com duração aproximada.</small></div><button type="button" class="owner-secondary" data-debora-close-activity>Fechar</button></div>${(data.items||[]).map(session=>`<div class="owner-debora-activity-row"><span>${esc(fmtDateTime(session.startedAt))}</span><strong>${esc(formatUsageSeconds(session.durationSeconds))}</strong><small>${session.endedAt?'Encerrada':'Sessão atual/recentemente ativa'}</small></div>`).join('')||'<p>Nenhuma sessão registrada.</p>'}</div>`;document.querySelector<HTMLButtonElement>('[data-debora-close-activity]')!.onclick=()=>{panel.innerHTML=''}}catch{panel.innerHTML='<p>Atividade indisponível temporariamente.</p>'}
}

function openLegacyClassification(email:string){
  const panel=document.querySelector<HTMLElement>('[data-debora-classification-panel]');if(!panel||!email)return;
  panel.innerHTML=`<form class="owner-debora-classification" data-debora-classification-form><div class="owner-debora-observability-panel-head"><div><h4>Classificar venda manual antiga</h4><small>${esc(email)} · a classificação comercial não altera a licença.</small></div><button type="button" class="owner-secondary" data-debora-close-classification>Fechar</button></div><div class="owner-debora-observability-filters"><label>Origem<select name="acquisitionChannel" required><option value="mercado_livre">Mercado Livre</option><option value="direct_sale">Venda direta</option><option value="shopee">Shopee</option><option value="gumroad">Gumroad</option><option value="courtesy">Cortesia</option><option value="partnership">Parceria</option><option value="other">Outro</option></select></label><label>Pagamento<select name="paymentStatus" required><option value="paid">Pago</option><option value="pending">Pendente</option><option value="unpaid">Não pago</option><option value="not_applicable">Não se aplica</option></select></label><label>Valor<input name="amount" inputmode="decimal" placeholder="80,00"></label><label>Referência<input name="externalOrderRef" maxlength="160"></label></div><div class="owner-form-actions row"><button class="owner-primary" type="submit">Salvar classificação</button><span data-debora-classification-result role="status"></span></div></form>`;
  panel.querySelector<HTMLButtonElement>('[data-debora-close-classification]')!.onclick=()=>{panel.innerHTML=''};
  const form=panel.querySelector<HTMLFormElement>('[data-debora-classification-form]')!;
  form.onsubmit=async event=>{event.preventDefault();const result=form.querySelector<HTMLElement>('[data-debora-classification-result]')!,button=form.querySelector<HTMLButtonElement>('button[type="submit"]')!;button.disabled=true;result.textContent='Salvando…';try{if(!activeApi?.post)throw new Error('Ação administrativa indisponível.');const values=new FormData(form);await activeApi.post('/api/owner/debora-manual-sales/classify',{email,sale:{acquisitionChannel:String(values.get('acquisitionChannel')||''),paymentStatus:String(values.get('paymentStatus')||''),amountCents:brlToCents(values.get('amount')),externalOrderRef:String(values.get('externalOrderRef')||'').trim()||null}});result.textContent='Classificação salva.';await bindDeboraObservability(activeApi)}catch(error){result.textContent=(error as {message?:string})?.message||'Não foi possível classificar.'}finally{button.disabled=false}};
}

function resetUsers(){usersState.cursor=null;usersState.stack=[];usersState.nextCursor=null;void loadUsers().catch(markUnavailable)}
function resetSales(){salesState.cursor=null;salesState.stack=[];salesState.nextCursor=null;void loadSales().catch(markUnavailable)}
function markUnavailable(){const status=document.querySelector<HTMLElement>('[data-debora-observability-status]');if(status)status.textContent='Atividade indisponível temporariamente. O licenciamento continua disponível.'}
function bindFilters(){
  const search=document.querySelector<HTMLInputElement>('[data-debora-users-search]');if(search)search.oninput=()=>{window.clearTimeout(searchTimer);searchTimer=window.setTimeout(resetUsers,250)};
  for(const selector of ['[data-debora-users-plan]','[data-debora-users-origin]','[data-debora-users-payment]','[data-debora-users-online]'])document.querySelector<HTMLSelectElement>(selector)?.addEventListener('change',resetUsers);
  for(const selector of ['[data-debora-sales-channel]','[data-debora-sales-status]'])document.querySelector<HTMLSelectElement>(selector)?.addEventListener('change',resetSales);
  const un=document.querySelector<HTMLButtonElement>('[data-debora-users-next]');if(un)un.onclick=()=>{if(!usersState.nextCursor)return;usersState.stack.push(usersState.cursor);usersState.cursor=usersState.nextCursor;void loadUsers().catch(markUnavailable)};
  const up=document.querySelector<HTMLButtonElement>('[data-debora-users-prev]');if(up)up.onclick=()=>{if(!usersState.stack.length)return;usersState.cursor=usersState.stack.pop()??null;void loadUsers().catch(markUnavailable)};
  const sn=document.querySelector<HTMLButtonElement>('[data-debora-sales-next]');if(sn)sn.onclick=()=>{if(!salesState.nextCursor)return;salesState.stack.push(salesState.cursor);salesState.cursor=salesState.nextCursor;void loadSales().catch(markUnavailable)};
  const sp=document.querySelector<HTMLButtonElement>('[data-debora-sales-prev]');if(sp)sp.onclick=()=>{if(!salesState.stack.length)return;salesState.cursor=salesState.stack.pop()??null;void loadSales().catch(markUnavailable)};
}

export async function bindDeboraObservability(api:OwnerApi){
  const root=document.querySelector('[data-debora-observability-root]');if(!root)return;activeApi=api;usersState.cursor=null;usersState.stack=[];salesState.cursor=null;salesState.stack=[];bindFilters();
  const status=document.querySelector<HTMLElement>('[data-debora-observability-status]');
  try{
    const [summary]=await Promise.all([api.get<DeboraSummary>('/api/owner/debora-observability/summary'),loadUsers(),loadSales()]);renderSummary(summary.data);if(status)status.textContent='Dados administrativos atualizados.';
  }catch{markUnavailable()}
}

export async function refreshDeboraObservability(){if(activeApi&&document.querySelector('[data-debora-observability-root]'))await bindDeboraObservability(activeApi)}