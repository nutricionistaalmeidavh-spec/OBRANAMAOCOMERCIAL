import { describe, expect, it } from 'vitest';
import { addCalendarMonths, accessForLicense, normalizeLicenseEmail, unmanagedAccess } from './product-license-service';

describe('Cloudflare product license authority', () => {
  it('normalizes license e-mails independently from the CEO identity', () => {
    expect(normalizeLicenseEmail('  CLIENT@Example.COM ')).toBe('client@example.com');
  });

  it('adds six calendar months for Mercado Livre grants', () => {
    expect(addCalendarMonths('2026-09-14T12:00:00.000Z', 6)).toBe('2027-03-14T12:00:00.000Z');
    expect(addCalendarMonths('2026-08-31T12:00:00.000Z', 6)).toBe('2027-02-28T12:00:00.000Z');
  });

  it('keeps accounts outside the explicit commercial registry unmanaged and unlimited', () => {
    expect(unmanagedAccess()).toEqual({
      productCode: 'debora-lactacao',
      planCode: 'legacy_unmanaged',
      active: true,
      commercial: false,
      enforceLimits: false,
      patientLimit: null,
      mediaUpload: true,
      expiresAt: null,
      source: 'legacy',
      status: 'unmanaged',
    });
  });

  it('returns Freemium limits only after an account is classified as commercial', () => {
    expect(accessForLicense(null, '2026-09-14T12:00:00.000Z')).toEqual({
      productCode: 'debora-lactacao',
      planCode: 'freemium',
      active: false,
      commercial: true,
      enforceLimits: true,
      patientLimit: 3,
      mediaUpload: false,
      expiresAt: null,
      source: 'cloudflare_d1',
      status: 'freemium',
    });
  });

  it('returns Pro access only while the commercial license is active and unexpired', () => {
    const license = { planCode: 'pro_6m', status: 'active', expiresAt: '2027-03-14T12:00:00.000Z' };
    expect(accessForLicense(license, '2026-09-14T12:00:00.000Z').mediaUpload).toBe(true);
    expect(accessForLicense(license, '2026-09-14T12:00:00.000Z').commercial).toBe(true);
    expect(accessForLicense(license, '2027-03-15T12:00:00.000Z').planCode).toBe('freemium');
  });
});
