// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
const client = vi.hoisted(() => ({ get:vi.fn(), post:vi.fn(), isSignedIn:vi.fn(), getUser:vi.fn(), signIn:vi.fn(), signOut:vi.fn() }));
vi.mock('./cloudflare-client', () => ({ api:{get:client.get,post:client.post},auth:client }));
import { mountMhPortal } from './portal';

const bootstrap = (role:string) => ({
  role, needsClaim:false, company:{name:'Empresa teste'},project:{name:'Obra teste'},
  access:{modules:['dre','contracts','documents','measurements','obra360'],channels:['mobile']},
  platformAccess:{status:'active',systems:{gestao:{enabled:true,role:'admin'},obra360:{enabled:true,role:role==='admin'?'admin':'funcionario'},universidade:{enabled:true,role:'colaborador'}}},
});
const overview={updatedAt:'2026-09-03T14:20:00Z',metrics:[{key:'dre',label:'Resultado',value:5400000,kind:'money'}],attention:[{key:'documents',label:'Documentos a vencer em 30 dias',value:3,kind:'count'}]};
const byId = <T extends HTMLElement>(id:string) => document.getElementById(id) as T;
describe('Commercial login and overview DOM flows', () => {
  beforeEach(() => {
    vi.resetAllMocks();localStorage.clear();document.body.innerHTML='';location.hash='#portal';
    client.isSignedIn.mockReturnValue(false);client.getUser.mockResolvedValue(null);
  });
  it('renders the corporate login without phone fields and keeps phone controls on the collaborator route', async () => {
    await mountMhPortal();
    expect(document.querySelector('h1')?.textContent).toBe('Acesse sua operação');
    expect(document.querySelector('.cp-login-brand img')?.getAttribute('src')).toContain('canteiro360-logo.png');
    expect(document.querySelector('.cp-google-mark')).not.toBeNull();
    expect(document.querySelector('.cp-vendor img')?.getAttribute('src')).toContain('artisys-icon.svg');
    expect(document.body.textContent).not.toContain('SISTEMA LIBERADO');
    expect(document.getElementById('phoneLogin')).toBeNull();
    expect(document.querySelector<HTMLAnchorElement>('.cp-login-switch')?.getAttribute('href')).toContain('#colaborador');
    client.signIn.mockRejectedValue(new Error('Login indisponível'));
    byId<HTMLButtonElement>('googleLogin').click();
    await vi.waitFor(()=>expect(byId('mhToast').textContent).toBe('Login indisponível'));

    location.hash='#colaborador';await mountMhPortal();
    expect(document.querySelector('h1')?.textContent).toBe('Acesso do colaborador');
    expect(document.getElementById('googleLogin')).toBeNull();
    byId<HTMLButtonElement>('togglePassword').click();expect(byId<HTMLInputElement>('phonePassword').type).toBe('text');
    expect(byId('togglePassword').getAttribute('aria-label')).toBe('Ocultar senha');
    byId<HTMLButtonElement>('togglePassword').click();expect(byId<HTMLInputElement>('phonePassword').type).toBe('password');
    expect(document.querySelector<HTMLAnchorElement>('.cp-login-switch')?.getAttribute('href')).toContain('#portal');
  });
  it('does not launch two Google flows on repeated taps and exposes an accessible error', async () => {
    await mountMhPortal();
    let reject!: (error: Error) => void;
    client.signIn.mockReturnValue(new Promise((_resolve, fail) => { reject = fail; }));
    const button=byId<HTMLButtonElement>('googleLogin');
    button.click();button.click();
    expect(client.signIn).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Abrindo Google');
    reject(new Error('Login indisponível'));
    await vi.waitFor(()=>expect(button.disabled).toBe(false));
    expect(byId('loginFeedback').getAttribute('role')).toBe('alert');
    expect(byId('loginFeedback').textContent).toBe('Login indisponível');
  });
  it('shows an already licensed client an activation path without buying another plan', async () => {
    client.getUser.mockResolvedValue({name:'Cliente',email:'cliente@example.test'});
    client.get.mockImplementation(async (path:string)=>({data:path==='/api/bootstrap'?
      {needsClaim:true,authorized:true,license:{licenseId:'lic-1',status:'active',modules:['obra360'],channels:['mobile']},platformRole:'user'}:
      {role:'user'}}));
    await mountMhPortal();
    expect(location.hash).toBe('#portal');
    expect(document.querySelector('[data-resource="ativar"]')).not.toBeNull();
    expect(document.body.textContent).toContain('licença ativa');
    expect(document.body.textContent).not.toContain('Nenhuma licença vinculada');
  });
  it('explains an unregistered Google account without creating a company or immediately sending it to checkout', async () => {
    client.getUser.mockResolvedValue({name:'Visitante',email:'visitante@example.test'});
    client.get.mockImplementation(async (path:string)=>({data:path==='/api/bootstrap'?
      {needsClaim:true,authorized:false,license:null,platformRole:'user'}:
      {role:'user'}}));
    await mountMhPortal();
    expect(location.hash).toBe('#portal');
    expect(document.body.textContent).toContain('Nenhuma licença vinculada');
    expect(document.querySelector('[data-resource="ativar"]')).toBeNull();
    expect(document.querySelector('a[href*="#planos"]')).not.toBeNull();
  });
  it('keeps a blocked client inside a restricted authenticated screen with logout', async () => {
    client.getUser.mockResolvedValue({name:'Cliente',email:'cliente@example.test'});
    client.get.mockImplementation(async (path:string)=>({data:path==='/api/bootstrap'?
      {needsClaim:false,platformAccess:{status:'blocked',systems:{}},platformRole:'user'}:
      {role:'user'}}));
    await mountMhPortal();
    expect(document.body.textContent).toContain('Acesso bloqueado');
    expect(document.querySelector('[data-resource="obra"]')).toBeNull();
    expect(byId('logoutBtn')).not.toBeNull();
  });
  it('explains a pending credential while retaining the existing activation code flow', async () => {
    client.getUser.mockResolvedValue({name:'Cliente',email:'cliente@example.test'});
    client.get.mockImplementation(async (path:string)=>({data:path==='/api/bootstrap'?
      {needsClaim:false,platformAccess:{status:'pending',systems:{}},platformRole:'user'}:
      {role:'user'}}));
    await mountMhPortal();
    expect(document.body.textContent).toContain('Liberação pendente');
    expect(byId<HTMLInputElement>('platformCode')).not.toBeNull();
    expect(document.querySelector('[data-resource="gestao"]')).toBeNull();
  });
  it('keeps an authenticated desktop-only account visible when Web/PWA is not licensed', async () => {
    client.getUser.mockResolvedValue({name:'Cliente',email:'cliente@example.test'});
    client.get.mockImplementation(async (path:string)=>path==='/api/bootstrap'?
      Promise.reject(Object.assign(new Error('Sua conta não possui acesso Mobile/PWA.'),{response:{status:403,data:{error:'Sua conta não possui acesso Mobile/PWA.'}}})):
      Promise.reject(new Error('not a central admin')));
    await mountMhPortal();
    expect(document.body.textContent).toContain('não possui acesso Mobile/PWA');
    expect(byId('logoutBtn')).not.toBeNull();
    expect(byId('googleLogin')).toBeNull();
  });
  it('recovers a valid server session when the readable auth hint is missing', async () => {
    client.isSignedIn.mockReturnValue(false);
    client.getUser.mockResolvedValue({name:'Pessoa Teste',email:'person@example.test'});
    client.get.mockResolvedValue({data:bootstrap('employee')});
    await mountMhPortal();
    expect(document.querySelector('h1')?.textContent).toBe('Visão geral');
    expect(client.getUser).toHaveBeenCalled();
    expect(client.get.mock.calls.map(call=>call[0])).toContain('/api/bootstrap');
  });
  it.each(['employee','foreman'])('renders only permitted module navigation for %s and never fetches the overview', async role => {
    client.isSignedIn.mockReturnValue(true);client.getUser.mockResolvedValue({name:'Pessoa Teste',email:'person@example.test'});client.get.mockResolvedValue({data:bootstrap(role)});
    await mountMhPortal();
    expect(document.querySelector('h1')?.textContent).toBe('Visão geral');
    expect(document.querySelector('.cp-context span')?.textContent).toBe('Empresa teste');
    expect(document.querySelector('.cp-welcome p')?.textContent).toMatch(/^(Bom dia|Boa tarde|Boa noite), Pessoa$/);
    expect(Array.from(document.querySelectorAll('.cp-bottom-nav span')).map(node=>node.textContent)).toContain('Mais');
    expect(document.querySelector('[data-resource="gestao"]')).toBeNull();
    expect(document.querySelector('[data-resource="obra"]')).not.toBeNull();
    expect(document.querySelector('[data-resource="universidade"]')).not.toBeNull();
    expect(document.body.textContent).not.toContain('Resumo da gestão');
    expect(client.get.mock.calls.map(call=>call[0])).toEqual(['/api/central/access','/api/bootstrap']);
  });
  it('shows real authorized aggregates and clears them immediately on logout', async () => {
    client.isSignedIn.mockReturnValue(true);
    client.getUser.mockResolvedValue({name:'Pessoa Teste',email:'person@example.test'});
    client.get.mockImplementation(async path=>({data:path==='/api/bootstrap'?bootstrap('admin'):overview}));
    await mountMhPortal();
    await vi.waitFor(()=>expect(document.body.textContent).toContain('54.000,00'));
    expect(document.body.textContent).toContain('3 documentos a vencer em 30 dias');
    expect(document.querySelector('[data-resource="gestao"]')?.getAttribute('href')).toBe('./gestao.html#gestao');
    byId<HTMLButtonElement>('logoutBtn').click();
    expect(document.body.textContent).not.toContain('54.000,00');
    expect(document.querySelector('h1')?.textContent).toBe('Acesse sua operação');
    expect(client.signOut).toHaveBeenCalledOnce();
  });
  it('does not insert an in-flight admin response after logout', async () => {
    let release!:(value:unknown)=>void;
    client.isSignedIn.mockReturnValue(true);
    client.getUser.mockResolvedValue({name:'Pessoa Teste',email:'person@example.test'});
    client.get.mockImplementation(path=>path==='/api/central/access'?Promise.reject(new Error('not a Central admin')):path==='/api/bootstrap'?Promise.resolve({data:bootstrap('admin')}):new Promise(resolve=>{release=resolve}));
    await mountMhPortal();byId<HTMLButtonElement>('logoutBtn').click();release({data:overview});
    await new Promise(resolve=>setTimeout(resolve,0));
    expect(document.body.textContent).not.toContain('54.000,00');
    expect(document.querySelector('#portalOverview')).toBeNull();
  });
  it('completes first access through the collaborator route and keeps phone users outside management', async () => {
    client.post.mockImplementation(async path => ({data:path==='/api/edu/access-status'?{needsPasswordSetup:true}:path==='/api/edu/first-access'?{token:'test-phone-session',participant:{id:'p1',name:'Colaborador Teste',phone:'11999990000',jobRole:'Encarregado'}}:{company:{name:'Empresa teste'},project:{name:'Obra de teste oculta'},access:{modules:['obra360']}}}));
    location.hash='#colaborador';await mountMhPortal();byId<HTMLInputElement>('phoneIdentity').value='11999990000';byId<HTMLButtonElement>('phoneFirst').click();
    await vi.waitFor(()=>expect(document.getElementById('phoneSetup')).not.toBeNull());
    byId<HTMLInputElement>('newPassword').value='test-password-only';byId<HTMLInputElement>('confirmPassword').value='different';
    byId<HTMLFormElement>('phoneSetup').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    expect(byId('mhToast').textContent).toBe('As senhas não coincidem.');
    byId<HTMLInputElement>('confirmPassword').value='test-password-only';
    byId<HTMLFormElement>('phoneSetup').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    await vi.waitFor(()=>expect(document.querySelector('h1')?.textContent).toBe('Visão geral'));
    expect(localStorage.getItem('obn-edu-session')).toBe('test-phone-session');
    expect(document.querySelector('.cp-context span')?.textContent).toBe('Empresa teste');
    expect(document.querySelector('[data-resource="gestao"]')).toBeNull();
    expect(document.querySelector('[data-resource="obra"]')).not.toBeNull();
    expect(client.get).not.toHaveBeenCalled();
  });
});
