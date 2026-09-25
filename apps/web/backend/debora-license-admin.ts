import { error, json, runtimeEnv, type RouterRoutes } from '../cloudflare/sdk';
import { normalizeDeboraLicenseEmail } from './debora-license-policy';
import { classifyLegacyManualSale, grantManualDeboraLicenseWithSale, listManualSales, manualSalesSummary } from './manual-license-sales';
import { buildDeboraAdminClients, DEBORA_PRODUCT_CODE, getManualDeboraLicense, resolveProductAccess, revokeManualDeboraLicense, summarizeDeboraLicenseOverview } from './product-license-service';

const parseJson=(value:unknown)=>{try{return JSON.parse(String(value||'{}')) as Record<string,unknown>}catch{return{}}};

export function createDeboraLicenseAdminRoutes(secured: RouterRoutes[string]): RouterRoutes {
  return {
    'GET /api/owner/debora-overview': [
      ...secured,
      async () => {
        const db=runtimeEnv().DB;
        const [accountsResult,licensesResult]=await Promise.all([
          db.prepare('SELECT email,status,source FROM product_accounts WHERE product_code=?').bind(DEBORA_PRODUCT_CODE).all<{email:string;status:string;source:string}>(),
          db.prepare('SELECT email,plan_code,status,expires_at,source,updated_at FROM product_licenses WHERE product_code=? ORDER BY updated_at DESC').bind(DEBORA_PRODUCT_CODE).all<{email:string;plan_code:string;status:string;expires_at:string|null;source:string;updated_at:string}>(),
        ]);
        const accounts=accountsResult.results||[],licenses=licensesResult.results||[];
        const overview=summarizeDeboraLicenseOverview(accounts,licenses);
        const clients=buildDeboraAdminClients(accounts,licenses);
        return json({overview,clients});
      },
    ],
    'GET /api/owner/license-audit': [
      ...secured,
      async () => {
        const db=runtimeEnv().DB;
        const [obraResult,deboraResult]=await Promise.all([
          db.prepare(`SELECT a.id,a.license_id,a.action,a.source,a.actor_email,a.details_json,a.created_at,k.record_json
            FROM license_audit a
            LEFT JOIN kv_records k ON k.collection='licenses' AND k.id=a.license_id
            ORDER BY a.created_at DESC LIMIT 100`).all<{id:string;license_id:string;action:string;source:string;actor_email:string|null;details_json:string;created_at:string;record_json:string|null}>(),
          db.prepare('SELECT id,license_id,email,action,actor,source,details_json,created_at FROM product_license_events WHERE product_code=? ORDER BY created_at DESC LIMIT 100').bind(DEBORA_PRODUCT_CODE).all<{id:string;license_id:string|null;email:string;action:string;actor:string;source:string;details_json:string;created_at:string}>(),
        ]);
        const obra=(obraResult.results||[]).map(row=>{const license=parseJson(row.record_json);return{id:row.id,product:'obra-na-mao',licenseId:row.license_id,email:String(license.email||''),action:row.action,source:row.source,actor:row.actor_email||'',createdAt:row.created_at,details:parseJson(row.details_json)}});
        const debora=(deboraResult.results||[]).map(row=>({id:row.id,product:'debora-lactacao',licenseId:row.license_id||'',email:row.email,action:row.action,source:row.source,actor:row.actor||'',createdAt:row.created_at,details:parseJson(row.details_json)}));
        const events=[...obra,...debora].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,100);
        return json({events});
      },
    ],
    'GET /api/owner/debora-manual-sales/summary': [
      ...secured,
      async()=>json(await manualSalesSummary(runtimeEnv().DB)),
    ],
    'GET /api/owner/debora-manual-sales': [
      ...secured,
      async(ctx)=>{
        try{return json(await listManualSales(runtimeEnv().DB,ctx.query))}
        catch(cause){if((cause as Error)?.message==='invalid_cursor')return error('Cursor inválido.',400);throw cause}
      },
    ],
    'POST /api/owner/debora-manual-sales/classify': [
      ...secured,
      async(ctx)=>{
        const input=(ctx.body||{}) as Record<string,unknown>,email=normalizeDeboraLicenseEmail(input.email),actor=ctx.user?.email||'central-artisys';
        if(!/^\S+@\S+\.\S+$/.test(email))return error('Informe um e-mail válido.',400);
        try{return json({sale:await classifyLegacyManualSale(runtimeEnv().DB,email,input.sale,actor)})}
        catch(cause){
          const message=(cause as Error)?.message||'';
          if(message==='manual_license_not_found')return error('Não existe licença manual para este e-mail.',404);
          if(message==='duplicate_legacy_classification')return error('Esta referência já foi classificada para a licença.',409);
          if(message==='invalid_email')return error('Informe um e-mail válido.',400);
          if(/Informe|referência/i.test(message))return error(message,400);
          throw cause;
        }
      },
    ],
    'POST /api/owner/debora-license': [
      ...secured,
      async (ctx) => {
        const input=(ctx.body||{}) as Record<string,unknown>;
        const action=String(input.action||'grant');
        const email=normalizeDeboraLicenseEmail(input.email);
        if(!/^\S+@\S+\.\S+$/.test(email))return error('Informe um e-mail válido.',400);
        if(!['grant','status','revoke'].includes(action))return error('Ação de licença inválida.',400);
        const db=runtimeEnv().DB,actor=ctx.user?.email||'central-artisys';
        try{
          if(action==='grant'){
            const activated=await grantManualDeboraLicenseWithSale(db,email,input.sale,actor);
            return json({state:'active',activation:'cloudflare_d1',grant:activated.grant,sale:activated.sale});
          }
          if(action==='revoke'){
            const grant=await revokeManualDeboraLicense(db,email,actor);
            if(!grant)return error('Não existe licença manual para este e-mail.',404);
            return json({state:'revoked',activation:'cloudflare_d1',grant});
          }
          const grant=await getManualDeboraLicense(db,email);
          const access=await resolveProductAccess(db,'debora-lactacao',email);
          return json({state:grant?.status||(!access.commercial?'none':access.planCode),activation:'cloudflare_d1',grant,access});
        }catch(cause){
          const message=(cause as Error)?.message||'';
          if(message==='invalid_email')return error('Informe um e-mail válido.',400);
          if(/Informe|referência/i.test(message))return error(message,400);
          throw cause;
        }
      },
    ],
  };
}
