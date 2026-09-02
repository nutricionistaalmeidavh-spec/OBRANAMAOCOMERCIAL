import { handler } from '../backend/index';
type Env=Parameters<typeof handler.fetch>[1];
export const onRequest:PagesFunction<Env>=async context=>{
  const pathname=new URL(context.request.url).pathname;
  if(!pathname.startsWith('/api/'))return context.next();
  return handler.fetch(context.request,context.env,context);
};
