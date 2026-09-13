import { describe, expect, it } from 'vitest';
import { createPasswordRecord, newInitialPassword, verifyPasswordRecord } from './password-credentials';

describe('corporate e-mail/password credentials', () => {
  it('stores only a password derivation and does not add an expiry deadline', async () => {
    const record = await createPasswordRecord('SenhaForte#2026');
    expect(record.algorithm).toBe('PBKDF2-SHA256');
    expect(record.iterations).toBe(100_000);
    expect(record.salt).toBeTruthy();
    expect(record.hash).toBeTruthy();
    expect(record).not.toHaveProperty('expiresAt');
    expect(await verifyPasswordRecord('SenhaForte#2026', record)).toBe(true);
    expect(await verifyPasswordRecord('senha-incorreta', record)).toBe(false);
  });

  it('generates a strong initial password that can remain valid until the user changes it', () => {
    const password = newInitialPassword();
    expect(password.length).toBeGreaterThanOrEqual(16);
    expect(/[a-z]/.test(password)).toBe(true);
    expect(/[A-Z]/.test(password)).toBe(true);
    expect(/\d/.test(password)).toBe(true);
  });
});
