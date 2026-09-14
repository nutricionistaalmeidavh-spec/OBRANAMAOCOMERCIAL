import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const source = () => readFile(new URL('./owner.ts', import.meta.url), 'utf8');

describe('Central Artisys CEO authentication contract', () => {
  it('uses the existing e-mail/password session flow and never offers Google login', async () => {
    const owner = await source();
    expect(owner).toContain('/api/auth/password/login');
    expect(owner).toContain('E-mail');
    expect(owner).toContain('Senha');
    expect(owner).not.toContain('Entrar com Google');
    expect(owner).not.toContain('auth.signIn(');
  });
});
