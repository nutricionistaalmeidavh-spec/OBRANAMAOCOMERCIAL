import { error, json, runtimeEnv, type RouterRoutes } from '../cloudflare/sdk';
import { normalizeDeboraLicenseEmail } from './debora-license-policy';
import { getManualDeboraLicense, grantManualDeboraLicense, resolveProductAccess, revokeManualDeboraLicense } from './product-license-service';

export function createDeboraLicenseAdminRoutes(secured: RouterRoutes[string]): RouterRoutes {
  return {
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
