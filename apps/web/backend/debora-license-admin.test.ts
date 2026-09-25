import { describe, expect, it } from 'vitest';
import { buildDeboraGrantPayload, normalizeDeboraLicenseEmail, normalizeManualSaleInput } from './debora-license-policy';

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

  it('normalizes explicit manual sale metadata without assuming payment',()=>{
    expect(normalizeManualSaleInput({
      acquisitionChannel:'mercado_livre',paymentStatus:'paid',amountCents:8000,externalOrderRef:'  MLB-123  ',
    })).toEqual({
      acquisitionChannel:'mercado_livre',paymentStatus:'paid',amountCents:8000,paidAt:null,externalOrderRef:'MLB-123',
    });
  });

  it('rejects invalid commercial metadata and never defaults to paid',()=>{
    expect(()=>normalizeManualSaleInput({acquisitionChannel:'mercado_livre'})).toThrow(/pagamento/i);
    expect(()=>normalizeManualSaleInput({acquisitionChannel:'invalid',paymentStatus:'paid'})).toThrow(/origem/i);
    expect(()=>normalizeManualSaleInput({acquisitionChannel:'direct_sale',paymentStatus:'paid',amountCents:-1})).toThrow(/valor/i);
  });
});
