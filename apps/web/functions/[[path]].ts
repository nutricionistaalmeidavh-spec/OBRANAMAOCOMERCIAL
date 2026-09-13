import { handler } from '../backend/index';
import { handleCorporatePasswordAuth } from '../backend/corporate-password-auth';
type Env=Parameters<typeof handler.fetch>[1];
export const onRequest:PagesFunction<Env>=async context=>{
  const pathname=new URL(context.request.url).pathname;
  if(!pathname.startsWith('/api/'))return context.next();
  const passwordAuth=await handleCorporatePasswordAuth(context.request,context.env);
  if(passwordAuth)return passwordAuth;
  return handler.fetch(context.request,context.env,context);
};
