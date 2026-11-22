/**
 * Google proves identity. The existing company/member/license records remain the
 * authority for access. This module only links a verified Google subject to a
 * stable account ID; it never creates memberships, companies, or entitlements.
 */
export class GoogleIdentityFailure extends Error {
  constructor(message:string, readonly status=401) { super(message); this.name='GoogleIdentityFailure'; }
}
export type VerifiedGoogleIdentity={sub:string;email:string;name:string};
type JsonRow={record_json:string};
const norm=(value:unknown)=>String(value||'').trim().toLowerCase();
const safe=(value:string)=>value.replace(/[^a-zA-Z0-9_-]/g,'_');
function hashKey(value:string) {
  let h=2166136261;
  for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)}
  return (h>>>0).toString(16);
}
const memberIndex=(email:string)=>'access_'+safe(email.slice(0,28))+'_'+hashKey(email);
const platformIndex=(email:string)=>'platform_access_email_'+hashKey(email);
const licenseIndex=(email:string)=>'license_email_'+safe(email.slice(0,28))+'_'+hashKey(email);
function readRecord(row:JsonRow|null):Record<string,unknown> {
  if(!row)return {};
  try {const data=JSON.parse(row.record_json);return data&&typeof data==='object'&&!Array.isArray(data)?data:{}}catch{return {}}
}
export function verifiedGoogleClaims(info:Record<string,unknown>,clientId:string):VerifiedGoogleIdentity {
  const email=norm(info.email),sub=String(info.sub||'').trim(),issuer=String(info.iss||'');
  if(!clientId||String(info.aud||'')!==clientId||
    !['accounts.google.com','https://accounts.google.com'].includes(issuer)||
    !(info.email_verified===true||info.email_verified==='true')||
    !sub||!email||!/^\\S+@\\S+\\.\\S+$/.test(email)) {
    throw new GoogleIdentityFailure('Identidade Google inválida.',401);
  }
  return{sub,email,name:String(info.name||'')};
}
async function ensureTable(db:D1Database) {
  await db.prepare('CREATE TABLE IF NOT EXISTS google_identity_links (sub TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, user_id TEXT NOT NULL, created_at TEXT NOT NULL)').run();
}
async function linkedBySub(db:D1Database,sub:string) {
  return db.prepare('SELECT sub,email,user_id FROM google_identity_links WHERE sub=?').bind(sub).first<{sub:string;email:string;user_id:string}>();
}
async function linkedByEmail(db:D1Database,email:string) {
  return db.prepare('SELECT sub,email,user_id FROM google_identity_links WHERE email=?').bind(email).first<{sub:string;email:string;user_id:string}>();
}
async function assertNotBlocked(db:D1Database,email:string) {
  const ref=readRecord(await db.prepare('SELECT record_json FROM kv_records WHERE collection=? ORDER BY updated_at DESC LIMIT 1').bind(platformIndex(email)).first<JsonRow>());
  if(!ref.accessId)return;
  const access=readRecord(await db.prepare("SELECT record_json FROM kv_records WHERE collection='platform_accesses' AND id=?").bind(String(ref.accessId)).first<JsonRow>());
  if(norm(access.email)===email&&access.status==='blocked')
    throw new GoogleIdentityFailure('Acesso bloqueado. Procure o administrador.',403);
}
async function legacyAccountId(db:D1Database,identity:VerifiedGoogleIdentity) {
  const rows=await db.prepare('SELECT record_json FROM kv_records WHERE collection=? ORDER BY updated_at DESC LIMIT 20')
    .bind(memberIndex(identity.email)).all<JsonRow>();
  const members=(rows.results||[]).map(row=>readRecord(row))
    .filter(row=>row.status!=='revoked'&&(!row.email||norm(row.email)===identity.email))
    .map(row=>String(row.userId||'').trim()).filter(Boolean);
  // Prefer a prior Google ID when it already belongs to this member. Otherwise
  // retain the first established account ID, including legacy password IDs.
  const existing=members.includes(identity.sub)?identity.sub:members[0];
  if(existing)return existing;
  const hasPasswords=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='password_credentials'").first<{name:string}>();
  if(hasPasswords){
    const password=await db.prepare('SELECT email FROM password_credentials WHERE email=?').bind(identity.email).first<{email:string}>();
    if(password){
      const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(identity.email));
      const hex=Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,'0')).join('');
      return 'pwd:'+hex.slice(0,24);
    }
  }
  // License claims can predate the Platform membership: preserve their owner ID.
  const refs=await db.prepare('SELECT record_json FROM kv_records WHERE collection=? ORDER BY updated_at DESC LIMIT 5')
    .bind(licenseIndex(identity.email)).all<JsonRow>();
  for(const ref of refs.results||[]){
    const licenseId=String(readRecord(ref).licenseId||'');
    if(!licenseId)continue;
    const license=readRecord(await db.prepare("SELECT record_json FROM kv_records WHERE collection='licenses' AND id=?").bind(licenseId).first<JsonRow>());
    if(norm(license.email)===identity.email&&license.status==='active'&&
      (!license.expiresAt||String(license.expiresAt)>=new Date().toISOString())&&license.claimedBy)
      return String(license.claimedBy);
  }
  return identity.sub;
}
export async function resolveGoogleIdentity(db:D1Database,identity:VerifiedGoogleIdentity) {
  await ensureTable(db);
  // A blocked account may not create a fresh session just by using Google.
  await assertNotBlocked(db,identity.email);
  const existing=await linkedBySub(db,identity.sub);
  if(existing){
    if(existing.email!==identity.email)
      throw new GoogleIdentityFailure('Esta conta Google já está vinculada a outro e-mail. Solicite suporte para alterar o vínculo.',403);
    return{userId:existing.user_id,email:identity.email,name:identity.name};
  }
  const byEmail=await linkedByEmail(db,identity.email);
  if(byEmail&&byEmail.sub!==identity.sub)
    throw new GoogleIdentityFailure('Este e-mail já está vinculado a outra conta Google. Solicite suporte.',403);
  const userId=await legacyAccountId(db,identity);
  // Unique constraints make simultaneous first logins idempotent and prevent
  // a second Google subject taking over an email by racing the first request.
  await db.prepare('INSERT OR IGNORE INTO google_identity_links(sub,email,user_id,created_at) VALUES(?,?,?,?)')
    .bind(identity.sub,identity.email,userId,new Date().toISOString()).run();
  const committed=await linkedBySub(db,identity.sub);
  if(!committed||committed.email!==identity.email)
    throw new GoogleIdentityFailure('Este e-mail já está vinculado a outra conta Google. Solicite suporte.',403);
  return{userId:committed.user_id,email:identity.email,name:identity.name};
}
/** Password authentication remains supported and uses the canonical linked ID. */
export async function linkedUserIdForPassword(db:D1Database,email:string,fallback:string) {
  try {
    const linked=await linkedByEmail(db,norm(email));
    return linked?.user_id||fallback;
  } catch(error) {
    // Older installations may not have received the Google link table yet.
    if(/no such table.*google_identity_links/i.test(String(error)))return fallback;
    throw error;
  }
}
