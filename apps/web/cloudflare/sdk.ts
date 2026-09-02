import { AsyncLocalStorage } from 'node:async_hooks';

export type AuthUser = { userId:string; email?:string; name?:string };
export type RuntimeEnv = {
  DB: D1Database;
  FILES?: R2Bucket;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GEMINI_API_KEY?: string;
  OWNER_EMAIL?: string;
  OWNER_COMPANY?: string;
  OWNER_PROJECT?: string;
  OWNER_CUSTOMER?: string;
};
export type RouterContext = {
  request: Request;
  env: RuntimeEnv;
  query: Record<string,string>;
  params: Record<string,string>;
  body: unknown;
  user?: AuthUser;
};
export type RouterResponse = Response;
type Middleware = (ctx:RouterContext)=>Promise<Response|void>|Response|void;
export type RouterRoutes = Record<string, readonly Middleware[] | Middleware[]>;

const runtime = new AsyncLocalStorage<{env:RuntimeEnv;request:Request}>();
export const runtimeEnv = () => {
  const state = runtime.getStore();
  if (!state) throw new Error('Cloudflare runtime unavailable.');
  return state.env;
};

const now=()=>new Date().toISOString();
const parseJson=<T=Record<string,unknown>>(value:string|null, fallback:T={} as T):T=>{
  if(!value)return fallback;
  try{return JSON.parse(value) as T}catch{return fallback}
};
const id=()=>crypto.randomUUID().replace(/-/g,'');
const cleanEnvValue=(value?:string)=>String(value||'').trim();

export const db = {
  async list<T=Record<string,unknown>>(collection:string, options:{limit?:number}={}) {
    const limit=Math.max(1,Math.min(1000,Number(options.limit||100)));
    const rows=await runtimeEnv().DB.prepare(
      'SELECT id, record_json FROM kv_records WHERE collection=? ORDER BY updated_at DESC LIMIT ?'
    ).bind(collection,limit).all<{id:string;record_json:string}>();
    return {items:(rows.results||[]).map(row=>({...parseJson<Record<string,unknown>>(row.record_json),id:row.id}) as T & {id:string})};
  },
  async get<T=Record<string,unknown>>(collection:string, ids:string[]) {
    const out:Array<T & {id:string}>=[];
    for(const recordId of ids){
      const row=await runtimeEnv().DB.prepare(
        'SELECT id, record_json FROM kv_records WHERE collection=? AND id=?'
      ).bind(collection,String(recordId)).first<{id:string;record_json:string}>();
      if(row)out.push({...parseJson<Record<string,unknown>>(row.record_json),id:row.id} as T & {id:string});
    }
    return out;
  },
  async add(collection:string, records:Array<Record<string,unknown>>) {
    const ids:string[]=[];
    for(const record of records){
      const recordId=id(),stamp=now(),clean={...record};delete (clean as Record<string,unknown>).id;
      await runtimeEnv().DB.prepare(
        'INSERT INTO kv_records(collection,id,record_json,created_at,updated_at) VALUES(?,?,?,?,?)'
      ).bind(collection,recordId,JSON.stringify(clean),stamp,stamp).run();
      ids.push(recordId);
    }
    return ids;
  },
  async update(collection:string, changes:Array<{id:string;record:Record<string,unknown>}>) {
    const stamp=now();
    for(const change of changes){
      const clean={...change.record};delete (clean as Record<string,unknown>).id;
      await runtimeEnv().DB.prepare(
        `INSERT INTO kv_records(collection,id,record_json,created_at,updated_at)
         VALUES(?,?,?,?,?)
         ON CONFLICT(collection,id) DO UPDATE SET record_json=excluded.record_json,updated_at=excluded.updated_at`
      ).bind(collection,String(change.id),JSON.stringify(clean),stamp,stamp).run();
    }
    return changes.map(x=>x.id);
  },
  async delete(collection:string, ids:string[]) {
    for(const recordId of ids)await runtimeEnv().DB.prepare(
      'DELETE FROM kv_records WHERE collection=? AND id=?'
    ).bind(collection,String(recordId)).run();
    return true;
  }
};

function base64Bytes(value:string){
  const raw=atob(value),bytes=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
  return bytes;
}
export const storage = {
  async write(files:Array<{path:string;content:string;contentType?:string}>){
    const bucket=runtimeEnv().FILES;
    if(!bucket)throw new Error('Binding R2 FILES não configurado.');
    const out:string[]=[];
    for(const file of files){
      await bucket.put(file.path,base64Bytes(file.content),{httpMetadata:{contentType:file.contentType||'application/octet-stream'}});
      out.push(file.path);
    }
    return out;
  }
};

async function geminiGenerate(payload:Record<string,unknown>){
  const key=runtimeEnv().GEMINI_API_KEY;
  if(!key)throw new Error('GEMINI_API_KEY não configurada no Cloudflare.');
  const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent',{
    method:'POST',headers:{'content-type':'application/json','x-goog-api-key':key},body:JSON.stringify(payload)
  });
  const raw=await response.text();
  if(!response.ok)throw new Error('Falha Gemini: '+raw.slice(0,500));
  const data=parseJson<Record<string,unknown>>(raw);
  const candidates=Array.isArray(data.candidates)?data.candidates as Array<Record<string,unknown>>:[];
  const content=(candidates[0]?.content||{}) as Record<string,unknown>;
  const parts=Array.isArray(content.parts)?content.parts as Array<Record<string,unknown>>:[];
  return parts.map(x=>String(x.text||'')).filter(Boolean).join('\n').trim();
}
export const ai = {
  async extract(input:{prompt:string;content:string;schema?:unknown}){
    const text=await geminiGenerate({
      contents:[{role:'user',parts:[{text:input.prompt+'\n\nCONTEÚDO:\n'+input.content+'\n\nResponda APENAS JSON válido compatível com este schema:\n'+JSON.stringify(input.schema||{})}]}],
      generationConfig:{responseMimeType:'application/json',temperature:0,maxOutputTokens:8192}
    });
    return {data:parseJson(text,{})};
  },
  async ocr(input:{images:Array<{data:string;mimeType:string}>;prompt?:string}){
    const parts:Record<string,unknown>[]=[{text:input.prompt||'Transcreva fielmente o documento.'}];
    for(const image of input.images)parts.push({inline_data:{mime_type:image.mimeType,data:image.data}});
    return {text:await geminiGenerate({contents:[{role:'user',parts}],generationConfig:{temperature:0,maxOutputTokens:8192}})};
  }
};

export const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
export const error=(message:string,status=400)=>json({error:message},status);

function cookie(request:Request,name:string){
  const raw=request.headers.get('cookie')||'';
  for(const part of raw.split(';')){const [k,...v]=part.trim().split('=');if(k===name)return decodeURIComponent(v.join('='))}
  return '';
}
async function userFromRequest(request:Request):Promise<AuthUser|null>{
  const sessionId=cookie(request,'obn_session');
  if(!sessionId)return null;
  const row=await runtimeEnv().DB.prepare(
    'SELECT user_id,email,name,expires_at FROM auth_sessions WHERE id=?'
  ).bind(sessionId).first<{user_id:string;email:string;name:string;expires_at:string}>();
  if(!row||row.expires_at<now())return null;
  return {userId:row.user_id,email:row.email,name:row.name||undefined};
}
export const requireAuth=():Middleware=>async ctx=>{
  const user=await userFromRequest(ctx.request);
  if(!user)return error('Autenticação necessária.',401);
  ctx.user=user;
};
export const withScopes=(..._scopes:string[]):Middleware=>async()=>{};
export const requireAdminEmailAllowlist=(allowlist:string[]):Middleware=>async ctx=>{
  const allowed=new Set(allowlist.map(x=>x.toLowerCase()).filter(Boolean));
  const configured=String(ctx.env.OWNER_EMAIL||'').trim().toLowerCase();
  if(configured)allowed.add(configured);
  if(!ctx.user?.email||!allowed.has(ctx.user.email.toLowerCase()))return error('Acesso administrativo não autorizado.',403);
};

function routeRegex(path:string){
  const names:string[]=[];
  const pattern=path.split('/').map(part=>{
    if(part.startsWith(':')){names.push(part.slice(1));return '([^/]+)'}
    return part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
  }).join('/');
  return {regex:new RegExp('^'+pattern+'$'),names};
}
function matchRoute(routes:RouterRoutes,method:string,pathname:string){
  for(const [key,stack] of Object.entries(routes)){
    const pos=key.indexOf(' ');if(pos<0)continue;
    const routeMethod=key.slice(0,pos),routePath=key.slice(pos+1);
    if(routeMethod!==method)continue;
    const compiled=routeRegex(routePath),match=pathname.match(compiled.regex);
    if(!match)continue;
    const params:Record<string,string>={};compiled.names.forEach((n,i)=>params[n]=decodeURIComponent(match[i+1]||''));
    return {stack:[...stack],params};
  }
  return null;
}
async function requestBody(request:Request){
  if(['GET','HEAD'].includes(request.method))return {};
  const type=request.headers.get('content-type')||'';
  if(type.includes('application/json')){try{return await request.json()}catch{return {}}}
  return {};
}
function sameOriginReturn(request:Request,value:string|null){
  const origin=new URL(request.url).origin;
  if(!value)return origin+'/';
  try{const u=new URL(value,origin);return u.origin===origin?u.toString():origin+'/'}catch{return origin+'/'}
}
const QUESTION_ASSET_KEY='university/question-assets-549.zip';
const LEGACY_QUESTION_ASSET_URL='https://fluxodre-campo-b2u-clbfo5.v2.appdeploy.ai/resources/question-assets-549.zip';

async function ensureQuestionAssetInR2(env:RuntimeEnv){
  if(!env.FILES)throw new Error('Binding R2 FILES não configurado.');
  let head=await env.FILES.head(QUESTION_ASSET_KEY);
  if(head)return head;
  const upstream=await fetch(LEGACY_QUESTION_ASSET_URL,{redirect:'follow'});
  if(!upstream.ok||!upstream.body)throw new Error('Não foi possível migrar as imagens da Universidade: HTTP '+upstream.status);
  await env.FILES.put(QUESTION_ASSET_KEY,upstream.body,{
    httpMetadata:{contentType:'application/zip'},
    customMetadata:{source:'legacy-appdeploy-v93',migratedAt:now()}
  });
  head=await env.FILES.head(QUESTION_ASSET_KEY);
  if(!head)throw new Error('O pacote de imagens não foi confirmado no R2 após a migração.');
  return head;
}

function parseByteRange(value:string,size:number){
  const match=value.match(/^bytes=(\d*)-(\d*)$/i);
  if(!match)return null;
  const a=match[1],b=match[2];
  let start:number,end:number;
  if(!a&&b){
    const suffix=Math.max(1,Number(b));
    start=Math.max(0,size-suffix);end=size-1;
  }else{
    start=Math.max(0,Number(a||0));
    end=b?Math.min(size-1,Number(b)):size-1;
  }
  if(!Number.isFinite(start)||!Number.isFinite(end)||start>end||start>=size)return null;
  return{start,end,length:end-start+1};
}

async function questionAssetResponse(request:Request,env:RuntimeEnv){
  try{
    const head=await ensureQuestionAssetInR2(env),size=Number(head.size||0);
    const headers=new Headers({
      'content-type':'application/zip',
      'accept-ranges':'bytes',
      'cache-control':'public, max-age=86400, stale-while-revalidate=604800'
    });
    const rangeHeader=request.headers.get('range');
    if(rangeHeader&&size>0){
      const range=parseByteRange(rangeHeader,size);
      if(!range){
        headers.set('content-range','bytes */'+size);
        return new Response(null,{status:416,headers});
      }
      const object=await env.FILES!.get(QUESTION_ASSET_KEY,{range:{offset:range.start,length:range.length}});
      if(!object)return error('Pacote visual não encontrado no R2.',404);
      headers.set('content-range',`bytes ${range.start}-${range.end}/${size}`);
      headers.set('content-length',String(range.length));
      return new Response(object.body,{status:206,headers});
    }
    const object=await env.FILES!.get(QUESTION_ASSET_KEY);
    if(!object)return error('Pacote visual não encontrado no R2.',404);
    if(size>0)headers.set('content-length',String(size));
    return new Response(request.method==='HEAD'?null:object.body,{status:200,headers});
  }catch(e){
    return error((e as Error).message||'Não foi possível carregar as imagens da Universidade.',503);
  }
}

async function authConfig(){
  const clientId=cleanEnvValue(runtimeEnv().GOOGLE_CLIENT_ID);
  return json({googleClientId:clientId});
}

async function authGoogleCredential(request:Request){
  const env=runtimeEnv(),clientId=cleanEnvValue(env.GOOGLE_CLIENT_ID);
  if(!clientId)return error('GOOGLE_CLIENT_ID não configurado.',503);
  let body:Record<string,unknown>={};
  try{body=await request.json() as Record<string,unknown>}catch{return error('Credencial Google ausente.',400)}
  const idToken=String(body.credential||body.idToken||'');
  if(!idToken)return error('Credencial Google ausente.',400);
  const infoResp=await fetch('https://oauth2.googleapis.com/tokeninfo?id_token='+encodeURIComponent(idToken));
  const info=await infoResp.json() as Record<string,unknown>;
  if(!infoResp.ok||String(info.aud||'')!==clientId||String(info.email_verified||'')!=='true')return error('Identidade Google inválida.',401);
  const sessionId=id()+id(),expiresAt=new Date(Date.now()+7*24*60*60*1000).toISOString();
  const email=String(info.email||'').toLowerCase(),name=String(info.name||'');
  await env.DB.prepare('INSERT INTO auth_sessions(id,user_id,email,name,expires_at,created_at) VALUES(?,?,?,?,?,?)')
    .bind(sessionId,String(info.sub||email),email,name,expiresAt,now()).run();
  const headers=new Headers({'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
  headers.append('set-cookie',`obn_session=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`);
  headers.append('set-cookie','obn_auth=1; Path=/; Secure; SameSite=Lax; Max-Age=604800');
  return new Response(JSON.stringify({ok:true,user:{userId:String(info.sub||email),email,name}}),{status:200,headers});
}

async function authStart(request:Request){
  const env=runtimeEnv(),clientId=cleanEnvValue(env.GOOGLE_CLIENT_ID);
  if(!clientId)return error('GOOGLE_CLIENT_ID não configurado.',503);
  const url=new URL(request.url),state=id()+id(),returnTo=sameOriginReturn(request,url.searchParams.get('return')),stamp=now();
  await env.DB.prepare('INSERT INTO oauth_states(id,return_to,expires_at,created_at) VALUES(?,?,?,?)')
    .bind(state,returnTo,new Date(Date.now()+10*60*1000).toISOString(),stamp).run();
  const redirectUri=url.origin+'/api/auth/callback';
  const google=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  google.searchParams.set('client_id',clientId);google.searchParams.set('redirect_uri',redirectUri);
  google.searchParams.set('response_type','code');google.searchParams.set('scope','openid email profile');
  google.searchParams.set('state',state);google.searchParams.set('prompt','select_account');
  return Response.redirect(google.toString(),302);
}
async function authCallback(request:Request){
  const env=runtimeEnv(),url=new URL(request.url),code=url.searchParams.get('code')||'',state=url.searchParams.get('state')||'';
  const stateRow=await env.DB.prepare('SELECT return_to,expires_at FROM oauth_states WHERE id=?').bind(state).first<{return_to:string;expires_at:string}>();
  await env.DB.prepare('DELETE FROM oauth_states WHERE id=?').bind(state).run();
  if(!stateRow||stateRow.expires_at<now()||!code)return error('Login expirado ou inválido.',400);
  const clientId=cleanEnvValue(env.GOOGLE_CLIENT_ID),clientSecret=cleanEnvValue(env.GOOGLE_CLIENT_SECRET);
  if(!clientId||!clientSecret)return error('OAuth Google não configurado.',503);
  const redirectUri=url.origin+'/api/auth/callback';
  const tokenResp=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({
    code,client_id:clientId,client_secret:clientSecret,redirect_uri:redirectUri,grant_type:'authorization_code'
  })});
  const token=await tokenResp.json() as Record<string,unknown>;
  const idToken=String(token.id_token||'');
  if(!tokenResp.ok||!idToken){
    const oauthError=String(token.error||'oauth_token_exchange_failed');
    const oauthDescription=String(token.error_description||'');
    return json({
      error:'Google não concluiu a autenticação.',
      oauthError,
      ...(oauthDescription?{oauthDescription}:{}),
      redirectUri
    },401);
  }
  const infoResp=await fetch('https://oauth2.googleapis.com/tokeninfo?id_token='+encodeURIComponent(idToken));
  const info=await infoResp.json() as Record<string,unknown>;
  if(!infoResp.ok||String(info.aud||'')!==clientId||String(info.email_verified||'')!=='true')return error('Identidade Google inválida.',401);
  const sessionId=id()+id(),expiresAt=new Date(Date.now()+7*24*60*60*1000).toISOString();
  await env.DB.prepare('INSERT INTO auth_sessions(id,user_id,email,name,expires_at,created_at) VALUES(?,?,?,?,?,?)')
    .bind(sessionId,String(info.sub||info.email),String(info.email||'').toLowerCase(),String(info.name||''),expiresAt,now()).run();
  const headers=new Headers({location:stateRow.return_to});
  headers.append('set-cookie',`obn_session=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`);
  headers.append('set-cookie','obn_auth=1; Path=/; Secure; SameSite=Lax; Max-Age=604800');
  return new Response(null,{status:302,headers});
}
async function authMe(request:Request){
  const user=await userFromRequest(request);
  return user?json({user}):error('Sessão não encontrada.',401);
}
async function authLogout(request:Request){
  const sessionId=cookie(request,'obn_session');
  if(sessionId)await runtimeEnv().DB.prepare('DELETE FROM auth_sessions WHERE id=?').bind(sessionId).run();
  const headers=new Headers({'content-type':'application/json'});
  headers.append('set-cookie','obn_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  headers.append('set-cookie','obn_auth=; Path=/; Secure; SameSite=Lax; Max-Age=0');
  return new Response(JSON.stringify({ok:true}),{status:200,headers});
}

async function healthResponse(env:RuntimeEnv){
  const dbBinding=(env as RuntimeEnv & {DB?:D1Database}).DB;
  const bindings={
    d1:!!dbBinding,
    r2:!!env.FILES,
    googleOAuth:!!cleanEnvValue(env.GOOGLE_CLIENT_ID),
    gemini:!!env.GEMINI_API_KEY,
    owner:!!env.OWNER_EMAIL
  };
  let schemaReady=false;
  let dbError:string|undefined;
  if(dbBinding){
    try{
      const rows=await dbBinding.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('kv_records','auth_sessions','oauth_states')").all<{name:string}>();
      const names=new Set((rows.results||[]).map(x=>x.name));
      schemaReady=['kv_records','auth_sessions','oauth_states'].every(name=>names.has(name));
    }catch(error){dbError=(error as Error)?.message||'D1 indisponível';}
  }
  return json({
    ok:true,
    service:'obra-na-mao-comercial',
    runtime:'cloudflare-worker',
    readyForLogin:bindings.d1&&schemaReady&&bindings.googleOAuth&&bindings.owner,
    readyForDesktopAi:bindings.d1&&schemaReady&&bindings.gemini,
    readyForFileImports:bindings.d1&&schemaReady&&bindings.r2,
    bindings,
    // OAuth runtime diagnostics; remove after validation.
    googleClientIdPresent: !!env.GOOGLE_CLIENT_ID,
    googleClientSecretPresent: !!env.GOOGLE_CLIENT_SECRET,
    googleClientIdFormatValid: /^\d+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(cleanEnvValue(env.GOOGLE_CLIENT_ID)),
    googleClientIdHasWhitespace: cleanEnvValue(env.GOOGLE_CLIENT_ID)!==String(env.GOOGLE_CLIENT_ID||''),
    googleClientIdHasOuterQuotes: /^["']|["']$/.test(cleanEnvValue(env.GOOGLE_CLIENT_ID)),
    schemaReady,
    ...(dbError?{dbError}:{}),
    checkedAt:new Date().toISOString()
  });
}

export function router(routes:RouterRoutes){
  return {
    async fetch(request:Request,env:RuntimeEnv,_ctx?:unknown){
      return runtime.run({env,request},async()=>{
        const url=new URL(request.url);
        if(url.pathname==='/api/health'&&request.method==='GET')return healthResponse(env);
        if(url.pathname==='/api/assets/question-images'&&(request.method==='GET'||request.method==='HEAD'))return questionAssetResponse(request,env);
        if(url.pathname==='/api/auth/config'&&request.method==='GET')return authConfig();
        if(url.pathname==='/api/auth/google-credential'&&request.method==='POST')return authGoogleCredential(request);
        if(url.pathname==='/api/auth/start'&&request.method==='GET')return authStart(request);
        if(url.pathname==='/api/auth/callback'&&request.method==='GET')return authCallback(request);
        if(url.pathname==='/api/auth/me'&&request.method==='GET')return authMe(request);
        if(url.pathname==='/api/auth/logout'&&request.method==='POST')return authLogout(request);
        const matched=matchRoute(routes,request.method,url.pathname);
        if(!matched)return error('Rota não encontrada.',404);
        const query=Object.fromEntries(url.searchParams.entries()),body=await requestBody(request);
        const context:RouterContext={request,env,query,params:matched.params,body};
        for(const middleware of matched.stack){
          const response=await middleware(context);
          if(response instanceof Response)return response;
        }
        return error('Rota sem resposta.',500);
      });
    }
  };
}
