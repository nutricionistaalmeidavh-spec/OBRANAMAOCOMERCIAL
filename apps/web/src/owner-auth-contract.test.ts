import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const ownerSource = () => readFile(new URL('./owner.ts', import.meta.url), 'utf8');
const clientSource = () => readFile(new URL('./cloudflare-client.ts', import.meta.url), 'utf8');

describe('Central Artisys CEO authentication contract', () => {
  it('uses Google sign-in for the owner portal and does not reuse the SEO password flow', async () => {
    const owner = await ownerSource();
    expect(owner).toContain('Entrar com Google');
    expect(owner).toContain('auth.signIn(');
    expect(owner).not.toContain('/api/auth/password/login');
    expect(owner).not.toContain('autocomplete="current-password"');
  });

  it('brands the Google chooser as Central Artisys on the owner route', async () => {
    const client = await clientSource();
    expect(client).toContain("location.hash==='#owner'");
    expect(client).toContain('Entrar na Central Artisys');
  });
});
