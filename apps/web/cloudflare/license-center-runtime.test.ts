import fs from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { router, runtimeEnv } from './sdk';

describe('license center Cloudflare runtime context', () => {
  it('keeps the original request body readable while a clone establishes router runtime context', async () => {
    const statement = {
      bind() { return this; },
      async run() { return { meta: { changes: 0 } }; },
      async all() { return { results: [] }; },
      async first() { return null; },
    };
    const env = { DB: { prepare: () => statement } } as any;
    const request = new Request('https://obra.test/api/internal/license-center/obra/companies', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'ARTISYS QA E2E run-123', adminEmail: 'qa-license-run-123@example.test' }),
    });
    const bridgeRequest = request.clone();
    const probe = router({
      'POST /api/internal/license-center/obra/companies': [async () => {
        const payload = await request.json() as Record<string, unknown>;
        return new Response(JSON.stringify({ sameEnv: runtimeEnv() === env, payload }), {
          headers: { 'content-type': 'application/json' },
        });
      }],
    });

    const response = await probe.fetch(bridgeRequest, env);
    const result = await response.json() as { sameEnv:boolean; payload:Record<string, unknown> };

    expect(result.sameEnv).toBe(true);
    expect(result.payload).toEqual({
      name: 'ARTISYS QA E2E run-123',
      adminEmail: 'qa-license-run-123@example.test',
    });
  });

  it('routes a clone but gives the untouched original request to the direct admin handler', async () => {
    const source = await fs.readFile(new URL('./worker.ts', import.meta.url), 'utf8');

    expect(source).toMatch(/const\s+bridgeRequest\s*=\s*request\.clone\(\)/);
    expect(source).toMatch(/handleLicenseCenterAdminInternal\(request,\s*ctx\.env(?:\s+as\s+any)?\)/);
    expect(source).toMatch(/bridge\.fetch\(bridgeRequest,\s*env\)/);
    expect(source).not.toMatch(/handleLicenseCenterAdminInternal\(ctx\.request,/);
  });
});
