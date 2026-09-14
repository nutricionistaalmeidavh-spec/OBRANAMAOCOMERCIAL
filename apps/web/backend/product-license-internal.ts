import { DEBORA_PRODUCT_CODE, registerCommercialAccount, resolveProductAccess, syncProductLicense } from './product-license-service';

type Env={DB:D1Database;LICENSE_SERVICE_SECRET?:string};
const json=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});

async function digest(value:string){return new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))}
async function sameSecret(a:string,b:string){if(!a||!b)return false;const [x,y]=await Promise.all([digest(a),digest(b)]);if(x.length!==y.length)return false;let diff=0;for(let i=0;i<x.length;i++)diff|=x[i]^y[i];return diff===0}

export async function handleProductLicenseInternal(request:Request,env:Env):Promise<Response|null>{
  const url=new URL(request.url);if(url.pathname!=='/api/internal/product-license')return null;
  if(request.method!=='POST')return json(405,{error:'method_not_allowed'});
  if(!await sameSecret(request.headers.get('x-artisys-license-secret')||'',String(env.LICENSE_SERVICE_SECRET||'')))return json(401,{error:'unauthorized'});
  const input=await request.json().catch(()=>({})) as Record<string,unknown>;
  const action=String(input.action||'resolve'),productCode=String(input.productCode||DEBORA_PRODUCT_CODE);
  if(productCode!==DEBORA_PRODUCT_CODE)return json(400,{error:'unsupported_product'});
  try{
    if(action==='resolve')return json(200,await resolveProductAccess(env.DB,productCode,input.email));
    if(action==='register')return json(200,await registerCommercialAccount(env.DB,productCode,input.email,String(input.source||'saas_onboarding')));
    if(action==='sync')return json(200,await syncProductLicense(env.DB,{
      productCode,email:input.email,planCode:String(input.planCode||''),status:String(input.status||''),
      expiresAt:input.expiresAt?String(input.expiresAt):null,source:String(input.source||'billing_sync'),
      externalRef:String(input.externalRef||input.planCode||''),actor:String(input.actor||'debora-worker'),
    }));
    return json(400,{error:'invalid_action'});
  }catch(error){return json((error as Error)?.message==='invalid_email'?400:500,{error:(error as Error)?.message||'license_error'})}
}
