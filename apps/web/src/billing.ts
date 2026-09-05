import { api, auth } from './cloudflare-client';
import { createIcons, ArrowLeft, Check, CreditCard, FileText, House, LogOut, ReceiptText, ShieldCheck, Users, Building2, Monitor, CalendarDays, ExternalLink } from 'lucide';
import './portal.css';
import './billing.css';

type Plan={code:string;name:string;interval:'monthly'|'yearly';priceCents:number;features:string[];limits:{maxUsers:number;maxProjects:number;maxDevices:number}};
type PlanMeta={modules?:string[];limits?:{maxUsers:number;maxProjects:number;maxDevices:number}};
type Order=PlanMeta&{id:string;plan_version_id:string;amount_cents:number;currency:string;financial_status:string;checkout_url?:string|null;reconciliation_required?:number;created_at:string;updated_at:string;plan_code?:string;plan_name?:string;interval_code?:string};
type Subscription=PlanMeta&{id:string;financial_status:string;current_period_end?:string|null;created_at:string;updated_at:string;plan_code?:string;plan_name?:string;price_cents?:number;currency?:string;interval_code?:string};
type Payment={id:string;provider_payment_id:string;provider_status?:string;financial_status:string;amount_cents:number;paid_at?:string|null;created_at:string;updated_at:string};
type BillingStatus={orders:Order[];subscriptions:Subscription[];payments?:Payment[];usage?:{users:number;projects:number;devices:number}};
type CheckoutState='ready'|'verifying'|'paid'|'failed';

type BillingTab='plans'|'confirmation'|'billing';
const icons={ArrowLeft,Check,CreditCard,FileText,House,LogOut,ReceiptText,ShieldCheck,Users,Building2,Monitor,CalendarDays,ExternalLink};
const esc=(value:unknown)=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char] as string));
const money=(cents:number,currency='BRL')=>new Intl.NumberFormat('pt-BR',{style:'currency',currency}).format(cents/100);
const date=(value?:string|null)=>value?new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'long',year:'numeric'}).format(new Date(`${value.slice(0,10)}T12:00:00`)):'—';
const icon=(name:string)=>`<i data-lucide="${name}" aria-hidden="true"></i>`;
const errorText=(cause:unknown)=>{const error=cause as {response?:{status?:number;data?:{error?:string}};message?:string};return error.response?.data?.error||error.message||'Não foi possível concluir.'};
const selectedPlan=()=>new URLSearchParams(location.hash.split('?')[1]||'').get('plano')||'';
const moduleLabels:Record<string,string>={finance:'Financeiro',rh:'RH',contracts:'Contratos',rdo:'RDO',obra360:'Obra360',dre:'DRE',procurement:'Compras',measurements:'Medições',documents:'Documentos',universidade:'Universidade Empresarial',ai:'IA ArtiSys'};
let confirmationPolls=0;
let confirmationTimer:number|undefined;

function setBody(content:string,current:BillingTab){
  const nav=(id:BillingTab|'home',label:string,href:string,iconName:string)=>`<a href="${href}" ${current===id?'aria-current="page"':''}>${icon(iconName)}<span>${label}</span></a>`;
  document.body.className='mh-portal-body billing-body';
  document.body.innerHTML=`<div id="mhPortal"><header class="cp-header"><div class="cp-header-inner"><a class="billing-wordmark" href="#portal" aria-label="Canteiro360 — início"><span class="cp-wordmark">Canteiro<span>360</span></span></a><div class="billing-header-actions"><a href="#portal" class="billing-back">${icon('arrow-left')}<span>Voltar ao painel</span></a><button id="billingLogout" type="button" aria-label="Sair">${icon('log-out')}<span>Sair</span></button></div></div></header><main class="cp-dashboard billing-dashboard">${content}</main><nav class="cp-bottom-nav billing-bottom" aria-label="Navegação de cobrança">${nav('home','Início','#portal','house')}${nav('plans','Planos','#planos','file-text')}${nav('billing','Cobrança','#plano-cobranca','receipt-text')}</nav></div><div id="mhToast" class="mh-toast" role="status" aria-live="polite"></div>`;
  document.getElementById('billingLogout')?.addEventListener('click',()=>void auth.signOut());
  createIcons({icons});
}

function state(title:string,text:string){return `<section class="billing-state" role="status"><span class="billing-spinner"></span><h1>${esc(title)}</h1><p>${esc(text)}</p></section>`}
function showError(title:string,cause:unknown,retry:()=>void,current:BillingTab='plans'){setBody(`<section class="billing-state billing-state-error"><h1>${esc(title)}</h1><p>${esc(errorText(cause))}</p><button id="billingRetry" class="billing-primary">Tentar novamente</button></section>`,current);document.getElementById('billingRetry')?.addEventListener('click',retry)}
async function requireUser(){const user=await auth.getUser();if(!user){location.hash='#portal';return null}return user}
function idempotencyKey(planCode:string){const storage=`artisys-billing-idempotency:${planCode}`,existing=sessionStorage.getItem(storage);if(existing&&/^[0-9a-f-]{36}$/i.test(existing))return existing;const next=crypto.randomUUID();sessionStorage.setItem(storage,next);return next}
function clearIdempotency(planCode?:string){if(planCode)sessionStorage.removeItem(`artisys-billing-idempotency:${planCode}`)}
function stopConfirmationPolling(){if(confirmationTimer!==undefined){window.clearTimeout(confirmationTimer);confirmationTimer=undefined}confirmationPolls=0}
function scheduleConfirmationPolling(){if(confirmationTimer!==undefined||confirmationPolls>=3)return;confirmationPolls+=1;confirmationTimer=window.setTimeout(()=>{confirmationTimer=undefined;void renderConfirmation()},2000)}

export async function renderPlans(){
  if(!await requireUser())return;
  setBody(state('Carregando planos','Buscando as opções disponíveis para sua operação.'),'plans');
  try{
    const plans=(await api.get<{plans:Plan[]}>('/api/billing/plans')).data.plans;
    const interval=new URLSearchParams(location.hash.split('?')[1]||'').get('periodo')==='yearly'?'yearly':'monthly';
    const visible=plans.filter(plan=>plan.interval===interval);
    setBody(`<header class="billing-hero"><span>PLANOS ARTISYS</span><h1>Escolha a estrutura certa para sua operação</h1><p>Desktop e PWA/mobile incluídos. Comece agora e evolua quando sua empresa precisar.</p><div class="billing-toggle" aria-label="Período de cobrança"><a href="#planos?periodo=monthly" ${interval==='monthly'?'aria-current="true"':''}>Mensal</a><a href="#planos?periodo=yearly" ${interval==='yearly'?'aria-current="true"':''}>Anual <small>2 meses de vantagem</small></a></div></header><section class="billing-plan-grid" aria-label="Planos disponíveis">${visible.map(plan=>`<article class="billing-plan ${plan.code.startsWith('pro_')?'billing-plan-featured':''}">${plan.code.startsWith('pro_')?'<span class="billing-popular">MAIS ESCOLHIDO</span>':''}<h2>${esc(plan.name)}</h2><p class="billing-price"><strong>${money(plan.priceCents)}</strong><span>/${interval==='yearly'?'ano':'mês'}</span></p><p class="billing-limits">${plan.limits.maxUsers} usuários · ${plan.limits.maxProjects} obras · ${plan.limits.maxDevices} computadores</p><ul>${plan.features.map(feature=>`<li>${icon('check')}<span>${esc(feature)}</span></li>`).join('')}</ul><a class="billing-primary" href="#checkout?plano=${encodeURIComponent(plan.code)}">Escolher ${esc(plan.name)}</a></article>`).join('')}</section><div class="billing-trust"><span>${icon('shield-check')} Checkout hospedado e seguro pelo Asaas</span><span>${icon('credit-card')} Dados financeiros preenchidos no Asaas</span><span>${icon('check')} Ativação automática após confirmação</span></div>`,'plans');
  }catch(cause){showError('Não foi possível carregar os planos',cause,()=>void renderPlans())}
}

export async function renderCheckout(){
  if(!await requireUser())return;
  const planCode=selectedPlan();
  setBody(state('Preparando contratação','Validando o plano selecionado.'),'plans');
  try{
    const plans=(await api.get<{plans:Plan[]}>('/api/billing/plans')).data.plans,plan=plans.find(item=>item.code===planCode);
    if(!plan){location.hash='#planos';return}
    const idem=idempotencyKey(planCode);
    setBody(`<div class="billing-checkout"><section><span class="billing-eyebrow">CONTRATAÇÃO</span><h1>Confirme sua assinatura</h1><p>O ArtiSys define o plano e o valor no servidor. Seus dados fiscais e de pagamento serão preenchidos somente no Checkout do Asaas.</p><form id="checkoutForm"><label for="companyName">Nome da empresa</label><input id="companyName" name="companyName" maxlength="120" autocomplete="organization" required placeholder="Sua empresa"><button class="billing-primary" type="submit">Continuar para o Asaas</button><small>${icon('shield-check')} Não solicitamos cartão, CPF/CNPJ ou dados bancários nesta tela.</small></form></section><aside class="billing-summary"><span>RESUMO</span><h2>${esc(plan.name)}</h2><p>${plan.interval==='yearly'?'Cobrança anual':'Cobrança mensal'}</p><strong>${money(plan.priceCents)}</strong><p class="billing-summary-limits">${plan.limits.maxUsers} usuários · ${plan.limits.maxProjects} obras · ${plan.limits.maxDevices} computadores</p><ul>${plan.features.slice(0,7).map(feature=>`<li>${icon('check')}<span>${esc(feature)}</span></li>`).join('')}</ul></aside></div>`,'plans');
    document.getElementById('checkoutForm')?.addEventListener('submit',async event=>{
      event.preventDefault();const form=event.currentTarget as HTMLFormElement,button=form.querySelector('button')!,companyName=(form.elements.namedItem('companyName') as HTMLInputElement).value.trim();if(!companyName||button.disabled)return;
      button.disabled=true;button.textContent='Criando checkout…';
      try{const result=(await api.post<{order:Order;state:CheckoutState}>('/api/billing/checkout',{planCode,companyName,idempotencyKey:idem})).data;sessionStorage.setItem('artisys-billing-order',result.order.id);location.hash=`#assinatura?pedido=${encodeURIComponent(result.order.id)}`;await renderConfirmation()}catch(cause){button.disabled=false;button.textContent='Continuar para o Asaas';const toast=document.getElementById('mhToast')!;toast.textContent=errorText(cause);toast.classList.add('show')}
    });
  }catch(cause){showError('Não foi possível preparar a contratação',cause,()=>void renderCheckout())}
}

export async function renderConfirmation(){
  if(!await requireUser())return;
  const requested=new URLSearchParams(location.hash.split('?')[1]||'').get('pedido')||sessionStorage.getItem('artisys-billing-order')||'';
  setBody(state('Confirmando assinatura','Verificando o status mais recente da sua contratação.'),'confirmation');
  try{
    const status=(await api.get<BillingStatus>('/api/billing/status')).data;
    let order=status.orders.find(item=>item.id===requested)||status.orders[0];
    if(!order){stopConfirmationPolling();location.hash='#planos';return}
    let recoveryState:CheckoutState|undefined;
    if(order.reconciliation_required||(!order.checkout_url&&order.financial_status==='created')){
      const recovery=(await api.post<{order:Order;state:CheckoutState}>('/api/billing/checkout/status',{orderId:order.id})).data;
      order={...order,...recovery.order};recoveryState=recovery.state;
    }
    const paid=order.financial_status==='paid'||recoveryState==='paid',failed=order.financial_status==='failed'||recoveryState==='failed',verifying=recoveryState==='verifying'||(!order.checkout_url&&!paid&&!failed&&!!order.reconciliation_required);
    if(paid||['canceled','refunded'].includes(order.financial_status))clearIdempotency(order.plan_code);
    if(verifying){
      setBody(`<section class="billing-confirmation"><span class="billing-spinner"></span><span class="billing-eyebrow">CHECKOUT ASAAS</span><h1>Estamos confirmando seu checkout</h1><p>Recebemos sua solicitação e estamos verificando com o Asaas antes de permitir qualquer nova tentativa. Isso evita cobranças duplicadas.</p><div class="billing-order"><span>Pedido <strong>${esc(order.id.slice(0,8).toUpperCase())}</strong></span><span>Valor <strong>${money(order.amount_cents,order.currency)}</strong></span><span>Status <strong>Em verificação</strong></span></div><button id="refreshBilling" class="billing-secondary">Verificar novamente</button><a class="billing-text-link" href="#plano-cobranca">Ver plano e cobrança</a></section>`,'confirmation');
      document.getElementById('refreshBilling')?.addEventListener('click',()=>void renderConfirmation());scheduleConfirmationPolling();return;
    }
    stopConfirmationPolling();
    if(failed){
      setBody(`<section class="billing-confirmation"><div class="billing-confirmation-icon">${icon('credit-card')}</div><span class="billing-eyebrow">CHECKOUT ASAAS</span><h1>Não foi possível criar o checkout</h1><p>A tentativa anterior falhou antes de uma cobrança ser confirmada. Você pode tentar novamente com segurança usando o mesmo pedido.</p><div class="billing-order"><span>Pedido <strong>${esc(order.id.slice(0,8).toUpperCase())}</strong></span><span>Valor <strong>${money(order.amount_cents,order.currency)}</strong></span><span>Status <strong>Falhou</strong></span></div><a class="billing-primary" href="#checkout?plano=${encodeURIComponent(order.plan_code||'')}">Tentar novamente</a><a class="billing-text-link" href="#plano-cobranca">Ver plano e cobrança</a></section>`,'confirmation');return;
    }
    setBody(`<section class="billing-confirmation"><div class="billing-confirmation-icon ${paid?'is-paid':''}">${icon(paid?'check':'credit-card')}</div><span class="billing-eyebrow">${paid?'ASSINATURA ATIVA':'CHECKOUT ASAAS'}</span><h1>${paid?'Pagamento confirmado':'Finalize o pagamento no Asaas'}</h1><p>${paid?'Sua licença foi ativada automaticamente. Você já pode configurar a operação.':'O pagador preencherá CPF/CNPJ, endereço e dados de pagamento diretamente no ambiente seguro do Asaas.'}</p><div class="billing-order"><span>Pedido <strong>${esc(order.id.slice(0,8).toUpperCase())}</strong></span><span>Valor <strong>${money(order.amount_cents,order.currency)}</strong></span><span>Status <strong>${esc(statusLabel(order.financial_status))}</strong></span></div>${paid?'<a class="billing-primary" href="#portal">Ir para o painel</a>':`${order.checkout_url?`<a class="billing-primary" href="${esc(order.checkout_url)}" rel="noopener noreferrer">Abrir Checkout Asaas ${icon('external-link')}</a>`:''}<button id="refreshBilling" class="billing-secondary">Já paguei · verificar novamente</button>`}<a class="billing-text-link" href="#plano-cobranca">Ver plano e cobrança</a></section>`,'confirmation');
    document.getElementById('refreshBilling')?.addEventListener('click',()=>void renderConfirmation());
  }catch(cause){stopConfirmationPolling();showError('Não foi possível confirmar a assinatura',cause,()=>void renderConfirmation(),'confirmation')}
}

const statusLabel=(status:string)=>({created:'Criado',pending:'Aguardando pagamento',paid:'Pago',overdue:'Em atraso',canceled:'Cancelado',refunded:'Estornado',failed:'Falhou'}[status]||status);
function usageCard(iconName:string,label:string,used:number,max:number){const safeMax=Math.max(1,max),percent=Math.min(100,Math.round(used/safeMax*100));return `<article class="billing-usage-card">${icon(iconName)}<div><span>${esc(label)}</span><strong>${used}/${max}</strong><div class="billing-progress"><i style="width:${percent}%"></i></div><small>${percent}% utilizado</small></div></article>`}
function paymentRows(payments:Payment[]){if(!payments.length)return '<p class="billing-history-empty">Nenhuma cobrança processada ainda.</p>';return `<div class="billing-history-table"><div class="billing-history-head"><span>Data</span><span>Valor</span><span>Status</span></div>${payments.map(payment=>`<div class="billing-history-row"><span>${date(payment.paid_at||payment.created_at)}</span><strong>${money(payment.amount_cents)}</strong><span class="billing-payment-status is-${esc(payment.financial_status)}">${esc(statusLabel(payment.financial_status))}</span></div>`).join('')}</div>`}

export async function renderBillingAccount(){
  if(!await requireUser())return;
  setBody(state('Carregando cobrança','Consultando sua assinatura, licença e pagamentos.'),'billing');
  try{
    const status=(await api.get<BillingStatus>('/api/billing/status')).data,subscription=status.subscriptions[0],order=status.orders[0];
    if(!subscription&&!order){setBody(`<header class="billing-page-head"><span class="billing-eyebrow">CONFIGURAÇÕES</span><h1>Plano e cobrança</h1><p>Gerencie sua contratação do ArtiSys.</p></header><section class="billing-empty"><h2>Nenhum plano contratado</h2><p>Escolha um plano para liberar sua operação no Desktop e PWA/mobile.</p><a class="billing-primary" href="#planos">Ver planos</a></section>`,'billing');return}
    const current=subscription||order!,price=subscription?.price_cents??order?.amount_cents??0,currency=subscription?.currency??order?.currency??'BRL',limits=current.limits||{maxUsers:0,maxProjects:0,maxDevices:0},usage=status.usage||{users:0,projects:0,devices:0},modules=current.modules||[],payments=status.payments||[];
    setBody(`<header class="billing-page-head"><span class="billing-eyebrow">CONFIGURAÇÕES</span><h1>Plano e cobrança</h1><p>Acompanhe sua assinatura, o uso da licença e o histórico financeiro.</p></header><section class="billing-account-card"><div><span>PLANO ATUAL</span><h2>${esc(current.plan_name||'ArtiSys')}</h2><p>${current.interval_code==='yearly'?'Assinatura anual':'Assinatura mensal'} · Desktop + PWA/mobile</p></div><div class="billing-account-price"><strong>${money(price,currency)}</strong><span>${current.interval_code==='yearly'?'/ano':'/mês'}</span></div><span class="billing-status billing-status-${esc(current.financial_status)}">${esc(statusLabel(current.financial_status))}</span></section><section class="billing-details"><article>${icon('calendar-days')}<span>Próxima renovação</span><strong>${date(subscription?.current_period_end)}</strong></article><article>${icon('credit-card')}<span>Pagamento</span><strong>Processado pelo Asaas</strong></article><article>${icon('shield-check')}<span>Licença</span><strong>${current.financial_status==='paid'?'Ativa':'Aguardando confirmação'}</strong></article></section><section class="billing-section"><div class="billing-section-head"><div><h2>Uso da licença</h2><p>Limites vinculados ao plano atual.</p></div></div><div class="billing-usage-grid">${usageCard('users','Usuários',usage.users,limits.maxUsers)}${usageCard('building-2','Obras',usage.projects,limits.maxProjects)}${usageCard('monitor','Computadores',usage.devices,limits.maxDevices)}</div></section><section class="billing-section"><div class="billing-section-head"><div><h2>Módulos do seu plano</h2><p>Recursos liberados automaticamente pela licença.</p></div><span class="billing-active-dot">● Ativos</span></div><div class="billing-module-grid">${modules.map(module=>`<span>${icon('check')}${esc(moduleLabels[module]||module)}</span>`).join('')||'<span>Nenhum módulo listado.</span>'}</div></section><section class="billing-section"><div class="billing-section-head"><div><h2>Histórico de cobranças</h2><p>Pagamentos registrados para esta conta.</p></div></div>${paymentRows(payments)}</section><div class="billing-actions"><a class="billing-secondary" href="#planos">Trocar plano</a>${order?.checkout_url&&order.financial_status!=='paid'?`<a class="billing-primary" href="${esc(order.checkout_url)}" rel="noopener noreferrer">Resolver pagamento no Asaas ${icon('external-link')}</a>`:'<span class="billing-managed-note">Forma de pagamento e dados financeiros são gerenciados no Asaas.</span>'}</div>`,'billing');
  }catch(cause){showError('Não foi possível carregar plano e cobrança',cause,()=>void renderBillingAccount(),'billing')}
}

let listening=false;
export async function mountBillingRoute(){
  if(!listening){
    listening=true;
    window.addEventListener('hashchange',()=>{
      if(['#planos','#checkout','#assinatura','#plano-cobranca'].some(route=>location.hash.startsWith(route)))void mountBillingRoute();
      else if(location.hash==='#portal')void import('./portal').then(module=>module.mountMhPortal());
    });
  }
  if(location.hash.startsWith('#checkout'))return renderCheckout();
  if(location.hash.startsWith('#assinatura'))return renderConfirmation();
  if(location.hash.startsWith('#plano-cobranca'))return renderBillingAccount();
  return renderPlans();
}
