type ApiResponse<T=any>={data:T};
async function request<T=any>(method:string,path:string,body?:unknown,query?:Record<string,unknown>):Promise<ApiResponse<T>>{
  const url=new URL(path,location.origin);
  if(query)for(const [key,value] of Object.entries(query))if(value!==undefined&&value!==null)url.searchParams.set(key,String(value));
  const response=await fetch(url.toString(),{
    method,credentials:'include',headers:body===undefined?{}:{'content-type':'application/json'},
    body:body===undefined?undefined:JSON.stringify(body)
  });
  let data:any={};try{data=await response.json()}catch{}
  if(!response.ok){const error:any=new Error(data.error||data.message||('HTTP '+response.status));error.response={status:response.status,data};throw error}
  return {data};
}
export const api={
  get:<T=any>(path:string,query?:Record<string,unknown>)=>request<T>('GET',path,undefined,query),
  post:<T=any>(path:string,body?:unknown)=>request<T>('POST',path,body),
  put:<T=any>(path:string,body?:unknown)=>request<T>('PUT',path,body),
  delete:<T=any>(path:string,body?:unknown)=>request<T>('DELETE',path,body)
};

type GoogleCredentialResponse={credential?:string};
type GooglePromptNotification={isNotDisplayed?:()=>boolean;isSkippedMoment?:()=>boolean};
type GoogleIdentityApi={
  accounts:{id:{
    initialize:(options:{client_id:string;callback:(response:GoogleCredentialResponse)=>void;auto_select?:boolean;cancel_on_tap_outside?:boolean})=>void;
    prompt:(callback?:(notification:GooglePromptNotification)=>void)=>void;
    renderButton:(element:HTMLElement,options:Record<string,unknown>)=>void;
  }}
};
declare global{interface Window{google?:GoogleIdentityApi}}

let googleScriptPromise:Promise<void>|null=null;
function loadGoogleIdentity(){
  if(window.google?.accounts?.id)return Promise.resolve();
  if(googleScriptPromise)return googleScriptPromise;
  googleScriptPromise=new Promise<void>((resolve,reject)=>{
    const existing=document.querySelector('script[data-obn-google-identity]') as HTMLScriptElement|null;
    if(existing){existing.addEventListener('load',()=>resolve(),{once:true});existing.addEventListener('error',()=>reject(new Error('Não foi possível carregar o login Google.')),{once:true});return}
    const script=document.createElement('script');
    script.src='https://accounts.google.com/gsi/client';script.async=true;script.defer=true;script.dataset.obnGoogleIdentity='1';
    script.onload=()=>resolve();script.onerror=()=>reject(new Error('Não foi possível carregar o login Google.'));
    document.head.appendChild(script);
  });
  return googleScriptPromise;
}

function removeGoogleChooser(){document.getElementById('obn-google-chooser')?.remove()}
function showGoogleButton(){
  removeGoogleChooser();
  const overlay=document.createElement('div');overlay.id='obn-google-chooser';
  overlay.style.cssText='position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:24px';
  const box=document.createElement('div');box.style.cssText='background:#fff;border-radius:18px;padding:24px;max-width:360px;width:100%;box-shadow:0 24px 60px rgba(0,0,0,.3);text-align:center';
  const title=document.createElement('div');title.textContent='Entrar no Obra na Mão';title.style.cssText='font:600 18px system-ui;color:#111;margin-bottom:16px';
  const target=document.createElement('div');target.style.cssText='display:flex;justify-content:center';
  const cancel=document.createElement('button');cancel.textContent='Cancelar';cancel.type='button';cancel.style.cssText='margin-top:16px;border:0;background:transparent;color:#555;font:14px system-ui;padding:8px 12px';cancel.onclick=removeGoogleChooser;
  box.append(title,target,cancel);overlay.appendChild(box);overlay.addEventListener('click',e=>{if(e.target===overlay)removeGoogleChooser()});document.body.appendChild(overlay);
  window.google?.accounts.id.renderButton(target,{theme:'outline',size:'large',type:'standard',shape:'rectangular',text:'signin_with',width:280});
}

async function googleSignIn(){
  await loadGoogleIdentity();
  const config=(await api.get<{googleClientId:string}>('/api/auth/config')).data;
  const clientId=String(config.googleClientId||'').trim();
  if(!clientId)throw new Error('Login Google não configurado.');
  window.google!.accounts.id.initialize({
    client_id:clientId,
    auto_select:false,
    cancel_on_tap_outside:true,
    callback:async response=>{
      try{
        const credential=String(response.credential||'');
        if(!credential)throw new Error('O Google não retornou a credencial.');
        await api.post('/api/auth/google-credential',{credential});
        removeGoogleChooser();
        location.reload();
      }catch(error){removeGoogleChooser();console.error(error);alert((error as Error)?.message||'Não foi possível concluir o login Google.');}
    }
  });
  // One Tap/FedCM first; if the browser does not surface it, show the official Google button.
  let fallbackTimer=window.setTimeout(showGoogleButton,900);
  try{
    window.google!.accounts.id.prompt(notification=>{
      if(notification?.isNotDisplayed?.()||notification?.isSkippedMoment?.()){window.clearTimeout(fallbackTimer);showGoogleButton()}
    });
  }catch{window.clearTimeout(fallbackTimer);showGoogleButton()}
  return new Promise<never>(()=>{});
}

let verifiedWebSession:boolean|null=null;
function authHint(){return document.cookie.split(';').some(x=>x.trim()==='obn_auth=1')}
function clearAuthHint(){document.cookie='obn_auth=; Path=/; Secure; SameSite=Lax; Max-Age=0'}
async function currentUser(){
  try{
    const user=(await api.get<{user:{userId:string;email?:string;name?:string}}>('/api/auth/me')).data.user;
    verifiedWebSession=true;
    return user;
  }catch{
    verifiedWebSession=false;
    clearAuthHint();
    return null;
  }
}

export const auth={
  // This is only a local hint for synchronous UI checks. Server validation via /api/auth/me is authoritative.
  isSignedIn:()=>verifiedWebSession===null?authHint():verifiedWebSession,
  async signIn(_options?:{scope?:string}){return googleSignIn()},
  async getUser(){return currentUser()},
  async hasSession(){return !!(await currentUser())},
  async signOut(){
    try{await api.post('/api/auth/logout',{})}
    finally{verifiedWebSession=false;clearAuthHint();location.reload()}
  }
};
