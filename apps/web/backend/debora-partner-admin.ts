import { json, runtimeEnv, type RouterRoutes } from '../cloudflare/sdk';

type ServiceBinding={fetch(input:RequestInfo|URL,init?:RequestInit):Promise<Response>};
export type DeboraPartnerAdminEnv={
  DEBORA_OBSERVABILITY?:ServiceBinding;
  DEBORA_PARTNER_ADMIN_SECRET?:string;
  DEBORA_OBSERVABILITY_SECRET?:string;
};

export class DeboraPartnerAdminError extends Error{
  constructor(public status:number,public code:string,message?:string){super(message||code)}
}

const internalBase='https://debora-observability.internal';
const queryString=(query:Record<string,unknown>)=>{const params=new URLSearchParams();for(const[key,value]of Object.entries(query||{})){const text=String(value??'').trim();if(text)params.set(key,text)}const raw=params.toString();return raw?`?${raw}`:''};

export async function deboraPartnerAdminRequest<T=any>(path:string,init:RequestInit={},env:DeboraPartnerAdminEnv=runtimeEnv() as unknown as DeboraPartnerAdminEnv):Promise<T>{
  const binding=env.DEBORA_OBSERVABILITY;
  const secret=String(env.DEBORA_PARTNER_ADMIN_SECRET||env.DEBORA_OBSERVABILITY_SECRET||'').trim();
  if(!binding?.fetch||!secret)throw new DeboraPartnerAdminError(503,'debora_partner_admin_unavailable','Administração de parceiros da Débora indisponível.');
  const headers=new Headers(init.headers||{});
  headers.set('accept','application/json');
  headers.set('x-debora-partner-admin-secret',secret);
  if(init.body!==undefined&&!headers.has('content-type'))headers.set('content-type','application/json');
  let response:Response;
  try{response=await binding.fetch(new Request(`${internalBase}${path}`,{...init,headers}))}
  catch{throw new DeboraPartnerAdminError(503,'debora_partner_admin_unavailable','Administração de parceiros da Débora indisponível.');}
  const payload=await response.json().catch(()=>({})) as any;
  if(!response.ok)throw new DeboraPartnerAdminError(response.status,String(payload?.error||'debora_partner_admin_failed'),String(payload?.message||payload?.error||'Falha ao administrar parceiros da Débora.'));
  return payload as T;
}

async function respond(work:()=>Promise<any>){
  try{return json(await work())}
  catch(error){
    if(error instanceof DeboraPartnerAdminError)return json({error:error.code,message:error.message},error.status);
    return json({error:'debora_partner_admin_unavailable'},503);
  }
}

export function createDeboraPartnerAdminRoutes(secured:RouterRoutes[string]):RouterRoutes{return{
  'GET /api/owner/debora-partners':[
    ...secured,async()=>respond(()=>deboraPartnerAdminRequest('/api/admin/partners')),
  ],
  'POST /api/owner/debora-partners':[
    ...secured,async(ctx)=>respond(()=>deboraPartnerAdminRequest('/api/admin/partners',{method:'POST',body:JSON.stringify(ctx.body||{})})),
  ],
  'GET /api/owner/debora-partner-sales':[
    ...secured,async(ctx)=>respond(()=>deboraPartnerAdminRequest(`/api/admin/partner-sales${queryString(ctx.query)}`)),
  ],
  'POST /api/owner/debora-partner-commission':[
    ...secured,async(ctx)=>respond(()=>deboraPartnerAdminRequest('/api/admin/partner-commission',{method:'POST',body:JSON.stringify(ctx.body||{})})),
  ],
};}
