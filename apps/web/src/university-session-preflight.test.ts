import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../universidade.html', import.meta.url), 'utf8');

describe('Universidade session preflight', () => {
  it('validates the authoritative web session before mounting the university route', () => {
    expect(html).toContain("import { auth } from './src/cloudflare-client.ts'");
    expect(html).toContain('await auth.getUser()');
    expect(html).toContain("await import('./src/main.ts')");
    expect(html).not.toContain('type="module" src="./src/main.ts"');
  });
});
