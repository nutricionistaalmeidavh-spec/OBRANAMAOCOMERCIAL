import { createPasswordRecord, newInitialPassword, sha256Hex, type PasswordRecord, verifyPasswordRecord } from './password-credentials';

type Env={DB:D1Database;OWNER_EMAIL?:string};
type PlatformAccess={id:string;email:string;name?:string;platformRole:'superadmin'|'user';status:'pending'|'active'|'blocked';companyIds:string[];projectIds:string[];systems:Record<string,{enabled:boolean;role:string}>;provisionalCode?:string;claimedBy?:string;sessionVersion?:number;createdAt:string;updatedAt:string};
const SESSION_TTL_MS=24*60*60*1000;
const SESSION_MAX_AGE=Math.floor(SESSION_TTL_MS/1000);
const now=()=>new Date().toISOString();
const norm=(value:unknown)=>String(value||'').trim().toLowerCase();
const safe=(value:string)=>value.replace(/[^a-zA-Z0-9_-]/g,'_');
function hashKey(value:string){let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16)}
const emailIndex=(email:string)=>`platform_access_email_${hashKey(norm(email))}`;
const legacyCodeIndex=(code:string)=>`platform_access_code_${safe(code.toUpperCase())}`;

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
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS password_activation_codes(
    code_hash TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    access_id TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`).run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_password_activation_email ON password_activation_codes(email)').run();
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
  const refs=await env.DB.prepare('SELECT record_json FROM kv_records WHERE collection=? ORDER BY updated_at DESC LIMIT 1').bind(emailIndex(email)).first<{record_json:string}>();
  if(!refs?.record_json)return null;let accessId='';try{accessId=String(JSON.parse(refs.record_json).accessId||'')}catch{}if(!accessId)return null;
  const row=await env.DB.prepare("SELECT id,record_json FROM kv_records WHERE collection='platform_accesses' AND id=?").bind(accessId).first<{id:string;record_json:string}>();
  if(!row)return null;try{return{...JSON.parse(row.record_json),id:row.id} as PlatformAccess}catch{return null}
}
async function savePlatformAccess(env:Env,access:PlatformAccess){
  const{id,...record}=access;await env.DB.prepare("UPDATE kv_records SET record_json=?,updated_at=? WHERE collection='platform_accesses' AND id=?").bind(JSON.stringify(record),now(),id).run();
}
async function sessionUser(env:Env,request:Request){
  const sessionId=cookie(request,'obn_session');if(!sessionId)return null;
  const row=await env.DB.prepare('SELECT user_id,email,name,expires_at FROM auth_sessions WHERE id=?').bind(sessionId).first<{user_id:string;email:string;name:string;expires_at:string}>();
  if(!row||row.expires_at<now())return null;return{userId:row.user_id,email:row.email,name:row.name||''};
}
async function createSession(env:Env,email:string,name?:string){
  const normalized=norm(email),userId='pwd:'+(await sha256Hex(normalized)).slice(0,24),sessionId=crypto.randomUUID().replace(/-/g,'')+crypto.randomUUID().replace(/-/g,''),stamp=now(),expiresAt=new Date(Date.now()+SESSION_TTL_MS).toISOString();
  await env.DB.prepare('INSERT INTO auth_sessions(id,user_id,email,name,expires_at,created_at) VALUES(?,?,?,?,?,?)').bind(sessionId,userId,normalized,name||'',expiresAt,stamp).run();
  const headers=new Headers({'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','x-frame-options':'DENY','referrer-policy':'same-origin'});
  headers.append('set-cookie',`obn_session=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}`);
  headers.append('set-cookie',`obn_auth=1; Path=/; Secure; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}`);
  return new Response(JSON.stringify({ok:true,user:{userId,email:normalized,name:name||''}}),{status:200,headers});
}
async function revokeSessions(env:Env,email:string){await env.DB.prepare('DELETE FROM auth_sessions WHERE lower(email)=?').bind(norm(email)).run()}
async function consumeRateLimit(env:Env,request:Request,scope:string,limit:number,windowSeconds:number){
  const rawIp=(request.headers.get('cf-connecting-ip')||request.headers.get('x-forwarded-for')||'unknown').split(',')[0].trim(),bucket=Math.floor(Date.now()/1000/windowSeconds),key=`${scope}:${(await sha256Hex(rawIp)).slice(0,16)}`;
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS api_rate_limits(key TEXT NOT NULL,bucket INTEGER NOT NULL,count INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL,PRIMARY KEY(key,bucket))`).run();
  await env.DB.prepare(`INSERT INTO api_rate_limits(key,bucket,count,updated_at) VALUES(?,?,1,?) ON CONFLICT(key,bucket) DO UPDATE SET count=count+1,updated_at=excluded.updated_at`).bind(key,bucket,now()).run();
  const row=await env.DB.prepare('SELECT count FROM api_rate_limits WHERE key=? AND bucket=?').bind(key,bucket).first<{count:number}>();return Number(row?.count||1)<=limit;
}
async function readBody(request:Request){try{return await request.json() as Record<string,unknown>}catch{return{}}}
async function login(request:Request,env:Env){
  if(!await consumeRateLimit(env,request,'auth-password',10,600))return fail('Muitas tentativas. Aguarde antes de tentar novamente.',429);
  const body=await readBody(request),email=norm(body.email),password=String(body.password||'');if(!/^\S+@\S+\.\S+$/.test(email)||!password)return fail('E-mail ou senha inválidos.',401);
  const record=await credential(env,email);if(!record||!await verifyPasswordRecord(password,record))return fail('E-mail ou senha inválidos.',401);
  const access=await platformAccess(env,email);if(!access)return fail('Acesso ainda não configurado para esta conta.',403);if(access.status==='blocked')return fail('Acesso bloqueado. Procure o administrador.',403);if(access.status!=='active')return fail('Primeiro acesso pendente. Use seu código de liberação.',403);
  return createSession(env,email,access.name);
}
async function firstAccess(request:Request,env:Env){
  if(!await consumeRateLimit(env,request,'auth-first-access',6,900))return fail('Muitas tentativas. Aguarde antes de tentar novamente.',429);
  const body=await readBody(request),email=norm(body.email),code=String(body.code||'').trim().toUpperCase(),password=String(body.password||'');if(!/^\S+@\S+\.\S+$/.test(email)||!code||!password)return fail('Informe e-mail, código de liberação e senha inicial.',400);
  const record=await credential(env,email);if(!record||!await verifyPasswordRecord(password,record))return fail('Dados de primeiro acesso inválidos.',401);
  const access=await platformAccess(env,email);if(!access||access.platformRole==='superadmin')return fail('Dados de primeiro acesso inválidos.',401);if(access.status==='blocked')return fail('Acesso bloqueado. Procure o administrador.',403);
  const codeHash=await sha256Hex(code),reserved=await env.DB.prepare('SELECT email,access_id FROM password_activation_codes WHERE code_hash=?').bind(codeHash).first<{email:string;access_id:string}>();
  const legacyMatch=access.provisionalCode===code,validReserved=reserved&&norm(reserved.email)===email&&reserved.access_id===access.id;
  if(!legacyMatch&&!validReserved)return fail('Código de liberação inválido.',401);
  const userId='pwd:'+(await sha256Hex(email)).slice(0,24),next={...access,status:'active' as const,claimedBy:userId,provisionalCode:undefined,updatedAt:now()};await savePlatformAccess(env,next);
  await env.DB.prepare('DELETE FROM password_activation_codes WHERE code_hash=?').bind(codeHash).run();
  if(legacyMatch){const ref=await env.DB.prepare('SELECT id FROM kv_records WHERE collection=? LIMIT 1').bind(legacyCodeIndex(code)).first<{id:string}>();if(ref?.id)await env.DB.prepare('DELETE FROM kv_records WHERE collection=? AND id=?').bind(legacyCodeIndex(code),ref.id).run()}
  return createSession(env,email,access.name);
}
async function changePassword(request:Request,env:Env){
  const user=await sessionUser(env,request);if(!user)return fail('Autenticação necessária.',401);const body=await readBody(request),current=String(body.currentPassword||''),next=String(body.newPassword||'');if(next.length<8)return fail('A nova senha deve ter ao menos 8 caracteres.',400);
  const record=await credential(env,user.email);if(!record||!await verifyPasswordRecord(current,record))return fail('Senha atual inválida.',401);await saveCredential(env,user.email,await createPasswordRecord(next));return json({ok:true});
}
async function ownerProvision(request:Request,env:Env){
  const user=await sessionUser(env,request),owner=norm(env.OWNER_EMAIL);if(!user||!owner||norm(user.email)!==owner)return fail('Acesso administrativo não autorizado.',403);
  const body=await readBody(request),email=norm(body.email),access=await platformAccess(env,email);if(!access||access.platformRole==='superadmin')return fail('Acesso não encontrado.',404);
  const initialPassword=newInitialPassword(),code=crypto.randomUUID().replace(/-/g,'').slice(0,12).toUpperCase();await saveCredential(env,email,await createPasswordRecord(initialPassword));
  await ensureSchema(env);const codeHash=await sha256Hex(code);await env.DB.prepare('DELETE FROM password_activation_codes WHERE email=?').bind(email).run();await env.DB.prepare('INSERT INTO password_activation_codes(code_hash,email,access_id,created_at) VALUES(?,?,?,?)').bind(codeHash,email,access.id,now()).run();
  const next={...access,status:'pending' as const,claimedBy:undefined,provisionalCode:undefined,sessionVersion:Number(access.sessionVersion||0)+1,updatedAt:now()};await savePlatformAccess(env,next);await revokeSessions(env,email);
  return json({ok:true,code,initialPassword,noExpiry:true});
}

export async function handleCorporatePasswordAuth(request:Request,env:Env):Promise<Response|null>{
  const url=new URL(request.url);if(request.method==='POST'&&url.pathname==='/api/auth/password/login')return login(request,env);if(request.method==='POST'&&url.pathname==='/api/auth/password/first-access')return firstAccess(request,env);if(request.method==='POST'&&url.pathname==='/api/auth/password/change')return changePassword(request,env);if(request.method==='POST'&&url.pathname==='/api/auth/password/admin/provision')return ownerProvision(request,env);return null;
}

export async function seedCorporatePasswordAccess(env:Env,input:{email:string;accessId:string;licenseCodeHash:string;password:PasswordRecord;name?:string;systems:PlatformAccess['systems']}){
  await ensureSchema(env);const email=norm(input.email),stamp=now(),access:Omit<PlatformAccess,'id'>={email,name:input.name,platformRole:'user',status:'pending',companyIds:[],projectIds:[],systems:input.systems,sessionVersion:0,createdAt:stamp,updatedAt:stamp};
  const accessRow=await env.DB.prepare("SELECT id FROM kv_records WHERE collection='platform_accesses' AND id=?").bind(input.accessId).first<{id:string}>();if(!accessRow)await env.DB.prepare('INSERT INTO kv_records(collection,id,record_json,created_at,updated_at) VALUES(?,?,?,?,?)').bind('platform_accesses',input.accessId,JSON.stringify(access),stamp,stamp).run();
  const indexCollection=emailIndex(email),indexRow=await env.DB.prepare('SELECT id FROM kv_records WHERE collection=? LIMIT 1').bind(indexCollection).first<{id:string}>();const indexRecord=JSON.stringify({accessId:input.accessId});if(indexRow)await env.DB.prepare('UPDATE kv_records SET record_json=?,updated_at=? WHERE collection=? AND id=?').bind(indexRecord,stamp,indexCollection,indexRow.id).run();else await env.DB.prepare('INSERT INTO kv_records(collection,id,record_json,created_at,updated_at) VALUES(?,?,?,?,?)').bind(indexCollection,crypto.randomUUID().replace(/-/g,''),indexRecord,stamp,stamp).run();
  await saveCredential(env,email,input.password);await env.DB.prepare('INSERT INTO password_activation_codes(code_hash,email,access_id,created_at) VALUES(?,?,?,?) ON CONFLICT(code_hash) DO UPDATE SET email=excluded.email,access_id=excluded.access_id').bind(input.licenseCodeHash,email,input.accessId,stamp).run();
}
