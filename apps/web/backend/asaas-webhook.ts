type D1StatementLike = {
  bind: (...values: unknown[]) => D1StatementLike
  run: () => Promise<unknown>
}

type D1DatabaseLike = {
  prepare: (query: string) => D1StatementLike
}

export type AsaasWebhookEnv = {
  ASAAS_WEBHOOK_TOKEN?: string
  DB?: D1DatabaseLike
}

type AsaasWebhookPayload = {
  id?: string
  event?: string
  checkout?: {
    id?: string
    externalReference?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

const CHECKOUT_EVENTS = new Set([
  'CHECKOUT_CREATED',
  'CHECKOUT_PAID',
  'CHECKOUT_CANCELED',
  'CHECKOUT_EXPIRED'
])

let schemaReady = false

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    }
  })
}

function constantTimeEqual(received: string, expected: string) {
  if (received.length !== expected.length) return false
  let mismatch = 0
  for (let index = 0; index < received.length; index += 1) {
    mismatch |= received.charCodeAt(index) ^ expected.charCodeAt(index)
  }
  return mismatch === 0
}

async function persistEvent(env: AsaasWebhookEnv, payload: AsaasWebhookPayload) {
  if (!env.DB || !payload.id) return
  if (!schemaReady) {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS asaas_webhook_events (
      event_id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      checkout_id TEXT,
      external_reference TEXT,
      payload_json TEXT NOT NULL,
      received_at TEXT NOT NULL
    )`).run()
    schemaReady = true
  }

  await env.DB.prepare(`INSERT OR IGNORE INTO asaas_webhook_events(
    event_id,event_type,checkout_id,external_reference,payload_json,received_at
  ) VALUES(?,?,?,?,?,?)`)
    .bind(
      payload.id,
      String(payload.event || 'UNKNOWN'),
      payload.checkout?.id || null,
      payload.checkout?.externalReference || null,
      JSON.stringify(payload),
      new Date().toISOString()
    )
    .run()
}

export async function handleAsaasWebhook(request: Request, env: AsaasWebhookEnv) {
  if (request.method === 'GET') {
    return json({ ok: true, service: 'asaas-webhook', version: 1 })
  }

  if (request.method !== 'POST') {
    return json({ error: 'Método não permitido.' }, 405)
  }

  const expectedToken = String(env.ASAAS_WEBHOOK_TOKEN || '').trim()
  if (!expectedToken) {
    return json({ error: 'Webhook temporariamente indisponível.' }, 503)
  }

  const receivedToken = request.headers.get('asaas-access-token') || ''
  if (!receivedToken || !constantTimeEqual(receivedToken, expectedToken)) {
    return json({ error: 'Webhook não autorizado.' }, 401)
  }

  let payload: AsaasWebhookPayload
  try {
    payload = await request.json() as AsaasWebhookPayload
  } catch {
    return json({ error: 'Payload inválido.' }, 400)
  }

  const event = String(payload.event || '')
  const externalReference = payload.checkout?.externalReference || null

  // Checkout events are the billing signal used by ArtiSys. Unknown events are
  // acknowledged too so future Asaas fields/events do not pause the delivery queue.
  if (CHECKOUT_EVENTS.has(event)) {
    await persistEvent(env, payload)
  }

  console.log('Asaas webhook received', {
    id: payload.id || null,
    event: event || 'UNKNOWN',
    checkoutId: payload.checkout?.id || null,
    externalReference
  })

  return json({ received: true, event: event || null, externalReference })
}
