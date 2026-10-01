import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import path from 'node:path'
import test from 'node:test'
import { LanRepository } from '../src/repository.mjs'
import { createLanServer } from '../src/server.mjs'

const TOKEN = 'sync-operation-device-token'
const digest = value => createHash('sha256').update(String(value)).digest('hex')
const migrationsDir = path.resolve(import.meta.dirname, '../migrations')

function security() {
  return {
    serverState() { return { claimed: true, companyId: 'company-a' } },
    deviceByTokenHash(value) { return value === digest(TOKEN) ? { id: 'device-sync', memberId: 'member-sync', status: 'active' } : null },
    member(id) { return id === 'member-sync' ? { memberId: id, role: 'employee', modules: ['obra360'], channels: ['desktop'], status: 'active' } : null },
    touchDevice() {}
  }
}

async function fixture() {
  const repository = new LanRepository({ filename: ':memory:' })
  repository.applyMigrations(migrationsDir)
  const server = createLanServer({ repository, security: security() })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Servidor sem porta TCP.')
  return { repository, server, baseUrl: `http://127.0.0.1:${address.port}` }
}

async function close(f) {
  f.server.close()
  await once(f.server, 'close')
  f.repository.close()
}

test('F10 preserva todas as bridges operacionais da F9 ao adicionar Planejamento', async () => {
  const f = await fixture()
  try {
    const response = await fetch(`${f.baseUrl}/api/v1/sync-source/capabilities`, { headers: { authorization: `Bearer ${TOKEN}` } })
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.version, 1)
    assert.ok(body.modules.includes('core'))
    assert.ok(body.modules.includes('operation'))
    assert.ok(body.modules.includes('planning'))
    for (const entity of ['frentes_obra', 'tarefas_obra', 'rdos']) assert.ok(body.bridgeEntities.includes(entity))
    assert.ok(body.bridgeEntities.includes('cronograma_etapas'))
  } finally { await close(f) }
})
