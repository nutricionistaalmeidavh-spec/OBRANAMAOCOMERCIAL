import { db, runtimeEnv } from '../cloudflare/sdk'
import { getCompany } from './project-state'

export const LICENSE_MODULES=['finance','rh','contracts','rdo','obra360','dre','procurement','measurements','documents','universidade','ai'] as const
export const LICENSE_CHANNELS=['desktop','mobile'] as const
export type LicenseStatus='active'|'revoked'
export type License={id?:string;email?:string;code:string;modules:string[];channels:string[];status:LicenseStatus;expiresAt?:string;claimedBy?:string;companyId?:string;note?:string;plan?:string;maxUsers?:number;maxProjects?:number;maxDevices?:number;version?:number;createdAt:string;updatedAt:string}
export type LicenseMutationActor={source:'manual'|'billing'|'system';userId?:string;email?:string;orderId?:string}
export class LicenseConflictError extends Error{constructor(){super('Licença alterada concorrentemente. Tente novamente.');this.name='LicenseConflictError'}}

const now=()=>new Date().toISOString()
const norm=(v:string|undefined)=>String(v||'').trim().toLowerCase()
const safe=(v:string)=>v.replace(/[^a-zA-Z0-9_-]/g,'_')
function hash(v:string){let h=2166136261;for(let i=0;i<v.length;i++){h^=v.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16)}
const emailTable=(email:string)=>`license_email_${safe(norm(email).slice(0,28))}_${hash(norm(email))}`
const codeTable=(code:string)=>`license_code_${safe(code.toUpperCase())}`
export const newLicenseCode=()=>crypto.randomUUID().replace(/-/g,'').slice(0,12).toUpperCase()

export async function getLicense(id:string){const [x]=await db.get<License>('licenses',[id]);return x?{...x,id}:null}
export function licenseUsable(lic:License){return lic.status==='active'&&(!lic.expiresAt||lic.expiresAt>=now())}
export function licenseEntitlements(lic:License|null){return lic?{licenseId:lic.id,modules:lic.modules,channels:lic.channels,status:lic.status,expiresAt:lic.expiresAt}:null}

export async function indexLicense(id:string,lic:License){
  const ctable=codeTable(lic.code),crefs=(await db.list<Record<string,unknown>>(ctable,{limit:5})).items,cref=crefs.find(r=>String(r.licenseId||'')===id)||crefs[0]
  if(cref)await db.update(ctable,[{id:cref.id,record:{licenseId:id}}]);else await db.add(ctable,[{licenseId:id}])
  if(lic.email){const etable=emailTable(lic.email),refs=(await db.list<Record<string,unknown>>(etable,{limit:10})).items;if(!refs.some(r=>String(r.licenseId||'')===id))await db.add(etable,[{licenseId:id}])}
}

export async function licenseByEmail(email:string){const normalized=norm(email),refs=(await db.list<Record<string,unknown>>(emailTable(normalized),{limit:10})).items;for(const ref of refs){const lic=await getLicense(String(ref.licenseId||''));if(lic&&norm(lic.email)===normalized&&licenseUsable(lic))return lic}return null}
export async function licenseByCode(code:string){const normalized=String(code||'').trim().toUpperCase(),refs=(await db.list<Record<string,unknown>>(codeTable(normalized),{limit:5})).items;for(const ref of refs){const lic=await getLicense(String(ref.licenseId||''));if(lic&&lic.code===normalized)return lic}return null}

export async function companyEntitlements(companyId:string){
  const company=await getCompany(companyId);if(!company)return null
  const ownerCompany=String(runtimeEnv().OWNER_COMPANY||'Obra na Mão'),companyName=String(company.name||'')
  if(norm(companyName)===norm(ownerCompany))return{licenseId:'owner',modules:[...LICENSE_MODULES],channels:[...LICENSE_CHANNELS],status:'active' as const,expiresAt:undefined}
  const licenseId=String(company.licenseId||''),lic=licenseId&&licenseId!=='owner'?await getLicense(licenseId):null
  if(lic){const usable=licenseUsable(lic);return{licenseId:lic.id,modules:usable?lic.modules:[],channels:usable?lic.channels:[],status:lic.status,expiresAt:lic.expiresAt}}
  const modules=(Array.isArray(company.licensedModules)?company.licensedModules:[]).map(String).filter(x=>(LICENSE_MODULES as readonly string[]).includes(x))
  const channels=(Array.isArray(company.licensedChannels)?company.licensedChannels:[]).map(String).filter(x=>(LICENSE_CHANNELS as readonly string[]).includes(x))
  return{licenseId:licenseId||undefined,modules,channels,status:'active' as const,expiresAt:undefined}
}

async function audit(licenseId:string,action:string,actor:LicenseMutationActor,previousVersion:number|undefined,nextVersion:number|undefined,details:Record<string,unknown>={}){
  const id=crypto.randomUUID().replace(/-/g,'')
  await runtimeEnv().DB.prepare(`INSERT INTO license_audit(id,license_id,action,source,actor_user_id,actor_email,order_id,previous_version,next_version,details_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id,licenseId,action,actor.source,actor.userId||null,actor.email||null,actor.orderId||null,previousVersion??null,nextVersion??null,JSON.stringify(details),now()).run()
}

export async function createLicense(input:Omit<License,'id'|'code'|'version'|'createdAt'|'updatedAt'> & {code?:string},actor:LicenseMutationActor){
  const stamp=now(),lic:License={...input,code:input.code||newLicenseCode(),version:1,createdAt:stamp,updatedAt:stamp}
  const [id]=await db.add('licenses',[lic as unknown as Record<string,unknown>]);if(!id)throw new Error('Não foi possível criar a licença.')
  await indexLicense(id,lic);await audit(id,'created',actor,undefined,1,{status:lic.status,plan:lic.plan,companyId:lic.companyId});return{...lic,id}
}

export async function mutateLicense(id:string,mutator:(current:License)=>License,actor:LicenseMutationActor,action='updated'){
  const current=await getLicense(id);if(!current)throw new Error('Licença não encontrada.')
  const previousVersion=Math.max(0,Number(current.version||0)),nextVersion=previousVersion+1,stamp=now(),next={...mutator({...current}),id,version:nextVersion,updatedAt:stamp}
  const clean={...next} as Record<string,unknown>;delete clean.id
  const result=await runtimeEnv().DB.prepare(`UPDATE kv_records SET record_json=?,updated_at=? WHERE collection='licenses' AND id=? AND COALESCE(CAST(json_extract(record_json,'$.version') AS INTEGER),0)=?`)
    .bind(JSON.stringify(clean),stamp,id,previousVersion).run() as {meta?:{changes?:number}}
  if(Number(result.meta?.changes||0)!==1)throw new LicenseConflictError()
  await indexLicense(id,next);await audit(id,action,actor,previousVersion,nextVersion,{status:next.status,plan:next.plan,companyId:next.companyId,expiresAt:next.expiresAt});return next
}

function extendExpiry(current:string|undefined,interval:'monthly'|'yearly'|'one_time'){
  if(interval==='one_time')return current
  const base=current&&current>now()?new Date(current):new Date(),months=interval==='yearly'?12:1;base.setUTCMonth(base.getUTCMonth()+months);return base.toISOString()
}

export async function activateOrRenewBillingLicense(input:{licenseId?:string;email:string;companyId:string;plan:string;modules:string[];channels:string[];maxUsers:number;maxProjects:number;maxDevices:number;interval:'monthly'|'yearly'|'one_time';orderId:string;userId:string}){
  const actor:LicenseMutationActor={source:'billing',userId:input.userId,email:input.email,orderId:input.orderId}
  if(input.licenseId){return mutateLicense(input.licenseId,current=>({...current,email:norm(input.email),companyId:input.companyId,plan:input.plan,modules:input.modules,channels:input.channels,maxUsers:input.maxUsers,maxProjects:input.maxProjects,maxDevices:input.maxDevices,status:'active',expiresAt:extendExpiry(current.expiresAt,input.interval)}),actor,'billing_renewed')}
  return createLicense({email:norm(input.email),companyId:input.companyId,plan:input.plan,modules:input.modules,channels:input.channels,maxUsers:input.maxUsers,maxProjects:input.maxProjects,maxDevices:input.maxDevices,status:'active',expiresAt:extendExpiry(undefined,input.interval)},actor)
}

export async function revokeBillingLicense(licenseId:string,actor:LicenseMutationActor,reason:string){return mutateLicense(licenseId,current=>({...current,status:'revoked',note:[current.note,reason].filter(Boolean).join(' | ').slice(0,500)}),actor,'billing_revoked')}
