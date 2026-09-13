import { createPasswordRecord, sha256Hex, type PasswordRecord, verifyPasswordRecord } from './password-credentials';

type Env={DB:D1Database;OWNER_EMAIL?:string};
type PlatformAccess={id:string;email:string;name?:string;platformRole:'superadmin'|'user';status:'pending'|'active'|'blocked';companyIds:string[];projectIds:string[];systems:Record<string,{enabled:boolean;role:string}>;provisionalCode?:string;claimedBy?:string;sessionVersion?:number;createdAt:string;updatedAt:string};
type License={id:string;email?:string;code:string;status:'active'|'revoked';expiresAt?:string;claimedBy?:string;companyId?:string;updatedAt?:string};
const SESSION_TTL_MS=24*60*60*1000;
const SESSION_MAX_AGE=Math.floor(SESSION_TTL_MS/1000);
const RESERVED_FIRST_ACCESS_HASH='1ba29e33d79d9ce2d61ffd872689fd0df6287a9a99f8a639968b86e480b2d560';
const now=()=>new Date().toISOString();
const norm=(value:unknown)=>String(value||'').trim().toLowerCase();
const safe=(value:string)=>value.replace(/[^a-zA-Z0-9_-]/g,'_');
function hashKey(value:string){let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16)}
const platformEmailIndex=(email:string)=>`platform_access_email_${hashKey(norm(email))}`;
const legacyCodeIndex=(code:string)=>`platform_access_code_${safe(code.toUpperCase())}`;
const licenseEmailIndex=(email:string)=>`license_email_${safe(norm(email).slice(0,28))}_${hashKey(norm(email))}`;

function json(value:unknown,status=200,extra?:HeadersInit){
  const headers=new Headers({'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','x-frame-options':'DENY','referrer-policy':'same-origin',...extra});
  return new Response(JSON.stringify(value),{status,headers});
}
const fail=(message:string,status=400)=>json({error:message},status);
function cookie(request:Request,name:string){for(const part of (request.headers.get('cookie')||'').split(';')){const [key,...value]=part.trim().split('=');if(key===name)return decodeURIComponent(value.join('='))}return''}
async function ensureSchema(env:Env){
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS password_credentials(
    email TEXT PRIMARY KEY,
    algorithm TEXT NOT NULL,
    salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    iterations INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();
}
async function credential(env:Env,email:string):Promise<PasswordRecord|null>{
  await ensureSchema(env);
  const row=await env.DB.prepare('SELECT algorithm,salt,password_hash,iterations,created_at,updated_at FROM password_credentials WHERE email=?').bind(norm(email)).first<any>();
  return row?{algorithm:row.algorithm,salt:row.salt,hash:row.password_hash,iterations:Number(row.iterations),createdAt:row.created_at,updatedAt:row.updated_at}:null;
}
async function saveCredential(env:Env,email:string,record:PasswordRecord){
  await ensureSchema(env);
  await env.DB.prepare(`INSERT INTO password_credentials(email,algorithm,salt,password_hash,iterations,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET algorithm=excluded.algorithm,salt=excluded.salt,password_hash=excluded.password_hash,iterations=excluded.iterations,updated_at=excluded.updated_at`)
    .bind(norm(email),record.algorithm,record.salt,record.hash,record.iterations,record.createdAt,record.updatedAt).run();
}
async function platformAccess(env:Env,email:string):Promise<PlatformAccess|null>{
  const ref=await env.DB.prepare('SELECT record_json FROM kv_records WHERE collection=? ORDER BY updated_at DESC LIMIT 1').bind(platformEmailIndex(email)).first<{record_json:string}>();
  if(!ref?.record_json)return null;let accessId='';try{accessId=String(JSON.parse(ref.record_json).accessId||'')}catch{}if(!accessId)return null;
  const row=await env.DB.prepare("SELECT id,record_json FROM kv_records WHERE collection='platform_accesses' AND id=?").bind(accessId).first<{id:string;record_json:string}>();
  if(!row)return null;try{return{...JSON.parse(row.record_json),id:row.id} as PlatformAccess}catch{return null}
}
async function savePlatformAccess(env:Env,access:PlatformAccess){
  const{id,...record}=access,stamp=now();await env.DB.prepare("UPDATE kv_records SET record_json=?,updated_at=? WHERE collection='platform_accesses' AND id=?").bind(JSON.stringify({...record,updatedAt:stamp}),stamp,id).run();
}
async function licenseByEmail(env:Env,email:string):Promise<License|null>{
  const refs=await env.DB.prepare('SELECT record_json FROM kv_records WHERE collection=? ORDER BY updated_at DESC LIMIT 5').bind(licenseEmailIndex(email)).all<{record_json:string}>();
  for(const row of refs.results||[]){let licenseId='';try{licenseId=String(JSON.parse(row.record_json).licenseId||'')}catch{}if(!licenseId)continue;const lic=await env.DB.prepare("SELECT id,record_json FROM kv_records WHERE collection='licenses' AND id=?").bind(licenseId).first<{id:string;record_json:string}>();if(!lic)continue;try{const parsed={...JSON.parse(lic.record_json),id:lic.id} as License;if(norm(parsed.email)===norm(email)&&parsed.status==='active'&&(!parsed.expiresAt||parsed.expiresAt>=now()))return parsed}catch{}}
  return null;
}
async function saveLicense(env:Env,license:License){const{id,...record}=license,stamp=now();await env.DB.prepare("UPDATE kv_records SET record_json=?,updated_at=? WHERE collection='licenses' AND id=?").bind(JSON.stringify({...record,updatedAt:stamp}),stamp,id).run()}
async function sessionUser(env:Env,request:Request){
  const sessionId=cookie(request,'obn_session');if(!sessionId)return null;
  const row=await env.DB.prepare('SELECT user_id,email,name,expires_at FROM auth_sessions WHERE id=?').bind(sessionId).first<{user_id:string;email:string;name:string;expires_at:string}>();
  if(!row||row.expires_at<now())return null;return{userId:row.user_id,email:row.email,name:row.name||''};
}
async function stableUserId(email:string){return'pwd:'+(await sha256Hex(norm(email))).slice(0,24)}
async function createSession(env:Env,email:string,name?:string){
  const normalized=norm(email),userId=await stableUserId(normalized),sessionId=crypto.randomUUID().replace(/-/g,'')+crypto.randomUUID().replace(/-/g,''),stamp=now(),expiresAt=new Date(Date.now()+SESSION_TTL_MS).toISOString();
  await env.DB.prepare('INSERT INTO auth_sessions(id,user_id,email,name,expires_at,created_at) VALUES(?,?,?,?,?,?)').bind(sessionId,userId,normalized,name||'',expiresAt,stamp).run();
  const headers=new Headers({'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','x-frame-options':'DENY','referrer-policy':'same-origin'});
  headers.append('set-cookie',`obn_session=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}`);
  headers.append('set-cookie',`obn_auth=1; Path=/; Secure; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}`);
  return new Response(JSON.stringify({ok:true,user:{userId,email:normalized,name:name||''}}),{status:200,headers});
}
async function consumeRateLimit(env:Env,request:Request,scope:string,limit:number,windowSeconds:number){
  const rawIp=(request.headers.get('cf-connecting-ip')||request.headers.get('x-forwarded-for')||'unknown').split(',')[0].trim(),bucket=Math.floor(Date.now()/1000/windowSeconds),key=`${scope}:${(await sha256Hex(rawIp)).slice(0,16)}`;
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS api_rate_limits(key TEXT NOT NULL,bucket INTEGER NOT NULL,count INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL,PRIMARY KEY(key,bucket))`).run();
  await env.DB.prepare(`INSERT INTO api_rate_limits(key,bucket,count,updated_at) VALUES(?,?,1,?) ON CONFLICT(key,bucket) DO UPDATE SET count=count+1,updated_at=excluded.updated_at`).bind(key,bucket,now()).run();
  const row=await env.DB.prepare('SELECT count FROM api_rate_limits WHERE key=? AND bucket=?').bind(key,bucket).first<{count:number}>();return Number(row?.count||1)<=limit;
}
async function readBody(request:Request){try{return await request.json() as Record<string,unknown>}catch{return{}}}
async function validLicenseCode(license:License,code:string){if(license.code===code)return true;return license.code==='RESERVED'&&(await sha256Hex(code))===RESERVED_FIRST_ACCESS_HASH}
async function login(request:Request,env:Env){
  if(!await consumeRateLimit(env,request,'auth-password',10,600))return fail('Muitas tentativas. Aguarde antes de tentar novamente.',429);
  const body=await readBody(request),email=norm(body.email),password=String(body.password||'');if(!/^\S+@\S+\.\S+$/.test(email)||!password)return fail('E-mail ou senha inválidos.',401);
  const record=await credential(env,email);if(!record||!await verifyPasswordRecord(password,record))return fail('E-mail ou senha inválidos.',401);
  const access=await platformAccess(env,email);if(access?.status==='blocked')return fail('Acesso bloqueado. Procure o administrador.',403);if(access&&access.status!=='active')return fail('Primeiro acesso pendente. Use seu código de liberação.',403);
  if(!access&&!await licenseByEmail(env,email))return fail('Acesso ainda não configurado para esta conta.',403);
  return createSession(env,email,access?.name);
}
async function firstAccess(request:Request,env:Env){
  if(!await consumeRateLimit(env,request,'auth-first-access',6,900))return fail('Muitas tentativas. Aguarde antes de tentar novamente.',429);
  const body=await readBody(request),email=norm(body.email),code=String(body.code||'').trim().toUpperCase(),password=String(body.password||'');if(!/^\S+@\S+\.\S+$/.test(email)||!code||password.length<8)return fail('Informe e-mail, código de liberação e uma senha inicial com ao menos 8 caracteres.',400);
  if(await credential(env,email))return fail('O primeiro acesso desta conta já foi concluído. Entre com e-mail e senha.',409);
  const access=await platformAccess(env,email);if(access?.platformRole==='superadmin')return fail('Use o método administrativo de autenticação.',403);if(access?.status==='blocked')return fail('Acesso bloqueado. Procure o administrador.',403);
  const license=await licenseByEmail(env,email),legacyMatch=!!access?.provisionalCode&&access.provisionalCode===code,licenseMatch=!!license&&await validLicenseCode(license,code);if(!legacyMatch&&!licenseMatch)return fail('Código de liberação inválido.',401);
  const userId=await stableUserId(email);if(license?.claimedBy&&license.claimedBy!==userId)return fail('Este código de liberação já foi utilizado.',409);
  await saveCredential(env,email,await createPasswordRecord(password));
  if(access&&legacyMatch){const next={...access,status:'active' as const,claimedBy:userId,provisionalCode:undefined,updatedAt:now()};await savePlatformAccess(env,next);const ref=await env.DB.prepare('SELECT id FROM kv_records WHERE collection=? LIMIT 1').bind(legacyCodeIndex(code)).first<{id:string}>();if(ref?.id)await env.DB.prepare('DELETE FROM kv_records WHERE collection=? AND id=?').bind(legacyCodeIndex(code),ref.id).run()}
  if(license&&!license.claimedBy)await saveLicense(env,{...license,claimedBy:userId,updatedAt:now()});
  return createSession(env,email,access?.name);
}
async function changePassword(request:Request,env:Env){
  const user=await sessionUser(env,request);if(!user)return fail('Autenticação necessária.',401);const body=await readBody(request),current=String(body.currentPassword||''),next=String(body.newPassword||'');if(next.length<8)return fail('A nova senha deve ter ao menos 8 caracteres.',400);
  const record=await credential(env,user.email);if(!record||!await verifyPasswordRecord(current,record))return fail('Senha atual inválida.',401);await saveCredential(env,user.email,await createPasswordRecord(next));return json({ok:true});
}

export async function handleCorporatePasswordAuth(request:Request,env:Env):Promise<Response|null>{
  const url=new URL(request.url);if(request.method==='POST'&&url.pathname==='/api/auth/password/login')return login(request,env);if(request.method==='POST'&&url.pathname==='/api/auth/password/first-access')return firstAccess(request,env);if(request.method==='POST'&&url.pathname==='/api/auth/password/change')return changePassword(request,env);return null;
}
