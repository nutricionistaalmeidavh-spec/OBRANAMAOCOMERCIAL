import { handler } from '../backend/index';
import { handleCorporatePasswordAuth } from '../backend/corporate-password-auth';
import { handleAdminGovernanceRequest } from '../backend/admin-governance-http';
type Env=Parameters<typeof handler.fetch>[1];
export const onRequest:PagesFunction<Env>=async context=>{
  const pathname=new URL(context.request.url).pathname;
  if(!pathname.startsWith('/api/'))return context.next();
  const passwordAuth=await handleCorporatePasswordAuth(context.request,context.env);
  if(passwordAuth)return passwordAuth;
  const governance=await handleAdminGovernanceRequest(context.request,context.env,()=>{
    const url=new URL(context.request.url);url.pathname='/api/bootstrap';url.search='';
    return handler.fetch(new Request(url,{method:'GET',headers:context.request.headers}),context.env,context);
  });
  if(governance)return governance;
  return handler.fetch(context.request,context.env,context);
};
