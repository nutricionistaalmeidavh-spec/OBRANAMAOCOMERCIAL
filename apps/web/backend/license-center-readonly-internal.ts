import { companyViews } from './owner-companies';
import { buildDeboraAdminClients, DEBORA_PRODUCT_CODE, summarizeDeboraLicenseOverview } from './product-license-service';
import { lojaOnlineRequest, type LojaOnlineCompany, type LojaOnlineLicenseEvent, type LojaOnlineRuntimeEnv } from './loja-online-admin';

type ServiceBinding={fetch(input:RequestInfo|URL,init?:RequestInit):Promise<Response>};
type Env={
  DB:D1Database;
  LICENSE_CENTER_READ_SECRET?:string;
  OWNER_EMAIL?:string;
  OWNER_COMPANY?:string;
  LOJAONLINE_LICENSING?:ServiceBinding;
  LOJAONLINE_LICENSE_SERVICE_SECRET?:string;
  LOJAONLINE_LICENSE_BASE_URL?:string;
};
type Row=Record<string,any>&{id:string};

const json=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const parseJson=(value:unknown)=>{try{return JSON.parse(String(value||'{}')) as Record<string,unknown>}catch{return{}}};

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
  return {generatedAt:new Date().toISOString(),mode:'read-only',obra,debora,lojaOnline,audit:{events:audit}};
}

export async function handleLicenseCenterReadonlyInternal(request:Request,env:Env):Promise<Response|null>{
  const url=new URL(request.url);if(url.pathname!=='/api/internal/license-center/snapshot')return null;
  if(request.method!=='GET')return json(405,{error:'method_not_allowed'});
  if(!await sameSecret(request.headers.get('x-artisys-license-center-secret')||'',String(env.LICENSE_CENTER_READ_SECRET||'')))return json(401,{error:'unauthorized'});
  try{return json(200,await buildLicenseCenterReadonlySnapshot(env))}catch(error){return json(500,{error:'license_center_read_failed',message:error instanceof Error?error.message:'Falha ao consultar a Central de Licenças.'})}
}
