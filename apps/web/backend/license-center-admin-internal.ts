import { ManagedAdminError, createManagedCompany, managedCompanyInventory, setManagedDeviceStatus, updateManagedCompany } from './owner-company-service';
import { getManualDeboraLicense, grantManualDeboraLicense, resolveProductAccess, revokeManualDeboraLicense } from './product-license-service';
import { lojaOnlineRequest, LojaOnlineUpstreamError, type LojaOnlineRuntimeEnv } from './loja-online-admin';

type ServiceBinding={fetch(input:RequestInfo|URL,init?:RequestInit):Promise<Response>};
type Env=LojaOnlineRuntimeEnv&{
  LICENSE_CENTER_READ_SECRET?:string;
  LICENSE_CENTER_WRITE_SECRET?:string;
  LICENSE_CENTER_WRITE_ENABLED?:string|boolean;
  LOJAONLINE_LICENSING?:ServiceBinding;
};

type AdminDependencies={
  managedCompanyInventory:typeof managedCompanyInventory;
  createManagedCompany:typeof createManagedCompany;
  updateManagedCompany:typeof updateManagedCompany;
  setManagedDeviceStatus:typeof setManagedDeviceStatus;
  getManualDeboraLicense:typeof getManualDeboraLicense;
  grantManualDeboraLicense:typeof grantManualDeboraLicense;
  resolveProductAccess:typeof resolveProductAccess;
  revokeManualDeboraLicense:typeof revokeManualDeboraLicense;
  lojaOnlineRequest:typeof lojaOnlineRequest;
};
const defaultDependencies:AdminDependencies={managedCompanyInventory,createManagedCompany,updateManagedCompany,setManagedDeviceStatus,getManualDeboraLicense,grantManualDeboraLicense,resolveProductAccess,revokeManualDeboraLicense,lojaOnlineRequest};

const json=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const qaHeader='x-artisys-qa-run';
const writeHeader='x-artisys-license-center-write-secret';
const qaRunPattern=/^[A-Za-z0-9._-]{3,80}$/;

async function digest(value:string){return new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))}
async function sameSecret(a:string,b:string){if(!a||!b)return false;const[x,y]=await Promise.all([digest(a),digest(b)]);if(x.length!==y.length)return false;let diff=0;for(let i=0;i<x.length;i++)diff|=x[i]^y[i];return diff===0}
function enabled(value:unknown){return value===true||String(value||'').trim().toLowerCase()==='true'}
function qaRun(request:Request){return String(request.headers.get(qaHeader)||'').trim()}
function expectedQaEmail(run:string){return `qa-license-${run}@example.test`.toLowerCase()}
function expectedObraName(run:string){return `ARTISYS QA E2E ${run}`}
function expectedLojaName(run:string){return `ARTISYS QA E2E LOJA ${run}`}
function cleanEmail(value:unknown){return String(value||'').trim().toLowerCase()}
function validRun(run:string){return qaRunPattern.test(run)}
async function body(request:Request){return await request.json().catch(()=>({})) as Record<string,unknown>}

async function requireWriteAccess(request:Request,env:Env){
  if(!enabled(env.LICENSE_CENTER_WRITE_ENABLED))return json(503,{error:'write_disabled'});
  if(!await sameSecret(request.headers.get(writeHeader)||'',String(env.LICENSE_CENTER_WRITE_SECRET||'')))return json(401,{error:'unauthorized'});
  return null;
}

function qaCreationAllowed(run:string,input:Record<string,unknown>,product:'obra'|'loja'){
  if(!run)return true;
  if(!validRun(run))return false;
  const email=cleanEmail(input.adminEmail);
  const name=String(product==='obra'?input.name:input.companyName||'').trim();
  return email===expectedQaEmail(run)&&name===(product==='obra'?expectedObraName(run):expectedLojaName(run));
}

async function requireObraQaTarget(run:string,companyId:string,deps:AdminDependencies){
  if(!run)return true;
  if(!validRun(run))return false;
  const company=(await deps.managedCompanyInventory()).companies.find(item=>item.id===companyId);
  return !!company&&String(company.name||'')===expectedObraName(run)&&cleanEmail(company.adminEmail)===expectedQaEmail(run);
}

async function requireDeviceQaTarget(run:string,deviceId:string,deps:AdminDependencies){
  if(!run)return true;
  if(!validRun(run))return false;
  const company=(await deps.managedCompanyInventory()).companies.find(item=>Array.isArray(item.devices)&&item.devices.some((device:any)=>device.id===deviceId));
  return !!company&&String(company.name||'')===expectedObraName(run)&&cleanEmail(company.adminEmail)===expectedQaEmail(run);
}

async function lojaCompany(env:Env,id:string,deps:AdminDependencies){
  const payload=await deps.lojaOnlineRequest<any>(`/api/internal/artisys/loja-online/companies/${encodeURIComponent(id)}`,{},env);
  return payload?.company?.license?payload.company:payload?.company||payload;
}
async function requireLojaQaTarget(env:Env,run:string,id:string,deps:AdminDependencies){
  if(!run)return true;
  if(!validRun(run))return false;
  const record=await lojaCompany(env,id,deps);
  return String(record?.company?.name||record?.name||'')===expectedLojaName(run)&&cleanEmail(record?.admin?.email)===expectedQaEmail(run);
}

async function deboraAction(env:Env,input:Record<string,unknown>,run:string,deps:AdminDependencies){
  const action=String(input.action||'grant'),email=cleanEmail(input.email);
  if(run&&(!validRun(run)||email!==expectedQaEmail(run)))return json(403,{error:'qa_scope_violation'});
  if(!/^\S+@\S+\.\S+$/.test(email))return json(400,{error:'invalid_email',message:'Informe um e-mail válido.'});
  if(!['grant','status','revoke'].includes(action))return json(400,{error:'invalid_action',message:'Ação de licença inválida.'});
  const actor='general-panel-artisys';
  if(action==='grant')return json(200,{state:'active',activation:'cloudflare_d1',grant:await deps.grantManualDeboraLicense(env.DB,email,actor)});
  if(action==='revoke'){
    const grant=await deps.revokeManualDeboraLicense(env.DB,email,actor);
    return grant?json(200,{state:'revoked',activation:'cloudflare_d1',grant}):json(404,{error:'not_found',message:'Não existe licença manual para este e-mail.'});
  }
  const grant=await deps.getManualDeboraLicense(env.DB,email),access=await deps.resolveProductAccess(env.DB,'debora-lactacao',email);
  return json(200,{state:grant?.status||(!access.commercial?'none':access.planCode),activation:'cloudflare_d1',grant,access});
}

function upstreamError(cause:unknown){
  if(cause instanceof ManagedAdminError)return json(cause.status,{error:'managed_admin_error',message:cause.message});
  if(cause instanceof LojaOnlineUpstreamError)return json(cause.status,{error:cause.code,message:cause.message});
  return json(500,{error:'license_center_write_failed',message:cause instanceof Error?cause.message:'Falha administrativa.'});
}

export async function handleLicenseCenterAdminInternal(request:Request,env:Env,deps:AdminDependencies=defaultDependencies):Promise<Response|null>{
  const url=new URL(request.url),path=url.pathname;
  if(!path.startsWith('/api/internal/license-center/')||path==='/api/internal/license-center/snapshot')return null;
  const gate=await requireWriteAccess(request,env);if(gate)return gate;
  const run=qaRun(request),input=await body(request),actor={userId:'general-panel',email:'general-panel@artisys.internal'};
  try{
    if(path==='/api/internal/license-center/obra/companies'){
      if(request.method!=='POST')return json(405,{error:'method_not_allowed'});
      if(!qaCreationAllowed(run,input,'obra'))return json(403,{error:'qa_scope_violation'});
      return json(201,await deps.createManagedCompany(input,actor));
    }
    let match=path.match(/^\/api\/internal\/license-center\/obra\/companies\/([^/]+)$/);
    if(match){
      if(request.method!=='PUT')return json(405,{error:'method_not_allowed'});
      const id=decodeURIComponent(match[1]);if(!await requireObraQaTarget(run,id,deps))return json(403,{error:'qa_scope_violation'});
      return json(200,await deps.updateManagedCompany(id,input,actor));
    }
    match=path.match(/^\/api\/internal\/license-center\/obra\/devices\/([^/]+)$/);
    if(match){
      if(request.method!=='PUT')return json(405,{error:'method_not_allowed'});
      const id=decodeURIComponent(match[1]);if(!await requireDeviceQaTarget(run,id,deps))return json(403,{error:'qa_scope_violation'});
      return json(200,await deps.setManagedDeviceStatus(id,input.status));
    }
    if(path==='/api/internal/license-center/debora/license'){
      if(request.method!=='POST')return json(405,{error:'method_not_allowed'});
      return deboraAction(env,input,run,deps);
    }
    if(path==='/api/internal/license-center/loja-online/companies'){
      if(request.method!=='POST')return json(405,{error:'method_not_allowed'});
      if(!qaCreationAllowed(run,input,'loja'))return json(403,{error:'qa_scope_violation'});
      return json(201,await deps.lojaOnlineRequest('/api/internal/artisys/loja-online/companies',{method:'POST',body:JSON.stringify(input)},env));
    }
    match=path.match(/^\/api\/internal\/license-center\/loja-online\/companies\/([^/]+)\/(license|extend|block|unblock)$/);
    if(match){
      const id=decodeURIComponent(match[1]),action=match[2];
      const expectedMethod=action==='license'?'PUT':'POST';if(request.method!==expectedMethod)return json(405,{error:'method_not_allowed'});
      if(!await requireLojaQaTarget(env,run,id,deps))return json(403,{error:'qa_scope_violation'});
      const suffix=action==='license'?'license':action;
      return json(200,await deps.lojaOnlineRequest(`/api/internal/artisys/loja-online/companies/${encodeURIComponent(id)}/${suffix}`,{method:expectedMethod,body:JSON.stringify(input)},env));
    }
    return json(404,{error:'not_found'});
  }catch(cause){return upstreamError(cause)}
}
