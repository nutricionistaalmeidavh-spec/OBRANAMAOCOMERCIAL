import { describe, expect, it } from 'vitest';
import { lojaOnlineRequest, createLojaOnlineAdminRoutes, type LojaOnlineRuntimeEnv } from './loja-online-admin';

function envWith(fetchImpl:(request:Request)=>Promise<Response>):LojaOnlineRuntimeEnv{
  return {
    DB:{} as D1Database,
    LOJAONLINE_LICENSE_SERVICE_SECRET:'segredo-central',
    LOJAONLINE_LICENSING:{fetch:async(input:RequestInfo|URL,init?:RequestInit)=>fetchImpl(new Request(input,init))},
  };
}

describe('Loja Online admin adapter',()=>{
  it('usa Service Binding e envia somente o segredo interno no backend',async()=>{
    const calls:Request[]=[];
    const env=envWith(async request=>{
      calls.push(request);
      return Response.json({companies:[{company:{id:'c1',name:'Casa Silva'},admin:{email:'casa@example.com'},license:{status:'ACTIVE',maxUsers:3},accessStatus:'ACTIVE',accessible:true,userCount:1}]});
    });
    const result=await lojaOnlineRequest<{companies:unknown[]}>('/api/internal/artisys/loja-online/companies',{},env);
    expect(result.companies).toHaveLength(1);
    expect(calls).toHaveLength(1);
    expect(new URL(calls[0].url).pathname).toBe('/api/internal/artisys/loja-online/companies');
    expect(calls[0].headers.get('x-artisys-license-secret')).toBe('segredo-central');
    expect(calls[0].headers.get('authorization')).toBeNull();
  });

  it('falha fechado quando segredo ou destino não estão configurados',async()=>{
    const base={DB:{} as D1Database} as LojaOnlineRuntimeEnv;
    await expect(lojaOnlineRequest('/api/internal/artisys/loja-online/companies',{},base)).rejects.toThrow('LOJAONLINE_LICENSE_SERVICE_SECRET');
    await expect(lojaOnlineRequest('/api/internal/artisys/loja-online/companies',{}, {...base,LOJAONLINE_LICENSE_SERVICE_SECRET:'x'})).rejects.toThrow('Binding/URL');
  });

  it('normaliza erro upstream sem expor segredo',async()=>{
    const env=envWith(async()=>Response.json({error:'CLIENT_ADMIN_EMAIL_EXISTS',message:'E-mail já vinculado'},{status:409}));
    await expect(lojaOnlineRequest('/api/internal/artisys/loja-online/companies',{method:'POST',body:'{}'},env)).rejects.toMatchObject({status:409,code:'CLIENT_ADMIN_EMAIL_EXISTS',message:'E-mail já vinculado'});
  });

  it('expõe todas as rotas owner protegidas para Loja Online',()=>{
    const secured=[async()=>{}];
    const routes=createLojaOnlineAdminRoutes(secured);
    const expected=[
      'GET /api/owner/loja-online/overview',
      'GET /api/owner/loja-online/companies',
      'GET /api/owner/loja-online/companies/:id',
      'POST /api/owner/loja-online/companies',
      'PUT /api/owner/loja-online/companies/:id/license',
      'POST /api/owner/loja-online/companies/:id/extend',
      'POST /api/owner/loja-online/companies/:id/block',
      'POST /api/owner/loja-online/companies/:id/unblock',
      'GET /api/owner/loja-online/license-audit',
    ];
    for(const key of expected){
      expect(routes[key]).toBeDefined();
      expect(routes[key][0]).toBe(secured[0]);
    }
  });
});
