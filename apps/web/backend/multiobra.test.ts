import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => {
  let requestHeaders:Record<string,string>={};
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
  return{db,createLanClaim,revokeLanServerGrant,reset(){sequence=0;collections.clear();createLanClaim.mockClear();revokeLanServerGrant.mockReset();revokeLanServerGrant.mockResolvedValue(true)},bucket,setHeaders(h:Record<string,string>){requestHeaders=h},request(){return new Request('https://example.test/api',{headers:requestHeaders})},env:{DB:{prepare(sql:string){let args:any[]=[];return{bind(...v:any[]){args=v;return this},async first(){if(sql.includes("collection='projects'")){let n=0;for(const r of bucket('projects').values())if((r as any).companyId===args[0])n++;return{n}}return null},async run(){return{meta:{changes:0}}},async all(){return{results:[]}}}}},OWNER_EMAIL:'owner@example.com',OWNER_COMPANY:'Obra na Mão',OWNER_PROJECT:'Operação Comercial',OWNER_CUSTOMER:'Obra na Mão',DB:{prepare(sql:string){let args:any[]=[];return{bind(...values:any[]){args=values;return this},async run(){return{success:true,meta:{changes:1}}},async first(){return null},async all(){return{results:sql.includes('AS work_id')?args.slice(2).flatMap(collection=>{const record=bucket(String(collection)).get('latest');return record?.sourceDeviceId===args[1]?[{collection,work_id:record?.workId}]:[]}):[]}}}}}}};
});

vi.mock('../cloudflare/sdk',()=>({
  db:state.db,
  json:(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}}),
  error:(message:string,status=400)=>new Response(JSON.stringify({error:message}),{status,headers:{'content-type':'application/json'}}),
  requireAuth:()=>async()=>undefined,withScopes:()=>async()=>undefined,requireAdminEmailAllowlist:()=>async()=>undefined,
  runtimeEnv:()=>state.env,runtimeRequest:()=>state.request(),recentErrorDiagnostics:vi.fn(async()=>[]),router:(routes:Record<string,unknown>)=>({routes,fetch:vi.fn()}),storage:{write:vi.fn()},ai:{extract:vi.fn(),ocr:vi.fn()},
}));
vi.mock('./lan-server-authority',()=>({
  createLanClaim:state.createLanClaim,
  redeemLanClaim:vi.fn(),authenticateLanServer:vi.fn(),revokeLanServerGrant:state.revokeLanServerGrant,lanServerSnapshot:vi.fn(),
}));

vi.mock('./desktop-presence',()=>({touchDesktopPresence:vi.fn(async()=>undefined),desktopSeenAt:vi.fn(async()=>null)}));
import { touchDesktopPresence } from './desktop-presence';
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
  state.bucket(accessTable(email)).set('access-a',{projectMemberId:'member-a',companyId:'company-a',projectId:'project-a',email,userId:'user-a',name:'Admin',role,modules:['obra360'],channels:['desktop','mobile'],createdAt:now,updatedAt:now});
  return token;
}


function member(email:string,projectId:string,role='admin',extra:Record<string,unknown>={}){
  return{projectMemberId:'member-'+projectId,companyId:'company-a',projectId,email,userId:'user-a',name:'Admin',role,modules:['obra360','rdo'],channels:['desktop','mobile'],status:'active',createdAt:'2026-09-29T20:00:00.000Z',...extra};
}
const routes=()=> (handler as unknown as{routes:Record<string,readonly unknown[]>}).routes;
const call=(name:string,payload:Record<string,unknown>)=>last(routes()[name])({body:payload,query:{},params:{},user:{userId:'user-a',email:'admin@example.com',name:'Admin'}});

describe('Multiobra: um Desktop, várias obras da mesma empresa',()=>{
  beforeEach(()=>state.reset());

  it('lists only the works the device user belongs to and scopes data calls by projectId',async()=>{
    const token=await seedDesktop('admin');
    state.bucket('projects').set('project-b',{companyId:'company-a',name:'Obra B',createdAt:'x',createdBy:'user-a'});
    state.bucket('projects').set('project-x',{companyId:'company-x',name:'Outra empresa',createdAt:'x',createdBy:'user-z'});
    state.bucket(accessTable('admin@example.com')).set('access-b',member('admin@example.com','project-b'));
    state.bucket(accessTable('admin@example.com')).set('access-x',{...member('admin@example.com','project-x'),companyId:'company-x'});
    const listed=await body(await call('POST /api/desktop/projects',{deviceToken:token}));
    expect(listed.projects.map((p:any)=>p.id).sort()).toEqual(['project-a','project-b']);
    expect(listed.projects.find((p:any)=>p.id==='project-a').primary).toBe(true);
    // A project of another company, or one without membership, is refused.
    expect((await call('POST /api/desktop/field/rdo/pending',{deviceToken:token,projectId:'project-x'})).status).toBe(403);
    expect((await call('POST /api/desktop/field/rdo/pending',{deviceToken:token,projectId:'project-z'})).status).toBe(403);
  });

  it('creates the online work for a local work once, within the license limit',async()=>{
    const token=await seedDesktop('admin');
    const created=await call('POST /api/desktop/projects/create',{deviceToken:token,name:'Residencial Sul',localWorkId:7});
    expect(created.status).toBe(201);
    const project=(await body(created)).project;
    expect(project).toMatchObject({name:'Residencial Sul',localWorkId:7});
    expect(state.bucket('projects').get(project.id)).toMatchObject({companyId:'company-a',workSource:{sourceDeviceId:'device-a',localWorkId:7}});
    const again=await body(await call('POST /api/desktop/projects/create',{deviceToken:token,name:'Residencial Sul',localWorkId:7}));
    expect(again).toMatchObject({created:false,project:{id:project.id}});
    const listed=await body(await call('POST /api/desktop/projects',{deviceToken:token}));
    expect(listed.projects.find((p:any)=>p.id===project.id)).toMatchObject({localWorkId:7});
  });

  it('refuses project creation by a non-admin Desktop',async()=>{
    const token=await seedDesktop('foreman');
    expect((await call('POST /api/desktop/projects/create',{deviceToken:token,name:'X',localWorkId:3})).status).toBe(403);
  });

  it('lets the web user choose among their own works and ignores a work they do not belong to',async()=>{
    await seedDesktop('admin');
    state.bucket('projects').set('project-b',{companyId:'company-a',name:'Obra B',createdAt:'x',createdBy:'user-a'});
    state.bucket(accessTable('admin@example.com')).set('access-b',member('admin@example.com','project-b'));
    const mine=async()=>(await body(await last(routes()['GET /api/projects/mine'])({body:{},query:{},params:{},user:{userId:'user-a',email:'admin@example.com',name:'Admin'}}))).projects;
    state.setHeaders({'x-obn-project':'project-b'});
    expect((await mine()).find((p:any)=>p.current).id).toBe('project-b');
    state.setHeaders({'x-obn-project':'project-of-someone-else'});
    expect((await mine()).find((p:any)=>p.current).id).not.toBe('project-of-someone-else');
    state.setHeaders({});
  });

  it('keeps licensed desktop finance available when the web add-on is disabled',async()=>{
    const token=await seedDesktop('admin');
    const grant=state.bucket(accessTable('admin@example.com')).get('access-a')!;
    state.bucket(accessTable('admin@example.com')).set('access-a',{...grant,modules:['obra360','finance']});
    state.bucket('companies').set('company-a',{...state.bucket('companies').get('company-a'),financeWebAddon:false});
    const response=await call('POST /api/desktop/finance/read',{deviceToken:token,view:'dashboard'});
    expect(response.status).not.toBe(403);
  });

  it('rejects a primary project when the membership belongs to another account',async()=>{
    const token=await seedDesktop('admin');
    const grant=state.bucket(accessTable('admin@example.com')).get('access-a')!;
    state.bucket(accessTable('admin@example.com')).set('access-a',{...grant,userId:'different-account'});
    expect((await call('POST /api/desktop/field/rdo/pending',{deviceToken:token})).status).toBe(403);
  });
  it('lists members only in the selected work administered by the device account',async()=>{
    const token=await seedDesktop('admin');
    state.bucket('projects').set('project-b',{companyId:'company-a',name:'Obra B'});
    state.bucket(accessTable('admin@example.com')).set('access-b',member('admin@example.com','project-b'));
    state.bucket('members_project-b').set('member-b',member('bob@example.com','project-b','employee'));
    const selected=await call('POST /api/desktop/members/list',{deviceToken:token,projectId:'project-b'});
    expect(selected.status).toBe(200);
    expect((await body(selected)).members.map((item:any)=>item.email)).toEqual(['bob@example.com']);
    state.bucket(accessTable('admin@example.com')).set('access-b',member('admin@example.com','project-b','foreman'));
    expect((await call('POST /api/desktop/members/list',{deviceToken:token,projectId:'project-b'})).status).toBe(403);
  });
  it('updates operational heartbeat only after the RDO module gate',async()=>{
    const token=await seedDesktop('admin');
    vi.mocked(touchDesktopPresence).mockClear();
    const grant=state.bucket(accessTable('admin@example.com')).get('access-a')!;
    state.bucket(accessTable('admin@example.com')).set('access-a',{...grant,modules:['finance']});
    expect((await call('POST /api/desktop/field/rdo/pending',{deviceToken:token})).status).toBe(403);
    expect(touchDesktopPresence).not.toHaveBeenCalled();
    state.bucket(accessTable('admin@example.com')).set('access-a',grant);
    expect((await call('POST /api/desktop/field/rdo/pending',{deviceToken:token})).status).toBe(200);
    expect(touchDesktopPresence).toHaveBeenCalledWith('project-a','device-a');
  });
  it('includes all authorized works when an account has more than 20 memberships',async()=>{
    const token=await seedDesktop('admin');
    for(let index=0;index<30;index++){
      const id='project-'+index;
      state.bucket('projects').set(id,{companyId:'company-a',name:'Obra '+index});
      state.bucket(accessTable('admin@example.com')).set('access-'+index,member('admin@example.com',id));
    }
    const response=await call('POST /api/desktop/projects',{deviceToken:token});
    expect(response.status).toBe(200);
    const {projects}=await body(response);
    expect(projects).toHaveLength(31);
    expect(projects).toContainEqual(expect.objectContaining({id:'project-a',primary:true}));
  });
  it('uses a legacy catalog only when it identifies this device and no conflicting source exists',async()=>{
    const token=await seedDesktop('admin');
    for(const id of ['legacy','other-device','conflicting']){
      state.bucket('projects').set(id,{companyId:'company-a',name:'Mesmo nome',...(id==='conflicting'?{workSource:{sourceDeviceId:'device-a',localWorkId:30}}:{})});
      state.bucket(accessTable('admin@example.com')).set('access-'+id,member('admin@example.com',id));
      state.bucket('field_rdo_catalog_'+id).set('latest',{sourceDeviceId:id==='other-device'?'device-other':'device-a',workId:7});
    }
    const result=await body(await call('POST /api/desktop/projects',{deviceToken:token}));
    expect(result.projects.find((p:any)=>p.id==='legacy').localWorkId).toBe(7);
    expect(result.projects.find((p:any)=>p.id==='other-device').localWorkId).toBeUndefined();
    expect(result.projects.find((p:any)=>p.id==='conflicting').localWorkId).toBeUndefined();
  });
});