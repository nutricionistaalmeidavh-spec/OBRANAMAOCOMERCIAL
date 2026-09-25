import { handler } from '../backend/index';
import { handleAsaasWebhook } from '../backend/asaas-webhook';
import { ensureBillingSchema } from '../backend/billing-schema-runtime';
import { handleCorporatePasswordAuth } from '../backend/corporate-password-auth';
import { handleProductLicenseInternal } from '../backend/product-license-internal';
import { handleLicenseCenterReadonlyInternal } from '../backend/license-center-readonly-internal';
import { handleLicenseCenterAdminInternal } from '../backend/license-center-admin-internal';
import { handleAdminGovernanceRequest } from '../backend/admin-governance-http';
import { handlePublicDownload } from './public-downloads';
import { router } from './sdk';

const RESERVED_LICENSE_ID='11e1a89038929aa010bb22c601502da1';
const RESERVED_EMAIL_HEX='65766572746f6e2e656e6740686f746d61696c2e636f6d';
const RESERVED_INDEX_ID='06223016d70e5571ce5b85d2b7b28f57';
let reservedLicenseReady:Promise<void>|null=null;

function fromHex(value:string){let out='';for(let i=0;i<value.length;i+=2)out+=String.fromCharCode(parseInt(value.slice(i,i+2),16));return out}
function hashKey(value:string){let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16)}
function safeKey(value:string){return value.replace(/[^a-zA-Z0-9_-]/g,'_')}

export async function provisionReservedLifetimeLicense(env:any){
  const email=fromHex(RESERVED_EMAIL_HEX).trim().toLowerCase();
  const collection=`license_email_${safeKey(email.slice(0,28))}_${hashKey(email)}`;
  const stamp=new Date().toISOString();
  const existing=await env.DB.prepare("SELECT record_json FROM kv_records WHERE collection='licenses' AND id=?").bind(RESERVED_LICENSE_ID).first() as {record_json?:string}|null;
  // Bootstrap only: never reactivate, unclaim or replace an administrator-edited license.
  if(!existing){
    const record={email,code:'RESERVED',modules:['finance','rh','contracts','rdo','obra360','dre','procurement','measurements','documents','universidade','ai'],channels:['desktop','mobile'],status:'active',note:'Acesso comercial vitalício reservado; tenant criado no primeiro acesso autenticado.',plan:'lifetime-manual',maxUsers:10,maxProjects:5,maxDevices:2,version:1,createdAt:stamp,updatedAt:stamp};
    await env.DB.prepare(`INSERT INTO kv_records(collection,id,record_json,created_at,updated_at) VALUES('licenses',?,?,?,?) ON CONFLICT(collection,id) DO NOTHING`).bind(RESERVED_LICENSE_ID,JSON.stringify(record),stamp,stamp).run();
  }
  await env.DB.prepare(`INSERT INTO kv_records(collection,id,record_json,created_at,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(collection,id) DO NOTHING`).bind(collection,RESERVED_INDEX_ID,JSON.stringify({licenseId:RESERVED_LICENSE_ID}),stamp,stamp).run();
}

function ensureReservedLifetimeLicense(env:any){
  if(!reservedLicenseReady)reservedLicenseReady=provisionReservedLifetimeLicense(env).catch(error=>{reservedLicenseReady=null;throw error});
  return reservedLicenseReady;
}

export async function licenseCenterAdminWithRuntime(request:Request,env:any){
  const url=new URL(request.url);
  if(request.method==='GET'||!url.pathname.startsWith('/api/internal/license-center/')||url.pathname==='/api/internal/license-center/snapshot')return null;
  const bridgeRequest=request.clone();
  const bridge=router({
    [`${request.method} ${url.pathname}`]: [async ctx=>{
      const response=await handleLicenseCenterAdminInternal(request,ctx.env as any);
      return response||new Response(JSON.stringify({error:'not_found'}),{status:404,headers:{'content-type':'application/json; charset=utf-8'}});
    }]
  });
  return bridge.fetch(bridgeRequest,env);
}

export default {
  async fetch(request: Request, env: any) {
    const publicDownload=await handlePublicDownload(request);
    if(publicDownload)return publicDownload;
    await ensureBillingSchema(env);
    await ensureReservedLifetimeLicense(env);
    const licensing=await handleProductLicenseInternal(request,env);
    if(licensing)return licensing;
    const licenseCenterAdmin=await licenseCenterAdminWithRuntime(request,env);
    if(licenseCenterAdmin)return licenseCenterAdmin;
    const licenseCenter=await handleLicenseCenterReadonlyInternal(request,env);
    if(licenseCenter)return licenseCenter;
    const passwordAuth=await handleCorporatePasswordAuth(request,env);
    if(passwordAuth)return passwordAuth;
    const url = new URL(request.url);
    if (url.pathname === '/api/webhooks/asaas') {
      return handleAsaasWebhook(request, env);
    }
    const governance=await handleAdminGovernanceRequest(request,env,()=>{
      const bootstrapUrl=new URL(request.url);bootstrapUrl.pathname='/api/bootstrap';bootstrapUrl.search='';
      return handler.fetch(new Request(bootstrapUrl,{method:'GET',headers:request.headers}),env);
    });
    if(governance)return governance;
    return handler.fetch(request, env);
  }
};
