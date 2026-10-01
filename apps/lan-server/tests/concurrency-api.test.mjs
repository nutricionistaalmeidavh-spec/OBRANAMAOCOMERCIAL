import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import path from 'node:path'
import test from 'node:test'
import { LanRepository } from '../src/repository.mjs'
import { createLanServer } from '../src/server.mjs'

const TOKEN = 'f14-concurrency-device-token'
const digest = value => createHash('sha256').update(String(value)).digest('hex')

function security() {
  return {
    serverState() { return { claimed: true, companyId: 'company-a' } },
    deviceByTokenHash(value) {
      return value === digest(TOKEN)
        ? { id: 'device-a', memberId: 'member-a', status: 'active' }
        : null
    },
    member(id) {
      return id === 'member-a'
        ? { memberId: id, role: 'admin', modules: ['obra360'], channels: ['desktop'], status: 'active' }
        : null
    },
    touchDevice() {}
  }
}

async function fixture() {
  const repository = new LanRepository({ filename: ':memory:' })
  repository.applyMigrations(path.resolve(import.meta.dirname, '../migrations'))
  const company = repository.save('empresas', { razao_social: 'Empresa F14' })
  const client = repository.save('clientes', { empresa_id: company.id, nome: 'Cliente F14' })
  const work = repository.save('obras', {
    empresa_id: company.id,
    cliente_id: client.id,
    nome: 'Obra original',
    status: 'planejada'
  })

  const server = createLanServer({ repository, security: security() })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Servidor sem porta TCP.')
  return { repository, server, baseUrl: `http://127.0.0.1:${address.port}`, work }
}

async function close(f) {
  f.server.close()
  await once(f.server, 'close')
  f.repository.close()
}

function headers(extra = {}) {
  return { authorization: `Bearer ${TOKEN}`, ...extra }
}

async function read(f, id) {
  return fetch(`${f.baseUrl}/api/v1/obras/${id}`, { headers: headers() })
}

async function update(f, id, expectedRevision, data) {
  return fetch(`${f.baseUrl}/api/v1/obras/${id}`, {
    method: 'PUT',
    headers: headers({ 'content-type': 'application/json' }),
    body: JSON.stringify({ expectedRevision, data })
  })
}

async function remove(f, id, expectedRevision) {
  return fetch(`${f.baseUrl}/api/v1/obras/${id}?expectedRevision=${expectedRevision}`, {
    method: 'DELETE',
    headers: headers()
  })
}

test('two clients cannot silently overwrite the same central record revision', async () => {
  const f = await fixture()
  try {
    const readA = await read(f, f.work.id)
    const readB = await read(f, f.work.id)
    assert.equal(readA.status, 200)
    assert.equal(readB.status, 200)

    const a = await readA.json()
    const b = await readB.json()
    assert.equal(a.revision, 1)
    assert.equal(b.revision, 1)

    const first = await update(f, f.work.id, a.revision, { nome: 'Alterada pelo PC A' })
    assert.equal(first.status, 200)
    const firstBody = await first.json()
    assert.equal(firstBody.nome, 'Alterada pelo PC A')
    assert.equal(firstBody.revision, 2)

    const stale = await update(f, f.work.id, b.revision, { nome: 'Sobrescrita pelo PC B' })
    assert.equal(stale.status, 409)
    const conflict = await stale.json()
    assert.equal(conflict.error, 'revision_conflict')
    assert.equal(conflict.resourceType, 'obras')
    assert.equal(conflict.resourceId, String(f.work.id))
    assert.equal(conflict.expectedRevision, 1)
    assert.equal(conflict.currentRevision, 2)
    assert.equal(conflict.current.nome, 'Alterada pelo PC A')
    assert.equal(conflict.current.revision, 2)

    const persisted = await read(f, f.work.id)
    const persistedBody = await persisted.json()
    assert.equal(persistedBody.nome, 'Alterada pelo PC A')
    assert.equal(persistedBody.revision, 2)
  } finally { await close(f) }
})

test('stale delete is rejected and fresh delete succeeds', async () => {
  const f = await fixture()
  try {
    const observed = await (await read(f, f.work.id)).json()
    const changed = await update(f, f.work.id, observed.revision, { responsavel: 'Atualizado' })
    assert.equal(changed.status, 200)
    assert.equal((await changed.json()).revision, 2)

    const staleDelete = await remove(f, f.work.id, observed.revision)
    assert.equal(staleDelete.status, 409)
    assert.equal((await staleDelete.json()).currentRevision, 2)
    assert.ok(f.repository.get('obras', f.work.id))

    const freshDelete = await remove(f, f.work.id, 2)
    assert.equal(freshDelete.status, 200)
    assert.deepEqual(await freshDelete.json(), { ok: true })
  } finally { await close(f) }
})

test('failed write after revision precondition does not bump revision or mutate data', async () => {
  const f = await fixture()
  try {
    const observed = await (await read(f, f.work.id)).json()
    assert.equal(observed.revision, 1)

    const invalid = await update(f, f.work.id, observed.revision, { cliente_id: 999999 })
    assert.equal(invalid.status, 400)

    const after = await (await read(f, f.work.id)).json()
    assert.equal(after.revision, 1)
    assert.equal(after.cliente_id, f.work.cliente_id)
    assert.equal(after.nome, 'Obra original')
  } finally { await close(f) }
})

test('capabilities advertise optimistic concurrency without removing existing modules', async () => {
  const f = await fixture()
  try {
    const response = await fetch(`${f.baseUrl}/api/v1/sync-source/capabilities`, { headers: headers() })
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.ok(body.modules.includes('core'))
    assert.ok(body.modules.includes('rh'))
    assert.ok(body.features.includes('optimistic-concurrency-v1'))
  } finally { await close(f) }
})
