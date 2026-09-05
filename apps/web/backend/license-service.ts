import { runtimeEnv } from '../cloudflare/sdk'
import { getCompany } from './project-state'

export const LICENSE_MODULES=['finance','rh','contracts','rdo','obra360','dre','procurement','measurements','documents','universidade','ai'] as const
export const LICENSE_CHANNELS=['desktop','mobile'] as const
export type LicenseStatus='active'|'revoked'
export type License={id?:string;email?:string;code:string;modules:string[];channels:string[];status:LicenseStatus;expiresAt?:string;claimedBy?:string;companyId?:string;note?:string;plan?:string;maxUsers?:number;maxProjects?:number;maxDevices?:number;version?:number;createdAt:string;updatedAt:string}
export type LicenseMutationActor={source:'manual'|'billing'|'system';userId?:string;email?:string;orderId?:string}
export type LicenseEnv={DB:D1Database}
export class LicenseConflictError extends Error{constructor(){super('Licença alterada concorrentemente. Tente novamente.');this.name='LicenseConflictError'}}

const now=()=>new Date().toISOString(),norm=(v:string|undefined)=>String(v||'').trim().toLowerCase(),safe=(v:string)=>v.replace(/[^a-zA-Z0-9_-]/g,'_')
function hash(v:string){let h=2166136261;for(let i=0;i<v.length;i++){h^=v.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16)}
const emailTable=(email:string)=>`license_email_${safe(norm(email).slice(0,28))}_${hash(norm(email))}`,codeTable=(code:string)=>`license_code_${safe(code.toUpperCase())}`
export const newLicenseCode=()=>crypto.randomUUID().replace(/-/g,'').slice(0,12).toUpperCase()
const database=(env?:LicenseEnv)=>env?.DB||runtimeEnv().DB
const parse=(value:string)=>{try{return JSON.parse(value) as Record<string,unknown>}catch{return{}}}
async function kvGet<T>(collection:string,recordId:string,env?:LicenseEnv){const row=await database(env).prepare('SELECT id,record_json FROM kv_records WHERE collection=? AND id=?').bind(collection,recordId).first<{id:string;record_json:string}>();return row?{...parse(row.record_json),id:row.id} as T&{id:string}:null}
async function kvList<T>(collection:string,limit:number,env?:LicenseEnv){const rows=await database(env).prepare('SELECT id,record_json FROM kv_records WHERE collection=? ORDER BY updated_at DESC LIMIT ?').bind(collection,limit).all<{id:string;record_json:string}>();return(rows.results||[]).map(row=>({...parse(row.record_json),id:row.id}) as T&{id:string})}
async function kvAdd(collection:string,record:Record<string,unknown>,env?:LicenseEnv){const recordId=crypto.randomUUID().replace(/-/g,''),stamp=now(),clean={...record};delete clean.id;await database(env).prepare('INSERT INTO kv_records(collection,id,record_json,created_at,updated_at) VALUES(?,?,?,?,?)').bind(collection,recordId,JSON.stringify(clean),stamp,stamp).run();return recordId}
async function kvUpsert(collection:string,recordId:string,record:Record<string,unknown>,env?:LicenseEnv){const stamp=now(),clean={...record};delete clean.id;await database(env).prepare(`INSERT INTO kv_records(collection,id,record_json,created_at,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(collection,id) DO UPDATE SET record_json=excluded.record_json,updated_at=excluded.updated_at`).bind(collection,recordId,JSON.stringify(clean),stamp,stamp).run()}

export async function getLicense(id:string,env?:LicenseEnv){const x=await kvGet<License>('licenses',id,env);return x?{...x,id}:null}
export function licenseUsable(lic:License){return lic.status==='active'&&(!lic.expiresAt||lic.expiresAt>=now())}
export function licenseEntitlements(lic:License|null){return lic?{licenseId:lic.id,modules:lic.modules,channels:lic.channels,status:lic.status,expiresAt:lic.expiresAt}:null}

export async function indexLicense(id:string,lic:License,env?:LicenseEnv){
  const ctable=codeTable(lic.code),crefs=await kvList<Record<string,unknown>>(ctable,5,env),cref=crefs.find(r=>String(r.licenseId||'')===id)||crefs[0]
  if(cref)await kvUpsert(ctable,cref.id,{licenseId:id},env);else await kvAdd(ctable,{licenseId:id},env)
  if(lic.email){const etable=emailTable(lic.email),refs=await kvList<Record<string,unknown>>(etable,10,env);if(!refs.some(r=>String(r.licenseId||'')===id))await kvAdd(etable,{licenseId:id},env)}
}
export async function licenseByEmail(email:string,env?:LicenseEnv){const normalized=norm(email),refs=await kvList<Record<string,unknown>>(emailTable(normalized),10,env);for(const ref of refs){const lic=await getLicense(String(ref.licenseId||''),env);if(lic&&norm(lic.email)===normalized&&licenseUsable(lic))return lic}return null}
export async function licenseByCode(code:string,env?:LicenseEnv){const normalized=String(code||'').trim().toUpperCase(),refs=await kvList<Record<string,unknown>>(codeTable(normalized),5,env);for(const ref of refs){const lic=await getLicense(String(ref.licenseId||''),env);if(lic&&lic.code===normalized)return lic}return null}

export async function companyEntitlements(companyId:string){
  const company=await getCompany(companyId);if(!company)return null
  const ownerCompany=String(runtimeEnv().OWNER_COMPANY||'Obra na Mão'),companyName=String(company.name||'')
  if(norm(companyName)===norm(ownerCompany))return{licenseId:'owner',modules:[...LICENSE_MODULES],channels:[...LICENSE_CHANNELS],status:'active' as const,expiresAt:undefined}
  const licenseId=String(company.licenseId||''),lic=licenseId&&licenseId!=='owner'?await getLicense(licenseId):null
  if(lic){const usable=licenseUsable(lic);return{licenseId:lic.id,modules:usable?lic.modules:[],channels:usable?lic.channels:[],status:lic.status,expiresAt:lic.expiresAt}}
  const modules=(Array.isArray(company.licensedModules)?company.licensedModules:[]).map(String).filter(x=>(LICENSE_MODULES as readonly string[]).includes(x)),channels=(Array.isArray(company.licensedChannels)?company.licensedChannels:[]).map(String).filter(x=>(LICENSE_CHANNELS as readonly string[]).includes(x))
  return{licenseId:licenseId||undefined,modules,channels,status:'active' as const,expiresAt:undefined}
}

async function audit(licenseId:string,action:string,actor:LicenseMutationActor,previousVersion:number|undefined,nextVersion:number|undefined,details:Record<string,unknown>,env?:LicenseEnv){await database(env).prepare(`INSERT INTO license_audit(id,license_id,action,source,actor_user_id,actor_email,order_id,previous_version,next_version,details_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID().replace(/-/g,''),licenseId,action,actor.source,actor.userId||null,actor.email||null,actor.orderId||null,previousVersion??null,nextVersion??null,JSON.stringify(details),now()).run()}

export async function createLicense(input:Omit<License,'id'|'code'|'version'|'createdAt'|'updatedAt'> & {code?:string},actor:LicenseMutationActor,env?:LicenseEnv){const stamp=now(),lic:License={...input,code:input.code||newLicenseCode(),version:1,createdAt:stamp,updatedAt:stamp},licenseId=await kvAdd('licenses',lic as unknown as Record<string,unknown>,env);await indexLicense(licenseId,lic,env);await audit(licenseId,actor.source==='billing'?'billing_created':'created',actor,undefined,1,{status:lic.status,plan:lic.plan,companyId:lic.companyId},env);return{...lic,id:licenseId}}

export async function mutateLicense(id:string,mutator:(current:License)=>License,actor:LicenseMutationActor,action='updated',env?:LicenseEnv){
  const current=await getLicense(id,env);if(!current)throw new Error('Licença não encontrada.')
  const previousVersion=Math.max(0,Number(current.version||0)),nextVersion=previousVersion+1,stamp=now(),next={...mutator({...current}),id,version:nextVersion,updatedAt:stamp},clean={...next} as Record<string,unknown>;delete clean.id
  const result=await database(env).prepare(`UPDATE kv_records SET record_json=?,updated_at=? WHERE collection='licenses' AND id=? AND COALESCE(CAST(json_extract(record_json,'$.version') AS INTEGER),0)=?`).bind(JSON.stringify(clean),stamp,id,previousVersion).run() as {meta?:{changes?:number}}
  if(Number(result.meta?.changes||0)!==1)throw new LicenseConflictError();await indexLicense(id,next,env);await audit(id,action,actor,previousVersion,nextVersion,{status:next.status,plan:next.plan,companyId:next.companyId,expiresAt:next.expiresAt},env);return next
}

function extendExpiry(current:string|undefined,interval:'monthly'|'yearly'|'one_time'){if(interval==='one_time')return current;const base=current&&current>now()?new Date(current):new Date(),months=interval==='yearly'?12:1;base.setUTCMonth(base.getUTCMonth()+months);return base.toISOString()}
async function billingMutationAlreadyApplied(orderId:string,env?:LicenseEnv){if(!orderId)return null;const row=await database(env).prepare(`SELECT license_id FROM license_audit WHERE order_id=? AND source='billing' AND action IN ('billing_created','billing_renewed') ORDER BY created_at DESC LIMIT 1`).bind(orderId).first<{license_id:string}>();return row?.license_id?getLicense(row.license_id,env):null}

export async function activateOrRenewBillingLicense(input:{licenseId?:string;email:string;companyId:string;plan:string;modules:string[];channels:string[];maxUsers:number;maxProjects:number;maxDevices:number;interval:'monthly'|'yearly'|'one_time';orderId:string;userId:string},env?:LicenseEnv){
  const applied=await billingMutationAlreadyApplied(input.orderId,env);if(applied)return applied
  const actor:LicenseMutationActor={source:'billing',userId:input.userId,email:input.email,orderId:input.orderId}
  if(input.licenseId)return mutateLicense(input.licenseId,current=>({...current,email:norm(input.email),companyId:input.companyId,plan:input.plan,modules:input.modules,channels:input.channels,maxUsers:input.maxUsers,maxProjects:input.maxProjects,maxDevices:input.maxDevices,status:'active',expiresAt:extendExpiry(current.expiresAt,input.interval)}),actor,'billing_renewed',env)
  return createLicense({email:norm(input.email),companyId:input.companyId,plan:input.plan,modules:input.modules,channels:input.channels,maxUsers:input.maxUsers,maxProjects:input.maxProjects,maxDevices:input.maxDevices,status:'active',expiresAt:extendExpiry(undefined,input.interval)},actor,env)
}
export async function revokeBillingLicense(licenseId:string,actor:LicenseMutationActor,reason:string,env?:LicenseEnv){return mutateLicense(licenseId,current=>({...current,status:'revoked',note:[current.note,reason].filter(Boolean).join(' | ').slice(0,500)}),actor,'billing_revoked',env)}
