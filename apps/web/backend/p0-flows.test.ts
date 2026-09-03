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
