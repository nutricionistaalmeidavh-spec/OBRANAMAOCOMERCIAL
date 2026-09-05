import { describe, expect, it } from 'vitest'
import { handleAsaasWebhook } from '../backend/asaas-webhook'

const request = (token: string | null, body: unknown) => new Request('https://example.com/api/webhooks/asaas', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    ...(token ? { 'asaas-access-token': token } : {})
  },
  body: JSON.stringify(body)
})

describe('Asaas webhook', () => {
  it('rejects requests with an invalid authentication token', async () => {
    const response = await handleAsaasWebhook(request('wrong-token', { event: 'CHECKOUT_PAID' }), { ASAAS_WEBHOOK_TOKEN: 'expected-token' })
    expect(response.status).toBe(401)
  })

  it('fails closed when the webhook secret is not configured', async () => {
    const response = await handleAsaasWebhook(request('any-token', { event: 'CHECKOUT_PAID' }), {})
    expect(response.status).toBe(503)
  })

  it('accepts checkout events and preserves the external reference', async () => {
    const response = await handleAsaasWebhook(request('expected-token', {
      id: 'evt_123',
      event: 'CHECKOUT_PAID',
      checkout: {
        id: 'chk_123',
        externalReference: 'company_42_plan_pro'
      }
    }), { ASAAS_WEBHOOK_TOKEN: 'expected-token' })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      received: true,
      event: 'CHECKOUT_PAID',
      externalReference: 'company_42_plan_pro'
    })
  })

  it('rejects invalid JSON without exposing internal details', async () => {
    const badRequest = new Request('https://example.com/api/webhooks/asaas', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'asaas-access-token': 'expected-token' },
      body: '{bad-json'
    })
    const response = await handleAsaasWebhook(badRequest, { ASAAS_WEBHOOK_TOKEN: 'expected-token' })
    expect(response.status).toBe(400)
  })
})
