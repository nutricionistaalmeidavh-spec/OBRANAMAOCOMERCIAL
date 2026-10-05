import { beforeEach, describe, expect, it, vi } from 'vitest';

const memory=vi.hoisted(()=>{
  let sequence=0;
  const collections=new Map<string,Map<string,Record<string,unknown>>>();
  const bucket=(name:string)=>{let value=collections.get(name);if(!value){value=new Map();collections.set(name,value)}return value};
  const db={
    async list<T=Record<string,unknown>>(collection:string,options:{limit?:number}={}){const limit=Math.max(1,Number(options.limit||100));const items=[...bucket(collection).entries()].slice(-limit).reverse().map(([id,record])=>({...structuredClone(record),id})) as Array<T&{id:string}>;return{items}},
    async get<T=Record<string,unknown>>(collection:string,ids:string[]){return ids.flatMap(id=>{const record=bucket(collection).get(String(id));return record?[{...structuredClone(record),id}]:[]}) as Array<T&{id:string}>},
    async add(collection:string,records:Array<Record<string,unknown>>){const ids:string[]=[];for(const record of records){const id='test_'+(++sequence),clean=structuredClone(record);delete clean.id;bucket(collection).set(id,clean);ids.push(id)}return ids},
    async update(collection:string,changes:Array<{id:string;record:Record<string,unknown>}>){for(const change of changes){const clean=structuredClone(change.record);delete clean.id;bucket(collection).set(String(change.id),clean)}return changes.map(change=>change.id)},
    async delete(collection:string,ids:string[]){for(const id of ids)bucket(collection).delete(String(id));return true}
  };
  return{db,reset(){sequence=0;collections.clear()},env:{OWNER_EMAIL:'owner@example.com',OWNER_COMPANY:'Obra na Mão',OWNER_PROJECT:'Operação Comercial',OWNER_CUSTOMER:'Obra na Mão',DB:{prepare(){return{bind(){return this},async run(){return{success:true}},async first(){return null},async all(){return{results:[]}}}}}}};
});

vi.mock('../cloudflare/sdk',()=>({
  db:memory.db,
  json:(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}}),
  error:(message:string,status=400)=>new Response(JSON.stringify({error:message}),{status,headers:{'content-type':'application/json'}}),
  requireAuth:()=>async()=>undefined,withScopes:()=>async()=>undefined,requireAdminEmailAllowlist:()=>async()=>undefined,
  runtimeEnv:()=>memory.env,router:(routes:Record<string,unknown>)=>({routes,fetch:vi.fn()}),storage:{write:vi.fn()},ai:{extract:vi.fn(),ocr:vi.fn()},recentErrorDiagnostics:vi.fn(async()=>[]),
}));

import { handler } from './index';

const body=async(response:Response)=>await response.json() as Record<string,any>;
const last=(route:readonly unknown[])=>route[route.length-1] as (ctx:any)=>Promise<Response>;
const routes=()=>(handler as unknown as {routes:Record<string,readonly unknown[]>}).routes;

async function bootstrap(){
  const user={userId:'owner-user',email:'owner@example.com',name:'Owner'};
  const response=await last(routes()['GET /api/bootstrap'])({user,body:{},query:{},params:{}});
  expect(response.status).toBe(200);
  const data=await body(response);
  const companyId=String(data.membership.companyId);
  await memory.db.add(`company_storage_${companyId.replace(/[^a-zA-Z0-9_-]/g,'_')}`,[{mode:'lan-server',serverId:'server-test-01'}]);
  return{user,data};
}

describe('granular member governance API',()=>{
  beforeEach(()=>memory.reset());

  it('persists a custom matrix and GET returns stored/effective/revision fields',async()=>{
    const {user}=await bootstrap();
    const save=await last(routes()['POST /api/members'])({user,body:{email:'foreman@test.local',role:'foreman',modules:['obra360','rdo','finance'],channels:['desktop','mobile'],permissions:{core:['view'],operation:['view','approve'],finance:['view']}},query:{},params:{}});
    expect(save.status).toBe(200);
    const saved=(await body(save)).member;
    expect(saved.permissions).toEqual({core:['view'],operation:['view','approve'],planning:[],finance:['view'],rh:[]});
    expect(saved.effectivePermissions.operation).toEqual(['view','approve']);
    expect(saved.permissionsRevision).toMatch(/^perm-v1-[a-f0-9]{8}$/);

    const read=await last(routes()['GET /api/members'])({user,body:{},query:{},params:{}});
    expect(read.status).toBe(200);
    const member=(await body(read)).members.find((item:any)=>item.email==='foreman@test.local');
    expect(member.permissions).toEqual(saved.permissions);
    expect(member.effectivePermissions).toEqual(saved.effectivePermissions);
    expect(member.permissionsRevision).toBe(saved.permissionsRevision);
  });

  it('rejects a domain permission when the selected member modules do not enable it',async()=>{
    const {user}=await bootstrap();
    const response=await last(routes()['POST /api/members'])({user,body:{email:'foreman@test.local',role:'foreman',modules:['obra360'],channels:['desktop'],permissions:{core:['view'],finance:['view']}},query:{},params:{}});
    expect(response.status).toBe(400);
    const read=await last(routes()['GET /api/members'])({user,body:{},query:{},params:{}});
    expect((await body(read)).members.some((item:any)=>item.email==='foreman@test.local')).toBe(false);
  });

  it('protects canonical owner from demotion',async()=>{
    const {user}=await bootstrap();
    const response=await last(routes()['POST /api/members'])({user,body:{email:'owner@example.com',role:'foreman',modules:['obra360','rdo'],channels:['desktop','mobile'],permissions:{core:['view'],operation:['view']}},query:{},params:{}});
    expect(response.status).toBe(409);
    const read=await last(routes()['GET /api/members'])({user,body:{},query:{},params:{}});
    expect((await body(read)).members.find((item:any)=>item.email==='owner@example.com')?.role).toBe('admin');
  });

  it('audits successful permission changes with a safe summarized diff',async()=>{
    const {user,data}=await bootstrap();
    await last(routes()['POST /api/members'])({user,body:{email:'foreman@test.local',role:'foreman',modules:['obra360','rdo'],channels:['desktop'],permissions:{core:['view'],operation:['view']}},query:{},params:{}});
    await last(routes()['POST /api/members'])({user,body:{email:'foreman@test.local',role:'foreman',modules:['obra360','rdo'],channels:['desktop'],permissions:{core:['view','edit'],operation:['view','approve']}},query:{},params:{}});
    const projectId=String(data.membership.projectId);
    const audits=(await memory.db.list<any>(`audit_${projectId}`,{limit:100})).items;
    const entry=audits.find((item:any)=>item.action==='member_permissions_updated'&&item.details?.targetEmail==='foreman@test.local');
    expect(entry).toBeTruthy();
    expect(entry.details.diff.permissions).toBeTruthy();
    expect(JSON.stringify(entry)).not.toContain('token');
    expect(JSON.stringify(entry)).not.toContain('secret');
  });


  it('revokes and reactivates a collaborator without deleting the canonical member',async()=>{
    const {user}=await bootstrap();
    const created=await last(routes()['POST /api/members'])({user,body:{email:'foreman@test.local',role:'foreman',modules:['obra360','rdo'],channels:['mobile'],permissions:{core:['view'],operation:['view']}},query:{},params:{}});
    expect(created.status).toBe(200);
    const member=(await body(created)).member;
    const revoke=await last(routes()['PUT /api/members/:id/status'])({user,body:{status:'revoked'},query:{},params:{id:member.id}});
    expect(revoke.status).toBe(200);
    const readRevoked=await last(routes()['GET /api/members'])({user,body:{},query:{},params:{}});
    expect((await body(readRevoked)).members.find((item:any)=>item.id===member.id)?.status).toBe('revoked');
    const reactivate=await last(routes()['PUT /api/members/:id/status'])({user,body:{status:'active'},query:{},params:{id:member.id}});
    expect(reactivate.status).toBe(200);
    const readActive=await last(routes()['GET /api/members'])({user,body:{},query:{},params:{}});
    expect((await body(readActive)).members.find((item:any)=>item.id===member.id)?.status).toBe('active');
  });

  it('does not allow revoking the canonical owner or last active Admin',async()=>{
    const {user,data}=await bootstrap();
    const ownerId=String(data.membership.id||data.membership.projectMemberId||'');
    const members=await last(routes()['GET /api/members'])({user,body:{},query:{},params:{}});
    const owner=(await body(members)).members.find((item:any)=>item.email==='owner@example.com');
    const response=await last(routes()['PUT /api/members/:id/status'])({user,body:{status:'revoked'},query:{},params:{id:owner?.id||ownerId}});
    expect(response.status).toBe(409);
  });
});
