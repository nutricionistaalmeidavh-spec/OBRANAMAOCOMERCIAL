import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => {
  let sequence=0;
  const collections=new Map<string,Map<string,Record<string,unknown>>>();
  const bucket=(name:string)=>{let value=collections.get(name);if(!value){value=new Map();collections.set(name,value)}return value};
  const db={
    async list<T=Record<string,unknown>>(collection:string,options:{limit?:number}={}){const limit=Math.max(1,Number(options.limit||100));const items=[...bucket(collection).entries()].slice(-limit).reverse().map(([id,record])=>({...structuredClone(record),id})) as Array<T&{id:string}>;return{items}},
    async get<T=Record<string,unknown>>(collection:string,ids:string[]){return ids.flatMap(id=>{const record=bucket(collection).get(String(id));return record?[{...structuredClone(record),id}]:[]}) as Array<T&{id:string}>},
    async add(collection:string,records:Array<Record<string,unknown>>){const ids:string[]=[];for(const record of records){const id='test_'+(++sequence),clean=structuredClone(record);delete clean.id;bucket(collection).set(id,clean);ids.push(id)}return ids},
    async update(collection:string,changes:Array<{id:string;record:Record<string,unknown>}>){for(const change of changes){const clean=structuredClone(change.record);delete clean.id;bucket(collection).set(String(change.id),clean)}return changes.map(x=>x.id)},
    async delete(collection:string,ids:string[]){for(const id of ids)bucket(collection).delete(String(id));return true},
  };
  const createLanClaim=vi.fn(async()=>({claimToken:'claim-token',expiresAt:'2026-09-29T20:10:00.000Z'}));
  const revokeLanServerGrant=vi.fn(async()=>true);
  return{db,createLanClaim,revokeLanServerGrant,reset(){sequence=0;collections.clear();createLanClaim.mockClear();revokeLanServerGrant.mockReset();revokeLanServerGrant.mockResolvedValue(true)},bucket,env:{OWNER_EMAIL:'owner@example.com',OWNER_COMPANY:'Obra na Mão',OWNER_PROJECT:'Operação Comercial',OWNER_CUSTOMER:'Obra na Mão',DB:{prepare(){return{bind(){return this},async run(){return{success:true,meta:{changes:1}}},async first(){return null},async all(){return{results:[]}}}}}}};
});

vi.mock('../cloudflare/sdk',()=>({
  db:state.db,
  json:(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}}),
  error:(message:string,status=400)=>new Response(JSON.stringify({error:message}),{status,headers:{'content-type':'application/json'}}),
  requireAuth:()=>async()=>undefined,withScopes:()=>async()=>undefined,requireAdminEmailAllowlist:()=>async()=>undefined,
  runtimeEnv:()=>state.env,recentErrorDiagnostics:vi.fn(async()=>[]),router:(routes:Record<string,unknown>)=>({routes,fetch:vi.fn()}),storage:{write:vi.fn()},ai:{extract:vi.fn(),ocr:vi.fn()},
}));
vi.mock('./lan-server-authority',()=>({
  createLanClaim:state.createLanClaim,
  redeemLanClaim:vi.fn(),authenticateLanServer:vi.fn(),revokeLanServerGrant:state.revokeLanServerGrant,lanServerSnapshot:vi.fn(),
}));

import { handler } from './index';

const body=async(response:Response)=>await response.json() as Record<string,any>;
const last=(route:readonly unknown[])=>route[route.length-1] as (ctx:any)=>Promise<Response>;
function hashKey(value:string){let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16)}
function safe(value:string){return value.replace(/[^a-zA-Z0-9_-]/g,'_')}
function accessTable(email:string){const normalized=email.trim().toLowerCase();return`access_${safe(normalized).slice(0,28)}_${hashKey(normalized)}`}
function deviceTokenTable(token:string){return`device_token_${hashKey(token)}`}

async function seedDesktop(role:'admin'|'foreman'|'employee'='admin'){
  const token='a'.repeat(64),email='admin@example.com',now='2026-09-29T20:00:00.000Z';
  state.bucket('companies').set('company-a',{name:'Obra na Mão',createdAt:now});
  state.bucket('projects').set('project-a',{companyId:'company-a',name:'Obra A',customer:'Cliente',createdAt:now,createdBy:'user-a'});
  state.bucket('devices').set('device-a',{installationId:'installation-a',name:'PC Admin',platform:'win32',companyId:'company-a',projectId:'project-a',userId:'user-a',email,status:'active',tokenExpiresAt:'2099-01-01T00:00:00.000Z',createdAt:now,updatedAt:now,lastSeenAt:now});
  state.bucket(deviceTokenTable(token)).set('token-ref',{deviceId:'device-a'});
  state.bucket(accessTable(email)).set('member-a',{companyId:'company-a',projectId:'project-a',email,userId:'user-a',name:'Admin',role,modules:['obra360'],channels:['desktop','mobile'],createdAt:now,updatedAt:now});
  return token;
}

describe('LAN server claim routes',()=>{
  beforeEach(()=>state.reset());

  it('allows an authorized admin Desktop to create a short-lived server claim',async()=>{
    const routes=(handler as unknown as{routes:Record<string,readonly unknown[]>}).routes;
    const token=await seedDesktop('admin');
    const response=await last(routes['POST /api/desktop/lan/claim/start'])({body:{deviceToken:token,serverId:'server-a'},query:{},params:{}});
    expect(response.status).toBe(200);
    expect(await body(response)).toEqual({claimToken:'claim-token',expiresAt:'2026-09-29T20:10:00.000Z'});
    expect(state.createLanClaim).toHaveBeenCalledWith({companyId:'company-a',serverId:'server-a',issuedByDeviceId:'device-a',issuedByMemberId:'member-a'});
  });

  it.each(['foreman','employee'] as const)('rejects %s Desktop even with a valid device token',async(role)=>{
    const routes=(handler as unknown as{routes:Record<string,readonly unknown[]>}).routes;
    const token=await seedDesktop(role);
    const response=await last(routes['POST /api/desktop/lan/claim/start'])({body:{deviceToken:token,serverId:'server-a'},query:{},params:{}});
    expect(response.status).toBe(403);
    expect(state.createLanClaim).not.toHaveBeenCalled();
  });

  it('rejects invalid device tokens and invalid server ids',async()=>{
    const routes=(handler as unknown as{routes:Record<string,readonly unknown[]>}).routes;
    const invalidToken=await last(routes['POST /api/desktop/lan/claim/start'])({body:{deviceToken:'invalid',serverId:'server-a'},query:{},params:{}});
    expect(invalidToken.status).toBe(403);

    const token=await seedDesktop('admin');
    const invalidServer=await last(routes['POST /api/desktop/lan/claim/start'])({body:{deviceToken:token,serverId:'x'},query:{},params:{}});
    expect(invalidServer.status).toBe(400);
  });

  it('lets only an admin revoke a server scoped to the same company',async()=>{
    const routes=(handler as unknown as{routes:Record<string,readonly unknown[]>}).routes;
    const token=await seedDesktop('admin');
    const response=await last(routes['POST /api/lan/server/revoke'])({body:{deviceToken:token,serverId:'server-a'},query:{},params:{}});
    expect(response.status).toBe(200);
    expect(state.revokeLanServerGrant).toHaveBeenCalledWith({serverId:'server-a',companyId:'company-a'});

    state.reset();
    const foreman=await seedDesktop('foreman');
    const denied=await last(routes['POST /api/lan/server/revoke'])({body:{deviceToken:foreman,serverId:'server-a'},query:{},params:{}});
    expect(denied.status).toBe(403);
    expect(state.revokeLanServerGrant).not.toHaveBeenCalled();
  });

  it('does not report a server from another company as revocable',async()=>{
    const routes=(handler as unknown as{routes:Record<string,readonly unknown[]>}).routes;
    const token=await seedDesktop('admin');
    state.revokeLanServerGrant.mockResolvedValueOnce(false);
    const response=await last(routes['POST /api/lan/server/revoke'])({body:{deviceToken:token,serverId:'server-other'},query:{},params:{}});
    expect(response.status).toBe(404);
  });
});
