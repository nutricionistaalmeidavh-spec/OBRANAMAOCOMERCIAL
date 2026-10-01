import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../cloudflare/sdk', () => ({ runtimeEnv: () => ({ OWNER_COMPANY: 'Owner Company' }) }));

import { createLanServerAuthority } from './lan-server-authority';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite');

class TestD1 {
  db = new DatabaseSync(':memory:');

  constructor() {
    this.db.exec(`
      CREATE TABLE kv_records (
        collection TEXT NOT NULL,
        id TEXT NOT NULL,
        record_json TEXT NOT NULL,
        PRIMARY KEY(collection,id)
      );
    `);
  }

  prepare(sql: string) {
    const db = this.db;
    const make = (values: unknown[] = []) => ({
      bind: (...next: unknown[]) => make(next),
      first: async <T = Record<string, unknown>>() => db.prepare(sql).get(...values) as T | null,
      all: async <T = Record<string, unknown>>() => ({ results: db.prepare(sql).all(...values) as T[] }),
      run: async () => {
        const result = db.prepare(sql).run(...values);
        return { success: true, meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid || 0) } };
      },
    });
    return make();
  }

  put(collection: string, id: string, record: Record<string, unknown>) {
    this.db.prepare('INSERT OR REPLACE INTO kv_records(collection,id,record_json) VALUES(?,?,?)')
      .run(collection, id, JSON.stringify(record));
  }
}

describe('LAN granular permission snapshots', () => {
  function fixture() {
    const db = new TestD1();
    db.put('companies', 'company-a', {
      name: 'Empresa A',
      licensedModules: ['obra360', 'rdo', 'finance'],
      licensedChannels: ['desktop', 'mobile'],
    });
    return { db, authority: createLanServerAuthority({ db: db as any, nowMs: () => Date.parse('2026-10-01T12:00:00.000Z') }) };
  }

  it('publishes capped effective permissions and permission revision while preserving role/modules/channels', async () => {
    const { db, authority } = fixture();
    db.put('members_project-a', 'member-a', {
      companyId: 'company-a', projectId: 'project-a', email: 'a@example.test', role: 'employee',
      modules: ['obra360', 'finance', 'rh'], channels: ['desktop'],
      permissions: {
        core: ['view', 'edit'],
        operation: ['approve'],
        finance: ['view', 'approve'],
        rh: ['view'],
      },
    });

    const snapshot = await authority.lanServerSnapshot('company-a');
    expect(snapshot.members).toHaveLength(1);
    expect(snapshot.members[0]).toMatchObject({
      memberId: 'member-a', role: 'employee',
      modules: ['obra360', 'finance'], channels: ['desktop'],
      permissions: {
        core: ['view', 'edit'],
        operation: ['approve'],
        planning: [],
        finance: ['view', 'approve'],
        rh: [],
      },
    });
    expect(snapshot.members[0].permissionsRevision).toMatch(/^perm-v1-[a-f0-9]{8}$/);
  });

  it('uses the role template for a legacy member without stored permissions', async () => {
    const { db, authority } = fixture();
    db.put('members_project-a', 'member-foreman', {
      companyId: 'company-a', projectId: 'project-a', email: 'foreman@example.test', role: 'foreman',
      modules: ['obra360', 'rdo'], channels: ['desktop'],
    });

    const member = (await authority.lanServerSnapshot('company-a')).members[0];
    expect(member.permissions).toMatchObject({
      core: ['view', 'create', 'edit'],
      operation: ['view', 'create', 'edit', 'approve'],
      planning: ['view', 'edit'],
      finance: [], rh: [],
    });
  });

  it('changes snapshot revision when only effective permissions change', async () => {
    const { db, authority } = fixture();
    const base = {
      companyId: 'company-a', projectId: 'project-a', email: 'a@example.test', role: 'employee',
      modules: ['obra360'], channels: ['desktop'],
      permissions: { core: ['view'] },
    };
    db.put('members_project-a', 'member-a', base);
    const first = await authority.lanServerSnapshot('company-a');

    db.put('members_project-a', 'member-a', { ...base, permissions: { core: ['view', 'edit'] } });
    const second = await authority.lanServerSnapshot('company-a');

    expect(second.members[0].permissionsRevision).not.toBe(first.members[0].permissionsRevision);
    expect(second.revision).not.toBe(first.revision);
  });

  it('removing a company module removes its effective domain permissions without deleting stored member intent', async () => {
    const { db, authority } = fixture();
    db.put('members_project-a', 'member-a', {
      companyId: 'company-a', projectId: 'project-a', email: 'a@example.test', role: 'admin',
      modules: ['obra360', 'finance'], channels: ['desktop'],
      permissions: { core: ['view'], finance: ['view', 'approve'] },
    });
    const before = await authority.lanServerSnapshot('company-a');
    expect(before.members[0].permissions.finance).toEqual(['view', 'approve']);

    db.put('companies', 'company-a', {
      name: 'Empresa A', licensedModules: ['obra360'], licensedChannels: ['desktop', 'mobile'],
    });
    const after = await authority.lanServerSnapshot('company-a');
    expect(after.members[0].permissions.finance).toEqual([]);
    expect(after.members[0].modules).toEqual(['obra360']);
  });
});
