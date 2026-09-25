import { companyViews } from './owner-companies';
import { buildDeboraAdminClients, DEBORA_PRODUCT_CODE, summarizeDeboraLicenseOverview } from './product-license-service';
import { createDeboraObservabilityAdminRoutes, fetchDeboraObservability } from './debora-observability-admin';
import { deboraPartnerAdminRequest } from './debora-partner-admin';
import { listManualSales, manualSalesSummary } from './manual-license-sales';
import { lojaOnlineRequest, type LojaOnlineCompany, type LojaOnlineLicenseEvent, type LojaOnlineRuntimeEnv } from './loja-online-admin';
import { router } from '../cloudflare/sdk';
import parityRegistry from '../qa/admin-parity-capabilities.json';

type ServiceBinding={fetch(input:RequestInfo|URL,init?:RequestInit):Promise<Response>};
type Env={
  DB:D1Database;
  LICENSE_CENTER_READ_SECRET?:string;
  OWNER_EMAIL?:string;
  OWNER_COMPANY?:string;
  LOJAONLINE_LICENSING?:ServiceBinding;
  LOJAONLINE_LICENSE_SERVICE_SECRET?:string;
  LOJAONLINE_LICENSE_BASE_URL?:string;
  DEBORA_OBSERVABILITY?:ServiceBinding;
  DEBORA_OBSERVABILITY_SECRET?:string;
  DEBORA_PARTNER_ADMIN_SECRET?:string;
};
type Row=Record<string,any>&{id:string};
type ReadonlyDependencies={
  consolidatedSummary:(env:Env)=>Promise<any>;
  listConsolidatedUsers:(env:Env,query:Record<string,string>)=>Promise<any>;
  mergedSales:(env:Env,query:Record<string,string>)=>Promise<any>;
  fetchDeboraObservability:(path:string,env:Env)=>Promise<any>;
  fetchDeboraPartnerAdmin:(path:string,env:Env)=>Promise<any>;
  listManualSales:(db:D1Database,query:Record<string,string>)=>Promise<any>;
  manualSalesSummary:(db:D1Database)=>Promise<any>;
};

const json=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const parseJson=(value:unknown)=>{try{return JSON.parse(String(value||'{}')) as Record<string,unknown>}catch{return{}}};
const queryRecord=(url:URL)=>Object.fromEntries(url.searchParams.entries()) as Record<string,string>;
const queryString=(query:Record<string,string>)=>{const value=new URLSearchParams(query).toString();return value?`?${value}`:''};

async function ownerObservability(path:string,env:Env){
  const bridge=router(createDeboraObservabilityAdminRoutes([]));
  const response=await bridge.fetch(new Request(`https://license-center.internal${path}`),env as any);
  const payload=await response.json().catch(()=>({})) as any;
  if(!response.ok)throw new Error(String(payload?.error||`debora_observability_${response.status}`));
  return payload;
}

const defaultDependencies:ReadonlyDependencies={
  consolidatedSummary:env=>ownerObservability('/api/owner/debora-observability/summary',env),
  listConsolidatedUsers:(env,query)=>ownerObservability(`/api/owner/debora-observability/users${queryString(query)}`,env),
  mergedSales:(env,query)=>ownerObservability(`/api/owner/debora-observability/sales${queryString(query)}`,env),
  fetchDeboraObservability:(path,env)=>fetchDeboraObservability(path,env as any),
  fetchDeboraPartnerAdmin:(path,env)=>deboraPartnerAdminRequest(path,{},env),
  listManualSales,
  manualSalesSummary,
};

export function licenseCenterAdminParity(){
  return {
    contractVersion:Number(parityRegistry.contractVersion||1),
    requiredCapabilities:parityRegistry.capabilities.filter(entry=>entry.generalPanelRequired===true&&entry.status==='active').map(entry=>String(entry.generalPanelCapability||entry.id)).sort(),
  };
}

async function digest(value:string){return new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))}
async function sameSecret(a:string,b:string){if(!a||!b)return false;const[x,y]=await Promise.all([digest(a),digest(b)]);if(x.length!==y.length)return false;let diff=0;for(let i=0;i<x.length;i++)diff|=x[i]^y[i];return diff===0}
async function rows(env:Env,collection:string):Promise<Row[]>{const result=await env.DB.prepare('SELECT id,record_json FROM kv_records WHERE collection=?').bind(collection).all<{id:string;record_json:string}>();return(result.results||[]).map(r=>({...JSON.parse(r.record_json),id:r.id}));}

async function obraSnapshot(env:Env){
  const [companies,licenses,users,projects,devices]=await Promise.all(['companies','licenses','platform_accesses','projects','devices'].map(collection=>rows(env,collection)));
  const table=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='password_credentials'").first();
  const credentials=table?(await env.DB.prepare('SELECT email,created_at FROM password_credentials').all<{email:string;created_at:string}>()).results||[]:[];
  return companyViews(companies,licenses,users,projects,devices,credentials,String(env.OWNER_EMAIL||''),String(env.OWNER_COMPANY||'Obra na Mão'));
}

async function deboraSnapshot(env:Env){
  const [accountsResult,licensesResult]=await Promise.all([
    env.DB.prepare('SELECT email,status,source FROM product_accounts WHERE product_code=?').bind(DEBORA_PRODUCT_CODE).all<{email:string;status:string;source:string}>(),
    env.DB.prepare('SELECT email,plan_code,status,expires_at,source,updated_at FROM product_licenses WHERE product_code=? ORDER BY updated_at DESC').bind(DEBORA_PRODUCT_CODE).all<{email:string;plan_code:string;status:string;expires_at:string|null;source:string;updated_at:string}>(),
  ]);
  const accounts=accountsResult.results||[],licenses=licensesResult.results||[];
  return {overview:summarizeDeboraLicenseOverview(accounts,licenses),clients:buildDeboraAdminClients(accounts,licenses)};
}

async function licenseAudit(env:Env){
  const [obraResult,deboraResult]=await Promise.all([
    env.DB.prepare(`SELECT a.id,a.license_id,a.action,a.source,a.actor_email,a.details_json,a.created_at,k.record_json
      FROM license_audit a
      LEFT JOIN kv_records k ON k.collection='licenses' AND k.id=a.license_id
      ORDER BY a.created_at DESC LIMIT 100`).all<{id:string;license_id:string;action:string;source:string;actor_email:string|null;details_json:string;created_at:string;record_json:string|null}>(),
    env.DB.prepare('SELECT id,license_id,email,action,actor,source,details_json,created_at FROM product_license_events WHERE product_code=? ORDER BY created_at DESC LIMIT 100').bind(DEBORA_PRODUCT_CODE).all<{id:string;license_id:string|null;email:string;action:string;actor:string;source:string;details_json:string;created_at:string}>(),
  ]);
  const obra=(obraResult.results||[]).map(row=>{const license=parseJson(row.record_json);return{id:row.id,product:'obra-na-mao',licenseId:row.license_id,email:String(license.email||''),action:row.action,source:row.source,actor:row.actor_email||'',createdAt:row.created_at,details:parseJson(row.details_json)}});
  const debora=(deboraResult.results||[]).map(row=>({id:row.id,product:'debora-lactacao',licenseId:row.license_id||'',email:row.email,action:row.action,source:row.source,actor:row.actor||'',createdAt:row.created_at,details:parseJson(row.details_json)}));
  return [...obra,...debora].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,100);
}

function lojaOverview(rows:LojaOnlineCompany[]){
  const now=Date.now(),limit=now+30*86400000;
  return {totalClients:rows.length,active:rows.filter(row=>row.accessStatus==='ACTIVE').length,expired:rows.filter(row=>row.accessStatus==='EXPIRED').length,blocked:rows.filter(row=>row.accessStatus==='BLOCKED').length,expiringSoon:rows.filter(row=>{const expiry=row.license?.expiresAt?Date.parse(row.license.expiresAt):NaN;return row.accessStatus==='ACTIVE'&&Number.isFinite(expiry)&&expiry>now&&expiry<=limit}).length};
}

async function lojaOnlineSnapshot(env:Env){
  try{
    const explicitEnv=env as LojaOnlineRuntimeEnv;
    const [companiesPayload,auditPayload]=await Promise.all([
      lojaOnlineRequest<{companies:LojaOnlineCompany[]}>('/api/internal/artisys/loja-online/companies',{},explicitEnv),
      lojaOnlineRequest<{events:LojaOnlineLicenseEvent[]}>('/api/internal/artisys/loja-online/license-audit',{},explicitEnv),
    ]);
    const companies=companiesPayload.companies||[];
    return {available:true,overview:lojaOverview(companies),companies,events:auditPayload.events||[]};
  }catch(error){
    return {available:false,error:error instanceof Error?error.message:'Loja Online indisponível.',overview:null,companies:[],events:[]};
  }
}

export async function buildLicenseCenterReadonlySnapshot(env:Env){
  const [obra,debora,audit,lojaOnline]=await Promise.all([obraSnapshot(env),deboraSnapshot(env),licenseAudit(env),lojaOnlineSnapshot(env)]);
  return {generatedAt:new Date().toISOString(),mode:'read-only',adminParity:licenseCenterAdminParity(),obra,debora,lojaOnline,audit:{events:audit}};
}

function isDeboraBridgeRead(path:string){
  return path==='/api/internal/license-center/debora/observability/summary'
    ||path==='/api/internal/license-center/debora/observability/users'
    ||path==='/api/internal/license-center/debora/observability/sales'
    ||/^\/api\/internal\/license-center\/debora\/observability\/users\/[^/]+\/sessions$/.test(path)
    ||path==='/api/internal/license-center/debora/manual-sales'
    ||path==='/api/internal/license-center/debora/manual-sales/summary'
    ||path==='/api/internal/license-center/debora/partners'
    ||path==='/api/internal/license-center/debora/partner-sales';
}

export async function handleLicenseCenterReadonlyInternal(request:Request,env:Env,deps:ReadonlyDependencies=defaultDependencies):Promise<Response|null>{
  const url=new URL(request.url),path=url.pathname;
  if(path!=='/api/internal/license-center/snapshot'&&!isDeboraBridgeRead(path))return null;
  if(request.method!=='GET')return json(405,{error:'method_not_allowed'});
  if(!await sameSecret(request.headers.get('x-artisys-license-center-secret')||'',String(env.LICENSE_CENTER_READ_SECRET||'')))return json(401,{error:'unauthorized'});
  try{
    if(path==='/api/internal/license-center/snapshot')return json(200,await buildLicenseCenterReadonlySnapshot(env));
    if(path==='/api/internal/license-center/debora/observability/summary')return json(200,await deps.consolidatedSummary(env));
    if(path==='/api/internal/license-center/debora/observability/users')return json(200,await deps.listConsolidatedUsers(env,queryRecord(url)));
    if(path==='/api/internal/license-center/debora/observability/sales')return json(200,await deps.mergedSales(env,queryRecord(url)));
    const sessions=path.match(/^\/api\/internal\/license-center\/debora\/observability\/users\/([^/]+)\/sessions$/);
    if(sessions)return json(200,await deps.fetchDeboraObservability(`/api/internal/observability/users/${sessions[1]}/sessions${url.search}`,env));
    if(path==='/api/internal/license-center/debora/manual-sales/summary')return json(200,await deps.manualSalesSummary(env.DB));
    if(path==='/api/internal/license-center/debora/manual-sales')return json(200,await deps.listManualSales(env.DB,queryRecord(url)));
    if(path==='/api/internal/license-center/debora/partners')return json(200,await deps.fetchDeboraPartnerAdmin('/api/admin/partners',env));
    if(path==='/api/internal/license-center/debora/partner-sales')return json(200,await deps.fetchDeboraPartnerAdmin(`/api/admin/partner-sales${url.search}`,env));
    return json(404,{error:'not_found'});
  }catch(error){
    const message=error instanceof Error?error.message:'Falha ao consultar a Central de Licenças.';
    if(message==='invalid_cursor'||message==='debora_observability_400')return json(400,{error:'invalid_cursor'});
    if(message.startsWith('debora_observability_'))return json(503,{available:false,error:'debora_observability_unavailable'});
    if(message.includes('partner'))return json(503,{available:false,error:'debora_partner_admin_unavailable'});
    return json(500,{error:'license_center_read_failed',message});
  }
}
