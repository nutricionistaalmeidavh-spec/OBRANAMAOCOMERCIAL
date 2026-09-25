import fs from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { runtimeEnv, withCloudflareRuntime } from './sdk';

describe('license center Cloudflare runtime context', () => {
  it('provides runtimeEnv without consuming the direct handler request body', async () => {
    const env = { DB: {} as D1Database } as any;
    const request = new Request('https://obra.test/api/internal/license-center/obra/companies', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'ARTISYS QA E2E run-123', adminEmail: 'qa-license-run-123@example.test' }),
    });

    const resolved = await withCloudflareRuntime(request, env, async () => ({
      env: runtimeEnv(),
      payload: await request.json() as Record<string, unknown>,
    }));

    expect(resolved.env).toBe(env);
    expect(resolved.payload).toEqual({
      name: 'ARTISYS QA E2E run-123',
      adminEmail: 'qa-license-run-123@example.test',
    });
  });

  it('wraps the direct license-center admin gateway without routing the request body twice', async () => {
    const source = await fs.readFile(new URL('./worker.ts', import.meta.url), 'utf8');

    expect(source).toContain("import { withCloudflareRuntime } from './sdk';");
    expect(source).toMatch(
      /withCloudflareRuntime\(\s*request\s*,\s*env\s*,\s*\(\)\s*=>\s*handleLicenseCenterAdminInternal\(request,\s*env\)\s*\)/,
    );
    expect(source).not.toContain('licenseCenterAdminWithRuntime');
  });
});
