import fs from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { runtimeEnv, withCloudflareRuntime } from './sdk';

describe('license center Cloudflare runtime context', () => {
  it('provides runtimeEnv to direct worker handlers', async () => {
    const env = { DB: {} as D1Database } as any;
    const request = new Request('https://obra.test/api/internal/license-center/obra/companies');

    const resolved = await withCloudflareRuntime(request, env, async () => runtimeEnv());

    expect(resolved).toBe(env);
  });

  it('wraps the direct license-center admin gateway in Cloudflare runtime context', async () => {
    const source = await fs.readFile(new URL('./worker.ts', import.meta.url), 'utf8');

    expect(source).toMatch(
      /withCloudflareRuntime\(\s*request\s*,\s*env\s*,\s*\(\)\s*=>\s*handleLicenseCenterAdminInternal\(request,\s*env\)\s*\)/,
    );
  });
});
