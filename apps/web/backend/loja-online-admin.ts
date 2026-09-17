import { error, json, runtimeEnv, type RouterRoutes, type RuntimeEnv } from '../cloudflare/sdk';

type ServiceBinding={fetch(input:RequestInfo|URL,init?:RequestInit):Promise<Response>};
export type LojaOnlineRuntimeEnv=RuntimeEnv&{
  LOJAONLINE_LICENSING?:ServiceBinding;
  LOJAONLINE_LICENSE_SERVICE_SECRET?:string;
  LOJAONLINE_LICENSE_BASE_URL?:string;
};

export type LojaOnlineCompany={
  company:{id:string;name:string};
  admin?:{id?:string;email?:string;name?:string;active?:boolean}|null;
  license:{id:string;plan?:string;status:string;startsAt?:string|null;expiresAt?:string|null;maxUsers:number;blockedReason?:string|null};
  accessStatus:string;
  accessible:boolean;
  userCount:number;
  users?:unknown[];
};
export type LojaOnlineOverview={totalClients:number;active:number;expired:number;blocked:number;expiringSoon:number};
export type LojaOnlineLicenseEvent={id:string;companyId:string;action:string;actor:string;createdAt:string;details?:Record<string,unknown>};

type UpstreamErrorPayload={error?:string;message?:string};
export class LojaOnlineUpstreamError extends Error{
  status:number;
  code:string;
  constructor(status:number,code:string,message:string){super(message);this.name='LojaOnlineUpstreamError';this.status=status;this.code=code;}
}

function configuredEnv(explicit?:LojaOnlineRuntimeEnv){return explicit||(runtimeEnv() as LojaOnlineRuntimeEnv)}
function cleanBase(value:unknown){return String(value||'').trim().replace(/\/$/,'')}

export async function lojaOnlineRequest<T=unknown>(path:string,init:RequestInit={},explicitEnv?:LojaOnlineRuntimeEnv):Promise<T>{
  const env=configuredEnv(explicitEnv);
  const secret=String(env.LOJAONLINE_LICENSE_SERVICE_SECRET||'').trim();
  if(!secret)throw new Error('LOJAONLINE_LICENSE_SERVICE_SECRET não configurado.');
  const headers=new Headers(init.headers);
  headers.set('x-artisys-license-secret',secret);
  if(init.body!==undefined&&!headers.has('content-type'))headers.set('content-type','application/json');
  const requestInit={...init,headers};
  let response:Response;
  if(env.LOJAONLINE_LICENSING){
    response=await env.LOJAONLINE_LICENSING.fetch(new Request(`https://lojaonline.internal${path}`,requestInit));
  }else{
    const base=cleanBase(env.LOJAONLINE_LICENSE_BASE_URL);
    if(!base)throw new Error('Binding/URL da Loja Online não configurado.');
    response=await fetch(base+path,requestInit);
  }
  const payload=await response.json().catch(()=>({})) as T&UpstreamErrorPayload;
  if(!response.ok){
    throw new LojaOnlineUpstreamError(response.status,String(payload.error||'LOJAONLINE_UPSTREAM_ERROR'),String(payload.message||'Falha na Loja Online.'));
  }
  return payload as T;
}

async function companies(){
  return lojaOnlineRequest<{companies:LojaOnlineCompany[]}>('/api/internal/artisys/loja-online/companies');
}

export async function lojaOnlineOverview():Promise<LojaOnlineOverview>{
  const rows=(await companies()).companies||[];
  const now=Date.now(),limit=now+30*86400000;
  return {
    totalClients:rows.length,
    active:rows.filter(row=>row.accessStatus==='ACTIVE').length,
    expired:rows.filter(row=>row.accessStatus==='EXPIRED').length,
    blocked:rows.filter(row=>row.accessStatus==='BLOCKED').length,
    expiringSoon:rows.filter(row=>{
      const expiry=row.license?.expiresAt?Date.parse(row.license.expiresAt):NaN;
      return row.accessStatus==='ACTIVE'&&Number.isFinite(expiry)&&expiry>now&&expiry<=limit;
    }).length,
  };
}

function body(input:unknown){return JSON.stringify(input||{})}
function internalCompanyPath(id:string){return `/api/internal/artisys/loja-online/companies/${encodeURIComponent(id)}`}
function upstreamResponseError(cause:unknown){
  if(cause instanceof LojaOnlineUpstreamError)return json({error:cause.code,message:cause.message},cause.status);
  return error(cause instanceof Error?cause.message:'Loja Online indisponível.',503);
}
async function safely<T>(work:()=>Promise<T>,status=200){try{return json(await work(),status)}catch(cause){return upstreamResponseError(cause)}}
function validEmail(value:string){return /^\S+@\S+\.\S+$/.test(value)}

export function createLojaOnlineAdminRoutes(secured:RouterRoutes[string]):RouterRoutes{return{
  'GET /api/owner/loja-online/overview':[
    ...secured,
    async()=>safely(()=>lojaOnlineOverview()),
  ],
  'GET /api/owner/loja-online/companies':[
    ...secured,
    async()=>safely(()=>companies()),
  ],
  'GET /api/owner/loja-online/companies/:id':[
    ...secured,
    async ctx=>safely(()=>lojaOnlineRequest(`${internalCompanyPath(ctx.params.id)}`)),
  ],
  'POST /api/owner/loja-online/companies':[
    ...secured,
    async ctx=>{
      const input=(ctx.body||{}) as Record<string,unknown>;
      const payload={
        companyName:String(input.companyName||'').trim(),
        adminName:String(input.adminName||'').trim(),
        adminEmail:String(input.adminEmail||'').trim().toLowerCase(),
        months:Math.trunc(Number(input.months||6)),
        maxUsers:Math.trunc(Number(input.maxUsers||5)),
        plan:String(input.plan||'6_MONTHS').trim(),
      };
      if(!payload.companyName||!payload.adminName||!validEmail(payload.adminEmail))return error('Informe empresa, administrador e e-mail válido.',400);
      if(![1,3,6,12].includes(payload.months))return error('Duração de licença inválida.',400);
      if(payload.maxUsers<1||payload.maxUsers>1000)return error('Limite de usuários inválido.',400);
      return safely(()=>lojaOnlineRequest('/api/internal/artisys/loja-online/companies',{method:'POST',body:body(payload)}),201);
    },
  ],
  'PUT /api/owner/loja-online/companies/:id/license':[
    ...secured,
    async ctx=>{
      const input=(ctx.body||{}) as Record<string,unknown>;
      const payload:{plan?:string;status?:string;startsAt?:string|null;expiresAt?:string|null;maxUsers?:number}={};
      if(input.plan!==undefined)payload.plan=String(input.plan||'').trim();
      if(input.status!==undefined)payload.status=String(input.status||'').trim();
      if(input.startsAt!==undefined)payload.startsAt=input.startsAt?String(input.startsAt):null;
      if(input.expiresAt!==undefined)payload.expiresAt=input.expiresAt?String(input.expiresAt):null;
      if(input.maxUsers!==undefined){payload.maxUsers=Math.trunc(Number(input.maxUsers));if(payload.maxUsers<1||payload.maxUsers>1000)return error('Limite de usuários inválido.',400);}
      return safely(()=>lojaOnlineRequest(`${internalCompanyPath(ctx.params.id)}/license`,{method:'PUT',body:body(payload)}));
    },
  ],
  'POST /api/owner/loja-online/companies/:id/extend':[
    ...secured,
    async ctx=>{
      const input=(ctx.body||{}) as Record<string,unknown>,months=Math.trunc(Number(input.months||6));
      if(![1,3,6,12].includes(months))return error('Duração de extensão inválida.',400);
      return safely(()=>lojaOnlineRequest(`${internalCompanyPath(ctx.params.id)}/extend`,{method:'POST',body:body({months})}));
    },
  ],
  'POST /api/owner/loja-online/companies/:id/block':[
    ...secured,
    async ctx=>{
      const input=(ctx.body||{}) as Record<string,unknown>;
      return safely(()=>lojaOnlineRequest(`${internalCompanyPath(ctx.params.id)}/block`,{method:'POST',body:body({reason:String(input.reason||'Acesso suspenso pela Artisys').trim()})}));
    },
  ],
  'POST /api/owner/loja-online/companies/:id/unblock':[
    ...secured,
    async ctx=>safely(()=>lojaOnlineRequest(`${internalCompanyPath(ctx.params.id)}/unblock`,{method:'POST',body:'{}'})),
  ],
  'GET /api/owner/loja-online/license-audit':[
    ...secured,
    async()=>safely(()=>lojaOnlineRequest<{events:LojaOnlineLicenseEvent[]}>('/api/internal/artisys/loja-online/license-audit')),
  ],
};}
