import { describe, expect, it } from 'vitest';
import { runCrossSystemQa } from '../scripts/qa-cross-system.mjs';

describe('Central ↔ Loja Online QA cross-system runner',()=>{
  it('runs read-only smoke without a licensing secret',async()=>{
    const calls:string[]=[];
    const fetchImpl=async(input:RequestInfo|URL)=>{
      const url=String(input);
      calls.push(url);
      return new Response('<html>ok</html>',{status:200,headers:{'content-type':'text/html'}});
    };
    const report=await runCrossSystemQa({
      centralBaseUrl:'https://central.example',
      lojaBaseUrl:'https://loja.example',
      secret:'',
      fetchImpl,
      writeArtifacts:false,
    });
    expect(report.status).toBe('PASS');
    expect(report.mode).toBe('read-only');
    expect(report.mutations).toHaveLength(0);
    expect(calls.some(url=>url.includes('central.example/sistema'))).toBe(true);
    expect(calls.some(url=>url.includes('loja.example'))).toBe(true);
  });

  it('runs P1 lifecycle, negative secret and storefront block without leaking credentials',async()=>{
    const sharedToken='qa-shared-token';
    const company={id:'cmp_qa',name:'QA-CROSS-Test'};
    const baseLicense={id:'lic_qa',companyId:company.id,status:'ACTIVE',expiresAt:'2030-01-01T00:00:00.000Z'};
    let blocked=false;
    let catalogConfigured=false;
    const fetchImpl=async(input:RequestInfo|URL,init?:RequestInit)=>{
      const url=String(input);
      const parsed=new URL(url);
      const headers=new Headers(init?.headers);

      if(parsed.pathname==='/api/internal/artisys/loja-online/companies'&&init?.method!=='POST'){
        expect(headers.get('x-artisys-license-secret')).toBe(`${sharedToken}-invalid`);
        return Response.json({error:'INTERNAL_AUTH_REQUIRED',message:'no'},{status:401});
      }
      if(parsed.pathname==='/api/internal/artisys/loja-online/companies'&&init?.method==='POST'){
        expect(headers.get('x-artisys-license-secret')).toBe(sharedToken);
        return Response.json({
          company,
          license:baseLicense,
          admin:{id:'usr_qa',email:'qa@example.test'},
          temporaryPassword:'temporary-value',
        },{status:201});
      }
      if(parsed.pathname==='/api/v1/login'&&init?.method==='POST'){
        const body=JSON.parse(String(init.body||'{}'));
        expect(body.password).toBe('temporary-value');
        return Response.json({session:'tenant-session',company,user:{id:'usr_qa'}});
      }
      if(parsed.pathname==='/api/v1/public-catalog/settings'&&init?.method==='PUT'){
        expect(headers.get('authorization')).toBe('Bearer tenant-session');
        catalogConfigured=true;
        return Response.json({slug:'qa-cross-test',enabled:true});
      }
      if(parsed.pathname.startsWith('/api/v1/public/catalog/')){
        expect(catalogConfigured).toBe(true);
        if(blocked)return Response.json({error:'PUBLIC_CATALOG_LICENSE_INACTIVE',message:'blocked'},{status:403});
        return Response.json({companyId:company.id,products:[]});
      }
      if(parsed.pathname.endsWith(`/companies/${company.id}/extend`)){
        return Response.json({company,license:{...baseLicense,expiresAt:'2030-07-01T00:00:00.000Z'}});
      }
      if(parsed.pathname.endsWith(`/companies/${company.id}/block`)){
        blocked=true;
        return Response.json({company,license:{...baseLicense,status:'BLOCKED'}});
      }
      if(parsed.pathname.endsWith(`/companies/${company.id}/unblock`)){
        blocked=false;
        return Response.json({company,license:baseLicense});
      }
      if(parsed.pathname.endsWith('/license-audit')){
        return Response.json({events:[
          {id:'e1',companyId:company.id,action:'central.client.create',createdAt:'2030-01-01T00:00:00.000Z'},
          {id:'e2',companyId:company.id,action:'central.license.extend',createdAt:'2030-01-01T00:01:00.000Z'},
          {id:'e3',companyId:company.id,action:'central.license.block',createdAt:'2030-01-01T00:02:00.000Z'},
          {id:'e4',companyId:company.id,action:'central.license.unblock',createdAt:'2030-01-01T00:03:00.000Z'},
        ]});
      }
      return new Response('<html>ok</html>',{status:200,headers:{'content-type':'text/html'}});
    };

    const report=await runCrossSystemQa({
      centralBaseUrl:'https://central.example',
      lojaBaseUrl:'https://loja.example',
      secret:sharedToken,
      fetchImpl,
      writeArtifacts:false,
      now:()=>new Date('2030-01-01T00:00:00.000Z'),
    });

    expect(report.status).toBe('PASS');
    expect(report.mode).toBe('mutable-p1');
    expect(report.mutations.map((item:any)=>item.action)).toEqual(['create','extend','block','unblock']);
    expect(report.checks.map((item:any)=>item.name)).toEqual(expect.arrayContaining([
      'internal-secret-negative',
      'tenant-login',
      'public-catalog-active',
      'public-catalog-blocked',
      'public-catalog-restored',
      'licensing-audit',
    ]));
    const serialized=JSON.stringify(report);
    expect(serialized).not.toContain(sharedToken);
    expect(serialized).not.toContain('temporary-value');
    expect(serialized).not.toContain('tenant-session');
  });
});
