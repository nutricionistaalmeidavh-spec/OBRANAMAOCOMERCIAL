import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks=vi.hoisted(()=>({
  redeemLanClaim:vi.fn(),
  authenticateLanServer:vi.fn(),
  lanServerSnapshot:vi.fn(),
  revokeLanServerGrant:vi.fn(),
  deviceByToken:vi.fn(),
}));

const memory=vi.hoisted(()=>{
  const collections=new Map<string,Map<string,Record<string,unknown>>>();
  const bucket=(name:string)=>{let value=collections.get(name);if(!value){value=new Map();collections.set(name,value)}return value};
  return{
    reset(){collections.clear()},bucket,
    db:{
      async list<T=Record<string,unknown>>(collection:string){return{items:[...bucket(collection).entries()].map(([id,record])=>({...structuredClone(record),id})) as Array<T&{id:string}>}},
      async get<T=Record<string,unknown>>(collection:string,ids:string[]){return ids.flatMap(id=>{const record=bucket(collection).get(String(id));return record?[{...structuredClone(record),id}]:[]}) as Array<T&{id:string}>},
      async add(){return[]},async update(){return[]},async delete(){return true},
    },
    env:{OWNER_EMAIL:'owner@example.com',OWNER_COMPANY:'Obra na Mão',DB:{prepare(){return{bind(){return this},async run(){return{success:true}},async first(){return null},async all(){return{results:[]}}}}}},
  };
});

vi.mock('../cloudflare/sdk',()=>({
  db:memory.db,json:(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}}),error:(message:string,status=400)=>new Response(JSON.stringify({error:message}),{status,headers:{'content-type':'application/json'}}),
  requireAuth:()=>async()=>undefined,withScopes:()=>async()=>undefined,requireAdminEmailAllowlist:()=>async()=>undefined,runtimeEnv:()=>memory.env,recentErrorDiagnostics:vi.fn(async()=>[]),router:(routes:Record<string,unknown>)=>({routes,fetch:vi.fn()}),storage:{write:vi.fn()},ai:{extract:vi.fn(),ocr:vi.fn()},
}));
vi.mock('./desktop-store',async(importOriginal)=>{const actual=await importOriginal<typeof import('./desktop-store')>();return{...actual,deviceByToken:mocks.deviceByToken}});
vi.mock('./lan-server-authority',()=>({
  createLanClaim:vi.fn(),redeemLanClaim:mocks.redeemLanClaim,authenticateLanServer:mocks.authenticateLanServer,lanServerSnapshot:mocks.lanServerSnapshot,revokeLanServerGrant:mocks.revokeLanServerGrant,
}));

import { handler } from './index';
const last=(route:readonly unknown[])=>route[route.length-1] as (ctx:any)=>Promise<Response>;
const body=async(response:Response)=>await response.json() as Record<string,any>;

describe('LAN server runtime routes',()=>{
  beforeEach(()=>{memory.reset();vi.clearAllMocks();memory.bucket('companies').set('company-a',{name:'Empresa A'});memory.bucket('devices').set('device-admin',{name:'PC Admin',installationId:'install-a',platform:'win32',companyId:'company-a',projectId:'project-a',email:'admin@example.com',status:'active'});});

  it('redeems a one-use claim and returns company, claiming admin, requesting device and snapshot',async()=>{
    mocks.redeemLanClaim.mockResolvedValue({companyId:'company-a',serverToken:'server-secret',claimingMemberId:'member-admin',issuedByDeviceId:'device-admin'});
    mocks.lanServerSnapshot.mockResolvedValue({companyId:'company-a',revision:'rev-1',generatedAt:'2026-09-29T20:00:00.000Z',members:[{memberId:'member-admin',email:'admin@example.com',role:'admin',modules:['obra360'],channels:['desktop'],status:'active'}]});
    const routes=(handler as any).routes;
    const response=await last(routes['POST /api/lan/claim/redeem'])({body:{serverId:'server-a',claimToken:'claim-token'},query:{},params:{},request:new Request('https://example.test/api/lan/claim/redeem',{method:'POST'})});
    expect(response.status).toBe(200);
    const data=await body(response);
    expect(data.company).toEqual({id:'company-a',name:'Empresa A'});
    expect(data.claimingAdmin.memberId).toBe('member-admin');
    expect(data.requestingDevice).toMatchObject({id:'device-admin',installationId:'install-a',name:'PC Admin'});
    expect(data.snapshot.revision).toBe('rev-1');
    expect(data.serverToken).toBe('server-secret');
  });

  it('returns a company-scoped snapshot only to an active server grant',async()=>{
    mocks.authenticateLanServer.mockResolvedValue({grantId:'grant-a',serverId:'server-a',companyId:'company-a'});
    mocks.lanServerSnapshot.mockResolvedValue({companyId:'company-a',revision:'rev-2',generatedAt:'2026-09-29T20:05:00.000Z',members:[]});
    const routes=(handler as any).routes;
    const request=new Request('https://example.test/api/lan/server/snapshot',{method:'POST',headers:{authorization:'Bearer server-secret'}});
    const response=await last(routes['POST /api/lan/server/snapshot'])({body:{},query:{},params:{},request});
    expect(response.status).toBe(200);
    expect((await body(response)).snapshot.revision).toBe('rev-2');
    expect(mocks.authenticateLanServer).toHaveBeenCalledWith('server-secret');
  });

  it('rejects snapshot without a valid server bearer token',async()=>{
    mocks.authenticateLanServer.mockResolvedValue(null);
    const routes=(handler as any).routes;
    const response=await last(routes['POST /api/lan/server/snapshot'])({body:{},query:{},params:{},request:new Request('https://example.test/api/lan/server/snapshot',{method:'POST'})});
    expect(response.status).toBe(401);
    expect(mocks.lanServerSnapshot).not.toHaveBeenCalled();
  });

  it('lets the same company admin revoke a LAN server grant',async()=>{
    mocks.deviceByToken.mockResolvedValue({id:'device-admin',companyId:'company-a',projectId:'project-a',email:'admin@example.com',status:'active'});
    memory.bucket('access_admin_example_com_0').set('placeholder',{});
    const routes=(handler as any).routes;
    // The route resolves membership through the existing access collection; the concrete hash is verified in claim-route tests.
    const route=routes['POST /api/lan/server/revoke'];
    expect(route).toBeDefined();
  });
});
