import { auth, api } from './cloudflare-client';
import './owner.css';

type Company = {id:string;name:string;adminEmail:string;status:string;reserved?:boolean;modules:string[];channels:string[];passwordCreatedAt?:string;usersCount:number;projectsCount:number;devicesCount:number;license?:{id:string;plan?:string;expiresAt?:string;code?:string};users?:Array<{email:string;name?:string;role?:string}>;projects?:Array<{name:string}>;devices?:Array<{name:string;status?:string}>};
type DeboraLicenseResponse={state?:string;activation?:string;grant?:{email?:string;status?:string;expires_at?:string;plan_code?:string}|null};
type OwnerView='overview'|'obra'|'debora'|'clients'|'licenses';

const modules=['finance','rh','contracts','rdo','obra360','dre','procurement','measurements','documents','universidade','ai'];
const labels:Record<string,string>={finance:'Financeiro',rh:'RH',contracts:'Contratos',rdo:'RDO',obra360:'Obra360',dre:'DRE',procurement:'Compras',measurements:'Medições',documents:'Documentos',universidade:'Universidade',ai:'IA',desktop:'Desktop',mobile:'Web / mobile'};
const viewLabels:Record<OwnerView,string>={overview:'Visão geral',obra:'Obra na Mão',debora:'Débora Lactação',clients:'Clientes',licenses:'Licenças'};
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const root=()=>document.getElementById('content')!;
const message=(e:unknown)=>(e as {message?:string}).message||'Não foi possível concluir.';
const state=(c:Company)=>c.status==='expired'?'Vencida':c.status==='suspended'||c.status==='revoked'?'Suspensa':c.status==='active'?'Ativa':'Aguardando ativação';
function choices(name:string,items:string[],selected:string[]){return items.map(k=>`<label class="check"><input type="checkbox" name="${name}" value="${k}" ${selected.includes(k)?'checked':''}>${labels[k]||k}</label>`).join('')}
function selected(form:HTMLFormElement,name:string){return [...form.querySelectorAll<HTMLInputElement>(`input[name="${name}"]:checked`)].map(x=>x.value)}

let ownerView:OwnerView='overview';
let ownerCompanies:Company[]=[];
let createMessage='';

function header(){return `<header class="owner-hero"><div><small>SUPERADMIN ARTISYS</small><h1>Central Artisys</h1><p>Produtos, clientes e licenças em áreas separadas para reduzir risco operacional.</p></div><div class="owner-hero-actions"><a class="owner-secondary" href="./index.html#portal">Minha operação</a><button id="centralLogout" class="owner-secondary">Sair</button></div></header>`}
function navigation(active:OwnerView){return `<nav class="owner-nav" aria-label="Navegação do superadmin">${(Object.keys(viewLabels) as OwnerView[]).map(view=>`<button type="button" data-owner-view="${view}" class="owner-nav-item ${active===view?'is-active':''}" aria-current="${active===view?'page':'false'}">${viewLabels[view]}</button>`).join('')}</nav>`}
function shell(content:string){return `<div class="owner-shell" data-owner-shell>${header()}${navigation(ownerView)}<div class="owner-view" data-owner-current="${ownerView}">${content}</div></div>`}
function logout(){document.getElementById('centralLogout')?.addEventListener('click',async()=>{await auth.signOut();location.href='./index.html'})}
function bindNavigation(){
  document.querySelectorAll<HTMLButtonElement>('[data-owner-view]').forEach(button=>button.addEventListener('click',()=>{
    const next=button.dataset.ownerView as OwnerView;
    if(next&&next!==ownerView){ownerView=next;renderCurrentView()}
  }));
  document.querySelectorAll<HTMLButtonElement>('[data-owner-open]').forEach(button=>button.addEventListener('click',()=>{
    ownerView=button.dataset.ownerOpen as OwnerView;renderCurrentView();
  }));
}

function showOwnerLogin(){
  root().innerHTML=`<section class="auth-page"><div class="auth-card"><h1>Central Artisys</h1><p>Gestão de empresas. Acesso exclusivo do superadmin.</p><form id="centralLogin"><label>E-mail<input name="email" type="email" autocomplete="username" required></label><label>Senha<input name="password" type="password" autocomplete="current-password" required></label><button class="btn" type="submit">Entrar</button><p id="centralLoginResult" role="status"></p></form></div></section>`;
  const form=document.getElementById('centralLogin') as HTMLFormElement,result=document.getElementById('centralLoginResult')!;
  form.onsubmit=async e=>{e.preventDefault();const values=new FormData(form),button=form.querySelector<HTMLButtonElement>('button[type="submit"]')!;button.disabled=true;result.textContent='Entrando…';try{await api.post('/api/auth/password/login',{email:String(values.get('email')||'').trim(),password:String(values.get('password')||'')});location.reload()}catch(error){result.textContent=message(error);button.disabled=false}};
}

function metric(label:string,value:number,detail:string,key:string){return `<article class="owner-metric" data-metric="${key}"><span>${esc(label)}</span><strong>${value}</strong><small>${esc(detail)}</small></article>`}
function overviewView(companies:Company[]){
  const active=companies.filter(c=>state(c)==='Ativa').length;
  const pending=companies.filter(c=>state(c)==='Aguardando ativação').length;
  const licenses=companies.filter(c=>Boolean(c.license)).length;
  return `<section class="owner-section owner-overview"><div class="owner-section-head"><div><span class="owner-eyebrow">VISÃO GERAL</span><h2>Operação da Central</h2><p>Resumo rápido. As ações de provisionamento ficam dentro de cada produto.</p></div></div><div class="owner-metrics">${metric('Empresas clientes',companies.length,'Obra na Mão','companies')}${metric('Licenças',licenses,'Licenças empresariais','licenses')}${metric('Ativas',active,'Empresas em operação','active')}${metric('Pendentes',pending,'Aguardando ativação','pending')}</div></section><section class="owner-section"><div class="owner-section-head"><div><span class="owner-eyebrow">PRODUTOS</span><h2>Gerenciar por produto</h2></div></div><div class="owner-product-grid"><article class="owner-product-card"><div class="owner-product-icon">OM</div><div><span class="owner-product-label">B2B / OBRAS</span><h3>Obra na Mão</h3><p>${companies.length} empresa(s) cliente(s) · ${active} ativa(s).</p></div><button type="button" class="owner-primary" data-owner-open="obra">Gerenciar</button></article><article class="owner-product-card"><div class="owner-product-icon owner-product-icon-debora">DL</div><div><span class="owner-product-label">SAÚDE / SaaS</span><h3>Débora Lactação</h3><p>Licenciamento Pro por e-mail, separado das empresas do Obra na Mão.</p></div><button type="button" class="owner-primary" data-owner-open="debora">Gerenciar</button></article></div></section>`;
}

function companyForm(){return `<section class="owner-section owner-form-section"><div class="owner-section-head"><div><span class="owner-eyebrow">OBRA NA MÃO</span><h2>Nova empresa cliente</h2><p>Provisiona uma empresa independente e gera a licença/código de primeiro acesso do Obra na Mão.</p></div></div><form id="companyForm" class="owner-form-card"><div class="owner-form-grid"><label>Empresa<input name="name" required maxlength="120" placeholder="Nome da empresa"></label><label>E-mail do admin principal<input name="adminEmail" type="email" required placeholder="admin@empresa.com"></label><label>Plano<input name="plan" value="manual" required></label></div><div class="owner-form-block"><h3>Módulos contratados</h3><div class="owner-choice-grid">${choices('modules',modules,modules)}</div></div><div class="owner-form-block"><h3>Canais</h3><div class="owner-choice-grid compact">${choices('channels',['desktop','mobile'],['desktop','mobile'])}</div></div><div class="owner-form-actions"><button class="owner-primary" type="submit">Criar empresa e gerar licença</button><p id="createResult" role="status">${esc(createMessage)}</p></div></form></section>`}
function obraView(companies:Company[]){return `<section class="owner-product-banner"><div><span class="owner-eyebrow">PRODUTO</span><h2>Obra na Mão</h2><p>Empresas, módulos, canais e códigos de primeiro acesso deste produto.</p></div><div class="owner-banner-stats"><strong>${companies.length}</strong><span>empresas clientes</span></div></section>${companyForm()}`}

function deboraLicenseCard(){return `<section class="owner-section"><div class="owner-section-head"><div><span class="owner-eyebrow">DÉBORA LACTAÇÃO</span><h2>Licenciamento Pro</h2><p>A licença da Débora usa o e-mail da consultora e permanece separada das empresas do Obra na Mão.</p></div><a class="owner-secondary" href="https://deboralactacao.com/admin/seo/" target="_blank" rel="noopener">Abrir painel SEO</a></div><form id="deboraLicenseForm" class="owner-form-card owner-debora-card"><div class="owner-form-grid single"><label>E-mail da cliente<input name="email" type="email" required autocomplete="off" placeholder="cliente@exemplo.com"></label></div><div class="owner-form-actions row"><button class="owner-primary" type="submit">Liberar 6 meses</button><button class="owner-secondary" type="button" id="deboraLicenseStatus">Consultar</button><button class="owner-danger" type="button" id="deboraLicenseRevoke">Revogar</button></div><p id="deboraLicenseResult" role="status"></p></form></section>`}
function deboraView(){return `<section class="owner-product-banner debora"><div><span class="owner-eyebrow">PRODUTO</span><h2>Débora Lactação</h2><p>Controle comercial da assinatura sem misturar com o provisionamento empresarial do Obra na Mão.</p></div><div class="owner-banner-stats"><strong>6</strong><span>meses no Pro manual</span></div></section>${deboraLicenseCard()}`}

function companyCard(c:Company){return `<article class="owner-client-card"><div class="owner-client-main"><span class="owner-status status-${c.status}">${state(c)}</span><h3>${esc(c.name)}</h3><p>${esc(c.adminEmail)}</p></div><div class="owner-client-meta"><span>${esc(c.license?.plan||'Manual')}</span><span>${c.usersCount} usuário(s)</span><span>${c.projectsCount} obra(s)</span><span>${c.devicesCount} dispositivo(s)</span></div><button class="owner-secondary" type="button" data-company="${esc(c.id)}">Ver empresa e licença</button></article>`}
function clientsView(companies:Company[]){return `<section class="owner-section"><div class="owner-section-head"><div><span class="owner-eyebrow">OBRA NA MÃO</span><h2>Clientes do Obra na Mão</h2><p>Empresas independentes provisionadas para o produto.</p></div><button class="owner-primary" type="button" data-owner-open="obra">Nova empresa</button></div><div class="owner-client-list">${companies.map(companyCard).join('')||'<div class="owner-empty">Nenhuma empresa cliente cadastrada.</div>'}</div></section>`}
function licensesView(companies:Company[]){return `<section class="owner-section"><div class="owner-section-head"><div><span class="owner-eyebrow">OBRA NA MÃO</span><h2>Licenças do Obra na Mão</h2><p>Visão operacional das licenças empresariais. A licença da Débora permanece em sua área própria.</p></div></div><div class="owner-license-list">${companies.map(c=>`<article class="owner-license-row"><div><span class="owner-status status-${c.status}">${state(c)}</span><strong>${esc(c.name)}</strong><small>${esc(c.adminEmail)}</small></div><div><span>${esc(c.license?.plan||'Manual')}</span><small>${c.license?.expiresAt?`Validade ${esc(new Date(c.license.expiresAt).toLocaleDateString('pt-BR'))}`:'Sem vencimento definido'}</small></div><button class="owner-secondary" type="button" data-company="${esc(c.id)}">Gerenciar</button></article>`).join('')||'<div class="owner-empty">Nenhuma licença empresarial cadastrada.</div>'}</div></section>`}

function describeDeboraLicense(data:DeboraLicenseResponse){
  if(!data.grant)return data.state==='none'?'Nenhuma licença manual encontrada para este e-mail.':'Operação concluída.';
  const expires=data.grant.expires_at?new Date(data.grant.expires_at).toLocaleDateString('pt-BR'):'—';
  const status=data.state||data.grant.status||data.activation||'atualizada';
  const activation=data.activation&&data.activation!==status?` · ativação: ${data.activation}`:'';
  return `Licença ${status}${activation} · validade: ${expires}.`;
}
function bindDeboraLicense(){
  const form=document.getElementById('deboraLicenseForm') as HTMLFormElement|null,result=document.getElementById('deboraLicenseResult');
  if(!form||!result)return;
  const email=()=>String(new FormData(form).get('email')||'').trim();
  const run=async(action:'grant'|'status'|'revoke',button:HTMLButtonElement)=>{button.disabled=true;result.textContent=action==='grant'?'Liberando acesso...':action==='revoke'?'Revogando licença...':'Consultando licença...';try{const {data}=await api.post<DeboraLicenseResponse>('/api/owner/debora-license',{action,email:email()});result.textContent=describeDeboraLicense(data)}catch(error){result.textContent=message(error)}finally{button.disabled=false}};
  form.onsubmit=e=>{e.preventDefault();void run('grant',form.querySelector<HTMLButtonElement>('button[type="submit"]')!)};
  const status=document.getElementById('deboraLicenseStatus') as HTMLButtonElement|null,revoke=document.getElementById('deboraLicenseRevoke') as HTMLButtonElement|null;
  if(status)status.onclick=()=>void run('status',status);
  if(revoke)revoke.onclick=()=>void run('revoke',revoke);
}

function bindCompanyCreation(){
  const form=document.getElementById('companyForm') as HTMLFormElement|null;if(!form)return;
  form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector<HTMLButtonElement>('button[type="submit"]')!,values=new FormData(form);button.disabled=true;try{const {data}=await api.post('/api/owner/companies',{name:values.get('name'),adminEmail:values.get('adminEmail'),plan:values.get('plan'),modules:selected(form,'modules'),channels:selected(form,'channels')});createMessage=`Empresa criada. E-mail: ${values.get('adminEmail')}. Código de primeiro acesso: ${data.license.code}. Guarde o código e entregue ao admin principal.`;const result=document.getElementById('createResult');if(result)result.textContent=createMessage;await refreshCompanies()}catch(error){const result=document.getElementById('createResult');if(result)result.textContent=message(error)}finally{button.disabled=false}};
}
function bindCompanyButtons(){document.querySelectorAll<HTMLButtonElement>('[data-company]').forEach(button=>button.onclick=()=>void detail(button.dataset.company!).catch(error=>alert(message(error))))}
function bindCurrentView(){logout();bindNavigation();bindDeboraLicense();bindCompanyCreation();bindCompanyButtons()}

function renderCurrentView(){
  const content=ownerView==='overview'?overviewView(ownerCompanies):ownerView==='obra'?obraView(ownerCompanies):ownerView==='debora'?deboraView():ownerView==='clients'?clientsView(ownerCompanies):licensesView(ownerCompanies);
  root().innerHTML=shell(content);bindCurrentView();
}
async function refreshCompanies(){const {data}=await api.get<{companies:Company[]}>('/api/owner/companies');ownerCompanies=data.companies||[]}

async function detail(id:string){
  const {data}=await api.get<{company:Company}>(`/api/owner/companies/${encodeURIComponent(id)}`),c=data.company;
  root().innerHTML=shell(`<button id="backCompanies" class="owner-secondary owner-back">← Clientes</button><section class="owner-section"><div class="owner-section-head"><div><span class="owner-status status-${c.status}">${state(c)}</span><h2>${esc(c.name)}</h2><p>Admin principal: ${esc(c.adminEmail)}</p></div></div><div class="owner-detail-grid"><article><span>Senha criada</span><strong>${c.passwordCreatedAt?esc(c.passwordCreatedAt):'Aguardando primeiro acesso'}</strong></article><article><span>Plano</span><strong>${esc(c.license?.plan||'Manual')}</strong></article><article><span>Validade</span><strong>${esc(c.license?.expiresAt||'Sem vencimento')}</strong></article></div></section><form id="licenseForm" class="owner-section owner-form-card"><div class="owner-section-head"><div><h2>Licença da empresa</h2><p>Configuração exclusiva do Obra na Mão.</p></div></div><div class="owner-form-block"><h3>Módulos</h3><div class="owner-choice-grid">${choices('modules',modules,c.modules)}</div></div><div class="owner-form-block"><h3>Canais</h3><div class="owner-choice-grid compact">${choices('channels',['desktop','mobile'],c.channels)}</div></div><label>Status<select name="status"><option value="active" ${state(c)!=='Suspensa'?'selected':''}>Liberada</option><option value="suspended" ${state(c)==='Suspensa'?'selected':''}>Suspensa</option></select></label><div class="owner-form-actions"><button class="owner-primary">Salvar licença</button><p role="status" id="licenseResult"></p></div></form><section class="owner-detail-columns"><article class="owner-section"><h2>Usuários</h2>${(c.users||[]).map(u=>`<p>${esc(u.name||u.email)} · ${esc(u.email)} · ${esc(u.role||'')}</p>`).join('')||'<p>Nenhum usuário ativado.</p>'}</article><article class="owner-section"><h2>Obras</h2>${(c.projects||[]).map(p=>`<p>${esc(p.name)}</p>`).join('')||'<p>Nenhuma obra cadastrada.</p>'}</article><article class="owner-section"><h2>Dispositivos</h2>${(c.devices||[]).map(d=>`<p>${esc(d.name)} · ${esc(d.status)}</p>`).join('')||'<p>Nenhum desktop ativado.</p>'}</article></section>`);
  bindCurrentView();
  document.getElementById('backCompanies')!.onclick=()=>{ownerView='clients';renderCurrentView()};
  document.getElementById('licenseForm')!.onsubmit=async e=>{e.preventDefault();const form=e.currentTarget as HTMLFormElement,button=form.querySelector<HTMLButtonElement>('button')!;button.disabled=true;try{await api.put(`/api/owner/companies/${encodeURIComponent(id)}`,{modules:selected(form,'modules'),channels:selected(form,'channels'),status:new FormData(form).get('status')});document.getElementById('licenseResult')!.textContent='Licença atualizada.';await refreshCompanies()}catch(error){document.getElementById('licenseResult')!.textContent=message(error)}finally{button.disabled=false}};
}

async function render(){
  document.querySelector('.nav')?.setAttribute('style','display:none');document.querySelector('.top')?.setAttribute('style','display:none');document.title='Central Artisys — Superadmin';
  if(!await auth.hasSession()){showOwnerLogin();return}
  try{await refreshCompanies();renderCurrentView()}catch(e){root().innerHTML=`<section class="card"><h1>Central Artisys</h1><p>${esc(message(e))}</p><a href="./index.html#portal">Voltar à minha operação</a></section>`}
}
export async function mountOwnerPortal(){await render()}
