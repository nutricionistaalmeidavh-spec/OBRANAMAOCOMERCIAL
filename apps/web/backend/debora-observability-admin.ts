import { json, runtimeEnv, type RouterRoutes } from '../cloudflare/sdk';
import { manualSalesSummary } from './manual-license-sales';
import { DEBORA_PRODUCT_CODE, normalizeLicenseEmail } from './product-license-service';

type ServiceBinding={fetch(input:RequestInfo|URL,init?:RequestInit):Promise<Response>};
type ObservabilityEnv={DB:D1Database;DEBORA_OBSERVABILITY?:ServiceBinding;DEBORA_OBSERVABILITY_SECRET?:string};
type GlobalSaleKey={createdAt:string;sourceRank:number;id:string};
type ConsolidatedUser={
  userId?:string;email?:string;planCode?:string;subscriptionStatus?:string|null;online?:boolean;
  effectiveLicense?:{planCode?:string;status?:string;source?:string;expiresAt?:string|null}|null;
  manualSale?:{acquisitionChannel?:string;paymentStatus?:string;amountCents?:number|null;externalOrderRef?:string|null}|null;
};

const internalBase='https://debora-observability.internal';
export const MAX_USER_SCAN=500;
const unavailable=()=>json({available:false,error:'debora_observability_unavailable'},503);
const pageLimit=(value:unknown,fallback=50)=>{const n=Number(value);return Number.isFinite(n)?Math.max(1,Math.min(100,Math.floor(n))):fallback};

export async function fetchDeboraObservability(path:string,env:ObservabilityEnv){
  const secret=String(env.DEBORA_OBSERVABILITY_SECRET||'').trim();
  const binding=env.DEBORA_OBSERVABILITY;
  if(!secret||!binding?.fetch)throw new Error('debora_observability_unavailable');
  const request=new Request(`${internalBase}${path}`,{headers:{accept:'application/json','x-debora-observability-secret':secret}});
  let response:Response;
  try{response=await binding.fetch(request)}catch{throw new Error('debora_observability_unavailable')}
  if(!response.ok)throw new Error(`debora_observability_${response.status}`);
  return await response.json() as any;
}

function base64urlEncode(value:unknown){return btoa(JSON.stringify(value)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'')}
function base64urlDecode(value:string){let raw=String(value||'').replace(/-/g,'+').replace(/_/g,'/');while(raw.length%4)raw+='=';return JSON.parse(atob(raw))}
export function encodeGlobalSalesCursor(value:GlobalSaleKey){return base64urlEncode(value)}
export function decodeGlobalSalesCursor(value:string):GlobalSaleKey{
  try{const parsed=base64urlDecode(value);if(!parsed||typeof parsed.createdAt!=='string'||!parsed.createdAt||!Number.isInteger(parsed.sourceRank)||![0,1].includes(parsed.sourceRank)||typeof parsed.id!=='string'||!parsed.id)throw new Error();return parsed}
  catch{throw new Error('invalid_cursor')}
}
export function compareGlobalSaleKey(a:GlobalSaleKey,b:GlobalSaleKey){
  if(a.createdAt!==b.createdAt)return a.createdAt>b.createdAt?-1:1;
  if(a.sourceRank!==b.sourceRank)return b.sourceRank-a.sourceRank;
  if(a.id===b.id)return 0;return a.id>b.id?-1:1;
}

function queryPath(base:string,query:Record<string,string>,allowed:string[]){
  const url=new URL(base,internalBase);
  for(const key of allowed){const value=String(query[key]||'').trim();if(value)url.searchParams.set(key,value)}
  return `${url.pathname}${url.search}`;
}

async function localEffectiveForEmails(db:D1Database,emails:string[],now:string){
  const clean=[...new Set(emails.map(normalizeLicenseEmail).filter(Boolean))].slice(0,100);if(!clean.length)return new Map<string,any>();
  const placeholders=clean.map(()=>'?').join(',');
  const result=await db.prepare(`WITH ranked AS (
    SELECT email,plan_code,status,expires_at,source,updated_at,
      ROW_NUMBER() OVER(PARTITION BY lower(email) ORDER BY CASE WHEN expires_at IS NULL THEN 1 ELSE 0 END DESC,expires_at DESC,updated_at DESC) rn
    FROM product_licenses
    WHERE product_code=? AND lower(email) IN (${placeholders}) AND status IN ('active','trialing') AND (expires_at IS NULL OR expires_at>?)
  ) SELECT email,plan_code,status,expires_at,source FROM ranked WHERE rn=1`).bind(DEBORA_PRODUCT_CODE,...clean,now).all<any>();
  return new Map((result.results||[]).map(item=>[normalizeLicenseEmail(item.email),{planCode:item.plan_code,status:item.status,expiresAt:item.expires_at||null,source:item.source}]));
}

async function latestManualSaleForEmails(db:D1Database,emails:string[]){
  const clean=[...new Set(emails.map(normalizeLicenseEmail).filter(Boolean))].slice(0,100);if(!clean.length)return new Map<string,any>();
  const placeholders=clean.map(()=>'?').join(',');
  const result=await db.prepare(`WITH ranked AS (
    SELECT email,acquisition_channel,payment_status,amount_cents,paid_at,external_order_ref,created_at,
      ROW_NUMBER() OVER(PARTITION BY lower(email) ORDER BY created_at DESC,id DESC) rn
    FROM manual_license_sales WHERE product_code=? AND lower(email) IN (${placeholders})
  ) SELECT * FROM ranked WHERE rn=1`).bind(DEBORA_PRODUCT_CODE,...clean).all<any>();
  return new Map((result.results||[]).map(item=>[normalizeLicenseEmail(item.email),{
    acquisitionChannel:item.acquisition_channel,paymentStatus:item.payment_status,amountCents:item.amount_cents===null?null:Number(item.amount_cents),
    paidAt:item.paid_at||null,externalOrderRef:item.external_order_ref||null,createdAt:item.created_at,
  }]));
}

async function enrichRemoteUsers(db:D1Database,remote:any){
  const items=Array.isArray(remote?.items)?remote.items:[],emails=items.map((item:any)=>String(item.email||''));
  const now=new Date().toISOString();
  const [licenses,sales]=await Promise.all([localEffectiveForEmails(db,emails,now),latestManualSaleForEmails(db,emails)]);
  return{...remote,items:items.map((item:any)=>{
    const email=normalizeLicenseEmail(item.email);return{...item,effectiveLicense:licenses.get(email)||null,manualSale:sales.get(email)||null};
  })};
}

function effectivePlan(user:ConsolidatedUser){return String(user.effectiveLicense?.planCode||user.planCode||'freemium')}
function effectiveOrigin(user:ConsolidatedUser){
  if(user.manualSale?.acquisitionChannel)return String(user.manualSale.acquisitionChannel);
  if(user.effectiveLicense?.planCode==='pro_6m')return String(user.effectiveLicense.source||'mercado_livre_manual');
  if(user.subscriptionStatus)return'asaas';
  return'cadastro';
}
function effectivePayment(user:ConsolidatedUser){
  if(user.manualSale?.paymentStatus)return String(user.manualSale.paymentStatus);
  if(user.effectiveLicense?.planCode==='pro_6m')return'unknown';
  const status=String(user.subscriptionStatus||'');
  if(['active','trialing'].includes(status))return'paid';
  if(status==='past_due')return'pending';
  if(['cancelled','expired'].includes(status))return'unpaid';
  return'';
}
function effectiveStatus(user:ConsolidatedUser){return String(user.effectiveLicense?.status||user.subscriptionStatus||(effectivePlan(user)==='freemium'?'freemium':''))}

export function matchesConsolidatedUserFilters(user:ConsolidatedUser,query:Record<string,string|undefined>){
  const plan=String(query.plan||'').trim(),origin=String(query.origin||'').trim(),payment=String(query.payment||'').trim(),status=String(query.status||'').trim();
  if(plan&&effectivePlan(user)!==plan)return false;
  if(origin&&effectiveOrigin(user)!==origin)return false;
  if(payment&&effectivePayment(user)!==payment)return false;
  if(status&&effectiveStatus(user)!==status)return false;
  return true;
}

async function listConsolidatedUsers(env:ObservabilityEnv,query:Record<string,string>){
  const limit=pageLimit(query.limit,50),items:any[]=[];
  let remoteCursor=String(query.cursor||'').trim()||null,remoteHasMore=true,scanned=0;
  const remoteFilters:Record<string,string>={};
  for(const key of ['online','createdFrom','createdTo','lastSeenFrom','lastSeenTo','search']){const value=String(query[key]||'').trim();if(value)remoteFilters[key]=value}

  while(items.length<limit&&remoteHasMore&&scanned<MAX_USER_SCAN){
    const requestLimit=Math.min(100,limit-items.length,MAX_USER_SCAN-scanned);
    const upstream=new URL('/api/internal/observability/users',internalBase);
    upstream.searchParams.set('limit',String(requestLimit));
    if(remoteCursor)upstream.searchParams.set('cursor',remoteCursor);
    for(const [key,value] of Object.entries(remoteFilters))upstream.searchParams.set(key,value);
    const remote=await fetchDeboraObservability(`${upstream.pathname}${upstream.search}`,env);
    const rawItems=Array.isArray(remote?.items)?remote.items:[];
    scanned+=rawItems.length;
    const enriched=await enrichRemoteUsers(env.DB,{...remote,items:rawItems});
    for(const user of enriched.items||[])if(matchesConsolidatedUserFilters(user,query))items.push(user);
    remoteHasMore=Boolean(remote?.hasMore);
    remoteCursor=remoteHasMore&&remote?.nextCursor?String(remote.nextCursor):null;
    if(!remoteHasMore||!remoteCursor||rawItems.length===0)break;
  }

  const hasMore=Boolean(remoteHasMore&&remoteCursor);
  return{items,hasMore,nextCursor:hasMore?remoteCursor:null,scanCapped:Boolean(scanned>=MAX_USER_SCAN&&hasMore)};
}

async function effectiveLicenseSummary(db:D1Database,now:string){
  const result=await db.prepare(`WITH ranked AS (
    SELECT email,plan_code,source,
      ROW_NUMBER() OVER(PARTITION BY lower(email) ORDER BY CASE WHEN expires_at IS NULL THEN 1 ELSE 0 END DESC,expires_at DESC,updated_at DESC) rn
    FROM product_licenses
    WHERE product_code=? AND status IN ('active','trialing') AND (expires_at IS NULL OR expires_at>?)
  ) SELECT COUNT(*) total,
    SUM(CASE WHEN plan_code='pro_monthly' THEN 1 ELSE 0 END) monthly,
    SUM(CASE WHEN plan_code='pro_annual' THEN 1 ELSE 0 END) annual,
    SUM(CASE WHEN plan_code='pro_6m' THEN 1 ELSE 0 END) manual6m
    FROM ranked WHERE rn=1`).bind(DEBORA_PRODUCT_CODE,now).first<any>();
  return{total:Number(result?.total||0),monthly:Number(result?.monthly||0),annual:Number(result?.annual||0),manual6m:Number(result?.manual6m||0)};
}

async function consolidatedSummary(env:ObservabilityEnv){
  const remote=await fetchDeboraObservability('/api/internal/observability/summary',env);
  const [pro,manual]=await Promise.all([effectiveLicenseSummary(env.DB,new Date().toISOString()),manualSalesSummary(env.DB)]);
  const automaticPaid=Number(remote?.billing?.paid||0),automaticRevenue=Number(remote?.billing?.realizedRevenueCents||0);
  const accountsTotal=Number(remote?.accounts?.total||0);
  return{
    ...remote,
    plans:{...(remote?.plans||{}),freemium:Math.max(0,accountsTotal-pro.total),proMonthly:pro.monthly,proAnnual:pro.annual,proManual6m:pro.manual6m},
    pro,
    manual,
    sales:{paid:automaticPaid+manual.paid,automaticPaid,manualPaid:manual.paid,realizedRevenueCents:automaticRevenue+manual.realizedRevenueCents},
  };
}

async function manualMergePage(db:D1Database,query:Record<string,string>,limit:number,cursor:GlobalSaleKey|null){
  const where=['product_code=?'],binds:any[]=[DEBORA_PRODUCT_CODE];
  const plan=String(query.plan||'').trim(),status=String(query.status||'').trim(),channel=String(query.channel||'').trim();
  if((plan&&plan!=='pro_6m')||channel==='asaas'||channel==='mercado_livre_manual')return{items:[],hasMore:false};
  if(status){where.push('payment_status=?');binds.push(status)}
  if(channel){where.push('acquisition_channel=?');binds.push(channel)}
  if(query.createdFrom){where.push('created_at>=?');binds.push(query.createdFrom)}
  if(query.createdTo){where.push('created_at<=?');binds.push(query.createdTo)}
  if(cursor){where.push('(created_at < ? OR (created_at = ? AND (0 < ? OR (0 = ? AND id < ?))))');binds.push(cursor.createdAt,cursor.createdAt,cursor.sourceRank,cursor.sourceRank,cursor.id)}
  const result=await db.prepare(`SELECT id,email,acquisition_channel,payment_status,amount_cents,external_order_ref,created_at
    FROM manual_license_sales WHERE ${where.join(' AND ')} ORDER BY created_at DESC,id DESC LIMIT ?`).bind(...binds,limit+1).all<any>();
  const rows=result.results||[],hasMore=rows.length>limit;
  return{hasMore,items:rows.slice(0,limit).map(item=>({id:String(item.id),source:'manual',sourceRank:0,email:item.email,planCode:'pro_6m',status:item.payment_status,
    amountCents:item.amount_cents===null?null:Number(item.amount_cents),acquisitionChannel:item.acquisition_channel,externalOrderRef:item.external_order_ref||null,createdAt:item.created_at}))};
}

async function mergedSales(env:ObservabilityEnv,query:Record<string,string>){
  const limit=pageLimit(query.limit,50),cursor=query.cursor?decodeGlobalSalesCursor(query.cursor):null,channel=String(query.channel||'').trim();
  const upstream=new URL('/api/internal/observability/sales',internalBase);upstream.searchParams.set('limit',String(limit));
  for(const key of ['plan','status','createdFrom','createdTo']){const value=String(query[key]||'').trim();if(value)upstream.searchParams.set(key,value)}
  if(cursor){upstream.searchParams.set('mergeCreatedAt',cursor.createdAt);upstream.searchParams.set('mergeSourceRank',String(cursor.sourceRank));upstream.searchParams.set('mergeId',cursor.id)}
  const automaticPromise=channel&&channel!=='asaas'
    ?Promise.resolve({items:[],hasMore:false,nextCursor:null})
    :fetchDeboraObservability(`${upstream.pathname}${upstream.search}`,env);
  const [automaticPage,manualPage]=await Promise.all([automaticPromise,manualMergePage(env.DB,query,limit,cursor)]);
  const automatic=(Array.isArray(automaticPage?.items)?automaticPage.items:[]).map((item:any)=>({
    ...item,id:String(item.checkoutId||item.id),source:'asaas',sourceRank:1,createdAt:String(item.createdAt||''),
  }));
  const merged=[...automatic,...manualPage.items].sort(compareGlobalSaleKey),items=merged.slice(0,limit),hasMore=merged.length>limit||Boolean(automaticPage?.hasMore)||manualPage.hasMore,last=items[items.length-1];
  return{items,hasMore,nextCursor:hasMore&&last?encodeGlobalSalesCursor({createdAt:last.createdAt,sourceRank:last.sourceRank,id:last.id}):null};
}

export function createDeboraObservabilityAdminRoutes(secured:RouterRoutes[string]):RouterRoutes{return{
  'GET /api/owner/debora-observability/summary':[
    ...secured,async()=>{try{return json(await consolidatedSummary(runtimeEnv() as unknown as ObservabilityEnv))}catch(error){console.error('debora observability summary unavailable',error);return unavailable()}},
  ],
  'GET /api/owner/debora-observability/users':[
    ...secured,async(ctx)=>{try{return json(await listConsolidatedUsers(runtimeEnv() as unknown as ObservabilityEnv,ctx.query))}
    catch(error){if((error as Error)?.message==='debora_observability_400')return json({error:'invalid_cursor'},400);console.error('debora observability users unavailable',error);return unavailable()}},
  ],
  'GET /api/owner/debora-observability/sales':[
    ...secured,async(ctx)=>{try{return json(await mergedSales(runtimeEnv() as unknown as ObservabilityEnv,ctx.query))}catch(error){if(['invalid_cursor','debora_observability_400'].includes((error as Error)?.message||''))return json({error:'invalid_cursor'},400);console.error('debora observability sales unavailable',error);return unavailable()}},
  ],
  'GET /api/owner/debora-observability/users/:id/sessions':[
    ...secured,async(ctx)=>{try{
      const env=runtimeEnv() as unknown as ObservabilityEnv,path=queryPath(`/api/internal/observability/users/${encodeURIComponent(ctx.params.id)}/sessions`,ctx.query,['limit','cursor']);
      return json(await fetchDeboraObservability(path,env));
    }catch(error){if((error as Error)?.message==='debora_observability_400')return json({error:'invalid_cursor'},400);console.error('debora observability sessions unavailable',error);return unavailable()}},
  ],
};}
