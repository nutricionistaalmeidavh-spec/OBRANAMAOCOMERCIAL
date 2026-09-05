import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAsaasCheckout, isUnknownAsaasOutcome } from './asaas-client';

const env={
  ASAAS_API_KEY:'test-key',
  ASAAS_API_BASE_URL:'https://api-sandbox.asaas.com/v3',
};
const input={
  orderId:'order_123',
  amountCents:29900,
  planName:'Pro',
  interval:'monthly' as const,
  callbackBaseUrl:'https://app.example.test',
};

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

    const result = await createAsaasCheckout(env, input);

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

  it('classifies validation failures as definitive instead of unknown', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({errors:[{description:'invalid'}]}), { status: 422 })));
    let failure:unknown;
    try{await createAsaasCheckout(env,input)}catch(error){failure=error}
    expect(failure).toBeInstanceOf(Error);
    expect(isUnknownAsaasOutcome(failure)).toBe(false);
  });

  it('classifies provider 5xx failures as an unknown outcome', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 503 })));
    let failure:unknown;
    try{await createAsaasCheckout(env,input)}catch(error){failure=error}
    expect(failure).toBeInstanceOf(Error);
    expect(isUnknownAsaasOutcome(failure)).toBe(true);
  });

  it('classifies a network interruption as an unknown outcome', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network interrupted')));
    let failure:unknown;
    try{await createAsaasCheckout(env,input)}catch(error){failure=error}
    expect(failure).toBeInstanceOf(Error);
    expect(isUnknownAsaasOutcome(failure)).toBe(true);
  });
});
