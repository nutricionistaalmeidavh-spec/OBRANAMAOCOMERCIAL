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
    client.isSignedIn.mockReturnValue(false);client.getUser.mockResolvedValue({name:'Pessoa Teste',email:'person@example.test'});
  });
  it('renders the approved login, supports password visibility and reports Google errors', async () => {
    await mountMhPortal();
    expect(document.querySelector('h1')?.textContent).toBe('Acesse sua operação');
    expect(document.querySelector('.cp-login-brand img')?.getAttribute('src')).toContain('canteiro360-logo.png');
    expect(document.querySelector('.cp-google-mark')).not.toBeNull();
    expect(document.querySelector('.cp-vendor img')?.getAttribute('src')).toContain('artisys-icon.svg');
    expect(document.body.textContent).not.toContain('SISTEMA LIBERADO');
    byId<HTMLButtonElement>('togglePassword').click();expect(byId<HTMLInputElement>('phonePassword').type).toBe('text');
    expect(byId('togglePassword').getAttribute('aria-label')).toBe('Ocultar senha');
    byId<HTMLButtonElement>('togglePassword').click();expect(byId<HTMLInputElement>('phonePassword').type).toBe('password');
    client.signIn.mockRejectedValue(new Error('Login indisponível'));
    byId<HTMLButtonElement>('googleLogin').click();
    await vi.waitFor(()=>expect(byId('mhToast').textContent).toBe('Login indisponível'));
  });
  it.each(['employee','foreman'])('renders only permitted module navigation for %s and never fetches the overview', async role => {
    client.isSignedIn.mockReturnValue(true);client.get.mockResolvedValue({data:bootstrap(role)});
    await mountMhPortal();
    expect(document.querySelector('h1')?.textContent).toBe('Visão geral');
    expect(document.querySelector('.cp-welcome p')?.textContent).toMatch(/^(Bom dia|Boa tarde|Boa noite), Pessoa$/);
    expect(Array.from(document.querySelectorAll('.cp-bottom-nav span')).map(node=>node.textContent)).toContain('Mais');
    expect(document.querySelector('[data-resource="gestao"]')).toBeNull();
    expect(document.querySelector('[data-resource="obra"]')).not.toBeNull();
    expect(document.querySelector('[data-resource="universidade"]')).not.toBeNull();
    expect(document.body.textContent).not.toContain('Resumo da gestão');
    expect(client.get.mock.calls.map(call=>call[0])).toEqual(['/api/bootstrap']);
  });
  it('shows real authorized aggregates and clears them immediately on logout', async () => {
    client.isSignedIn.mockReturnValue(true);
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
    client.get.mockImplementation(path=>path==='/api/bootstrap'?Promise.resolve({data:bootstrap('admin')}):new Promise(resolve=>{release=resolve}));
    await mountMhPortal();byId<HTMLButtonElement>('logoutBtn').click();release({data:overview});
    await new Promise(resolve=>setTimeout(resolve,0));
    expect(document.body.textContent).not.toContain('54.000,00');
    expect(document.querySelector('#portalOverview')).toBeNull();
  });
  it('completes first access through form submission and keeps phone users outside management', async () => {
    client.post.mockImplementation(async path => ({data:path==='/api/edu/access-status'?{needsPasswordSetup:true}:path==='/api/edu/first-access'?{token:'test-phone-session',participant:{id:'p1',name:'Colaborador Teste',phone:'11999990000',jobRole:'Encarregado'}}:{company:{name:'Empresa teste'},access:{modules:['obra360']}}}));
    await mountMhPortal();byId<HTMLInputElement>('phoneIdentity').value='11999990000';byId<HTMLButtonElement>('phoneFirst').click();
    await vi.waitFor(()=>expect(document.getElementById('phoneSetup')).not.toBeNull());
    byId<HTMLInputElement>('newPassword').value='test-password-only';byId<HTMLInputElement>('confirmPassword').value='different';
    byId<HTMLFormElement>('phoneSetup').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    expect(byId('mhToast').textContent).toBe('As senhas não coincidem.');
    byId<HTMLInputElement>('confirmPassword').value='test-password-only';
    byId<HTMLFormElement>('phoneSetup').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    await vi.waitFor(()=>expect(document.querySelector('h1')?.textContent).toBe('Visão geral'));
    expect(localStorage.getItem('obn-edu-session')).toBe('test-phone-session');
    expect(document.querySelector('[data-resource="gestao"]')).toBeNull();
    expect(document.querySelector('[data-resource="obra"]')).not.toBeNull();
    expect(client.get).not.toHaveBeenCalled();
  });
});
