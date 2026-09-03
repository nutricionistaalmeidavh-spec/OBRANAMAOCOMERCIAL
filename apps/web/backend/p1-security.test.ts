import { describe, expect, it } from 'vitest';
import { AUTH_SESSION_MAX_AGE_SECONDS, AUTH_SESSION_TTL_MS, authHintCookie, rateLimitPolicy, sameOriginMutationAllowed } from '../cloudflare/sdk';
import { contextOwnsScope, type PlatformContext } from './platform-context';
import { educationRoleChangeDecision } from './access-control';

describe('P1 security policies', () => {
  it('keeps authenticated web sessions bounded to one day', () => {
    expect(AUTH_SESSION_TTL_MS).toBe(24 * 60 * 60 * 1000);
    expect(AUTH_SESSION_MAX_AGE_SECONDS).toBe(86_400);
    expect(authHintCookie()).toBe('obn_auth=1; Path=/; Secure; SameSite=Lax; Max-Age=86400');
  });

  it('rate-limits sensitive authentication and activation endpoints', () => {
    expect(rateLimitPolicy('POST', '/api/edu/login')).toMatchObject({ limit: 10, windowSeconds: 600 });
    expect(rateLimitPolicy('POST', '/api/edu/first-access')).toMatchObject({ limit: 6, windowSeconds: 900 });
    expect(rateLimitPolicy('POST', '/api/license/claim')).not.toBeNull();
    expect(rateLimitPolicy('POST', '/api/desktop/start')).not.toBeNull();
    expect(rateLimitPolicy('GET', '/api/platform/help')).toBeNull();
  });

  it('rejects cross-site mutations when the cookie session is present', () => {
    const crossSite = new Request('https://example.test/api/project/state', {
      method: 'PUT',
      headers: {
        cookie: 'obn_session=abc',
        origin: 'https://evil.test',
        'sec-fetch-site': 'cross-site',
      },
    });
    expect(sameOriginMutationAllowed(crossSite)).toBe(false);

    const sameOrigin = new Request('https://example.test/api/project/state', {
      method: 'PUT',
      headers: {
        cookie: 'obn_session=abc',
        origin: 'https://example.test',
        'sec-fetch-site': 'same-origin',
      },
    });
    expect(sameOriginMutationAllowed(sameOrigin)).toBe(true);

    const tokenOnly = new Request('https://example.test/api/phone/attendance', {
      method: 'POST',
      headers: { origin: 'https://another-client.test', 'sec-fetch-site': 'cross-site' },
    });
    expect(sameOriginMutationAllowed(tokenOnly)).toBe(true);
  });

  it('enforces company and project scope deterministically', () => {
    const ctx: PlatformContext = {
      userId: 'u1',
      platformRole: 'user',
      role: 'admin',
      companyId: 'company-a',
      companyName: 'A',
      projectId: 'project-a',
      systems: {},
      channels: ['mobile'],
      modules: ['obra360'],
    };
    expect(contextOwnsScope(ctx, 'company-a', 'project-a')).toBe(true);
    expect(contextOwnsScope(ctx, 'company-b', 'project-a')).toBe(false);
    expect(contextOwnsScope(ctx, 'company-a', 'project-b')).toBe(false);
  });

  it('keeps education role escalation behind the admin boundary', () => {
    expect(educationRoleChangeDecision({
      actorRole: 'admin',
      targetRole: 'colaborador',
      nextRole: 'superadmin',
      isSelf: false,
    })).toBe('admin-boundary');
    expect(educationRoleChangeDecision({
      actorRole: 'colaborador',
      targetRole: 'colaborador',
      nextRole: 'rh',
      isSelf: false,
    })).toBe('actor-not-allowed');
  });
});
