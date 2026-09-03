import { beforeEach, describe, expect, it, vi } from 'vitest';

const memory = vi.hoisted(() => {
  let sequence = 0;
  const collections = new Map<string, Map<string, Record<string, unknown>>>();
  const bucket = (name: string) => {
    let value = collections.get(name);
    if (!value) { value = new Map(); collections.set(name, value); }
    return value;
  };
  const db = {
    async list<T = Record<string, unknown>>(collection: string, options: { limit?: number } = {}) {
      const limit = Math.max(1, Number(options.limit || 100));
      const items = [...bucket(collection).entries()].slice(-limit).reverse()
        .map(([id, record]) => ({ ...structuredClone(record), id })) as Array<T & { id: string }>;
      return { items };
    },
    async get<T = Record<string, unknown>>(collection: string, ids: string[]) {
      return ids.flatMap(id => {
        const record = bucket(collection).get(String(id));
        return record ? [{ ...structuredClone(record), id }] : [];
      }) as Array<T & { id: string }>;
    },
    async add(collection: string, records: Array<Record<string, unknown>>) {
      const ids: string[] = [];
      for (const record of records) {
        const id = 'test_' + (++sequence);
        const clean = structuredClone(record);
        delete clean.id;
        bucket(collection).set(id, clean);
        ids.push(id);
      }
      return ids;
    },
    async update(collection: string, changes: Array<{ id: string; record: Record<string, unknown> }>) {
      for (const change of changes) {
        const clean = structuredClone(change.record);
        delete clean.id;
        bucket(collection).set(String(change.id), clean);
      }
      return changes.map(change => change.id);
    },
    async delete(collection: string, ids: string[]) {
      for (const id of ids) bucket(collection).delete(String(id));
      return true;
    },
  };
  return {
    db,
    reset() { sequence = 0; collections.clear(); },
    env: {
      OWNER_EMAIL: 'owner@example.com',
      OWNER_COMPANY: 'Obra na Mão',
      OWNER_PROJECT: 'Operação Comercial',
      OWNER_CUSTOMER: 'Obra na Mão',
      DB: {
        prepare() {
          return {
            bind() { return this; },
            async run() { return { success: true }; },
            async first() { return null; },
            async all() { return { results: [] }; },
          };
        },
      },
    },
  };
});

vi.mock('../cloudflare/sdk', () => ({
  db: memory.db,
  json: (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } }),
  error: (message: string, status = 400) => new Response(JSON.stringify({ error: message }), { status, headers: { 'content-type': 'application/json' } }),
  requireAuth: () => async () => undefined,
  withScopes: () => async () => undefined,
  requireAdminEmailAllowlist: () => async () => undefined,
  runtimeEnv: () => memory.env,
  recentErrorDiagnostics: vi.fn(async () => []),
  router: (routes: Record<string, unknown>) => ({ routes, fetch: vi.fn() }),
  storage: { write: vi.fn() },
  ai: { extract: vi.fn(), ocr: vi.fn() },
}));

import {
  EDUCATION_PHONE_ACCESS_ROUTES,
  EDUCATION_ROUTES,
  createCentralEducationSession,
  ensureEducationPhoneParticipant,
  syncEducationIdentityByEmail,
} from './education';
import { EDUCATION_PRACTICE_ROUTES } from './education-practice';
import { ensurePhoneAccess } from './phone-access';
import { handler } from './index';
import { publishMobileSummary } from './e06e09';

const body = async (response: Response) => await response.json() as Record<string, any>;
const last = (route: readonly unknown[]) => route[route.length - 1] as (ctx: any) => Promise<Response>;

describe('P0 critical web flows', () => {
  beforeEach(() => memory.reset());

  it('supports first access and subsequent phone/password login', async () => {
    await ensureEducationPhoneParticipant({
      phone: '16 99999-0001',
      name: 'Colaborador Teste',
      employeeId: 'emp-login',
      companyId: 'company-a',
      companyName: 'Empresa A',
    });

    const statusResponse = await last(EDUCATION_PHONE_ACCESS_ROUTES['POST /api/edu/access-status'])({
      body: { identifier: '16 99999-0001' },
    });
    expect(statusResponse.status).toBe(200);
    const status = await body(statusResponse);
    expect(status.needsPasswordSetup).toBe(true);
    expect(status.participant.phone).toBeUndefined();
    expect(status.participant.email).toBeUndefined();

    const firstAccess = await last(EDUCATION_PHONE_ACCESS_ROUTES['POST /api/edu/first-access'])({
      body: { identifier: '16 99999-0001', password: 'SenhaSegura123!' },
    });
    expect(firstAccess.status).toBe(200);
    expect((await body(firstAccess)).token).toBeTruthy();

    const wrong = await last(EDUCATION_ROUTES['POST /api/edu/login'])({
      body: { identifier: '16 99999-0001', password: 'SenhaErrada123!' },
    });
    expect(wrong.status).toBe(401);

    const login = await last(EDUCATION_ROUTES['POST /api/edu/login'])({
      body: { identifier: '16 99999-0001', password: 'SenhaSegura123!' },
    });
    expect(login.status).toBe(200);
    expect((await body(login)).token).toBeTruthy();
  });

  it('blocks University admin access across companies', async () => {
    const admin = await createCentralEducationSession({ email: 'admin@a.test', name: 'Admin A', role: 'admin' });
    await syncEducationIdentityByEmail({ email: 'admin@a.test', companyId: 'company-a', companyName: 'Empresa A' });

    const worker = await createCentralEducationSession({ email: 'worker@b.test', name: 'Worker B', role: 'colaborador' });
    await syncEducationIdentityByEmail({ email: 'worker@b.test', companyId: 'company-b', companyName: 'Empresa B' });

    const response = await last(EDUCATION_ROUTES['POST /api/edu/admin/participant'])({
      body: { token: admin.token, participantId: worker.participant.id },
    });
    expect(response.status).toBe(403);
    expect((await body(response)).error).toContain('fora da sua empresa');
  });

  it('loads an obra snapshot and records attendance under the authenticated project scope', async () => {
    const routes = (handler as unknown as { routes: Record<string, readonly unknown[]> }).routes;
    const user = { userId: 'owner-user', email: 'owner@example.com', name: 'Owner' };

    const bootstrap = await last(routes['GET /api/bootstrap'])({ user, body: {}, query: {}, params: {} });
    expect(bootstrap.status).toBe(200);
    const bootstrapData = await body(bootstrap);
    expect(bootstrapData.needsClaim).toBe(false);

    const snapshot = {
      version: 6,
      project: { name: 'Operação Comercial', customer: 'Obra na Mão', startFloor: 0, targetFloor: 1 },
      settings: { defaultWorkStart: '07:30' },
      employees: [{ id: 'emp-1', name: 'João', compensationDays: 0 }],
      floors: [],
      days: {
        '2026-09-02': {
          date: '2026-09-02',
          presentCount: 0,
          absentCount: 0,
          attendance: {},
          assignments: [],
          events: [],
          note: '',
          plans: [],
          sessions: [],
        },
      },
    };

    const imported = await last(routes['POST /api/project/import'])({
      user, body: { state: snapshot }, query: {}, params: {},
    });
    expect(imported.status).toBe(200);

    const project = await last(routes['GET /api/project'])({
      user, body: {}, query: { date: '2026-09-02' }, params: {},
    });
    expect(project.status).toBe(200);
    expect((await body(project)).state.employees).toHaveLength(1);

    const attendance = await last(routes['POST /api/attendance'])({
      user,
      body: { date: '2026-09-02', employeeId: 'emp-1', status: 'present' },
      query: {},
      params: {},
    });
    expect(attendance.status).toBe(200);
    const attendanceData = await body(attendance);
    expect(attendanceData.day.presentCount).toBe(1);
    expect(attendanceData.day.attendance['emp-1']).toBe('present');
  });

  it('authorizes the mobile foreman only inside the linked company and project', async () => {
    const routes = (handler as unknown as { routes: Record<string, readonly unknown[]> }).routes;
    const user = { userId: 'owner-user', email: 'owner@example.com', name: 'Owner' };

    const bootstrap = await last(routes['GET /api/bootstrap'])({ user, body: {}, query: {}, params: {} });
    const bootstrapData = await body(bootstrap);
    const companyId = String(bootstrapData.membership.companyId);
    const projectId = String(bootstrapData.membership.projectId);

    const snapshot = {
      version: 6,
      project: { name: 'Operação Comercial', customer: 'Obra na Mão', startFloor: 0, targetFloor: 1 },
      settings: { defaultWorkStart: '07:30' },
      employees: [{ id: 'emp-field', name: 'Encarregado', phone: '16 99999-0003', compensationDays: 0 }],
      floors: [],
      days: {},
    };
    const imported = await last(routes['POST /api/project/import'])({ user, body: { state: snapshot }, query: {}, params: {} });
    expect(imported.status).toBe(200);

    await ensureEducationPhoneParticipant({
      phone: '16 99999-0003',
      name: 'Encarregado',
      employeeId: 'emp-field',
      companyId,
      companyName: 'Obra na Mão',
      jobRole: 'Encarregado',
    });
    await ensurePhoneAccess({
      phone: '16 99999-0003',
      name: 'Encarregado',
      employeeId: 'emp-field',
      companyId,
      projectId,
      obraRole: 'encarregado',
      universityRole: 'colaborador',
    });
    const firstAccess = await last(EDUCATION_PHONE_ACCESS_ROUTES['POST /api/edu/first-access'])({
      body: { identifier: '16 99999-0003', password: 'SenhaSegura123!' },
    });
    const token = String((await body(firstAccess)).token);

    const mobile = await last(routes['POST /api/phone/bootstrap'])({
      body: { token }, query: {}, params: {},
    });
    expect(mobile.status).toBe(200);
    const mobileData = await body(mobile);
    expect(mobileData.membership.companyId).toBe(companyId);
    expect(mobileData.membership.projectId).toBe(projectId);
    expect(mobileData.role).toBe('foreman');
  });

  it('pairs a desktop, hashes the temporary secret and opens a bounded device session', async () => {
    const routes = (handler as unknown as { routes: Record<string, readonly unknown[]> }).routes;
    const user = { userId: 'owner-user', email: 'owner@example.com', name: 'Owner' };
    await last(routes['GET /api/bootstrap'])({ user, body: {}, query: {}, params: {} });

    const requestId = 'desktop-request-12345678901234567890';
    const secret = 'desktop-secret-123456789012345678901234567890';
    const installationId = 'installation-1234567890';

    const start = await last(routes['POST /api/desktop/start'])({
      body: { requestId, secret, installationId, deviceName: 'PC Teste', platform: 'win32' },
      query: {}, params: {},
    });
    expect(start.status).toBe(200);

    const approve = await last(routes['POST /api/desktop/approve'])({
      user,
      body: { requestId, secret },
      query: {},
      params: {},
    });
    expect(approve.status).toBe(200);

    const status = await last(routes['POST /api/desktop/status'])({
      body: { requestId, secret },
      query: {},
      params: {},
    });
    expect(status.status).toBe(200);
    const statusData = await body(status);
    expect(statusData.status).toBe('approved');
    expect(statusData.deviceToken).toBeTruthy();

    const session = await last(routes['POST /api/desktop/session'])({
      body: { deviceToken: statusData.deviceToken },
      query: {},
      params: {},
    });
    expect(session.status).toBe(200);
    expect((await body(session)).authorized).toBe(true);

    const authRecords = await memory.db.list('desktop_auth_' + requestId.replace(/[^a-zA-Z0-9_-]/g, '_'), { limit: 1 });
    expect(authRecords.items[0]).toBeDefined();
    expect((authRecords.items[0] as Record<string, unknown>).secret).toBeUndefined();
    expect((authRecords.items[0] as Record<string, unknown>).secretHash).toBeTruthy();

    const devices = await memory.db.list('devices', { limit: 10 });
    expect((devices.items[0] as Record<string, unknown>).tokenExpiresAt).toBeTruthy();
  });

  it('validates Admin → Foreman → Employee permissions without a presencial user', async () => {
    const routes = (handler as unknown as { routes: Record<string, readonly unknown[]> }).routes;
    const adminUser = { userId: 'admin-owner', email: 'owner@example.com', name: 'Admin' };
    const bootstrap = await last(routes['GET /api/bootstrap'])({ user: adminUser, body: {}, query: {}, params: {} });
    expect(bootstrap.status).toBe(200);

    const snapshot = {
      version: 7,
      project: { name: 'Operação Comercial', customer: 'Obra na Mão', startFloor: 0, targetFloor: 2 },
      settings: { defaultWorkStart: '07:30' },
      employees: [
        { id: 'emp-foreman', name: 'Encarregado Teste', compensationDays: 0 },
        { id: 'emp-worker', name: 'Funcionário Teste', compensationDays: 0 },
      ],
      floors: [],
      days: {
        '2026-09-03': { date:'2026-09-03', presentCount:0, absentCount:0, attendance:{}, assignments:[], events:[], note:'', plans:[], sessions:[] },
      },
    };
    expect((await last(routes['POST /api/project/import'])({ user: adminUser, body: { state: snapshot }, query:{}, params:{} })).status).toBe(200);

    const foremanCreate = await last(routes['POST /api/members'])({
      user: adminUser,
      body: { email:'foreman@test.local', role:'foreman', employeeId:'emp-foreman', modules:['obra360','rdo'], channels:['mobile'] },
      query:{}, params:{},
    });
    expect(foremanCreate.status).toBe(200);
    const foremanMember = (await body(foremanCreate)).member;

    const workerCreate = await last(routes['POST /api/members'])({
      user: adminUser,
      body: { email:'worker@test.local', role:'employee', employeeId:'emp-worker', modules:['obra360'], channels:['mobile'] },
      query:{}, params:{},
    });
    expect(workerCreate.status).toBe(200);
    const workerMember = (await body(workerCreate)).member;

    const foremanUser = { userId:'foreman-user', email:'foreman@test.local', name:'Encarregado Teste' };
    const foremanClaim = await last(routes['POST /api/access/claim'])({
      user: foremanUser, body:{ code:foremanMember.joinCode }, query:{}, params:{},
    });
    expect(foremanClaim.status).toBe(200);
    expect((await body(foremanClaim)).role).toBe('foreman');

    const foremanBootstrap = await last(routes['GET /api/bootstrap'])({ user:foremanUser, body:{}, query:{}, params:{} });
    expect(foremanBootstrap.status).toBe(200);
    expect((await body(foremanBootstrap)).role).toBe('foreman');

    const foremanProject = await last(routes['GET /api/project'])({ user:foremanUser, body:{}, query:{date:'2026-09-03'}, params:{} });
    expect(foremanProject.status).toBe(200);

    const markWorker = await last(routes['POST /api/attendance'])({
      user:foremanUser, body:{date:'2026-09-03',employeeId:'emp-worker',status:'present'}, query:{}, params:{},
    });
    expect(markWorker.status).toBe(200);
    expect((await body(markWorker)).day.attendance['emp-worker']).toBe('present');

    const workerUser = { userId:'worker-user', email:'worker@test.local', name:'Funcionário Teste' };
    const workerClaim = await last(routes['POST /api/access/claim'])({
      user:workerUser, body:{code:workerMember.joinCode}, query:{}, params:{},
    });
    expect(workerClaim.status).toBe(200);
    expect((await body(workerClaim)).role).toBe('employee');

    const workerBootstrap = await last(routes['GET /api/bootstrap'])({ user:workerUser, body:{}, query:{}, params:{} });
    expect(workerBootstrap.status).toBe(200);
    expect((await body(workerBootstrap)).role).toBe('employee');

    const workerTasks = await last(routes['GET /api/my-tasks'])({ user:workerUser, body:{}, query:{today:'2026-09-03'}, params:{} });
    expect(workerTasks.status).toBe(200);

    const employeeProject = await last(routes['GET /api/project'])({ user:workerUser, body:{}, query:{date:'2026-09-03'}, params:{} });
    expect(employeeProject.status).toBe(403);
  });

  it('validates Desktop ↔ mobile synchronization on the canonical project state', async () => {
    const routes = (handler as unknown as { routes: Record<string, readonly unknown[]> }).routes;
    const adminUser = { userId:'sync-owner', email:'owner@example.com', name:'Admin Sync' };
    const bootstrap = await last(routes['GET /api/bootstrap'])({ user:adminUser, body:{}, query:{}, params:{} });
    const bootstrapData = await body(bootstrap);
    const companyId = String(bootstrapData.membership.companyId), projectId = String(bootstrapData.membership.projectId);

    const snapshot = {
      version:7,
      project:{name:'Operação Comercial',customer:'Obra na Mão',startFloor:0,targetFloor:2},
      settings:{defaultWorkStart:'07:30'},
      employees:[{id:'emp-sync-foreman',name:'Encarregado Sync',phone:'16 99999-0100',compensationDays:0}],
      floors:[],
      days:{},
    };
    expect((await last(routes['POST /api/project/import'])({user:adminUser,body:{state:snapshot},query:{},params:{}})).status).toBe(200);

    await ensureEducationPhoneParticipant({
      phone:'16 99999-0100',name:'Encarregado Sync',employeeId:'emp-sync-foreman',companyId,companyName:'Obra na Mão',jobRole:'Encarregado',
    });
    await ensurePhoneAccess({
      phone:'16 99999-0100',name:'Encarregado Sync',employeeId:'emp-sync-foreman',companyId,projectId,obraRole:'encarregado',universityRole:'colaborador',
    });
    const firstAccess = await last(EDUCATION_PHONE_ACCESS_ROUTES['POST /api/edu/first-access'])({
      body:{identifier:'16 99999-0100',password:'SenhaSegura123!'},
    });
    const phoneToken=String((await body(firstAccess)).token);

    const requestId='sync-desktop-request-123456789012345';
    const secret='sync-desktop-secret-123456789012345678901234';
    const installationId='sync-installation-123456';
    expect((await last(routes['POST /api/desktop/start'])({body:{requestId,secret,installationId,deviceName:'Desktop Sync',platform:'win32'},query:{},params:{}})).status).toBe(200);
    expect((await last(routes['POST /api/desktop/approve'])({user:adminUser,body:{requestId,secret},query:{},params:{}})).status).toBe(200);
    const status = await last(routes['POST /api/desktop/status'])({body:{requestId,secret},query:{},params:{}});
    const desktop = await body(status);
    const deviceToken=String(desktop.deviceToken),deviceId=String(desktop.deviceId);
    expect(deviceToken).toBeTruthy();

    const push = await last(routes['POST /api/desktop/sync/push'])({
      body:{deviceToken,changes:[{
        changeId:'change-sync-000001',entity:'tarefas_obra',action:'upsert',localId:101,baseMobileRevision:0,
        payload:{titulo:'Instalar prumada',status:'open',responsavel:'Equipe A'}
      }]},query:{},params:{},
    });
    expect(push.status).toBe(200);
    expect((await body(push)).accepted[0].status).toBe('accepted');

    const mobileUpdate = await last(routes['POST /api/phone/mobile/bridge/update'])({
      body:{token:phoneToken,entity:'tarefas_obra',localId:101,sourceDeviceId:deviceId,patch:{status:'done',responsavel:'Equipe B'}},
      query:{},params:{},
    });
    expect(mobileUpdate.status).toBe(200);

    const pull = await last(routes['POST /api/desktop/sync/pull'])({
      body:{deviceToken,sinceRevision:0},query:{},params:{},
    });
    expect(pull.status).toBe(200);
    const pulled=await body(pull);
    expect(pulled.changed).toBe(true);
    const tasks=pulled.snapshot.desktopBridge.tasks;
    expect(tasks).toHaveLength(1);
    expect(tasks[0].payload.status).toBe('done');
    expect(tasks[0].payload.responsavel).toBe('Equipe B');
  });

  it('persists a valid native practice run for the signed-in participant', async () => {
    await ensureEducationPhoneParticipant({
      phone: '16 99999-0002',
      name: 'Prática Teste',
      employeeId: 'emp-practice',
      companyId: 'company-a',
      companyName: 'Empresa A',
    });
    const firstAccess = await last(EDUCATION_PHONE_ACCESS_ROUTES['POST /api/edu/first-access'])({
      body: { identifier: '16 99999-0002', password: 'SenhaSegura123!' },
    });
    const token = (await body(firstAccess)).token as string;

    const response = await last(EDUCATION_PRACTICE_ROUTES['POST /api/edu/practice/run'])({
      body: {
        token,
        record: {
          runId: 'run-1',
          activityId: 'domino-adicao-n2',
          baseActivityId: 'domino-adicao-n2',
          skillId: 'math.addition',
          difficulty: 2,
          curriculumRefs: ['adicao-N2'],
          originUnitId: 'adicao-N2',
          unitId: 'adicao-N2',
          gameType: 'domino-math',
          score: 100,
          correctAnswers: 3,
          mistakes: 0,
          hintsUsed: 0,
          durationSec: 30,
          completedAt: '2026-09-02T12:00:00.000Z',
        },
      },
    });
    expect(response.status).toBe(200);
    const data = await body(response);
    expect(data.record.runId).toBe('run-1');
    expect(data.record.skillId).toBe('math.addition');
  });
});


describe('Commercial portal overview API boundaries', () => {
  beforeEach(() => memory.reset());
  const routes = (handler as unknown as { routes: Record<string, readonly unknown[]> }).routes;
  const owner = {userId:'owner-id',email:'owner@example.com',name:'Owner'};
  const call = (route:string,user?:Record<string,string>,payload:Record<string,unknown>={}) => last(routes[route])({user,body:payload,query:{projectId:'other-project',companyId:'other-company'},params:{}});
  async function setup(role:string, modules:string[]) {
    const bootstrap=await body(await call('GET /api/bootstrap',owner));
    const companyId=bootstrap.company.id,projectId=bootstrap.project.id;
    await call('POST /api/project/import',owner,{state:{project:{name:'Test'},employees:[{id:'employee-portal',name:'Employee'}],floors:[],days:{}}});
    const user={userId:'portal-user',email:'portal@example.test',name:'Portal User'};
    const created=await call('POST /api/members',owner,{email:user.email,role,modules,channels:['mobile'],employeeId:role==='employee'?'employee-portal':undefined});
    expect(created.status).toBe(200);
    const member=await body(await call('GET /api/bootstrap',user));
    await publishMobileSummary(projectId,'desktop-a',{generatedAt:'2026-09-03T14:20:00Z',privateField:'secret',modules:{dre:{result:5400000,payroll:'secret'},documents:{expiring30d:3},contracts:{active:8},measurements:{open:6},rh:{employees:['secret']}}});
    await publishMobileSummary('other-project','desktop-b',{modules:{documents:{expiring30d:999}}});
    return {user,member,companyId,projectId};
  }
  it('rejects requests without a corporate identity, including phone tokens alone', async () => {
    expect((await call('GET /api/portal/overview',undefined,{token:'phone-token'})).status).toBe(401);
  });
  it.each(['employee','foreman'])('denies direct API calls by %s despite assigned management modules', async role => {
    const {user}=await setup(role,['obra360','dre','contracts','documents']);
    const response=await call('GET /api/portal/overview',user);
    expect(response.status).toBe(403);expect(JSON.stringify(await body(response))).not.toContain('5400000');
  });
  it('returns only authorized aggregates from the membership project and disables caching', async () => {
    const {user}=await setup('admin',['documents']);
    const response=await call('GET /api/portal/overview',user);
    expect(response.status).toBe(200);expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await body(response)).toEqual({updatedAt:'2026-09-03T14:20:00.000Z',metrics:[],attention:[{key:'documents',label:'Documentos a vencer em 30 dias',value:3,kind:'count'}]});
  });
  it.each(['disabled','blocked','pending','wrong-company','wrong-project'])('denies %s management grants even with an administrative membership', async condition => {
    const {user,member}=await setup('admin',['dre','documents']);
    const [access]=await memory.db.get<any>('platform_accesses',[member.platformAccess.id]);
    if(condition==='disabled')access.systems.gestao.enabled=false;
    if(condition==='blocked'||condition==='pending')access.status=condition;
    if(condition==='wrong-company')access.companyIds=['other-company'];
    if(condition==='wrong-project')access.projectIds=['other-project'];
    await memory.db.update('platform_accesses',[{id:access.id,record:access}]);
    expect((await call('GET /api/portal/overview',user)).status).toBe(403);
  });
});
