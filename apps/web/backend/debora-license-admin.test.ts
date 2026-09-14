import { describe, expect, it } from 'vitest';
import { buildDeboraGrantPayload, normalizeDeboraLicenseEmail } from './debora-license-admin';

describe('Debora manual license admin contract', () => {
  it('normalizes buyer email without coupling it to the CEO identity', () => {
    expect(normalizeDeboraLicenseEmail('  CLIENT@Example.COM ')).toBe('client@example.com');
  });

  it('builds a fixed six-month manual marketplace grant', () => {
    expect(buildDeboraGrantPayload('client@example.com')).toEqual({
      action: 'grant',
      email: 'client@example.com',
      planCode: 'pro_6m',
      months: 6,
      source: 'mercado_livre_manual',
    });
  });

  it('rejects an invalid recipient email before calling the Debora backend', () => {
    expect(() => buildDeboraGrantPayload('not-an-email')).toThrow(/e-mail/i);
  });
});
