import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAsaasCheckout } from './asaas-client';

describe('Asaas hosted checkout', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('creates recurring checkout without pre-creating customer data', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 'chk_123',
      link: 'https://sandbox.asaas.com/checkoutSession/show/chk_123',
      status: 'ACTIVE',
      externalReference: 'order_123',
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await createAsaasCheckout({
      ASAAS_API_KEY: 'test-key',
      ASAAS_API_BASE_URL: 'https://api-sandbox.asaas.com/v3',
    }, {
      orderId: 'order_123',
      amountCents: 29900,
      planName: 'Pro',
      interval: 'monthly',
      callbackBaseUrl: 'https://app.example.test',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api-sandbox.asaas.com/v3/checkouts');
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      billingTypes: ['CREDIT_CARD'],
      chargeTypes: ['RECURRENT'],
      externalReference: 'order_123',
      items: [{ name: 'Pro', quantity: 1, value: 299 }],
      subscription: { cycle: 'MONTHLY' },
      callback: {
        successUrl: 'https://app.example.test/sistema.html#assinatura?pedido=order_123',
        cancelUrl: 'https://app.example.test/sistema.html#planos',
        expiredUrl: 'https://app.example.test/sistema.html#planos',
      },
    });
    expect(body.customer).toBeUndefined();
    expect(body.customerData).toBeUndefined();
    expect(result).toMatchObject({ checkoutId: 'chk_123', checkoutUrl: 'https://sandbox.asaas.com/checkoutSession/show/chk_123', providerStatus: 'ACTIVE' });
  });
});
