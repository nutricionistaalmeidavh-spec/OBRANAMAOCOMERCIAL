import { describe, expect, it } from 'vitest';
import { runCrossSystemQa } from '../scripts/qa-cross-system.mjs';

describe('Central ↔ Loja Online ↔ SEO QA cross-system runner',()=>{
  it('runs read-only smoke across Central, Loja Online and the shared SEO panel without a licensing secret',async()=>{
    const calls:string[]=[];
    const fetchImpl=async(input:RequestInfo|URL)=>{
      const url=String(input);
      calls.push(url);
      return new Response('<html><title>Painel SEO</title><script src="/admin/seo/app.js"></script></html>',{status:200,headers:{'content-type':'text/html'}});
    };
    const report=await runCrossSystemQa({
      centralBaseUrl:'https://central.example',
      lojaBaseUrl:'https://loja.example',
      seoPanelUrl:'https://seo.example/admin/seo/?context=loja-online',
      secret:'',
      fetchImpl,
      writeArtifacts:false,
    });
    expect(report.status).toBe('PASS');
    expect(report.mode).toBe('read-only');
    expect(report.mutations).toHaveLength(0);
    expect(report.targets.seo).toBe('https://seo.example/admin/seo/?context=loja-online');
    expect(report.checks.map((item:any)=>item.name)).toEqual(expect.arrayContaining(['central-http','loja-http','seo-panel-http']));
    expect(calls.some(url=>url.includes('central.example/sistema'))).toBe(true);
    expect(calls.some(url=>url.includes('loja.example'))).toBe(true);
    expect(calls.some(url=>url.includes('seo.example/admin/seo/?context=loja-online'))).toBe(true);
  });

  it('runs P1 licensing, login and public-catalog lifecycle without serializing credentials',async()=>{
    const sharedToken='qa-shared-token';
    const temporaryPassword='temporary-value';
    const session='session-sensitive-value';
    const company={id:'cmp_qa',name:'QA-CROSS-Test'};
    const license={id:'lic_qa',companyId:company.id,status:'ACTIVE',expiresAt:'2030-01-01T00:00:00.000Z'};
    let blocked=false;

    const json=(value:unknown,status=200)=>Response.json(value,{status});
    const fetchImpl=async(input:RequestInfo|URL,init?:RequestInit)=>{
      const url=String(input);
      const method=String(init?.method||'GET').toUpperCase();
      const headers=new Headers(init?.headers);
      const parsed=new URL(url);
      const pathname=parsed.pathname;

      if(parsed.hostname==='seo.example')return new Response('<html><title>Painel SEO</title><script src="/admin/seo/app.js"></script></html>',{status:200,headers:{'content-type':'text/html'}});
      if(pathname==='/sistema'||pathname==='/')return new Response('<html>ok</html>',{status:200,headers:{'content-type':'text/html'}});

      if(pathname==='/api/internal/artisys/loja-online/companies'&&method==='GET'){
        if(headers.get('x-artisys-license-secret')!==sharedToken)return json({error:'INTERNAL_AUTH_REQUIRED',message:'denied'},401);
        return json({companies:[{company,license}]});
      }
      if(pathname==='/api/internal/artisys/loja-online/companies'&&method==='POST'){
        expect(headers.get('x-artisys-license-secret')).toBe(sharedToken);
        return json({company,license,admin:{id:'usr_qa',email:'qa@example.test'},temporaryPassword},201);
      }
      if(pathname==='/api/v1/login'&&method==='POST')return json({session,user:{id:'usr_qa'},company,license});
      if(pathname==='/api/v1/products'&&method==='POST')return json({id:'prd_qa',companyId:company.id,name:'Produto QA',priceCents:1234},201);
      if(pathname==='/api/v1/products/prd_qa/publication'&&method==='PUT')return json({id:'prd_qa',published:true});
      if(pathname==='/api/v1/public-catalog/settings'&&method==='PUT')return json({slug:'qa-cross-test',enabled:true});
      if(pathname.startsWith('/api/v1/public/catalog/')){
        if(blocked)return json({error:'PUBLIC_CATALOG_LICENSE_INACTIVE',message:'blocked'},403);
        return json({companyId:company.id,products:[{id:'prd_qa'}]});
      }
      if(pathname.endsWith('/extend'))return json({company,license:{...license,expiresAt:'2030-07-01T00:00:00.000Z'}});
      if(pathname.endsWith('/block')){blocked=true;return json({company,license:{...license,status:'BLOCKED'}})}
      if(pathname.endsWith('/unblock')){blocked=false;return json({company,license})}
      if(pathname==='/api/v1/dashboard')return blocked?json({error:'LICENSE_BLOCKED',message:'blocked'},403):json({company});
      if(pathname.endsWith('/license-audit')){
        return json({events:[
          {id:'evt1',companyId:company.id,action:'central.client.create',actor:'central-artisys',createdAt:'2030-01-01T00:00:00.000Z',details:{}},
          {id:'evt2',companyId:company.id,action:'central.license.extend',actor:'central-artisys',createdAt:'2030-01-01T00:01:00.000Z',details:{}},
          {id:'evt3',companyId:company.id,action:'central.license.block',actor:'central-artisys',createdAt:'2030-01-01T00:02:00.000Z',details:{}},
          {id:'evt4',companyId:company.id,action:'central.license.unblock',actor:'central-artisys',createdAt:'2030-01-01T00:03:00.000Z',details:{}},
        ]});
      }
      return json({error:'NOT_MOCKED',pathname,method},500);
    };

    const report=await runCrossSystemQa({
      centralBaseUrl:'https://central.example',
      lojaBaseUrl:'https://loja.example',
      seoPanelUrl:'https://seo.example/admin/seo/?context=loja-online',
      secret:sharedToken,
      fetchImpl,
      writeArtifacts:false,
      now:()=>new Date('2030-01-01T00:00:00.000Z'),
    });
    expect(report.status).toBe('PASS');
    expect(report.mode).toBe('mutable-p1');
    expect(report.mutations.map((item:any)=>item.action)).toEqual(['create','extend','block','unblock']);
    expect(report.checks.map((item:any)=>item.name)).toEqual(expect.arrayContaining([
      'seo-panel-http','invalid-secret-denied','temporary-login','public-catalog-active','license-block-enforced','license-unblock-restored','licensing-audit',
    ]));
    const serialized=JSON.stringify(report);
    expect(serialized).not.toContain(sharedToken);
    expect(serialized).not.toContain(temporaryPassword);
    expect(serialized).not.toContain(session);
  });
});
