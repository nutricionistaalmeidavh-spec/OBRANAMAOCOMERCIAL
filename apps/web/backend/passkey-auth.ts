/**
 * WebAuthn/passkeys for the commercial PWA.
 * No biometric data is sent to the server: only public keys and signed challenges.
 * Supports ES256 platform credentials (iOS/Android), without paid services.
 */
import { educationParticipantBySession, educationSessionForPasskey } from './education';

type Env={ DB:D1Database };
type Scope='corporate'|'collaborator';
type Principal={subject:string;email:string;name:string;scope:Scope};
type Cbor=number|string|Uint8Array|Cbor[]|Map<Cbor,Cbor>|boolean|null;
const validScope=(value:unknown):value is Scope=>value==='corporate'||value==='collaborator';
const now=()=>new Date().toISOString();
function respond(body:unknown,status=200,extra?:HeadersInit){
  return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','x-frame-options':'DENY',...extra}});
}
const fail=(message:string,status=400)=>respond({error:message},status);
const encode=(bytes:Uint8Array)=>btoa(Array.from(bytes,b=>String.fromCharCode(b)).join('')).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
function decode(value:unknown,maxLength=8192){
  if(typeof value!=='string'||!value||value.length>maxLength||!/^[\w-]+={0,2}$/.test(value))throw new Error('Dados de autenticação inválidos.');
  const normalized=value.replace(/-/g,'+').replace(/_/g,'/');
  const raw=atob(normalized+'='.repeat((4-normalized.length%4)%4));
  return Uint8Array.from(raw,c=>c.charCodeAt(0));
}
function concat(...parts:Uint8Array[]){const result=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const p of parts){result.set(p,at);at+=p.length}return result}
async function sha256(bytes:Uint8Array){return new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))}
function randomChallenge(){const bytes=crypto.getRandomValues(new Uint8Array(32));return encode(bytes)}
function cookie(request:Request,key:string){for(const item of (request.headers.get('cookie')||'').split(';')){const [name,...value]=item.trim().split('=');if(name===key)return decodeURIComponent(value.join('='))}return''}
function sameOrigin(request:Request){
  const url=new URL(request.url);
  if(url.protocol!=='https:'&&url.hostname!=='localhost'&&url.hostname!=='127.0.0.1')return false;
  if((request.headers.get('sec-fetch-site')||'').toLowerCase()==='cross-site')return false;
  const origin=request.headers.get('origin');
  return !origin||origin===url.origin;
}
async function body(request:Request){try{return await request.json() as Record<string,any>}catch{return{}}}
function bytesEqual(a:Uint8Array,b:Uint8Array){return a.length===b.length&&a.every((byte,i)=>byte===b[i])}
class CborReader{
  pos=0;
  constructor(readonly bytes:Uint8Array){}
  take(count:number){if(!Number.isSafeInteger(count)||count<0||count>this.bytes.length-this.pos)throw new Error('CBOR inválido.');const out=this.bytes.slice(this.pos,this.pos+count);this.pos+=count;return out}
  length(ai:number){
    if(ai<24)return ai;
    if(ai===24)return this.take(1)[0];
    if(ai===25){const b=this.take(2);return b[0]*256+b[1]}
    if(ai===26){const b=this.take(4);return(b[0]*16777216)+(b[1]*65536)+(b[2]*256)+b[3]}
    throw new Error('Tamanho CBOR não suportado.');
  }
  read(depth=0):Cbor{
    if(depth>12)throw new Error('CBOR aninhado demais.');
    const initial=this.take(1)[0],type=initial>>5,amount=this.length(initial&31);
    if(type===0)return amount;
    if(type===1)return -1-amount;
    if(type===2)return this.take(amount);
    if(type===3)return new TextDecoder('utf-8',{fatal:true}).decode(this.take(amount));
    if(type===4){if(amount>64)throw new Error('CBOR muito grande.');return Array.from({length:amount},()=>this.read(depth+1))}
    if(type===5){if(amount>64)throw new Error('CBOR muito grande.');const map=new Map<Cbor,Cbor>();for(let i=0;i<amount;i++){const k=this.read(depth+1),v=this.read(depth+1);if(map.has(k))throw new Error('Chave CBOR repetida.');map.set(k,v)}return map}
    if(type===7&&amount===20)return false;
    if(type===7&&amount===21)return true;
    if(type===7&&amount===22)return null;
    throw new Error('Formato CBOR não suportado.');
  }
}
function registrationKey(attestation:Uint8Array,credentialId:string){
  const reader=new CborReader(attestation),root=reader.read();
  if(reader.pos!==reader.bytes.length||!(root instanceof Map)||root.get('fmt')!=='none')throw new Error('Atestado WebAuthn não suportado.');
  const stmt=root.get('attStmt'),data=root.get('authData');
  if(!(stmt instanceof Map)||stmt.size||!(data instanceof Uint8Array)||data.length<55)throw new Error('Atestado inválido.');
  const flags=data[32];
  if((flags&0x45)!==0x45)throw new Error('É necessário confirmar a identidade no aparelho.');
  const idLength=data[53]*256+data[54],start=55,end=start+idLength;
  if(idLength<16||idLength>1024||end>=data.length||encode(data.slice(start,end))!==credentialId)throw new Error('Identificador da chave inválido.');
  const keyReader=new CborReader(data.slice(end)),key=keyReader.read();
  if(!(key instanceof Map)||key.get(1)!==2||key.get(3)!==-7||key.get(-1)!==1)throw new Error('Tipo de chave não suportado.');
  const x=key.get(-2),y=key.get(-3);
  if(!(x instanceof Uint8Array)||!(y instanceof Uint8Array)||x.length!==32||y.length!==32)throw new Error('Chave pública inválida.');
  return {rpHash:data.slice(0,32),x:encode(x),y:encode(y)};
}
function derSignature(input:Uint8Array){
  if(input.length<8||input.length>80||input[0]!==0x30)throw new Error('Assinatura inválida.');
  let pos=1;
  function length(){let n=input[pos++];if(n===0x81)n=input[pos++];if(!Number.isInteger(n)||n<1||n>input.length-pos)throw new Error('Assinatura inválida.');return n}
  const sequenceLength=length(),limit=pos+sequenceLength;
  if(limit!==input.length)throw new Error('Assinatura inválida.');
  const out=new Uint8Array(64);
  for(let i=0;i<2;i++){
    if(input[pos++]!==0x02)throw new Error('Assinatura inválida.');
    const n=length(),number=input.slice(pos,pos+n);pos+=n;
    if(n>33||(n===33&&number[0]!==0)||(number[0]&128)!==0)throw new Error('Assinatura inválida.');
    const trimmed=number[0]===0?number.slice(1):number;
    if(trimmed.length>32)throw new Error('Assinatura inválida.');
    out.set(trimmed,32*i+32-trimmed.length);
  }
  if(pos!==limit)throw new Error('Assinatura inválida.');
  return out;
}
async function clientData(request:Request,encoded:unknown,purpose:'webauthn.create'|'webauthn.get',challenge:string){
  const bytes=decode(encoded);
  const parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  if(parsed?.type!==purpose||parsed?.challenge!==challenge||parsed?.origin!==new URL(request.url).origin||parsed?.crossOrigin===true||parsed?.topOrigin)throw new Error('Desafio ou domínio WebAuthn inválido.');
  return bytes;
}
async function ensureTables(env:Env){
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS passkey_credentials(id TEXT PRIMARY KEY,scope TEXT NOT NULL,subject TEXT NOT NULL,email TEXT NOT NULL,name TEXT NOT NULL,public_x TEXT NOT NULL,public_y TEXT NOT NULL,counter INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,last_used_at TEXT)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_passkey_owner ON passkey_credentials(scope,subject)').run();
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS passkey_challenges(id TEXT PRIMARY KEY,purpose TEXT NOT NULL,scope TEXT NOT NULL,subject TEXT NOT NULL,expires_at TEXT NOT NULL)').run();
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS passkey_limits(ip TEXT NOT NULL,bucket INTEGER NOT NULL,count INTEGER NOT NULL,PRIMARY KEY(ip,bucket))').run();
}
async function limit(env:Env,request:Request,amount:number){
  const ip=(request.headers.get('cf-connecting-ip')||'unknown').slice(0,80);
  const hash=encode((await sha256(new TextEncoder().encode(ip))).slice(0,16)),bucket=Math.floor(Date.now()/600000);
  await env.DB.prepare('INSERT INTO passkey_limits(ip,bucket,count) VALUES(?,?,1) ON CONFLICT(ip,bucket) DO UPDATE SET count=count+1').bind(hash,bucket).run();
  const row=await env.DB.prepare('SELECT count FROM passkey_limits WHERE ip=? AND bucket=?').bind(hash,bucket).first<{count:number}>();
  return Number(row?.count||0)<=amount;
}
async function principal(env:Env,request:Request,scope:Scope,token:unknown):Promise<Principal|null>{
  if(scope==='collaborator'){
    const p=await educationParticipantBySession(String(token||''));
    return p?{scope,subject:p.id,email:String(p.email||''),name:String(p.name||'Colaborador')}:null;
  }
  const sid=cookie(request,'obn_session');
  if(!sid)return null;
  const row=await env.DB.prepare('SELECT user_id,email,name,expires_at FROM auth_sessions WHERE id=?').bind(sid).first<{user_id:string;email:string;name:string;expires_at:string}>();
  return row&&row.expires_at>now()?{scope,subject:row.user_id,email:row.email,name:row.name||row.email}:null;
}
async function challenge(env:Env,purpose:string,scope:Scope,subject:string){
  const id=randomChallenge(),expiry=new Date(Date.now()+5*60*1000).toISOString();
  await env.DB.prepare('INSERT INTO passkey_challenges(id,purpose,scope,subject,expires_at) VALUES(?,?,?,?,?)').bind(id,purpose,scope,subject,expiry).run();
  return id;
}
async function consume(env:Env,id:string,purpose:string,scope:Scope,subject?:string){
  const row=await env.DB.prepare('DELETE FROM passkey_challenges WHERE id=? AND purpose=? AND scope=? AND expires_at>? RETURNING subject').bind(id,purpose,scope,now()).first<{subject:string}>();
  return !!row&&(subject===undefined||row.subject===subject);
}
async function createWebSession(env:Env,email:string,name:string,subject:string){
  const sessionId=crypto.randomUUID().replace(/-/g,'')+crypto.randomUUID().replace(/-/g,''),expiry=new Date(Date.now()+86400000).toISOString();
  await env.DB.prepare('INSERT INTO auth_sessions(id,user_id,email,name,expires_at,created_at) VALUES(?,?,?,?,?,?)').bind(sessionId,subject,email,name,expiry,now()).run();
  const headers=new Headers({'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
  headers.append('set-cookie','obn_session='+encodeURIComponent(sessionId)+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400');
  headers.append('set-cookie','obn_auth=1; Path=/; Secure; SameSite=Lax; Max-Age=86400');
  return new Response(JSON.stringify({ok:true,scope:'corporate'}),{headers});
}
async function enrollOptions(request:Request,env:Env,b:Record<string,any>){
  if(!validScope(b.scope))return fail('Tipo de acesso inválido.');
  const user=await principal(env,request,b.scope,b.token);
  if(!user)return fail('Entre com sua conta antes de cadastrar uma chave.',401);
  const count=await env.DB.prepare('SELECT COUNT(*) AS n FROM passkey_credentials WHERE scope=? AND subject=?').bind(user.scope,user.subject).first<{n:number}>();
  if(Number(count?.n||0)>=8)return fail('Limite de oito chaves por conta atingido.',409);
  const rpID=new URL(request.url).hostname,ch=await challenge(env,'register',user.scope,user.subject);
  return respond({challenge:ch,rp:{name:'Obra na Mão',id:rpID},user:{id:encode(new TextEncoder().encode(user.scope+':'+user.subject)),name:user.email||user.name,displayName:user.name},pubKeyCredParams:[{type:'public-key',alg:-7}],timeout:60000,attestation:'none',authenticatorSelection:{residentKey:'required',requireResidentKey:true,userVerification:'required'}});
}
async function enrollVerify(request:Request,env:Env,b:Record<string,any>){
  if(!validScope(b.scope))return fail('Tipo de acesso inválido.');
  const user=await principal(env,request,b.scope,b.token);
  if(!user)return fail('Sessão expirada.',401);
  const response=b.response||{},id=String(response.id||'');
  if(!id||id.length>1400||response.type!=='public-key')return fail('Credencial inválida.');
  try{
    const cd=decode(response.response?.clientDataJSON);
    const parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(cd));
    const ch=String(parsed?.challenge||'');
    if(!await consume(env,ch,'register',user.scope,user.subject))return fail('Desafio expirado ou já utilizado.',409);
    await clientData(request,response.response?.clientDataJSON,'webauthn.create',ch);
    const publicKey=registrationKey(decode(response.response?.attestationObject,32768),id);
    if(!bytesEqual(publicKey.rpHash,await sha256(new TextEncoder().encode(new URL(request.url).hostname))))return fail('Domínio da chave inválido.',403);
    const result=await env.DB.prepare('INSERT OR IGNORE INTO passkey_credentials(id,scope,subject,email,name,public_x,public_y,counter,created_at) VALUES(?,?,?,?,?,?,?,0,?)').bind(id,user.scope,user.subject,user.email,user.name,publicKey.x,publicKey.y,now()).run();
    if(Number(result.meta?.changes||0)!==1)return fail('Esta chave já está cadastrada.',409);
    return respond({ok:true});
  }catch{return fail('Não foi possível validar esta chave de acesso.',400)}
}
async function loginOptions(request:Request,env:Env,b:Record<string,any>){
  if(!validScope(b.scope))return fail('Tipo de acesso inválido.');
  if(!await limit(env,request,25))return fail('Muitas tentativas. Tente novamente mais tarde.',429);
  const ch=await challenge(env,'login',b.scope,'');
  return respond({challenge:ch,rpId:new URL(request.url).hostname,timeout:60000,userVerification:'required'});
}
async function loginVerify(request:Request,env:Env,b:Record<string,any>){
  if(!validScope(b.scope))return fail('Tipo de acesso inválido.');
  if(!await limit(env,request,25))return fail('Muitas tentativas. Tente novamente mais tarde.',429);
  const response=b.response||{},id=String(response.id||'');
  if(!id||id.length>1400||response.type!=='public-key')return fail('Credencial inválida.',401);
  try{
    const cd=decode(response.response?.clientDataJSON),parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(cd)),ch=String(parsed?.challenge||'');
    if(!await consume(env,ch,'login',b.scope))return fail('Desafio expirado ou já utilizado.',401);
    const client=await clientData(request,response.response?.clientDataJSON,'webauthn.get',ch);
    const stored=await env.DB.prepare('SELECT id,scope,subject,email,name,public_x,public_y,counter FROM passkey_credentials WHERE id=? AND scope=?').bind(id,b.scope).first<{id:string;scope:Scope;subject:string;email:string;name:string;public_x:string;public_y:string;counter:number}>();
    if(!stored)return fail('Chave de acesso não reconhecida.',401);
    const auth=decode(response.response?.authenticatorData),signature=derSignature(decode(response.response?.signature));
    if(auth.length<37||!bytesEqual(auth.slice(0,32),await sha256(new TextEncoder().encode(new URL(request.url).hostname)))||(auth[32]&0x05)!==0x05)return fail('Autenticação do dispositivo inválida.',401);
    const count=new DataView(auth.buffer,auth.byteOffset,auth.byteLength).getUint32(33,false),old=Number(stored.counter);
    if(old>0&&count<=old)return fail('Contador de segurança inválido.',401);
    const key=await crypto.subtle.importKey('jwk',{kty:'EC',crv:'P-256',x:stored.public_x,y:stored.public_y,ext:true},{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
    const signed=concat(auth,await sha256(client));
    if(!await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,signature,signed))return fail('Assinatura da chave inválida.',401);
    const changed=await env.DB.prepare('UPDATE passkey_credentials SET counter=?,last_used_at=? WHERE id=? AND counter=?').bind(count,now(),id,old).run();
    if(Number(changed.meta?.changes||0)!==1)return fail('Esta chave foi utilizada simultaneamente. Tente novamente.',409);
    if(b.scope==='collaborator'){
      const session=await educationSessionForPasskey(stored.subject);
      return session?respond({ok:true,scope:b.scope,...session}):fail('Conta do colaborador desativada.',403);
    }
    return createWebSession(env,stored.email,stored.name,stored.subject);
  }catch{return fail('Não foi possível validar a autenticação do dispositivo.',401)}
}
async function listCredentials(request:Request,env:Env,b:Record<string,any>){
  if(!validScope(b.scope))return fail('Tipo de acesso inválido.');
  const user=await principal(env,request,b.scope,b.token);
  if(!user)return fail('Sessão expirada.',401);
  const found=await env.DB.prepare('SELECT id,created_at,last_used_at FROM passkey_credentials WHERE scope=? AND subject=? ORDER BY created_at DESC').bind(user.scope,user.subject).all<{id:string;created_at:string;last_used_at:string|null}>();
  return respond({credentials:(found.results||[]).map(row=>({id:row.id,createdAt:row.created_at,lastUsedAt:row.last_used_at}))});
}
async function removeCredential(request:Request,env:Env,b:Record<string,any>){
  if(!validScope(b.scope))return fail('Tipo de acesso inválido.');
  const user=await principal(env,request,b.scope,b.token);
  if(!user)return fail('Sessão expirada.',401);
  if(typeof b.id!=='string'||b.id.length>1400)return fail('Chave inválida.');
  await env.DB.prepare('DELETE FROM passkey_credentials WHERE id=? AND scope=? AND subject=?').bind(b.id,user.scope,user.subject).run();
  return respond({ok:true});
}
export async function handlePasskeyAuth(request:Request,env:Env):Promise<Response|null>{
  const path=new URL(request.url).pathname;
  if(!path.startsWith('/api/auth/passkey/'))return null;
  if(!sameOrigin(request))return fail('Origem da requisição não autorizada.',403);
  if(request.method!=='POST')return fail('Método não permitido.',405);
  await ensureTables(env);
  const b=await body(request);
  if(path==='/api/auth/passkey/register/options')return enrollOptions(request,env,b);
  if(path==='/api/auth/passkey/register/verify')return enrollVerify(request,env,b);
  if(path==='/api/auth/passkey/login/options')return loginOptions(request,env,b);
  if(path==='/api/auth/passkey/login/verify')return loginVerify(request,env,b);
  if(path==='/api/auth/passkey/list')return listCredentials(request,env,b);
  if(path==='/api/auth/passkey/remove')return removeCredential(request,env,b);
  return fail('Rota não encontrada.',404);
}
