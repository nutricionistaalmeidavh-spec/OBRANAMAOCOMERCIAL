export const DEBORA_PRODUCT_CODE='debora-lactacao';
export const DEBORA_MANUAL_PLAN='pro_6m';
export const DEBORA_MANUAL_SOURCE='mercado_livre_manual';

type LicenseRow={id:string;product_code:string;email:string;plan_code:string;status:string;starts_at:string;expires_at:string|null;source:string;external_ref:string;metadata_json:string;created_at:string;updated_at:string};
export type ProductAccess={productCode:string;planCode:string;active:boolean;commercial:boolean;enforceLimits:boolean;patientLimit:number|null;mediaUpload:boolean;expiresAt:string|null;source:string;status:string};
type OverviewAccount={email:string;status:string};
type OverviewLicense={email:string;plan_code:string;status:string;expires_at:string|null;updated_at?:string};

export function normalizeLicenseEmail(value:unknown){return String(value||'').trim().toLowerCase()}

export function addCalendarMonths(value:string,months:number){
  const input=new Date(value);if(Number.isNaN(input.getTime()))throw new Error('invalid_date');
  const originalDay=input.getUTCDate();
  const target=new Date(input.getTime());
  target.setUTCDate(1);target.setUTCMonth(target.getUTCMonth()+months);
  const lastDay=new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate();
  target.setUTCDate(Math.min(originalDay,lastDay));
  return target.toISOString();
}

export function unmanagedAccess():ProductAccess{return{productCode:DEBORA_PRODUCT_CODE,planCode:'legacy_unmanaged',active:true,commercial:false,enforceLimits:false,patientLimit:null,mediaUpload:true,expiresAt:null,source:'legacy',status:'unmanaged'}}

export function accessForLicense(license:Pick<LicenseRow,'plan_code'|'status'|'expires_at'|'source'>|{planCode:string;status:string;expiresAt:string|null;source?:string}|null,now=new Date().toISOString()):ProductAccess{
  const planCode=license&&('plan_code'in license?license.plan_code:license.planCode)||'freemium';
  const status=license?.status||'freemium';
  const expiresAt=license&&('expires_at'in license?license.expires_at:license.expiresAt)||null;
  const source=license?.source||'cloudflare_d1';
  const end=expiresAt?Date.parse(expiresAt):null;
  const active=!!license&&['active','trialing'].includes(status)&&(!expiresAt||(typeof end==='number'&&Number.isFinite(end)&&end>Date.parse(now)))&&planCode.startsWith('pro_');
  return active
    ?{productCode:DEBORA_PRODUCT_CODE,planCode,active:true,commercial:true,enforceLimits:true,patientLimit:null,mediaUpload:true,expiresAt,source,status}
    :{productCode:DEBORA_PRODUCT_CODE,planCode:'freemium',active:false,commercial:true,enforceLimits:true,patientLimit:3,mediaUpload:false,expiresAt:null,source:'cloudflare_d1',status:'freemium'};
}

export function summarizeDeboraLicenseOverview(accounts:OverviewAccount[],licenses:OverviewLicense[],now=new Date().toISOString()){
  const current=Date.parse(now),expiringLimit=current+30*24*60*60*1000;
  const emails=[...new Set(accounts.filter(account=>account.status==='commercial').map(account=>normalizeLicenseEmail(account.email)).filter(Boolean))];
  let pro=0,freemium=0,expiring=0,revoked=0;
  for(const email of emails){
    const own=licenses.filter(license=>normalizeLicenseEmail(license.email)===email).sort((a,b)=>String(b.updated_at||'').localeCompare(String(a.updated_at||'')));
    const active=own.find(license=>{
      const expiry=license.expires_at?Date.parse(license.expires_at):null;
      return license.plan_code.startsWith('pro_')&&['active','trialing'].includes(license.status)&&(!license.expires_at||(typeof expiry==='number'&&Number.isFinite(expiry)&&expiry>current));
    });
    if(active){
      pro+=1;
      const expiry=active.expires_at?Date.parse(active.expires_at):null;
      if(typeof expiry==='number'&&Number.isFinite(expiry)&&expiry>current&&expiry<=expiringLimit)expiring+=1;
    }else freemium+=1;
    if(!active&&own[0]?.status==='revoked')revoked+=1;
  }
  return{clients:emails.length,pro,freemium,expiring,revoked};
}

async function commercialAccount(db:D1Database,productCode:string,email:string){return db.prepare('SELECT product_code,email,status,source,created_at,updated_at FROM product_accounts WHERE product_code=? AND email=? LIMIT 1').bind(productCode,email).first<any>()}
async function activeLicense(db:D1Database,productCode:string,email:string){return db.prepare("SELECT * FROM product_licenses WHERE product_code=? AND email=? AND status IN ('active','trialing') ORDER BY CASE WHEN expires_at IS NULL THEN 1 ELSE 0 END DESC, expires_at DESC, updated_at DESC LIMIT 1").bind(productCode,email).first<LicenseRow>()}

export async function registerCommercialAccount(db:D1Database,productCode:string,emailValue:unknown,source='saas_onboarding',at=new Date().toISOString()){
  const email=normalizeLicenseEmail(emailValue);if(!/^\S+@\S+\.\S+$/.test(email))throw new Error('invalid_email');
  await db.prepare(`INSERT INTO product_accounts(product_code,email,status,source,created_at,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(product_code,email) DO UPDATE SET status='commercial',source=excluded.source,updated_at=excluded.updated_at`).bind(productCode,email,'commercial',source,at,at).run();
  return{productCode,email,commercial:true};
}

export async function resolveProductAccess(db:D1Database,productCode:string,emailValue:unknown,now=new Date().toISOString()):Promise<ProductAccess>{
  const email=normalizeLicenseEmail(emailValue);if(!email)return unmanagedAccess();
  const account=await commercialAccount(db,productCode,email);
  if(!account||account.status!=='commercial')return unmanagedAccess();
  const license=await activeLicense(db,productCode,email);
  return accessForLicense(license,now);
}

async function event(db:D1Database,{licenseId=null,productCode,email,action,actor='',source='',details={}}:{licenseId?:string|null;productCode:string;email:string;action:string;actor?:string;source?:string;details?:Record<string,unknown>},at=new Date().toISOString()){
  await db.prepare('INSERT INTO product_license_events(id,license_id,product_code,email,action,actor,source,details_json,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),licenseId,productCode,email,action,actor,source,JSON.stringify(details),at).run();
}

export async function grantManualDeboraLicense(db:D1Database,emailValue:unknown,actor='central-artisys',now=new Date().toISOString()){
  const email=normalizeLicenseEmail(emailValue);if(!/^\S+@\S+\.\S+$/.test(email))throw new Error('invalid_email');
  await registerCommercialAccount(db,DEBORA_PRODUCT_CODE,email,DEBORA_MANUAL_SOURCE,now);
  const existing=await db.prepare('SELECT * FROM product_licenses WHERE product_code=? AND email=? AND source=? AND external_ref=? LIMIT 1').bind(DEBORA_PRODUCT_CODE,email,DEBORA_MANUAL_SOURCE,'').first<LicenseRow>();
  const base=existing?.expires_at&&Date.parse(existing.expires_at)>Date.parse(now)?existing.expires_at:now;
  const expiresAt=addCalendarMonths(base,6);
  const id=existing?.id||crypto.randomUUID();
  if(existing){await db.prepare("UPDATE product_licenses SET plan_code=?,status='active',starts_at=?,expires_at=?,metadata_json=?,updated_at=? WHERE id=?").bind(DEBORA_MANUAL_PLAN,now,expiresAt,JSON.stringify({months:6,manual:true}),now,id).run()}
  else{await db.prepare('INSERT INTO product_licenses(id,product_code,email,plan_code,status,starts_at,expires_at,source,external_ref,metadata_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,DEBORA_PRODUCT_CODE,email,DEBORA_MANUAL_PLAN,'active',now,expiresAt,DEBORA_MANUAL_SOURCE,'',JSON.stringify({months:6,manual:true}),now,now).run()}
  await event(db,{licenseId:id,productCode:DEBORA_PRODUCT_CODE,email,action:existing?'renew':'grant',actor,source:DEBORA_MANUAL_SOURCE,details:{planCode:DEBORA_MANUAL_PLAN,expiresAt}},now);
  return{id,email,plan_code:DEBORA_MANUAL_PLAN,status:'active',expires_at:expiresAt,source:DEBORA_MANUAL_SOURCE};
}

export async function getManualDeboraLicense(db:D1Database,emailValue:unknown){
  const email=normalizeLicenseEmail(emailValue);if(!/^\S+@\S+\.\S+$/.test(email))throw new Error('invalid_email');
  return db.prepare('SELECT id,email,plan_code,status,expires_at,source FROM product_licenses WHERE product_code=? AND email=? AND source=? AND external_ref=? LIMIT 1').bind(DEBORA_PRODUCT_CODE,email,DEBORA_MANUAL_SOURCE,'').first<any>();
}

export async function revokeManualDeboraLicense(db:D1Database,emailValue:unknown,actor='central-artisys',now=new Date().toISOString()){
  const email=normalizeLicenseEmail(emailValue);if(!/^\S+@\S+\.\S+$/.test(email))throw new Error('invalid_email');
  const current=await getManualDeboraLicense(db,email);if(!current)return null;
  await db.prepare("UPDATE product_licenses SET status='revoked',updated_at=? WHERE id=?").bind(now,current.id).run();
  await event(db,{licenseId:current.id,productCode:DEBORA_PRODUCT_CODE,email,action:'revoke',actor,source:DEBORA_MANUAL_SOURCE},now);
  return{...current,status:'revoked'};
}

export async function syncProductLicense(db:D1Database,input:{productCode?:string;email:unknown;planCode:string;status:string;expiresAt?:string|null;source?:string;externalRef?:string;actor?:string},now=new Date().toISOString()){
  const productCode=input.productCode||DEBORA_PRODUCT_CODE,email=normalizeLicenseEmail(input.email);if(!/^\S+@\S+\.\S+$/.test(email))throw new Error('invalid_email');
  const source=input.source||'billing_sync',externalRef=input.externalRef||input.planCode;
  await registerCommercialAccount(db,productCode,email,source,now);
  const existing=await db.prepare('SELECT id,created_at FROM product_licenses WHERE product_code=? AND email=? AND source=? AND external_ref=? LIMIT 1').bind(productCode,email,source,externalRef).first<any>();
  const id=existing?.id||crypto.randomUUID(),status=['active','trialing','past_due','cancelled','revoked'].includes(input.status)?input.status:'cancelled';
  if(existing){await db.prepare('UPDATE product_licenses SET plan_code=?,status=?,starts_at=?,expires_at=?,metadata_json=?,updated_at=? WHERE id=?').bind(input.planCode,status,now,input.expiresAt||null,JSON.stringify({synced:true}),now,id).run()}
  else{await db.prepare('INSERT INTO product_licenses(id,product_code,email,plan_code,status,starts_at,expires_at,source,external_ref,metadata_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,productCode,email,input.planCode,status,now,input.expiresAt||null,source,externalRef,JSON.stringify({synced:true}),now,now).run()}
  await event(db,{licenseId:id,productCode,email,action:'sync',actor:input.actor||'billing',source,details:{planCode:input.planCode,status,expiresAt:input.expiresAt||null}},now);
  return{id,email,plan_code:input.planCode,status,expires_at:input.expiresAt||null,source};
}
