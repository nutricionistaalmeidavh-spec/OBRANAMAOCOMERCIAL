import { error, type Middleware } from '../cloudflare/sdk';

type CentralConfig={OWNER_EMAIL?:string;DEBORA_CENTRAL_EMAIL?:string};
export type CentralRole='owner'|'debora';
const normalized=(value:unknown)=>String(value||'').trim().toLowerCase();

/** Resolve roles exclusively from the verified server session email and server configuration. */
export function centralRoleForEmail(email:unknown,env:CentralConfig):CentralRole|null{
  const current=normalized(email);
  if(!current)return null;
  const owner=normalized(env.OWNER_EMAIL);
  if(owner&&current===owner)return 'owner';
  const debora=normalized(env.DEBORA_CENTRAL_EMAIL);
  if(debora&&current===debora)return 'debora';
  return null;
}

/** Product-scoped API gate. Never use it for Obra administration or mixed-product audit. */
export const requireCentralAccess=():Middleware=>async ctx=>{
  if(!centralRoleForEmail(ctx.user?.email,ctx.env))return error('Acesso à Central não autorizado.',403);
};
