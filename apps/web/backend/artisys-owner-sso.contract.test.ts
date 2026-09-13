import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const worker = readFileSync(new URL('../cloudflare/worker.ts', import.meta.url), 'utf8');
const sso = readFileSync(new URL('./artisys-owner-sso.ts', import.meta.url), 'utf8');

describe('ArtiSys owner SSO broker', () => {
  it('reuses the existing Google OAuth callback and exposes one-time SSO exchange routes', () => {
    expect(worker).toContain("'/api/auth/callback'");
    expect(worker).toContain('handleArtisysOwnerSso');
    expect(sso).toContain('/api/artisys-sso/start');
    expect(sso).toContain('/api/artisys-sso/redeem');
    expect(sso).toContain("'/api/auth/callback'");
    expect(sso).toContain('https://deboralactacao.com/admin/seo/');
  });

  it('allows only the configured owner identity and one-time short-lived codes', () => {
    expect(sso).toContain('OWNER_EMAIL');
    expect(sso).toMatch(/DELETE FROM artisys_sso_codes/i);
    expect(sso).toMatch(/10\s*\*\s*60\s*\*\s*1000/);
    expect(sso).toMatch(/email_verified/i);
  });
});
