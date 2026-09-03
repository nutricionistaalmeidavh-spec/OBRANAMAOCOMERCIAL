import { beforeEach, describe, expect, it, vi } from 'vitest';

const memory=vi.hoisted(()=>{
  let sequence=0;
  const collections=new Map<string,Map<string,Record<string,unknown>>>();
  const bucket=(name:string)=>{let value=collections.get(name);if(!value){value=new Map();collections.set(name,value)}return value};
  const db={
    async list<T=Record<string,unknown>>(collection:string,options:{limit?:number}={}){
      const limit=Math.max(1,Number(options.limit||100));
      const items=[...bucket(collection).entries()].slice(-limit).reverse().map(([id,record])=>({...structuredClone(record),id})) as Array<T&{id:string}>;
      return{items};
    },
    async get<T=Record<string,unknown>>(collection:string,ids:string[]){
      return ids.flatMap(id=>{const record=bucket(collection).get(String(id));return record?[{...structuredClone(record),id}]:[]}) as Array<T&{id:string}>;
    },
    async add(collection:string,records:Array<Record<string,unknown>>){
      const ids:string[]=[];for(const record of records){const id='test_'+(++sequence),clean=structuredClone(record);delete clean.id;bucket(collection).set(id,clean);ids.push(id)}return ids;
    },
    async update(collection:string,changes:Array<{id:string;record:Record<string,unknown>}>){
      for(const change of changes){const clean=structuredClone(change.record);delete clean.id;bucket(collection).set(String(change.id),clean)}return changes.map(change=>change.id);
    },
    async delete(collection:string,ids:string[]){for(const id of ids)bucket(collection).delete(String(id));return true}
  };
  return{
    db,
    reset(){sequence=0;collections.clear()},
    env:{
      OWNER_EMAIL:'owner@example.com',
      OWNER_COMPANY:'Obra na Mão',
      OWNER_PROJECT:'Operação Comercial',
      OWNER_CUSTOMER:'Obra na Mão',
      DB:{prepare(){return{bind(){return this},async run(){return{success:true}},async first(){return null},async all(){return{results:[]}}}}},
    }
  };
});

vi.mock('../cloudflare/sdk',()=>({
  db:memory.db,
  json:(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}}),
  error:(message:string,status=400)=>new Response(JSON.stringify({error:message}),{status,headers:{'content-type':'application/json'}}),
  requireAuth:()=>async()=>undefined,
  withScopes:()=>async()=>undefined,
  requireAdminEmailAllowlist:()=>async()=>undefined,
  runtimeEnv:()=>memory.env,
  router:(routes:Record<string,unknown>)=>({routes,fetch:vi.fn()}),
  storage:{write:vi.fn()},
  ai:{extract:vi.fn(),ocr:vi.fn()},
  recentErrorDiagnostics:vi.fn(async()=>[]),
}));

import { handler } from './index';
import { EDUCATION_PHONE_ACCESS_ROUTES, ensureEducationPhoneParticipant } from './education';
import { ensurePhoneAccess } from './phone-access';

const body=async(response:Response)=>await response.json() as Record<string,any>;
const last=(route:readonly unknown[])=>route[route.length-1] as (ctx:any)=>Promise<Response>;
const routes=()=>(handler as unknown as {routes:Record<string,readonly unknown[]>}).routes;

async function ownerBootstrap(){
  const user={userId:'owner-user',email:'owner@example.com',name:'Owner'};
  const response=await last(routes()['GET /api/bootstrap'])({user,body:{},query:{},params:{}});
  expect(response.status).toBe(200);
  return{user,data:await body(response)};
}
async function importState(user:Record<string,string>,state:Record<string,unknown>){
  const response=await last(routes()['POST /api/project/import'])({user,body:{state},query:{},params:{}});
  expect(response.status).toBe(200);
}

describe('P3 automated product workflows',()=>{
  beforeEach(()=>memory.reset());

  it('validates Admin -> Encarregado -> Funcionário responsibilities without crossing roles',async()=>{
    const{user,data:bootstrap}=await ownerBootstrap();
    const today='2026-09-03';
    await importState(user,{
      version:7,
      project:{name:'Operação Comercial',customer:'Obra na Mão',startFloor:0,targetFloor:2},
      settings:{defaultWorkStart:'07:30'},
      employees:[
        {id:'emp-foreman',name:'Encarregado Teste',compensationDays:0},
        {id:'emp-worker',name:'Funcionário Teste',compensationDays:0},
      ],
      floors:[],
      days:{
        [today]:{date:today,presentCount:0,absentCount:0,attendance:{},assignments:[],events:[],note:'',plans:[{id:'plan-1',service:'fixacao',floor:1,startTime:'07:30',employeeIds:['emp-worker'],note:'Fixação pavimento 1'}],sessions:[]}
      }
    });

    const adminRoutes=routes();
    const foremanCreated=await last(adminRoutes['POST /api/members'])({
      user,body:{email:'foreman@test.local',role:'foreman',employeeId:'emp-foreman',modules:['obra360','rdo'],channels:['mobile']},query:{},params:{}
    });
    expect(foremanCreated.status).toBe(200);
    const foremanMember=(await body(foremanCreated)).member;
    expect(foremanMember.role).toBe('foreman');
    expect(foremanMember.joinCode).toMatch(/^[A-Z0-9]{8}$/);

    const employeeCreated=await last(adminRoutes['POST /api/members'])({
      user,body:{email:'worker@test.local',role:'employee',employeeId:'emp-worker',modules:['obra360'],channels:['mobile']},query:{},params:{}
    });
    expect(employeeCreated.status).toBe(200);
    const employeeMember=(await body(employeeCreated)).member;
    expect(employeeMember.role).toBe('employee');

    const foremanUser={userId:'foreman-user',email:'foreman@test.local',name:'Foreman'};
    const foremanClaim=await last(adminRoutes['POST /api/access/claim'])({
      user:foremanUser,body:{code:foremanMember.joinCode},query:{},params:{}
    });
    expect(foremanClaim.status).toBe(200);

    const attendance=await last(adminRoutes['POST /api/attendance'])({
      user:foremanUser,body:{date:today,employeeId:'emp-worker',status:'present'},query:{},params:{}
    });
    expect(attendance.status).toBe(200);
    expect((await body(attendance)).day.attendance['emp-worker']).toBe('present');

    const employeeUser={userId:'worker-user',email:'worker@test.local',name:'Worker'};
    const employeeClaim=await last(adminRoutes['POST /api/access/claim'])({
      user:employeeUser,body:{code:employeeMember.joinCode},query:{},params:{}
    });
    expect(employeeClaim.status).toBe(200);

    const tasks=await last(adminRoutes['GET /api/my-tasks'])({
      user:employeeUser,body:{},query:{today},params:{}
    });
    expect(tasks.status).toBe(200);
    const taskData=await body(tasks);
    expect(taskData.employee.id).toBe('emp-worker');
    expect(taskData.tasks.some((task:Record<string,unknown>)=>task.id==='plan-1')).toBe(true);

    const employeeAttendanceAttempt=await last(adminRoutes['POST /api/attendance'])({
      user:employeeUser,body:{date:today,employeeId:'emp-worker',status:'absent'},query:{},params:{}
    });
    expect(employeeAttendanceAttempt.status).toBe(403);
    expect(bootstrap.membership.companyId).toBeTruthy();
  });

  it('validates Desktop -> Cloud -> Encarregado -> Desktop sync with idempotency',async()=>{
    const{user,data:bootstrap}=await ownerBootstrap();
    const companyId=String(bootstrap.membership.companyId),projectId=String(bootstrap.membership.projectId);
    await importState(user,{
      version:7,
      project:{name:'Operação Comercial',customer:'Obra na Mão',startFloor:0,targetFloor:2},
      settings:{defaultWorkStart:'07:30'},
      employees:[{id:'emp-field',name:'Encarregado Campo',phone:'16 99999-0099',compensationDays:0}],
      floors:[],
      days:{}
    });

    const requestId='desktop-request-p3-1234567890',secret='desktop-secret-p3-12345678901234567890',installationId='desktop-install-p3';
    expect((await last(routes()['POST /api/desktop/start'])({body:{requestId,secret,installationId,deviceName:'Desktop P3',platform:'win32'},query:{},params:{}})).status).toBe(200);
    expect((await last(routes()['POST /api/desktop/approve'])({user,body:{requestId,secret},query:{},params:{}})).status).toBe(200);
    const status=await last(routes()['POST /api/desktop/status'])({body:{requestId,secret},query:{},params:{}});
    const desktop=await body(status),deviceToken=String(desktop.deviceToken),deviceId=String(desktop.deviceId);
    expect(deviceToken).toBeTruthy();expect(deviceId).toBeTruthy();

    const change={
      changeId:'change-task-0001',
      entity:'tarefas_obra',
      action:'upsert',
      localId:101,
      baseMobileRevision:0,
      payload:{title:'Conferir fixação',status:'open',responsavel:'Equipe A'}
    };
    const push=await last(routes()['POST /api/desktop/sync/push'])({body:{deviceToken,changes:[change]},query:{},params:{}});
    expect(push.status).toBe(200);
    expect((await body(push)).accepted[0].status).toBe('accepted');

    const duplicate=await last(routes()['POST /api/desktop/sync/push'])({body:{deviceToken,changes:[change]},query:{},params:{}});
    expect(duplicate.status).toBe(200);
    expect((await body(duplicate)).accepted[0].status).toBe('duplicate');

    await ensureEducationPhoneParticipant({phone:'16 99999-0099',name:'Encarregado Campo',employeeId:'emp-field',companyId,companyName:'Obra na Mão',jobRole:'Encarregado'});
    await ensurePhoneAccess({phone:'16 99999-0099',name:'Encarregado Campo',employeeId:'emp-field',companyId,projectId,obraRole:'encarregado',universityRole:'colaborador'});
    const firstAccess=await last(EDUCATION_PHONE_ACCESS_ROUTES['POST /api/edu/first-access'])({body:{identifier:'16 99999-0099',password:'SenhaSegura123!'}});
    expect(firstAccess.status).toBe(200);
    const token=String((await body(firstAccess)).token);

    const mobileUpdate=await last(routes()['POST /api/phone/mobile/bridge/update'])({
      body:{token,entity:'tarefas_obra',localId:101,sourceDeviceId:deviceId,patch:{status:'done',observacoes:'Conferido em campo'}},query:{},params:{}
    });
    expect(mobileUpdate.status).toBe(200);

    const pull=await last(routes()['POST /api/desktop/sync/pull'])({body:{deviceToken,sinceRevision:0},query:{},params:{}});
    expect(pull.status).toBe(200);
    const pulled=await body(pull);
    expect(pulled.changed).toBe(true);
    const tasks=pulled.snapshot.desktopBridge.tasks as Array<Record<string,any>>;
    const task=tasks.find(item=>Number(item.localId)===101);
    expect(task.payload.status).toBe('done');
    expect(task.payload.observacoes).toBe('Conferido em campo');
    expect(task.sourceDeviceId).toBe(deviceId);
  });
});
