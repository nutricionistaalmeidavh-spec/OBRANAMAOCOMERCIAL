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

  it('runs the licensing lifecycle without serializing credentials into the report',async()=>{
    const sharedToken='qa-shared-token';
    const company={id:'cmp_qa',name:'QA-CROSS-Test'};
    const license={id:'lic_qa',companyId:company.id,status:'ACTIVE',expiresAt:'2030-01-01T00:00:00.000Z'};
    const fetchImpl=async(input:RequestInfo|URL,init?:RequestInit)=>{
      const url=String(input);
      if(url.endsWith('/api/internal/artisys/loja-online/companies')&&init?.method==='POST'){
        expect(new Headers(init.headers).get('x-artisys-license-secret')).toBe(sharedToken);
        return Response.json({company,license,admin:{id:'usr_qa',email:'qa@example.test'},temporaryPassword:'temporary-value'},{status:201});
      }
      if(url.endsWith(`/companies/${company.id}/extend`)) return Response.json({company,license:{...license,expiresAt:'2030-07-01T00:00:00.000Z'}});
      if(url.endsWith(`/companies/${company.id}/block`)) return Response.json({company,license:{...license,status:'BLOCKED'}});
      if(url.endsWith(`/companies/${company.id}/unblock`)) return Response.json({company,license});
      if(url.includes('/license-audit')) return Response.json({events:[{id:'evt1',companyId:company.id,action:'central.client.create',actor:'central-artisys',createdAt:'2030-01-01T00:00:00.000Z',details:{}}]});
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
    expect(report.mode).toBe('mutable');
    expect(report.mutations.map((item:any)=>item.action)).toEqual(['create','extend','block','unblock']);
    expect(JSON.stringify(report)).not.toContain(sharedToken);
    expect(JSON.stringify(report)).not.toContain('temporary-value');
  });
});
