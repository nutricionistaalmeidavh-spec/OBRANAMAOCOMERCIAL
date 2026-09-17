import { error, json, runtimeEnv, type RouterRoutes } from '../cloudflare/sdk';
import { normalizeDeboraLicenseEmail } from './debora-license-policy';
import { DEBORA_PRODUCT_CODE, getManualDeboraLicense, grantManualDeboraLicense, resolveProductAccess, revokeManualDeboraLicense, summarizeDeboraLicenseOverview } from './product-license-service';

export function createDeboraLicenseAdminRoutes(secured: RouterRoutes[string]): RouterRoutes {
  return {
    'GET /api/owner/debora-overview': [
      ...secured,
      async () => {
        const db=runtimeEnv().DB;
        const [accountsResult,licensesResult]=await Promise.all([
          db.prepare('SELECT email,status FROM product_accounts WHERE product_code=?').bind(DEBORA_PRODUCT_CODE).all<{email:string;status:string}>(),
          db.prepare('SELECT email,plan_code,status,expires_at,updated_at FROM product_licenses WHERE product_code=? ORDER BY updated_at DESC').bind(DEBORA_PRODUCT_CODE).all<{email:string;plan_code:string;status:string;expires_at:string|null;updated_at:string}>(),
        ]);
        const overview=summarizeDeboraLicenseOverview(accountsResult.results||[],licensesResult.results||[]);
        return json({overview});
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
            const grant=await grantManualDeboraLicense(db,email,actor);
            return json({state:'active',activation:'cloudflare_d1',grant});
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
          if((cause as Error)?.message==='invalid_email')return error('Informe um e-mail válido.',400);
          throw cause;
        }
      },
    ],
  };
}
