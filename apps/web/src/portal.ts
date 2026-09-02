import { api, auth } from './cloudflare-client';
import './portal.css';

type Role='admin'|'foreman'|'employee';
type SystemKey='gestao'|'obra360'|'universidade'|'finance';
type PlatformAccess={id:string;email:string;platformRole:string;status:'pending'|'active'|'blocked';employeeId?:string|null;companyIds:string[];projectIds:string[];systems:Record<SystemKey,{enabled:boolean;role:string}>};
type Bootstrap={needsClaim:boolean;authorized?:boolean;isOwner?:boolean;platformRole?:string;platformAccess?:PlatformAccess;role?:Role;access?:{modules:string[];channels:string[]};license?:{modules?:string[];channels?:string[]}|null;company?:{name?:string};project?:{name?:string};user?:{email?:string;name?:string};membership?:{email?:string}};
type Participant={id:string;name:string;phone:string;email?:string|null;jobRole:string;mustChangePassword:boolean};

const SESSION='obn-edu-session';
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] as string));
const digits=(v:string)=>v.replace(/\D/g,'');
const apiErr=(e:unknown)=>{const x=e as {response?:{data?:{error?:string;message?:string}};message?:string};return x.response?.data?.error||x.response?.data?.message||x.message||'Não foi possível concluir.'};

function brand(){return '<div class="mh-brand"><span>ON</span><strong>OBRA NA MÃO<br>GESTÃO CONECTADA</strong></div>'}
function setBody(html:string){document.body.className='mh-portal-body';document.body.innerHTML=`<div id="mhPortal">${html}</div><div id="mhToast" class="mh-toast"></div>`}
function toast(text:string){const e=document.getElementById('mhToast');if(!e)return;e.textContent=text;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2800)}
function card(key:string,title:string,text:string,href:string,icon:string,role?:string){return `<a class="mh-resource-card" data-resource="${key}" href="${href}"><i>${icon}</i><div><small>${role?`PERFIL · ${esc(role.toUpperCase())}`:'SISTEMA LIBERADO'}</small><h3>${title}</h3><p>${text}</p><b>Abrir →</b></div></a>`}

function publicHome(){
  setBody(`<header class="mh-public-head">${brand()}<button id="openAccess" class="mh-primary">Acessar plataforma</button></header>
  <main class="mh-public-main">
    <section class="mh-hero">
      <div><small>PLATAFORMA MODULAR PARA CONSTRUÇÃO</small><h1>Campo, gestão e capacitação conectados ao financeiro do Desktop.</h1><p>Entre com sua conta corporativa ou, quando habilitado pela empresa, use o acesso de colaborador por celular.</p><div class="mh-hero-actions"><button id="googleLogin" class="mh-primary">Entrar com Google</button></div></div>
      <div class="mh-login-pop open" style="position:relative;inset:auto;transform:none;opacity:1;visibility:visible">
        <small>ACESSO POR CELULAR</small><h2>Colaborador</h2>
        <form id="phoneLogin">
          <label>Celular<input id="phoneIdentity" autocomplete="username" placeholder="(00) 99999-9999"></label>
          <label>Senha<input id="phonePassword" type="password" autocomplete="current-password"></label>
          <button class="mh-primary" type="submit">Entrar</button>
          <button class="linkbtn" type="button" id="phoneFirst">Primeiro acesso</button>
        </form>
      </div>
    </section>
    <section class="mh-resource-grid">
      ${card('gestao','Gestão / FluxoDRE','Administração, RH, documentos, contratos, compras e indicadores.','javascript:void(0)','▥')}
      ${card('obra','Obra360','Dias, frentes, equipe, tarefas, presença, RDO e planejamento.','javascript:void(0)','⌂')}
      ${card('universidade','Universidade Empresarial','Capacitação progressiva, exercícios e trilhas de desenvolvimento.','javascript:void(0)','▱')}
    </section>
  </main>`);
  const google=()=>void auth.signIn({scope:'openid email profile'});
  document.getElementById('openAccess')?.addEventListener('click',google);
  document.getElementById('googleLogin')?.addEventListener('click',google);
  document.getElementById('phoneLogin')?.addEventListener('submit',async e=>{
    e.preventDefault();
    const identifier=(document.getElementById('phoneIdentity') as HTMLInputElement).value.trim();
    const password=(document.getElementById('phonePassword') as HTMLInputElement).value;
    if(digits(identifier).length<10||!password)return toast('Informe celular e senha.');
    try{
      const data=(await api.post('/api/edu/login',{identifier,password})).data as {token:string;participant:Participant};
      localStorage.setItem(SESSION,data.token);location.hash='#portal';await renderPhonePortal(data.participant)
    }catch(err){toast(apiErr(err))}
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
    form.innerHTML=`<label>Celular<input value="${esc(identifier)}" disabled></label><label>Crie sua senha<input id="newPassword" type="password" minlength="8"></label><label>Confirme<input id="confirmPassword" type="password" minlength="8"></label><button type="button" class="mh-primary" id="createPassword">Criar senha e entrar</button>`;
    document.getElementById('createPassword')?.addEventListener('click',async()=>{
      const password=(document.getElementById('newPassword') as HTMLInputElement).value,confirm=(document.getElementById('confirmPassword') as HTMLInputElement).value;
      if(password.length<8)return toast('Use ao menos 8 caracteres.');if(password!==confirm)return toast('As senhas não coincidem.');
      try{
        const data=(await api.post('/api/edu/first-access',{identifier,password})).data as {token:string;participant:Participant};
        localStorage.setItem(SESSION,data.token);location.hash='#portal';await renderPhonePortal(data.participant)
      }catch(err){toast(apiErr(err))}
    })
  }catch(err){toast(apiErr(err))}
}
function portalShell(name:string,meta:string,cards:string){
  setBody(`<header class="mh-portal-head">${brand()}<div><button id="publicBtn">Início</button><button id="logoutBtn">Sair</button></div></header><main class="mh-myportal"><section class="mh-welcome"><small>MEUS SISTEMAS</small><h1>Olá, ${esc(name.split(' ')[0]||name)}</h1><p>${esc(meta)}</p></section><section class="mh-resource-grid">${cards}</section><aside class="mh-install-note"><b>Obra na Mão</b><span>Os módulos disponíveis respeitam a licença da empresa e as permissões do seu perfil.</span></aside></main>`);
  document.getElementById('publicBtn')?.addEventListener('click',()=>{location.hash='';publicHome()});
  document.getElementById('logoutBtn')?.addEventListener('click',()=>void logout());
}
async function renderPhonePortal(p:Participant){
  let cards=card('universidade','Universidade Empresarial','Capacitação, diagnóstico e trilhas personalizadas.','./universidade.html#universidade','▱','colaborador'),meta=`${p.jobRole||'Colaborador'} · acesso por celular`;
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
      portalShell(user.name||user.email||'Usuário','Credencial provisória pendente','<article class="mh-empty"><h3>Ativar credencial</h3><p>Informe o código provisório fornecido pelo administrador.</p><input id="platformCode" maxlength="8" placeholder="CÓDIGO"><button id="claimPlatform" class="mh-primary">Ativar acesso</button></article>');
      document.getElementById('claimPlatform')?.addEventListener('click',async()=>{try{const code=(document.getElementById('platformCode') as HTMLInputElement).value.trim().toUpperCase();await api.post('/api/platform/claim',{code});await renderCorporatePortal()}catch(e){toast(apiErr(e))}});return
    }
    const systems=pa?.systems;let cards='';
    if(systems?.gestao?.enabled&&!b.needsClaim)cards+=card('gestao','Gestão / FluxoDRE','RH, documentos, contratos, compras, medições e visão administrativa.','./gestao.html#gestao','▥',systems.gestao.role);
    if(systems?.obra360?.enabled&&!b.needsClaim)cards+=card('obra','Obra360','Dias, frentes, equipe, tarefas, RDO e rotina de campo.','./obra.html#obra','⌂',systems.obra360.role);
    // O portal exibe a Universidade pela permissão da plataforma. A própria Universidade
    // cria/recupera a sessão educacional ao abrir, evitando esconder o módulo por uma
    // falha transitória na criação antecipada da sessão.
    if(systems?.universidade?.enabled)cards+=card('universidade','Universidade Empresarial','Capacitação, diagnóstico e trilhas personalizadas.','./universidade.html#universidade','▱',systems.universidade.role);
    if(b.platformRole==='superadmin'||b.isOwner)cards+=card('acessos','Administração de acessos','Usuários, perfis, empresas, obras e sessões.','./index.html#owner','◇','superadmin');
    if(b.needsClaim)cards+=card('ativar','Ativar operação','Conclua a configuração da empresa e da primeira obra.','./obra.html#obra','+');
    if(!cards)cards='<article class="mh-empty"><h3>Nenhum sistema liberado</h3><p>Seu login está válido, mas ainda não há módulos liberados para este perfil.</p></article>';
    portalShell(user.name||user.email||'Usuário',`${b.platformRole==='superadmin'?'Superadmin · ':''}${b.company?.name||'Empresa'}${b.project?.name?` · ${b.project.name}`:''}`,cards)
  }catch(e){toast(apiErr(e));publicHome()}
}
async function openPortal(){
  location.hash='#portal';
  if(auth.isSignedIn()){await renderCorporatePortal();return}
  const token=localStorage.getItem(SESSION);
  if(token){try{const data=(await api.post('/api/edu/me',{token})).data as {participant:Participant};await renderPhonePortal(data.participant);return}catch{localStorage.removeItem(SESSION)}}
  publicHome()
}
async function logout(){localStorage.removeItem(SESSION);if(auth.isSignedIn()){await auth.signOut();return}location.hash='';publicHome()}
export async function mountMhPortal(){document.title='Obra na Mão';if(location.hash==='#portal'){await openPortal();return}if(auth.isSignedIn()){location.hash='#portal';await renderCorporatePortal();return}publicHome()}
