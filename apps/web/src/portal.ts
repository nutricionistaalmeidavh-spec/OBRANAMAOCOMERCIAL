import { api, auth } from './cloudflare-client';
import { APP_VERSION } from '../shared/version';
import './portal.css';
import { createIcons, Eye, EyeOff, ChevronRight, FileText, HardHat, GraduationCap, House, Ellipsis, LogOut, ArrowLeft, ShieldCheck, Plus, Building2 } from 'lucide';
import { canReadOverview } from '../shared/portal-overview';
import { loadPortalOverview } from './portal-overview';

type Role='admin'|'foreman'|'employee';
type SystemKey='gestao'|'obra360'|'universidade'|'finance';
type PlatformAccess={id:string;email:string;platformRole:string;status:'pending'|'active'|'blocked';employeeId?:string|null;companyIds:string[];projectIds:string[];systems:Record<SystemKey,{enabled:boolean;role:string}>};
type Bootstrap={needsClaim:boolean;authorized?:boolean;isOwner?:boolean;platformRole?:string;platformAccess?:PlatformAccess;role?:Role;access?:{modules:string[];channels:string[]};license?:{modules?:string[];channels?:string[]}|null;company?:{name?:string};project?:{name?:string};user?:{email?:string;name?:string};membership?:{email?:string}};
type Participant={id:string;name:string;phone:string;email?:string|null;jobRole:string;mustChangePassword:boolean};

const SESSION='obn-edu-session';
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] as string));
const digits=(v:string)=>v.replace(/\D/g,'');
const apiErr=(e:unknown)=>{const x=e as {response?:{data?:{error?:string;message?:string}};message?:string};return x.response?.data?.error||x.response?.data?.message||x.message||'Não foi possível concluir.'};

const icons = { Eye, EyeOff, ChevronRight, FileText, HardHat, GraduationCap, House, Ellipsis, LogOut, ArrowLeft, ShieldCheck, Plus, Building2 };
const icon = (name:string) => `<i data-lucide="${name}" aria-hidden="true"></i>`;
const googleMark = () => '<svg class="cp-google-mark" viewBox="0 0 18 18" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.797 2.716v2.258h2.909c1.702-1.567 2.684-3.875 2.684-6.614z"/><path fill="#34A853" d="M9 18c2.43 0 4.468-.806 5.956-2.18l-2.909-2.259c-.806.54-1.836.86-3.047.86-2.344 0-4.328-1.585-5.036-3.714H.956v2.332A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.707A5.42 5.42 0 0 1 3.682 9c0-.592.102-1.168.282-1.707V4.961H.956A9 9 0 0 0 0 9c0 1.45.347 2.824.956 4.039l3.008-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.507.454 3.442 1.345l2.581-2.582C13.464.892 11.426 0 9 0A9 9 0 0 0 .956 4.961l3.008 2.332C4.672 5.164 6.656 3.58 9 3.58z"/></svg>';
const vendor = () => '<a class="cp-vendor" href="./" aria-label="ArtiSys — página principal" title="ArtiSys"><img src="./artisys-icon.svg" alt="ArtiSys" width="26" height="26"></a>';
function brand(){return '<span class="cp-wordmark">Canteiro<span>360</span></span>'}
function portalGreeting(name:string){
  const first=name.trim().split(/\s+/)[0]||name;
  const hour=new Date().getHours();
  const greeting=hour<12?'Bom dia':hour<18?'Boa tarde':'Boa noite';
  return `${greeting}, ${first}`;
}

function setBody(html:string){document.body.className='mh-portal-body';document.body.innerHTML=`<div id="mhPortal">${html}</div><div id="mhToast" class="mh-toast" role="status" aria-live="polite"></div>`;createIcons({icons});}
function toast(text:string){const e=document.getElementById('mhToast');if(!e)return;e.textContent=text;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),4500)}
function card(key:string,title:string,text:string,href:string,_icon:string,role?:string){const names:Record<string,string>={gestao:'file-text',obra:'hard-hat',universidade:'graduation-cap',acessos:'shield-check',ativar:'plus',cobranca:'file-text'};return `<a class="cp-module" data-resource="${esc(key)}" href="${esc(href)}" aria-label="${esc(title)}${role?` — ${esc(role)}`:''}" title="${esc(text)}">${icon(names[key]||'file-text')}<span>${esc(title)}</span>${icon('chevron-right')}</a>`}

export function shouldRouteCorporateToPlans(b:Pick<Bootstrap,'needsClaim'|'isOwner'|'platformRole'|'platformAccess'>){
  const status=b.platformAccess?.status;
  return !!b.needsClaim&&!b.isOwner&&b.platformRole!=='superadmin'&&status!=='pending'&&status!=='blocked';
}

function publicHome(){
  setBody(`<main class="cp-login">
    <a class="cp-back" href="./">${icon('arrow-left')}<span>Página principal</span></a>
    <div class="cp-login-content"><div class="cp-login-brand"><img src="./canteiro360-logo.png" alt="Canteiro360 — controle total da obra" width="1448" height="1086"></div>
    <section class="cp-login-form" aria-labelledby="loginTitle"><h1 id="loginTitle">Acesse sua operação</h1><p>Entre com a conta responsável pela sua empresa.</p>
    <button id="googleLogin" type="button" class="cp-google">${googleMark()}<span>Continuar com Google</span></button></section></div>
    <a class="cp-login-switch" href="./sistema.html#colaborador"><span>Acesso do colaborador</span>${icon('chevron-right')}</a>
    <footer class="cp-login-footer"><span>Controle total da obra <small class="cp-version">v${APP_VERSION}</small></span>${vendor()}</footer>
  </main>`);
  document.getElementById('googleLogin')?.addEventListener('click',async()=>{try{await auth.signIn({scope:'openid email profile'})}catch(e){toast(apiErr(e))}});
}
function collaboratorHome(){
  setBody(`<main class="cp-login cp-collaborator-login">
    <a class="cp-back" href="./">${icon('arrow-left')}<span>Página principal</span></a>
    <div class="cp-login-content"><div class="cp-login-brand"><img src="./canteiro360-logo.png" alt="Canteiro360 — controle total da obra" width="1448" height="1086"></div>
    <section class="cp-login-form" aria-labelledby="collaboratorLoginTitle"><h1 id="collaboratorLoginTitle">Acesso do colaborador</h1><p>Use o celular liberado pela sua empresa e a sua senha.</p>
    <form id="phoneLogin">
      <label for="phoneIdentity">Celular</label><input id="phoneIdentity" type="tel" inputmode="tel" autocomplete="username" placeholder="(11) 99999-9999" required maxlength="22">
      <label for="phonePassword">Senha</label><div class="cp-password"><input id="phonePassword" type="password" autocomplete="current-password" required><button id="togglePassword" type="button" aria-label="Mostrar senha" aria-pressed="false">${icon('eye')}</button></div>
      <button class="mh-primary" id="phoneSubmit" type="submit">Entrar</button>
      <button class="cp-text-button" type="button" id="phoneFirst">Primeiro acesso</button>
    </form></section></div>
    <a class="cp-login-switch" href="./sistema.html#portal"><span>Acesso da empresa</span>${icon('chevron-right')}</a>
    <footer class="cp-login-footer"><span>Acesso exclusivo de colaboradores <small class="cp-version">v${APP_VERSION}</small></span>${vendor()}</footer>
  </main>`);
  document.getElementById('togglePassword')?.addEventListener('click',()=>{
    const input=document.getElementById('phonePassword') as HTMLInputElement,button=document.getElementById('togglePassword')!;
    const visible=input.type==='password';input.type=visible?'text':'password';button.setAttribute('aria-pressed',String(visible));button.setAttribute('aria-label',visible?'Ocultar senha':'Mostrar senha');button.innerHTML=icon(visible?'eye-off':'eye');createIcons({icons});
  });
  document.getElementById('phoneLogin')?.addEventListener('submit',async e=>{
    e.preventDefault();
    const identifier=(document.getElementById('phoneIdentity') as HTMLInputElement).value.trim();
    const password=(document.getElementById('phonePassword') as HTMLInputElement).value;
    if(digits(identifier).length<10||!password)return toast('Informe celular e senha.');
    const submit=document.getElementById('phoneSubmit') as HTMLButtonElement;submit.disabled=true;submit.textContent='Entrando…';
    try{
      const data=(await api.post('/api/edu/login',{identifier,password})).data as {token:string;participant:Participant};
      localStorage.setItem(SESSION,data.token);location.hash='#portal';await renderPhonePortal(data.participant)
    }catch(err){toast(apiErr(err))}finally{submit.disabled=false;submit.textContent='Entrar'}
  });
  document.getElementById('phoneFirst')?.addEventListener('click',showFirstAccess);
}
async function showFirstAccess(){
  const identifier=(document.getElementById('phoneIdentity') as HTMLInputElement|null)?.value.trim()||'';
  if(digits(identifier).length<10)return toast('Informe o celular liberado pela empresa.');
  try{
    const state=(await api.post('/api/edu/access-status',{identifier})).data as {needsPasswordSetup:boolean};
    if(!state.needsPasswordSetup)return toast('Este celular já possui senha.');
    const form=document.getElementById('phoneLogin') as HTMLFormElement|null;if(!form)return;
    form.outerHTML=`<form id="phoneSetup"><label>Celular<input value="${esc(identifier)}" disabled></label><label>Crie sua senha<input id="newPassword" type="password" minlength="8" autocomplete="new-password" required></label><label>Confirme a senha<input id="confirmPassword" type="password" minlength="8" autocomplete="new-password" required></label><button type="submit" class="mh-primary" id="createPassword">Criar senha e entrar</button><button type="button" class="cp-text-button" id="backToLogin">Voltar ao login</button></form>`;
    document.getElementById('backToLogin')?.addEventListener('click',collaboratorHome);
    (document.getElementById('newPassword') as HTMLInputElement)?.focus();
    document.getElementById('phoneSetup')?.addEventListener('submit',async(event)=>{
      event.preventDefault();
      const password=(document.getElementById('newPassword') as HTMLInputElement).value,confirm=(document.getElementById('confirmPassword') as HTMLInputElement).value;
      if(password.length<8)return toast('Use ao menos 8 caracteres.');if(password!==confirm)return toast('As senhas não coincidem.');
      try{
        const data=(await api.post('/api/edu/first-access',{identifier,password})).data as {token:string;participant:Participant};
        localStorage.setItem(SESSION,data.token);location.hash='#portal';await renderPhonePortal(data.participant)
      }catch(err){toast(apiErr(err))}
    })
  }catch(err){toast(apiErr(err))}
}
function portalShell(name:string,meta:string,cards:string,context?:Bootstrap){
  const hasObra=cards.includes('data-resource="obra"');
  const initials=name.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase();
  setBody(`<header class="cp-header"><div class="cp-header-inner">${brand()}<details class="cp-account"><summary aria-label="Menu da conta">${esc(initials||'EU')}</summary><div><strong>${esc(name)}</strong><a href="./">Página principal</a><button id="logoutBtn" type="button">${icon('log-out')}Sair</button></div></details></div></header>
    <main class="cp-dashboard"><div class="cp-context">${icon('building-2')}<span>${esc(meta)}</span></div>
    <section class="cp-welcome"><h1>Visão geral</h1><p>${esc(portalGreeting(name))}</p></section>
    <div class="cp-dashboard-grid"><div id="portalOverview" aria-live="polite">${context&&canReadOverview(context)?'<p class="cp-loading" role="status">Carregando resumo…</p>':''}</div>
    <section class="cp-section cp-module-section" id="portalModules"><h2>Seus módulos</h2><div class="cp-modules">${cards}</div></section></div>
    <footer class="cp-dashboard-footer"><span>Acessos conforme seu perfil. <small class="cp-version">v${APP_VERSION}</small></span>${vendor()}</footer></main>
    <nav class="cp-bottom-nav" aria-label="Navegação principal"><a href="#portal" aria-current="page">${icon('house')}<span>Início</span></a>${hasObra?`<a href="./obra.html#obra">${icon('hard-hat')}<span>Obras</span></a>`:''}<button id="moreModules" type="button">${icon('ellipsis')}<span>Mais</span></button></nav>`);
  document.getElementById('logoutBtn')?.addEventListener('click',()=>void logout());
  document.getElementById('moreModules')?.addEventListener('click',()=>{document.getElementById('portalModules')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});document.querySelector<HTMLAnchorElement>('.cp-module')?.focus({preventScroll:true})});
  if(context&&canReadOverview(context)){
    const target=document.getElementById('portalOverview')!;
    const refresh=async()=>{const html=await loadPortalOverview(context);if(!target.isConnected)return;target.innerHTML=html;target.querySelector('#retryOverview')?.addEventListener('click',()=>void refresh());};
    void refresh();
  }
}
async function renderPhonePortal(p:Participant){
  let cards=card('universidade','Universidade','Capacitação, diagnóstico e trilhas personalizadas.','./universidade.html#universidade','▱','colaborador'),meta=`${p.jobRole||'Colaborador'} · acesso por celular`;
  try{
    const token=localStorage.getItem(SESSION)||'',b=(await api.post('/api/phone/bootstrap',{token})).data as Bootstrap;
    if(b.access?.modules?.includes('obra360'))cards=card('obra','Obra360','Dias, frentes, equipe, presença e rotina de campo.','./obra.html#obra','⌂','encarregado')+cards;
    meta=`${b.company?.name||'Empresa'}${b.project?.name?` · ${b.project.name}`:''} · acesso por celular`;
  }catch{}
  portalShell(p.name,meta,cards)
}
async function renderCorporatePortal(){
  try{
    const user=await auth.getUser();if(!user)return publicHome();
    const b=(await api.get('/api/bootstrap')).data as Bootstrap,pa=b.platformAccess;
    if(pa?.status==='blocked'){portalShell(user.name||user.email||'Usuário','Acesso bloqueado','<article class="mh-empty"><h3>Acesso bloqueado</h3><p>Procure o administrador da sua empresa.</p></article>');return}
    if(pa?.status==='pending'){
      portalShell(user.name||user.email||'Usuário','Credencial provisória pendente','<article class="mh-empty"><h3>Ativar credencial</h3><p>Informe o código provisório fornecido pelo administrador.</p><input id="platformCode" maxlength="12" placeholder="CÓDIGO"><button id="claimPlatform" class="mh-primary">Ativar acesso</button></article>');
      document.getElementById('claimPlatform')?.addEventListener('click',async()=>{try{const code=(document.getElementById('platformCode') as HTMLInputElement).value.trim().toUpperCase();await api.post('/api/platform/claim',{code});await renderCorporatePortal()}catch(e){toast(apiErr(e))}});return
    }
    if(shouldRouteCorporateToPlans(b)){location.hash='#planos';await import('./billing').then(module=>module.mountBillingRoute());return}
    const systems=pa?.systems;let cards='';
    if(systems?.gestao?.enabled&&b.role==='admin'&&!b.needsClaim&&b.access?.modules?.some(module=>['rh','dre','contracts','procurement','measurements','documents'].includes(module)))cards+=card('gestao','Gestão','RH, documentos, contratos, compras, medições e visão administrativa.','./gestao.html#gestao','▥',systems.gestao.role);
    if(systems?.obra360?.enabled&&!b.needsClaim)cards+=card('obra','Obra360','Dias, frentes, equipe, tarefas, RDO e rotina de campo.','./obra.html#obra','⌂',systems.obra360.role);
    if(systems?.universidade?.enabled)cards+=card('universidade','Universidade','Capacitação, diagnóstico e trilhas personalizadas.','./universidade.html#universidade','▱',systems.universidade.role);
    if(b.platformRole==='superadmin'||b.isOwner)cards+=card('acessos','Administração de acessos','Usuários, perfis, empresas, obras e sessões.','./index.html#owner','◇','superadmin');
    if(b.needsClaim)cards+=card('ativar','Ativar operação','Conclua a configuração da empresa e da primeira obra.','./obra.html#obra','+');
    if(b.role==='admin'||b.platformRole==='superadmin'||b.isOwner)cards+=card('cobranca','Plano e cobrança','Consulte sua assinatura, pagamentos ou conheça outros planos.','./sistema.html#plano-cobranca','▤');
    if(!cards)cards='<article class="mh-empty"><h3>Nenhum sistema liberado</h3><p>Seu login está válido, mas ainda não há módulos liberados para este perfil.</p></article>';
    portalShell(user.name||user.email||'Usuário',`${b.platformRole==='superadmin'?'Superadmin · ':''}${b.company?.name||'Empresa'}${b.project?.name?` · ${b.project.name}`:''}`,cards,b)
  }catch(e){publicHome();toast(apiErr(e))}
}
async function openPortal(){
  location.hash='#portal';
  const user=await auth.getUser();
  if(user){await renderCorporatePortal();return}
  const token=localStorage.getItem(SESSION);
  if(token){try{const data=(await api.post('/api/edu/me',{token})).data as {participant:Participant};await renderPhonePortal(data.participant);return}catch{localStorage.removeItem(SESSION)}}
  publicHome()
}
async function openCollaborator(){
  if(location.hash!=='#colaborador')location.hash='#colaborador';
  const token=localStorage.getItem(SESSION);
  if(token){try{const data=(await api.post('/api/edu/me',{token})).data as {participant:Participant};location.hash='#portal';await renderPhonePortal(data.participant);return}catch{localStorage.removeItem(SESSION)}}
  collaboratorHome()
}
async function logout(){
  const hadPhoneSession=!!localStorage.getItem(SESSION);localStorage.removeItem(SESSION);
  const hinted=auth.isSignedIn();
  if(hinted){publicHome();await auth.signOut();return}
  if(await auth.getUser()){publicHome();await auth.signOut();return}
  if(hadPhoneSession){location.hash='#colaborador';collaboratorHome();return}
  location.hash='';publicHome()
}
export async function mountMhPortal(){
  document.title='Canteiro360 — Acesso e visão geral';
  if(['#phone-login','#celular'].includes(location.hash))location.hash='#colaborador';
  if(location.hash==='#colaborador'){await openCollaborator();return}
  if(location.hash==='#portal'){await openPortal();return}
  if(await auth.getUser()){location.hash='#portal';await renderCorporatePortal();return}
  publicHome()
}
