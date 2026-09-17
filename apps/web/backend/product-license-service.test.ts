import { describe, expect, it } from 'vitest';
import { addCalendarMonths, accessForLicense, buildDeboraAdminClients, normalizeLicenseEmail, summarizeDeboraLicenseOverview, unmanagedAccess } from './product-license-service';

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

  it('builds the admin client list with active, freemium, revoked, expired and expiring states', () => {
    const accounts=[
      {email:'pro@example.test',status:'commercial',source:'saas_onboarding'},
      {email:'free@example.test',status:'commercial',source:'saas_onboarding'},
      {email:'revoked@example.test',status:'commercial',source:'mercado_livre_manual'},
      {email:'expired@example.test',status:'commercial',source:'mercado_livre_manual'},
      {email:'expiring@example.test',status:'commercial',source:'mercado_livre_manual'},
    ];
    const licenses=[
      {email:'pro@example.test',plan_code:'pro_6m',status:'active',expires_at:'2027-03-14T12:00:00.000Z',source:'mercado_livre_manual',updated_at:'2026-09-14T12:00:00.000Z'},
      {email:'revoked@example.test',plan_code:'pro_6m',status:'revoked',expires_at:'2027-01-01T00:00:00.000Z',source:'mercado_livre_manual',updated_at:'2026-09-15T12:00:00.000Z'},
      {email:'expired@example.test',plan_code:'pro_6m',status:'active',expires_at:'2026-09-10T12:00:00.000Z',source:'mercado_livre_manual',updated_at:'2026-09-10T12:00:00.000Z'},
      {email:'expiring@example.test',plan_code:'pro_6m',status:'active',expires_at:'2026-09-30T12:00:00.000Z',source:'mercado_livre_manual',updated_at:'2026-09-14T12:00:00.000Z'},
    ];
    expect(buildDeboraAdminClients(accounts,licenses,'2026-09-16T12:00:00.000Z')).toEqual([
      expect.objectContaining({email:'expired@example.test',status:'expired',planCode:'pro_6m',expiring:false}),
      expect.objectContaining({email:'expiring@example.test',status:'active',planCode:'pro_6m',expiring:true}),
      expect.objectContaining({email:'free@example.test',status:'freemium',planCode:'freemium',expiring:false}),
      expect.objectContaining({email:'pro@example.test',status:'active',planCode:'pro_6m',expiring:false}),
      expect.objectContaining({email:'revoked@example.test',status:'revoked',planCode:'pro_6m',expiring:false}),
    ]);
  });

  it('summarizes Debora clients without changing license-generation semantics', () => {
    const accounts=[
      {email:'pro@example.test',status:'commercial'},
      {email:'free@example.test',status:'commercial'},
      {email:'revoked@example.test',status:'commercial'},
      {email:'expiring@example.test',status:'commercial'},
    ];
    const licenses=[
      {email:'pro@example.test',plan_code:'pro_6m',status:'active',expires_at:'2027-03-14T12:00:00.000Z',updated_at:'2026-09-14T12:00:00.000Z'},
      {email:'revoked@example.test',plan_code:'pro_6m',status:'revoked',expires_at:'2027-01-01T00:00:00.000Z',updated_at:'2026-09-15T12:00:00.000Z'},
      {email:'expiring@example.test',plan_code:'pro_6m',status:'active',expires_at:'2026-09-30T12:00:00.000Z',updated_at:'2026-09-14T12:00:00.000Z'},
    ];
    expect(summarizeDeboraLicenseOverview(accounts,licenses,'2026-09-16T12:00:00.000Z')).toEqual({
      clients:4,
      pro:2,
      freemium:2,
      expiring:1,
      revoked:1,
    });
  });
});
