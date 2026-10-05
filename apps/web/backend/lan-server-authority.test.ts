import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createLanServerAuthority } from './lan-server-authority';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite');
const migrationPath = new URL('../cloudflare/migrations/0010_lan_server_security.sql', import.meta.url);

class TestD1 {
  db = new DatabaseSync(':memory:');

  constructor() {
    this.db.exec(readFileSync(migrationPath, 'utf8'));
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS lan_device_enrollments (
        id TEXT PRIMARY KEY,
        token_hash TEXT NOT NULL UNIQUE,
        server_id TEXT NOT NULL,
        company_id TEXT NOT NULL,
        member_id TEXT NOT NULL,
        cloud_device_id TEXT NOT NULL,
        installation_id TEXT NOT NULL,
        device_name TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        consumed_at TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_lan_device_enrollments_token_hash ON lan_device_enrollments(token_hash);
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
}

describe('LAN server authority persistence', () => {
  it('creates normalized claim/grant tables and lookup indexes', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    const db = new DatabaseSync(':memory:');
    db.exec(sql);

    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map((row: any) => row.name);
    expect(tables).toContain('lan_server_claims');
    expect(tables).toContain('lan_server_grants');

    const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' ORDER BY name").all().map((row: any) => row.name);
    expect(indexes).toContain('idx_lan_server_claims_token_hash');
    expect(indexes).toContain('idx_lan_server_claims_server_company');
    expect(indexes).toContain('idx_lan_server_grants_token_hash');
    expect(indexes).toContain('idx_lan_server_grants_server_company');
  });

  it('stores only claim digest and redeems exactly one matching live claim', async () => {
    const db = new TestD1();
    let now = Date.parse('2026-09-29T20:00:00.000Z');
    const authority = createLanServerAuthority({ db: db as any, nowMs: () => now });

    const claim = await authority.createLanClaim({
      companyId: 'company-a',
      serverId: 'server-a',
      issuedByDeviceId: 'device-admin',
      issuedByMemberId: 'member-admin',
    });

    expect(claim.claimToken.length).toBeGreaterThanOrEqual(32);
    expect(Date.parse(claim.expiresAt) - now).toBe(10 * 60 * 1000);

    const stored = db.db.prepare('SELECT token_hash, consumed_at FROM lan_server_claims').get() as any;
    expect(stored.token_hash).not.toBe(claim.claimToken);
    expect(stored.token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.consumed_at).toBeNull();

    await expect(authority.redeemLanClaim({ serverId: 'server-other', claimToken: claim.claimToken })).rejects.toThrow(/claim/i);

    const redeemed = await authority.redeemLanClaim({ serverId: 'server-a', claimToken: claim.claimToken });
    expect(redeemed.companyId).toBe('company-a');
    expect(redeemed.claimingMemberId).toBe('member-admin');
    expect(redeemed.serverToken.length).toBeGreaterThanOrEqual(32);

    const grant = db.db.prepare('SELECT token_hash, status FROM lan_server_grants').get() as any;
    expect(grant.token_hash).not.toBe(redeemed.serverToken);
    expect(grant.token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(grant.status).toBe('active');

    await expect(authority.redeemLanClaim({ serverId: 'server-a', claimToken: claim.claimToken })).rejects.toThrow(/claim/i);

    const authenticated = await authority.authenticateLanServer(redeemed.serverToken);
    expect(authenticated).toMatchObject({ serverId: 'server-a', companyId: 'company-a' });
  });

  it('rejects an expired claim and revoked server grant', async () => {
    const db = new TestD1();
    let now = Date.parse('2026-09-29T20:00:00.000Z');
    const authority = createLanServerAuthority({ db: db as any, nowMs: () => now });
    const claim = await authority.createLanClaim({
      companyId: 'company-a',
      serverId: 'server-expiring',
      issuedByDeviceId: 'device-admin',
      issuedByMemberId: 'member-admin',
    });

    now += 10 * 60 * 1000 + 1;
    await expect(authority.redeemLanClaim({ serverId: 'server-expiring', claimToken: claim.claimToken })).rejects.toThrow(/expir|claim/i);

    now = Date.parse('2026-09-29T21:00:00.000Z');
    const live = await authority.createLanClaim({
      companyId: 'company-a',
      serverId: 'server-live',
      issuedByDeviceId: 'device-admin',
      issuedByMemberId: 'member-admin',
    });
    const redeemed = await authority.redeemLanClaim({ serverId: 'server-live', claimToken: live.claimToken });
    expect(await authority.authenticateLanServer(redeemed.serverToken)).not.toBeNull();

    await authority.revokeLanServerGrant({ serverId: 'server-live', companyId: 'company-a' });
    expect(await authority.authenticateLanServer(redeemed.serverToken)).toBeNull();
  });


  it('issues a one-use device enrollment bound to company, member, server and installation', async () => {
    const db = new TestD1();
    const now = Date.parse('2026-10-05T18:00:00.000Z');
    const authority = createLanServerAuthority({ db: db as any, nowMs: () => now });

    const claim = await authority.createLanClaim({
      companyId:'company-a', serverId:'server-a', issuedByDeviceId:'admin-device', issuedByMemberId:'admin-member'
    });
    const grant = await authority.redeemLanClaim({ serverId:'server-a', claimToken:claim.claimToken });

    const enrollment = await authority.createDeviceEnrollment({
      companyId:'company-a', serverId:'server-a', memberId:'member-a',
      cloudDeviceId:'cloud-device-a', installationId:'install-a', deviceName:'PC João'
    });
    expect(enrollment.enrollmentToken).toMatch(/^[a-f0-9]{64}$/);
    const stored = db.db.prepare('SELECT token_hash,consumed_at FROM lan_device_enrollments').get() as any;
    expect(stored.token_hash).not.toBe(enrollment.enrollmentToken);
    expect(stored.consumed_at).toBeNull();

    await expect(authority.redeemDeviceEnrollment({
      serverToken:grant.serverToken, serverId:'server-a', enrollmentToken:enrollment.enrollmentToken, installationId:'install-other'
    })).rejects.toThrow(/instalação/i);

    const redeemed = await authority.redeemDeviceEnrollment({
      serverToken:grant.serverToken, serverId:'server-a', enrollmentToken:enrollment.enrollmentToken, installationId:'install-a'
    });
    expect(redeemed).toMatchObject({
      companyId:'company-a', serverId:'server-a', memberId:'member-a',
      cloudDeviceId:'cloud-device-a', installationId:'install-a', deviceName:'PC João'
    });
    await expect(authority.redeemDeviceEnrollment({
      serverToken:grant.serverToken, serverId:'server-a', enrollmentToken:enrollment.enrollmentToken, installationId:'install-a'
    })).rejects.toThrow(/utiliz|inválid|expir/i);
  });
});
