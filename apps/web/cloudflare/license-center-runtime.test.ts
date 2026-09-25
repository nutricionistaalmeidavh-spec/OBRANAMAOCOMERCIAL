import fs from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { router, runtimeEnv } from './sdk';

describe('license center Cloudflare runtime context', () => {
  it('provides runtimeEnv while a bridged handler runs through router.fetch', async () => {
    const statement = {
      bind() { return this; },
      async run() { return { meta: { changes: 0 } }; },
      async all() { return { results: [] }; },
      async first() { return null; },
    };
    const env = { DB: { prepare: () => statement } } as any;
    const request = new Request('https://obra.test/runtime-probe');
    const probe = router({
      'GET /runtime-probe': [async () => new Response(runtimeEnv() === env ? 'ok' : 'bad')],
    });

    const response = await probe.fetch(request, env);

    expect(await response.text()).toBe('ok');
  });

  it('bridges the direct license-center admin gateway through router runtime context', async () => {
    const source = await fs.readFile(new URL('./worker.ts', import.meta.url), 'utf8');

    expect(source).toContain("import { router } from './sdk';");
    expect(source).toMatch(/router\(\{[\s\S]*handleLicenseCenterAdminInternal\(ctx\.request,\s*ctx\.env\)[\s\S]*\}\)/);
  });
});
