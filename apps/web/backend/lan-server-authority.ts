import { runtimeEnv } from '../cloudflare/sdk';

export type LanServerMemberSnapshot = {
  memberId:string;
  email:string;
  name?:string;
  role:'admin'|'foreman'|'employee';
  modules:string[];
  channels:string[];
  status:'active'|'revoked';
};

type D1Like = Pick<D1Database,'prepare'>;
type AuthorityDeps = { db:D1Like; nowMs?:()=>number };

type ClaimRow = {
  id:string; token_hash:string; server_id:string; company_id:string;
  issued_by_device_id:string; issued_by_member_id:string;
  expires_at:string; consumed_at:string|null; created_at:string;
};

type GrantRow = {
  id:string; token_hash:string; server_id:string; company_id:string;
  claiming_member_id:string; status:'active'|'revoked'; created_at:string;
  last_seen_at:string|null; revoked_at:string|null;
};

const CLAIM_TTL_MS = 10 * 60 * 1000;
const MODULES = ['finance','rh','contracts','rdo','obra360','dre','procurement','measurements','documents','universidade','ai'];
const CHANNELS = ['desktop','mobile'];

function id(){ return crypto.randomUUID().replace(/-/g,''); }
function randomToken(){
  const bytes=new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(value=>value.toString(16).padStart(2,'0')).join('');
}
async function digest(value:string){
  const bytes=new TextEncoder().encode(value);
  const hash=await crypto.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(hash)).map(value=>value.toString(16).padStart(2,'0')).join('');
}
function parseRecord<T extends Record<string,unknown>>(value:unknown):T|null{
  if(!value)return null;
  try{return JSON.parse(String(value)) as T}catch{return null}
}
function listStrings(value:unknown){return Array.isArray(value)?value.map(String):[]}
function intersect(a:string[],b:string[]){return a.filter(value=>b.includes(value))}
function defaultModules(role:string){return role==='admin'?MODULES:role==='foreman'?['obra360','rdo']:['obra360']}
function defaultChannels(role:string){return role==='admin'?CHANNELS:['mobile']}

export function createLanServerAuthority({db,nowMs=Date.now}:AuthorityDeps){
  const nowIso=()=>new Date(nowMs()).toISOString();

  async function createLanClaim(input:{companyId:string;serverId:string;issuedByDeviceId:string;issuedByMemberId:string}){
    const companyId=String(input.companyId||'').trim();
    const serverId=String(input.serverId||'').trim();
    const issuedByDeviceId=String(input.issuedByDeviceId||'').trim();
    const issuedByMemberId=String(input.issuedByMemberId||'').trim();
    if(!companyId||!serverId||!issuedByDeviceId||!issuedByMemberId)throw new Error('Dados do claim LAN incompletos.');
    const claimToken=randomToken(), tokenHash=await digest(claimToken), createdAt=nowIso(), expiresAt=new Date(nowMs()+CLAIM_TTL_MS).toISOString();
    await db.prepare('INSERT INTO lan_server_claims(id,token_hash,server_id,company_id,issued_by_device_id,issued_by_member_id,expires_at,consumed_at,created_at) VALUES(?,?,?,?,?,?,?,?,?)')
      .bind(id(),tokenHash,serverId,companyId,issuedByDeviceId,issuedByMemberId,expiresAt,null,createdAt).run();
    return {claimToken,expiresAt};
  }

  async function redeemLanClaim(input:{serverId:string;claimToken:string}){
    const serverId=String(input.serverId||'').trim(), claimToken=String(input.claimToken||'').trim();
    if(!serverId||!claimToken)throw new Error('Claim LAN inválido.');
    const tokenHash=await digest(claimToken);
    const claim=await db.prepare('SELECT * FROM lan_server_claims WHERE token_hash=? AND server_id=? LIMIT 1').bind(tokenHash,serverId).first<ClaimRow>();
    if(!claim)throw new Error('Claim LAN inválido.');
    if(claim.consumed_at)throw new Error('Claim LAN já utilizado.');
    if(Date.parse(claim.expires_at)<=nowMs())throw new Error('Claim LAN expirado.');

    const consumedAt=nowIso();
    const consumed=await db.prepare('UPDATE lan_server_claims SET consumed_at=? WHERE id=? AND consumed_at IS NULL AND expires_at>?')
      .bind(consumedAt,claim.id,consumedAt).run();
    if(Number(consumed.meta?.changes||0)!==1)throw new Error('Claim LAN inválido ou já utilizado.');

    const serverToken=randomToken(), grantId=id(), serverHash=await digest(serverToken);
    await db.prepare('INSERT INTO lan_server_grants(id,token_hash,server_id,company_id,claiming_member_id,status,created_at,last_seen_at,revoked_at) VALUES(?,?,?,?,?,?,?,?,?)')
      .bind(grantId,serverHash,serverId,claim.company_id,claim.issued_by_member_id,'active',consumedAt,consumedAt,null).run();
    return {companyId:claim.company_id,serverToken,claimingMemberId:claim.issued_by_member_id,issuedByDeviceId:claim.issued_by_device_id};
  }

  async function authenticateLanServer(serverToken:string){
    const token=String(serverToken||'').trim();
    if(!token)return null;
    const tokenHash=await digest(token);
    const grant=await db.prepare("SELECT * FROM lan_server_grants WHERE token_hash=? AND status='active' LIMIT 1").bind(tokenHash).first<GrantRow>();
    if(!grant)return null;
    const seenAt=nowIso();
    await db.prepare("UPDATE lan_server_grants SET last_seen_at=? WHERE id=? AND status='active'").bind(seenAt,grant.id).run();
    return {grantId:grant.id,serverId:grant.server_id,companyId:grant.company_id};
  }

  async function revokeLanServerGrant(input:{serverId:string;companyId:string}){
    const revokedAt=nowIso();
    const result=await db.prepare("UPDATE lan_server_grants SET status='revoked',revoked_at=? WHERE server_id=? AND company_id=? AND status='active'")
      .bind(revokedAt,String(input.serverId||''),String(input.companyId||'')).run();
    return Number(result.meta?.changes||0)>0;
  }

  async function companyAccess(companyId:string){
    const companyRow=await db.prepare("SELECT record_json FROM kv_records WHERE collection='companies' AND id=? LIMIT 1").bind(companyId).first<{record_json:string}>();
    const company=parseRecord<Record<string,unknown>>(companyRow?.record_json);
    if(!company)return {modules:[] as string[],channels:[] as string[]};
    const ownerName=String(runtimeEnv().OWNER_COMPANY||'Obra na Mão').trim().toLowerCase();
    if(String(company.name||'').trim().toLowerCase()===ownerName)return {modules:[...MODULES],channels:[...CHANNELS]};
    const licenseId=String(company.licenseId||'');
    if(licenseId&&licenseId!=='owner'){
      const licenseRow=await db.prepare("SELECT record_json FROM kv_records WHERE collection='licenses' AND id=? LIMIT 1").bind(licenseId).first<{record_json:string}>();
      const license=parseRecord<Record<string,unknown>>(licenseRow?.record_json);
      const active=license&&String(license.status||'')==='active'&&(!license.expiresAt||String(license.expiresAt)>=nowIso());
      if(active)return {modules:listStrings(license.modules),channels:listStrings(license.channels)};
      return {modules:[],channels:[]};
    }
    return {modules:listStrings(company.licensedModules),channels:listStrings(company.licensedChannels)};
  }

  async function lanServerSnapshot(companyId:string){
    const cleanCompanyId=String(companyId||'').trim();
    if(!cleanCompanyId)throw new Error('Empresa LAN inválida.');
    const access=await companyAccess(cleanCompanyId);
    const rows=await db.prepare("SELECT id,record_json FROM kv_records WHERE collection LIKE 'members_%' AND json_extract(record_json,'$.companyId')=? ORDER BY id")
      .bind(cleanCompanyId).all<{id:string;record_json:string}>();
    const members:LanServerMemberSnapshot[]=[];
    for(const row of rows.results||[]){
      const member=parseRecord<Record<string,unknown>>(row.record_json);if(!member)continue;
      const role=(['admin','foreman','employee'].includes(String(member.role))?String(member.role):'employee') as LanServerMemberSnapshot['role'];
      const requestedModules=listStrings(member.modules).length?listStrings(member.modules):defaultModules(role);
      const requestedChannels=listStrings(member.channels).length?listStrings(member.channels):defaultChannels(role);
      members.push({
        memberId:String(row.id),email:String(member.email||''),name:member.name?String(member.name):undefined,role,
        modules:intersect(access.modules,requestedModules),channels:intersect(access.channels,requestedChannels),status:'active'
      });
    }
    const generatedAt=nowIso();
    const revision=await digest(JSON.stringify(members.map(member=>({...member,modules:[...member.modules].sort(),channels:[...member.channels].sort()}))));
    return {companyId:cleanCompanyId,revision,generatedAt,members};
  }

  return {createLanClaim,redeemLanClaim,authenticateLanServer,revokeLanServerGrant,lanServerSnapshot};
}

function defaultAuthority(){return createLanServerAuthority({db:runtimeEnv().DB});}
export const createLanClaim=(input:{companyId:string;serverId:string;issuedByDeviceId:string;issuedByMemberId:string})=>defaultAuthority().createLanClaim(input);
export const redeemLanClaim=(input:{serverId:string;claimToken:string})=>defaultAuthority().redeemLanClaim(input);
export const authenticateLanServer=(serverToken:string)=>defaultAuthority().authenticateLanServer(serverToken);
export const revokeLanServerGrant=(input:{serverId:string;companyId:string})=>defaultAuthority().revokeLanServerGrant(input);
export const lanServerSnapshot=(companyId:string)=>defaultAuthority().lanServerSnapshot(companyId);
