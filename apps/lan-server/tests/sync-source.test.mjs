import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import test from 'node:test'
import { createLanServer } from '../src/server.mjs'

const TOKEN = 'sync-source-device-token'
const digest = value => createHash('sha256').update(String(value)).digest('hex')

function security({ status = 'active' } = {}) {
  return {
    serverState() { return { claimed: true, companyId: 'company-a' } },
    deviceByTokenHash(value) {
      return value === digest(TOKEN) ? { id: 'device-a', memberId: 'member-a', status } : null
    },
    member(id) {
      return id === 'member-a'
        ? { memberId: id, role: 'admin', modules: ['obra360'], channels: ['desktop'], status: 'active' }
        : null
    },
    touchDevice() {}
  }
}

async function fixture(options = {}) {
  const server = createLanServer({ security: security(options) })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Servidor sem porta TCP.')
  return { server, baseUrl: `http://127.0.0.1:${address.port}` }
}

async function close(server) {
  server.close()
  await once(server, 'close')
}

test('sync source capabilities exige dispositivo LAN autenticado', async () => {
  const { server, baseUrl } = await fixture()
  try {
    const response = await fetch(`${baseUrl}/api/v1/sync-source/capabilities`)
    assert.equal(response.status, 401)
    assert.equal((await response.json()).error, 'missing_device_token')
  } finally { await close(server) }
})

test('sync source capabilities rejeita dispositivo revogado', async () => {
  const { server, baseUrl } = await fixture({ status: 'revoked' })
  try {
    const response = await fetch(`${baseUrl}/api/v1/sync-source/capabilities`, {
      headers: { authorization: `Bearer ${TOKEN}` }
    })
    assert.equal(response.status, 403)
    assert.equal((await response.json()).error, 'device_revoked')
  } finally { await close(server) }
})

test('sync source capabilities anuncia somente core e operação centralizados na F9', async () => {
  const { server, baseUrl } = await fixture()
  try {
    const response = await fetch(`${baseUrl}/api/v1/sync-source/capabilities`, {
      headers: { authorization: `Bearer ${TOKEN}` }
    })
    assert.equal(response.status, 200)
    const capabilities = await response.json()
    assert.deepEqual(capabilities, {
      version: 1,
      modules: ['core', 'operation'],
      bridgeEntities: ['frentes_obra', 'tarefas_obra', 'rdos']
    })
    assert.equal(capabilities.modules.includes('planning'), false)
    assert.equal(capabilities.modules.includes('finance'), false)
    assert.equal(capabilities.modules.includes('rh'), false)
    assert.equal(capabilities.bridgeEntities.includes('cronograma_etapas'), false)
  } finally { await close(server) }
})
