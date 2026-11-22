// @vitest-environment happy-dom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { auth } from './cloudflare-client';

type GoogleCallback=(value:{credential?:string})=>Promise<void>|void;
describe('P1 Google picker failure and cancellation',()=>{
  let callback:GoogleCallback;
  let promptCallback:((value:{isNotDisplayed:()=>boolean})=>void)|undefined;
  beforeEach(()=>{
    document.body.innerHTML='';
    callback=undefined as unknown as GoogleCallback;
    promptCallback=undefined;
    vi.stubGlobal('fetch',vi.fn(async (input:RequestInfo|URL)=>{
      const url=String(input);
      if(url.includes('/api/auth/config'))return {ok:true,json:async()=>({googleClientId:'client-id'})};
      if(url.includes('/api/auth/google-credential'))return {ok:false,status:403,json:async()=>({error:'Acesso bloqueado. Procure o administrador.'})};
      return {ok:false,status:404,json:async()=>({error:'Not found'})};
    }));
    (window as any).google={accounts:{id:{
      initialize:vi.fn((opts:{callback:GoogleCallback})=>{callback=opts.callback}),
      prompt:vi.fn((next:(value:{isNotDisplayed:()=>boolean})=>void)=>{promptCallback=next}),
      renderButton:vi.fn(),
    }}};
  });
  afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();document.querySelector('#obn-google-chooser')?.remove();});
  it('rejects a denied credential instead of leaving Google sign-in permanently waiting',async()=>{
    const pending=auth.signIn({scope:'openid email profile'});
    await vi.waitFor(()=>expect(callback).toBeTypeOf('function'));
    await callback({credential:'not-a-real-token'});
    await expect(pending).rejects.toThrow('Acesso bloqueado');
    expect(document.querySelector('#obn-google-chooser')).toBeNull();
  });
  it('retries loading the official Google script after a transient network failure',async()=>{
    (window as any).google=undefined;
    const appended:HTMLScriptElement[]=[];
    // Keep this test deterministic: do not let happy-dom fetch an external script.
    const realAppend=document.head.appendChild.bind(document.head);
    vi.spyOn(document.head,'appendChild').mockImplementation(((node:Node)=>{
      if(node instanceof HTMLScriptElement && node.dataset.obnGoogleIdentity){appended.push(node);return node;}
      return realAppend(node);
    }) as typeof document.head.appendChild);
    const first=auth.signIn();
    expect(appended).toHaveLength(1);
    appended[0].dispatchEvent(new Event('error'));
    await expect(first).rejects.toThrow('Não foi possível carregar o login Google.');
    const retry=auth.signIn();
    expect(appended).toHaveLength(2);
    expect(appended[1]).not.toBe(appended[0]);
    appended[1].dispatchEvent(new Event('error'));
    await expect(retry).rejects.toThrow('Não foi possível carregar o login Google.');
  });
  it('lets the customer cancel the chooser and retry without reloading',async()=>{
    const pending=auth.signIn();
    await vi.waitFor(()=>expect(promptCallback).toBeTypeOf('function'));
    promptCallback!({isNotDisplayed:()=>true});
    const cancel=document.querySelector<HTMLButtonElement>('#obn-google-chooser button');
    expect(cancel).not.toBeNull();
    cancel!.click();
    await expect(pending).rejects.toThrow(/cancelado/i);
    expect(document.querySelector('#obn-google-chooser')).toBeNull();
    promptCallback=undefined;
    const again=auth.signIn();
    await vi.waitFor(()=>expect(promptCallback).toBeTypeOf('function'));
    promptCallback!({isNotDisplayed:()=>true});
    document.querySelector<HTMLButtonElement>('#obn-google-chooser button')?.click();
    await expect(again).rejects.toThrow(/cancelado/i);
  });
});
