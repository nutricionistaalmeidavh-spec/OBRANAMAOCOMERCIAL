import { describe, expect, it } from 'vitest';
import { addCalendarMonths, accessForLicense, normalizeLicenseEmail } from './product-license-service';

describe('Cloudflare product license authority', () => {
  it('normalizes license e-mails independently from the CEO identity', () => {
    expect(normalizeLicenseEmail('  CLIENT@Example.COM ')).toBe('client@example.com');
  });

  it('adds six calendar months for Mercado Livre grants', () => {
    expect(addCalendarMonths('2026-09-14T12:00:00.000Z', 6)).toBe('2027-03-14T12:00:00.000Z');
  });

  it('returns Freemium limits when there is no active commercial license', () => {
    expect(accessForLicense(null, '2026-09-14T12:00:00.000Z')).toEqual({
      productCode: 'debora-lactacao',
      planCode: 'freemium',
      active: false,
      patientLimit: 3,
      mediaUpload: false,
      expiresAt: null,
      source: 'cloudflare_d1',
    });
  });

  it('returns Pro access only while the license is active and unexpired', () => {
    const license = { planCode: 'pro_6m', status: 'active', expiresAt: '2027-03-14T12:00:00.000Z' };
    expect(accessForLicense(license, '2026-09-14T12:00:00.000Z').mediaUpload).toBe(true);
    expect(accessForLicense(license, '2027-03-15T12:00:00.000Z').planCode).toBe('freemium');
  });
});
