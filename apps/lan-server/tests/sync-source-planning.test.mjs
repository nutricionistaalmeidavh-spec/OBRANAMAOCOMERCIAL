import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import test from 'node:test'
import { createLanServer } from '../src/server.mjs'

const TOKEN = 'planning-sync-device-token'
const digest = value => createHash('sha256').update(String(value)).digest('hex')

function security() {
  return {
    serverState() { return { claimed: true, companyId: 'company-a' } },
    deviceByTokenHash(value) { return value === digest(TOKEN) ? { id: 'device-planning-sync', memberId: 'member-planning-sync', status: 'active' } : null },
    member(id) { return id === 'member-planning-sync' ? { memberId: id, role: 'employee', modules: ['obra360'], channels: ['desktop'], status: 'active' } : null },
    touchDevice() {}
  }
}

test('F10 continua anunciando planning e cronograma após capacidades posteriores serem adicionadas', async () => {
  const server = createLanServer({ security: security() })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Servidor sem porta TCP.')
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/sync-source/capabilities`, { headers: { authorization: `Bearer ${TOKEN}` } })
    assert.equal(response.status, 200)
    const capabilities = await response.json()
    assert.ok(capabilities.modules.includes('planning'))
    assert.ok(capabilities.bridgeEntities.includes('cronograma_etapas'))
    assert.ok(capabilities.bridgeEntities.includes('frentes_obra'))
    assert.ok(capabilities.bridgeEntities.includes('tarefas_obra'))
    assert.ok(capabilities.bridgeEntities.includes('rdos'))
    assert.equal(capabilities.modules.includes('rh'), false)
  } finally {
    server.close(); await once(server, 'close')
  }
})
