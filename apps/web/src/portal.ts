import { api, auth } from './cloudflare-client';
import { APP_VERSION } from '../shared/version';
import './portal.css';
import { createIcons, Eye, EyeOff, ChevronRight, FileText, HardHat, GraduationCap, House, Ellipsis, LogOut, ArrowLeft, ShieldCheck, Plus, Building2 } from 'lucide';
import { canReadOverview } from '../shared/portal-overview';
import { loadPortalOverview } from './portal-overview';

type Role='admin'|'foreman'|'employee';
type SystemKey='gestao'|'obra360'|'universidade'|'finance';
type PlatformAccess={id:string;email:string;platformRole:string;status:'pending'|'active'|'blocked';employeeId?:string|null;companyIds:string[];projectIds:string[];systems:Record<SystemKey,{enabled:boolean;role:string}>};
type Bootstrap={needsClaim:boolean;authorized?:boolean;isOwner?:boolean;platformRole?:string;platformAccess?:PlatformAccess;role?:Role;access?:{modules:string[];channels:string[]};license?:{licenseId?:string;status?:string;modules?:string[];channels?:string[]}|null;company?:{name?:string};project?:{name?:string};user?:{email?:string;name?:string};membership?:{email?:string}};
type Participant={id:string;name:string;phone:string;email?:string|null;jobRole:string;mustChangePassword:boolean};

const SESSION='obn-edu-session';
type PasskeyScope='corporate'|'collaborator';
type PasskeyClient={
  supported:()=>boolean;
  login:(scope:PasskeyScope)=>Promise<{scope:PasskeyScope;token?:string;participant?:Participant}>;
  enroll:(scope:PasskeyScope,token?:string)=>Promise<{ok:boolean}>;
  list:(scope:PasskeyScope,token?:string)=>Promise<{credentials:{id:string;createdAt:string;lastUsedAt?:string|null}[]}>;
  remove:(scope:PasskeyScope,id:string,token?:string)=>Promise<{ok:boolean}>;
};
const passkeys=()=> (window as typeof window & {obnPasskeys?:PasskeyClient}).obnPasskeys;
const passkeyToken=(scope:PasskeyScope)=>scope==='collaborator'?localStorage.getItem(SESSION)||undefined:undefined;
async function signInWithPasskey(scope:PasskeyScope){
  const provider=passkeys();
  if(!provider?.supported())throw new Error('Este navegador não permite o uso de chaves de acesso.');
  const result=await provider.login(scope);
  if(scope==='collaborator'){
    if(!result.token||!result.participant)throw new Error('Sessão do colaborador inválida.');
    localStorage.setItem(SESSION,result.token);
    location.hash='#portal';
    await renderPhonePortal(result.participant);
    return;
  }
  location.hash='#portal';
  await renderCorporatePortal();
}
function bindPasskeyLogin(id:string,scope:PasskeyScope){
  const button=document.getElementById(id) as HTMLButtonElement|null;
  if(!button)return;
  if(!passkeys()?.supported()){button.hidden=true;return}
  button.addEventListener('click',async()=>{
    button.disabled=true;
    try{await signInWithPasskey(scope)}catch(error){toast(apiErr(error))}
    finally{button.disabled=false}
  });
}
async function showPasskeyManager(scope:PasskeyScope){
  const provider=passkeys();
  if(!provider?.supported())return toast('Chaves de acesso indisponíveis neste navegador.');
  const dialog=document.createElement('dialog');
  dialog.className='cp-passkey-dialog';
  dialog.innerHTML='<h2>Chaves de acesso</h2><p>Revogue aqui os dispositivos que não devem mais acessar a conta.</p><div class="cp-passkey-list"></div><button type="button" class="cp-text-button cp-passkey-close">Fechar</button>';
  document.body.appendChild(dialog);
  dialog.querySelector('.cp-passkey-close')?.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  const list=dialog.querySelector('.cp-passkey-list')!;
  const refresh=async()=>{
    list.textContent='Carregando…';
    try{
      const result=await provider.list(scope,passkeyToken(scope));
      list.textContent='';
      if(!result.credentials.length){list.textContent='Nenhuma chave cadastrada.';return}
      for(const [index,item] of result.credentials.entries()){
        const row=document.createElement('div');row.className='cp-passkey-row';
        const text=document.createElement('span');
        text.textContent='Chave '+(index+1)+' · '+new Date(item.createdAt).toLocaleDateString('pt-BR');
        const revoke=document.createElement('button');revoke.type='button';revoke.textContent='Revogar';
        revoke.addEventListener('click',async()=>{
          if(!confirm('Revogar esta chave de acesso?'))return;
          revoke.disabled=true;
          try{await provider.remove(scope,item.id,passkeyToken(scope));await refresh()}catch(error){toast(apiErr(error));revoke.disabled=false}
        });
        row.append(text,revoke);list.appendChild(row);
      }
    }catch(error){list.textContent='Não foi possível carregar suas chaves.';toast(apiErr(error))}
  };
  dialog.showModal();
  await refresh();
}
function bindPasskeyAccount(scope:PasskeyScope){
  const enroll=document.getElementById('passkeyEnroll') as HTMLButtonElement|null;
  const manage=document.getElementById('passkeyManage') as HTMLButtonElement|null;
  if(!passkeys()?.supported()){enroll?.remove();manage?.remove();return}
  enroll?.addEventListener('click',async()=>{
    enroll.disabled=true;
    try{await passkeys()!.enroll(scope,passkeyToken(scope));toast('Chave de acesso cadastrada. No próximo login, use Face ID, digital ou PIN.')}
    catch(error){toast(apiErr(error))}finally{enroll.disabled=false}
  });
  manage?.addEventListener('click',()=>void showPasskeyManager(scope));
}

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

export function shouldRouteCorporateToPlans(b:Pick<Bootstrap,'needsClaim'|'isOwner'|'platformRole'|'platformAccess'|'authorized'|'license'>){
  const status=b.platformAccess?.status;
  return !!b.needsClaim&&!b.isOwner&&b.platformRole!=='superadmin'&&status!=='pending'&&status!=='blocked'&&!b.license?.licenseId&&!b.authorized;
}

function publicHome(){
  setBody(`<main class="cp-login">
    <a class="cp-back" href="./">${icon('arrow-left')}<span>Página principal</span></a>
    <div class="cp-login-content"><div class="cp-login-brand"><img src="./canteiro360-logo.png" alt="Canteiro360 — controle total da obra" width="1448" height="1086"></div>
    <section class="cp-login-form" aria-labelledby="loginTitle"><h1 id="loginTitle">Acesse sua operação</h1><p>Entre com a conta responsável pela sua empresa.</p>
    <button id="googleLogin" type="button" class="cp-google">${googleMark()}<span>Continuar com Google</span></button><p id="loginFeedback" class="cp-login-feedback" role="alert" aria-live="assertive" hidden></p>
    <button id="passkeyCompany" type="button" class="cp-google cp-passkey-login">Entrar com Face ID ou chave de acesso</button></section></div>
    <a class="cp-login-switch" href="./sistema.html#colaborador"><span>Acesso do colaborador</span>${icon('chevron-right')}</a>
    <footer class="cp-login-footer"><span>Controle total da obra <small class="cp-version">v${APP_VERSION}</small></span>${vendor()}</footer>
  </main>`);
  document.getElementById('googleLogin')?.addEventListener('click',async()=>{
    const button=document.getElementById('googleLogin') as HTMLButtonElement|null;
    const feedback=document.getElementById('loginFeedback') as HTMLParagraphElement|null;
    if(!button||button.disabled)return;
    button.disabled=true;
    button.querySelector('span')!.textContent='Abrindo Google…';
    if(feedback){feedback.textContent='';feedback.hidden=true}
    try{await auth.signIn({scope:'openid email profile'})}
    catch(e){const message=apiErr(e);if(feedback){feedback.textContent=message;feedback.hidden=false}toast(message)}
    finally{if(button.isConnected){button.disabled=false;button.querySelector('span')!.textContent='Continuar com Google'}}
  });
  bindPasskeyLogin('passkeyCompany','corporate');
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
    </form><button id="passkeyCollaborator" type="button" class="cp-google cp-passkey-login">Entrar com Face ID ou chave de acesso</button></section></div>
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
  bindPasskeyLogin('passkeyCollaborator','collaborator');
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
function portalShell(name:string,meta:string,cards:string,context?:Bootstrap,passkeyScope?:PasskeyScope){
  const hasObra=cards.includes('data-resource="obra"');
  const initials=name.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase();
  setBody(`<header class="cp-header"><div class="cp-header-inner">${brand()}<details class="cp-account"><summary aria-label="Menu da conta">${esc(initials||'EU')}</summary><div><strong>${esc(name)}</strong><a href="./">Página principal</a>${passkeyScope?'<button id="passkeyEnroll" type="button">Cadastrar chave de acesso</button><button id="passkeyManage" type="button">Gerenciar chaves</button>':''}<button id="logoutBtn" type="button">${icon('log-out')}Sair</button></div></details></div></header>
    <main class="cp-dashboard"><div class="cp-context">${icon('building-2')}<span>${esc(meta)}</span></div>
    <section class="cp-welcome"><h1>Visão geral</h1><p>${esc(portalGreeting(name))}</p></section>
    <div class="cp-dashboard-grid"><div id="portalOverview" aria-live="polite">${context&&canReadOverview(context)?'<p class="cp-loading" role="status">Carregando resumo…</p>':''}</div>
    <section class="cp-section cp-module-section" id="portalModules"><h2>Seus módulos</h2><div class="cp-modules">${cards}</div></section></div>
    <footer class="cp-dashboard-footer"><span>Acessos conforme seu perfil. <small class="cp-version">v${APP_VERSION}</small></span>${vendor()}</footer></main>
    <nav class="cp-bottom-nav" aria-label="Navegação principal"><a href="#portal" aria-current="page">${icon('house')}<span>Início</span></a>${hasObra?`<a href="./obra.html#obra">${icon('hard-hat')}<span>Obras</span></a>`:''}<button id="moreModules" type="button">${icon('ellipsis')}<span>Mais</span></button></nav>`);
  document.getElementById('logoutBtn')?.addEventListener('click',()=>void logout());
  if(passkeyScope)bindPasskeyAccount(passkeyScope);
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
    if(b.access?.modules?.includes('obra360'))cards=card('obra','Obra360','Dias, etapas, equipe, presença e rotina de campo.','./obra.html#obra','⌂','encarregado')+cards;
    meta=b.company?.name||'Empresa';
  }catch{}
  portalShell(p.name,meta,cards,undefined,'collaborator')
}
async function renderCorporatePortal(){
  let accountName='Sua conta';
  try{
    const user=await auth.getUser();if(!user)return publicHome();
    accountName=user.name||user.email||'Sua conta';
    // A lactation administrator has no Obra membership and must never enter the Obra bootstrap.
    try{
      const {data:central}=await api.get<{role:string}>('/api/central/access');
      if(central.role==='debora'){location.replace('./sistema.html#owner');return}
    }catch{/* Other users continue through their existing corporate portal. */}
    const b=(await api.get('/api/bootstrap')).data as Bootstrap,pa=b.platformAccess;
    if(pa?.status==='blocked'){portalShell(user.name||user.email||'Usuário','Acesso bloqueado','<article class="mh-empty"><h3>Acesso bloqueado</h3><p>Procure o administrador da sua empresa.</p></article>');return}
    if(pa?.status==='pending'){
      portalShell(user.name||user.email||'Usuário','Liberação pendente','<article class="mh-empty"><h3>Liberação pendente</h3><p>Seu acesso à empresa ainda precisa ser ativado. Informe o código provisório fornecido pelo administrador. Se você já recebeu uma licença, procure o responsável pela liberação.</p><input id="platformCode" maxlength="12" placeholder="CÓDIGO" aria-label="Código de liberação"><button id="claimPlatform" class="mh-primary">Ativar acesso</button></article>');
      document.getElementById('claimPlatform')?.addEventListener('click',async()=>{try{const code=(document.getElementById('platformCode') as HTMLInputElement).value.trim().toUpperCase();await api.post('/api/platform/claim',{code});await renderCorporatePortal()}catch(e){toast(apiErr(e))}});return
    }
    if(shouldRouteCorporateToPlans(b)){
      portalShell(accountName,'Conta não cadastrada','<article class="mh-empty"><h3>Nenhuma licença vinculada</h3><p>Sua identidade Google foi confirmada, mas este e-mail ainda não possui acesso a uma empresa do Obra na Mão. Se você já comprou uma licença, entre com o mesmo e-mail informado na compra ou solicite a conferência do cadastro.</p><a class="mh-primary cp-access-link" href="./sistema.html#planos">Conhecer planos</a></article>',undefined,'corporate');
      return;
    }
    if(b.needsClaim&&b.license&&!b.license.channels?.includes('mobile')&&!b.isOwner){
      portalShell(accountName,'Acesso Web não incluído','<article class="mh-empty"><h3>Acesso Web não liberado</h3><p>Encontramos sua licença, mas ela não inclui o canal Web/PWA. Você pode continuar usando o Desktop autorizado ou solicitar liberação do acesso Web.</p></article>',undefined,'corporate');
      return;
    }
    const systems=pa?.systems;let cards='';
    if(systems?.gestao?.enabled&&b.role==='admin'&&!b.needsClaim&&b.access?.modules?.some(module=>['rh','dre','contracts','procurement','measurements','documents'].includes(module)))cards+=card('gestao','Gestão','RH, documentos, contratos, compras, medições e visão administrativa.','./gestao.html#gestao','▥',systems.gestao.role);
    if(systems?.obra360?.enabled&&!b.needsClaim)cards+=card('obra','Obra360','Dias, etapas, equipe, tarefas, RDO e rotina de campo.','./obra.html#obra','⌂',systems.obra360.role);
    if(systems?.universidade?.enabled)cards+=card('universidade','Universidade','Capacitação, diagnóstico e trilhas personalizadas.','./universidade.html#universidade','▱',systems.universidade.role);
    if(b.platformRole==='superadmin'||b.isOwner)cards+=card('acessos','Central Artisys','Empresas clientes, licenças e ativações independentes.','./index.html#owner','◇','superadmin');
    if(b.needsClaim&&b.license?.channels?.includes('mobile')){
      cards='<article class="mh-empty cp-activation-notice"><h3>Licença ativa</h3><p>Seu acesso já foi identificado. Falta apenas configurar a empresa e a primeira obra; não é necessário comprar outra licença.</p></article>'+cards;
      cards+=card('ativar','Ativar operação','Conclua a configuração da empresa e da primeira obra.','./obra.html#obra','+');
    }else if(b.needsClaim&&b.isOwner)cards+=card('ativar','Ativar operação','Conclua a configuração da empresa e da primeira obra.','./obra.html#obra','+');
    if(b.role==='admin'||b.platformRole==='superadmin'||b.isOwner)cards+=card('cobranca','Plano e cobrança','Consulte sua assinatura, pagamentos ou conheça outros planos.','./sistema.html#plano-cobranca','▤');
    if(!cards)cards='<article class="mh-empty"><h3>Nenhum sistema liberado</h3><p>Seu login está válido, mas ainda não há módulos liberados para este perfil.</p></article>';
    portalShell(user.name||user.email||'Usuário',`${b.platformRole==='superadmin'?'Superadmin · ':''}${b.company?.name||'Empresa'}`,cards,b,'corporate')
  }catch(e){
    const detail=apiErr(e),status=Number((e as {response?:{status?:number}})?.response?.status||0);
    if(status===403||status===409){
      portalShell(accountName,'Acesso restrito',`<article class="mh-empty"><h3>Acesso não liberado</h3><p>${esc(detail)}</p><p>Se sua licença já foi ativada, confira o e-mail cadastrado e solicite ao administrador a revisão do acesso.</p></article>`,undefined,'corporate');
      return;
    }
    portalShell(accountName,'Conexão indisponível',`<article class="mh-empty"><h3>Não foi possível carregar sua operação</h3><p>${esc(detail)}</p><button id="retryCorporatePortal" class="mh-primary" type="button">Tentar novamente</button></article>`,undefined,'corporate');
    document.getElementById('retryCorporatePortal')?.addEventListener('click',()=>void renderCorporatePortal());
  }
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
