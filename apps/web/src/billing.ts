import { api, auth } from './cloudflare-client';
import { createIcons, ArrowLeft, Check, CreditCard, FileText, House, LogOut, ReceiptText, ShieldCheck } from 'lucide';
import './portal.css';
import './billing.css';

type Plan={code:string;name:string;interval:'monthly'|'yearly';priceCents:number;features:string[];limits:{maxUsers:number;maxProjects:number;maxDevices:number}};
type Order={id:string;plan_version_id:string;amount_cents:number;currency:string;financial_status:string;checkout_url?:string|null;reconciliation_required?:number;created_at:string;updated_at:string;plan_code?:string;plan_name?:string;interval_code?:string};
type Subscription={id:string;financial_status:string;current_period_end?:string|null;created_at:string;updated_at:string;plan_code?:string;plan_name?:string;price_cents?:number;currency?:string;interval_code?:string};
type BillingStatus={orders:Order[];subscriptions:Subscription[]};

const icons={ArrowLeft,Check,CreditCard,FileText,House,LogOut,ReceiptText,ShieldCheck};
const esc=(value:unknown)=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char] as string));
const money=(cents:number,currency='BRL')=>new Intl.NumberFormat('pt-BR',{style:'currency',currency}).format(cents/100);
const date=(value?:string|null)=>value?new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'long',year:'numeric'}).format(new Date(`${value.slice(0,10)}T12:00:00`)):'—';
const icon=(name:string)=>`<i data-lucide="${name}" aria-hidden="true"></i>`;
const errorText=(cause:unknown)=>{const error=cause as {response?:{status?:number;data?:{error?:string}};message?:string};return error.response?.data?.error||error.message||'Não foi possível concluir.'};
const selectedPlan=()=>new URLSearchParams(location.hash.split('?')[1]||'').get('plano')||'';

function setBody(content:string,current:'plans'|'confirmation'|'billing'){
  const nav=(id:string,label:string,href:string,iconName:string)=>`<a href="${href}" ${current===id?'aria-current="page"':''}>${icon(iconName)}<span>${label}</span></a>`;
  document.body.className='mh-portal-body billing-body';
  document.body.innerHTML=`<div class="billing-layout"><aside class="billing-sidebar"><a class="billing-brand" href="#portal"><img src="./artisys-icon.svg" alt=""><strong>ArtiSys</strong></a><nav aria-label="Área comercial">${nav('plans','Planos','#planos','file-text')}${nav('billing','Plano e cobrança','#plano-cobranca','receipt-text')}</nav><div class="billing-secure">${icon('shield-check')}<span>Pagamento seguro pelo Asaas</span></div></aside><div class="billing-stage"><header class="billing-top"><a href="#portal" class="billing-mobile-brand"><img src="./artisys-icon.svg" alt="ArtiSys"></a><a href="#portal" class="billing-back">${icon('arrow-left')} Voltar ao painel</a><button id="billingLogout" type="button">${icon('log-out')}<span>Sair</span></button></header><main class="billing-main">${content}</main></div></div><nav class="billing-bottom" aria-label="Área comercial">${nav('plans','Planos','#planos','file-text')}${nav('billing','Cobrança','#plano-cobranca','receipt-text')}${nav('home','Início','#portal','house')}</nav><div id="mhToast" class="mh-toast" role="status" aria-live="polite"></div>`;
  document.getElementById('billingLogout')?.addEventListener('click',()=>void auth.signOut());
  createIcons({icons});
}

function state(title:string,text:string){return `<section class="billing-state" role="status"><span class="billing-spinner"></span><h1>${esc(title)}</h1><p>${esc(text)}</p></section>`}
function showError(title:string,cause:unknown,retry:()=>void){setBody(`<section class="billing-state billing-state-error"><h1>${esc(title)}</h1><p>${esc(errorText(cause))}</p><button id="billingRetry" class="billing-primary">Tentar novamente</button></section>`,'plans');document.getElementById('billingRetry')?.addEventListener('click',retry)}

async function requireUser(){const user=await auth.getUser();if(!user){location.hash='#portal';return null}return user}

export async function renderPlans(){
  if(!await requireUser())return;
  setBody(state('Carregando planos','Buscando as opções disponíveis para sua operação.'),'plans');
  try{
    const plans=(await api.get<{plans:Plan[]}>('/api/billing/plans')).data.plans;
    const interval=new URLSearchParams(location.hash.split('?')[1]||'').get('periodo')==='yearly'?'yearly':'monthly';
    const visible=plans.filter(plan=>plan.interval===interval);
    setBody(`<header class="billing-hero"><span>PLANOS ARTISYS</span><h1>Escolha a estrutura certa para sua operação</h1><p>Desktop e PWA/mobile incluídos. Altere o período para comparar os valores.</p><div class="billing-toggle" aria-label="Período de cobrança"><a href="#planos?periodo=monthly" ${interval==='monthly'?'aria-current="true"':''}>Mensal</a><a href="#planos?periodo=yearly" ${interval==='yearly'?'aria-current="true"':''}>Anual <small>2 meses grátis</small></a></div></header><section class="billing-plan-grid" aria-label="Planos disponíveis">${visible.map(plan=>`<article class="billing-plan ${plan.code.startsWith('pro_')?'billing-plan-featured':''}">${plan.code.startsWith('pro_')?'<span class="billing-popular">MAIS ESCOLHIDO</span>':''}<h2>${esc(plan.name)}</h2><p class="billing-price"><strong>${money(plan.priceCents)}</strong><span>/${interval==='yearly'?'ano':'mês'}</span></p><p class="billing-limits">Até ${plan.limits.maxUsers} usuários · ${plan.limits.maxProjects} obras</p><ul>${plan.features.map(feature=>`<li>${icon('check')}<span>${esc(feature)}</span></li>`).join('')}</ul><a class="billing-primary" href="#checkout?plano=${encodeURIComponent(plan.code)}">Escolher ${esc(plan.name)}</a></article>`).join('')}</section>`,'plans');
  }catch(cause){showError('Não foi possível carregar os planos',cause,()=>void renderPlans())}
}

export async function renderCheckout(){
  if(!await requireUser())return;
  const planCode=selectedPlan();
  setBody(state('Preparando contratação','Validando o plano selecionado.'),'plans');
  try{
    const plans=(await api.get<{plans:Plan[]}>('/api/billing/plans')).data.plans,plan=plans.find(item=>item.code===planCode);
    if(!plan){location.hash='#planos';return}
    setBody(`<div class="billing-checkout"><section><span class="billing-eyebrow">CONTRATAÇÃO</span><h1>Confirme os dados da assinatura</h1><p>Você será direcionado à cobrança segura do Asaas após criar o pedido.</p><form id="checkoutForm"><label for="companyName">Nome da empresa</label><input id="companyName" name="companyName" maxlength="120" autocomplete="organization" required placeholder="Sua empresa"><button class="billing-primary" type="submit">Criar cobrança segura</button><small>${icon('shield-check')} Seus dados financeiros são preenchidos somente no ambiente do Asaas.</small></form></section><aside class="billing-summary"><span>RESUMO</span><h2>${esc(plan.name)}</h2><p>${plan.interval==='yearly'?'Cobrança anual':'Cobrança mensal'}</p><strong>${money(plan.priceCents)}</strong><ul>${plan.features.slice(0,4).map(feature=>`<li>${icon('check')}${esc(feature)}</li>`).join('')}</ul></aside></div>`,'plans');
    document.getElementById('checkoutForm')?.addEventListener('submit',async event=>{
      event.preventDefault();const form=event.currentTarget as HTMLFormElement,button=form.querySelector('button')!,companyName=(form.elements.namedItem('companyName') as HTMLInputElement).value.trim();if(!companyName)return;
      button.disabled=true;button.textContent='Criando cobrança…';
      try{const result=(await api.post<{order:Order}>('/api/billing/checkout',{planCode,companyName,idempotencyKey:crypto.randomUUID()})).data;sessionStorage.setItem('artisys-billing-order',result.order.id);location.hash=`#assinatura?pedido=${encodeURIComponent(result.order.id)}`;await renderConfirmation()}catch(cause){button.disabled=false;button.textContent='Criar cobrança segura';const toast=document.getElementById('mhToast')!;toast.textContent=errorText(cause);toast.classList.add('show')}
    });
  }catch(cause){showError('Não foi possível preparar a contratação',cause,()=>void renderCheckout())}
}

export async function renderConfirmation(){
  if(!await requireUser())return;
  const requested=new URLSearchParams(location.hash.split('?')[1]||'').get('pedido')||sessionStorage.getItem('artisys-billing-order')||'';
  setBody(state('Confirmando assinatura','Verificando o status mais recente da sua cobrança.'),'confirmation');
  try{
    const status=(await api.get<BillingStatus>('/api/billing/status')).data,order=status.orders.find(item=>item.id===requested)||status.orders[0];
    if(!order){location.hash='#planos';return}
    const paid=order.financial_status==='paid';
    setBody(`<section class="billing-confirmation"><div class="billing-confirmation-icon ${paid?'is-paid':''}">${icon(paid?'check':'credit-card')}</div><span class="billing-eyebrow">${paid?'ASSINATURA ATIVA':'PEDIDO CRIADO'}</span><h1>${paid?'Pagamento confirmado':'Conclua o pagamento no Asaas'}</h1><p>${paid?'Sua licença foi ativada. Você já pode seguir para a configuração da operação.':'A licença será liberada automaticamente após a confirmação do pagamento.'}</p><div class="billing-order"><span>Pedido <strong>${esc(order.id.slice(0,8).toUpperCase())}</strong></span><span>Valor <strong>${money(order.amount_cents,order.currency)}</strong></span><span>Status <strong>${esc(statusLabel(order.financial_status))}</strong></span></div>${paid?'<a class="billing-primary" href="#portal">Ir para o painel</a>':`${order.checkout_url?`<a class="billing-primary" href="${esc(order.checkout_url)}" target="_blank" rel="noopener noreferrer">Pagar com Asaas</a>`:''}<button id="refreshBilling" class="billing-secondary">Já paguei · verificar novamente</button>`}<a class="billing-text-link" href="#plano-cobranca">Ver plano e cobrança</a></section>`,'confirmation');
    document.getElementById('refreshBilling')?.addEventListener('click',()=>void renderConfirmation());
  }catch(cause){showError('Não foi possível confirmar a assinatura',cause,()=>void renderConfirmation())}
}

const statusLabel=(status:string)=>({created:'Criado',pending:'Aguardando pagamento',paid:'Pago',overdue:'Em atraso',canceled:'Cancelado',refunded:'Estornado'}[status]||status);
export async function renderBillingAccount(){
  if(!await requireUser())return;
  setBody(state('Carregando cobrança','Consultando sua assinatura e pagamentos.'),'billing');
  try{
    const status=(await api.get<BillingStatus>('/api/billing/status')).data,subscription=status.subscriptions[0],order=status.orders[0];
    if(!subscription&&!order){setBody(`<header class="billing-page-head"><span class="billing-eyebrow">CONFIGURAÇÕES</span><h1>Plano e cobrança</h1><p>Gerencie sua contratação do ArtiSys.</p></header><section class="billing-empty"><h2>Nenhum plano contratado</h2><p>Escolha um plano para liberar sua operação no Desktop e PWA/mobile.</p><a class="billing-primary" href="#planos">Ver planos</a></section>`,'billing');return}
    const current=subscription||order!;const price=subscription?.price_cents??order?.amount_cents??0,currency=subscription?.currency??order?.currency??'BRL';
    setBody(`<header class="billing-page-head"><span class="billing-eyebrow">CONFIGURAÇÕES</span><h1>Plano e cobrança</h1><p>Acompanhe sua assinatura e o status financeiro.</p></header><section class="billing-account-card"><div><span>PLANO ATUAL</span><h2>${esc(current.plan_name||'ArtiSys')}</h2><p>${current.interval_code==='yearly'?'Assinatura anual':'Assinatura mensal'}</p></div><div class="billing-account-price"><strong>${money(price,currency)}</strong><span>${current.interval_code==='yearly'?'/ano':'/mês'}</span></div><span class="billing-status billing-status-${esc(current.financial_status)}">${esc(statusLabel(current.financial_status))}</span></section><section class="billing-details"><article><span>Próxima renovação</span><strong>${date(subscription?.current_period_end)}</strong></article><article><span>Forma de pagamento</span><strong>Gerenciada pelo Asaas</strong></article><article><span>Licença</span><strong>${current.financial_status==='paid'?'Ativa':'Aguardando confirmação'}</strong></article></section><div class="billing-actions"><a class="billing-secondary" href="#planos">Trocar plano</a>${order?.checkout_url&&order.financial_status!=='paid'?`<a class="billing-primary" href="${esc(order.checkout_url)}" target="_blank" rel="noopener noreferrer">Resolver pagamento</a>`:''}</div><p class="billing-note">Cancelamentos e alterações financeiras são processados com segurança pelo atendimento ArtiSys e pelo Asaas.</p>`,'billing');
  }catch(cause){showError('Não foi possível carregar plano e cobrança',cause,()=>void renderBillingAccount())}
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
