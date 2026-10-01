import assert from 'node:assert/strict'
import http from 'node:http'
import { once } from 'node:events'
import test from 'node:test'
import { attachReadinessRoute } from '../src/readiness-route.mjs'

async function fixture({ ready = true } = {}) {
  const server = http.createServer((request, response) => { response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify({ base: true, path: request.url })) })
  const healthService = { readinessResponse() { return { statusCode: ready ? 200 : 503, body: { ready, status: ready ? 'ready' : 'not_ready' } } } }
  attachReadinessRoute(server, healthService)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  return { server, baseUrl: `http://127.0.0.1:${address.port}` }
}

async function close(server) { server.close(); await once(server, 'close') }

test('GET /ready returns readiness service payload and status', async () => {
  const { server, baseUrl } = await fixture({ ready: false })
  try { const response = await fetch(`${baseUrl}/ready`); assert.equal(response.status, 503); assert.deepEqual(await response.json(), { ready: false, status: 'not_ready' }) } finally { await close(server) }
})

test('non-ready routes continue through the existing server handler unchanged', async () => {
  const { server, baseUrl } = await fixture()
  try { const response = await fetch(`${baseUrl}/health`); assert.equal(response.status, 200); assert.deepEqual(await response.json(), { base: true, path: '/health' }) } finally { await close(server) }
})

test('POST /ready returns 405 and does not fall through to the base server', async () => {
  const { server, baseUrl } = await fixture()
  try { const response = await fetch(`${baseUrl}/ready`, { method: 'POST' }); assert.equal(response.status, 405); assert.equal(response.headers.get('allow'), 'GET'); assert.deepEqual(await response.json(), { error: 'method_not_allowed' }) } finally { await close(server) }
})
