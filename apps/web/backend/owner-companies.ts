import { error, json, type RouterRoutes } from '../cloudflare/sdk';
import { createDeboraLicenseAdminRoutes } from './debora-license-admin';
import { createDeboraObservabilityAdminRoutes } from './debora-observability-admin';
import { createDeboraPartnerAdminRoutes } from './debora-partner-admin';
import { createLojaOnlineAdminRoutes } from './loja-online-admin';
import { ManagedAdminError, companyViews, createManagedCompany, managedCompanyInventory, updateManagedCompany } from './owner-company-service';

export { companyViews } from './owner-company-service';

async function respond(work:()=>Promise<unknown>,status=200){
  try{return json(await work(),status)}catch(cause){
    if(cause instanceof ManagedAdminError)return error(cause.message,cause.status);
    throw cause;
  }
}

export function createCompanyRoutes(secured:RouterRoutes[string]):RouterRoutes{return{
 ...createDeboraLicenseAdminRoutes(secured),
 ...createDeboraObservabilityAdminRoutes(secured),
 ...createDeboraPartnerAdminRoutes(secured),
 ...createLojaOnlineAdminRoutes(secured),
 'GET /api/owner/companies':[...secured,async()=>json(await managedCompanyInventory())],
 'GET /api/owner/companies/:id':[...secured,async(ctx)=>{const company=(await managedCompanyInventory()).companies.find(item=>item.id===ctx.params.id);return company?json({company}):error('Empresa não encontrada.',404)}],
 'POST /api/owner/companies':[...secured,async(ctx)=>respond(()=>createManagedCompany((ctx.body||{}) as Record<string,unknown>,{userId:ctx.user!.userId,email:ctx.user!.email}),201)],
 'PUT /api/owner/companies/:id':[...secured,async(ctx)=>respond(()=>updateManagedCompany(ctx.params.id,(ctx.body||{}) as Record<string,unknown>,{userId:ctx.user!.userId,email:ctx.user!.email}))]
};}
