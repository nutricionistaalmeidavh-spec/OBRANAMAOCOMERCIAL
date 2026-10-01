import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import path from 'node:path'
import test from 'node:test'
import { LanRepository } from '../src/repository.mjs'
import { LanSecurityRepository } from '../src/security-repository.mjs'
import { createLanServer } from '../src/server.mjs'

const TOKEN = 'live-permission-device-token'
const digest = value => createHash('sha256').update(String(value)).digest('hex')
const permissions = actions => ({ core: actions, operation: [], planning: [], finance: [], rh: [] })

function snapshot({ revision, granular = true, actions = ['view', 'edit'] }) {
  return {
    companyId: 'company-a',
    revision,
    generatedAt: '2026-10-01T17:30:00.000Z',
    members: [{
      memberId: 'member-a', email: 'member@example.com', role: 'employee',
      modules: ['obra360'], channels: ['desktop'], status: 'active',
      ...(granular ? { permissions: permissions(actions), permissionsRevision: `perm-${revision}` } : {})
    }]
  }
}

async function fixture({ granular = true } = {}) {
  const repository = new LanRepository({ filename: ':memory:' })
  repository.applyMigrations(path.resolve(import.meta.dirname, '../migrations'))
  const company = repository.save('empresas', { razao_social: 'Empresa Live Refresh' })
  const work = repository.save('obras', { empresa_id: company.id, nome: 'Obra antes do refresh' })
  const security = new LanSecurityRepository({ db: repository.connection(), now: () => '2026-10-01T17:30:00.000Z' })
  security.initializeServer({ serverId: 'server-a', setupCodeHash: 'setup-hash' })
  security.claimServer({
    company: { id: 'company-a', name: 'Empresa A' },
    cloudBaseUrl: 'https://cloud.example',
    serverToken: 'server-token',
    snapshot: snapshot({ revision: 'rev-1', granular })
  })
  security.createDevice({ memberId: 'member-a', installationId: 'install-a', deviceName: 'PC A', tokenHash: digest(TOKEN) })

  const server = createLanServer({ repository, security })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Servidor sem porta TCP.')
  return { repository, security, server, work, baseUrl: `http://127.0.0.1:${address.port}` }
}

async function close(f) {
  f.server.close()
  await once(f.server, 'close')
  f.repository.close()
}

const headers = { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' }

test('next LAN request uses refreshed granular permissions without restart or re-pairing', async () => {
  const f = await fixture()
  try {
    const initialRead = await fetch(`${f.baseUrl}/api/v1/obras/${f.work.id}`, { headers })
    assert.equal(initialRead.status, 200)
    const observed = await initialRead.json()
    assert.equal(observed.revision, 1)

    const initialEdit = await fetch(`${f.baseUrl}/api/v1/obras/${f.work.id}`, {
      method: 'PUT', headers,
      body: JSON.stringify({ expectedRevision: observed.revision, data: { nome: 'Editada antes do refresh' } })
    })
    assert.equal(initialEdit.status, 200)
    const edited = await initialEdit.json()
    assert.equal(edited.revision, 2)

    f.security.replaceSnapshot(snapshot({ revision: 'rev-2', actions: ['view'] }))

    const readAfterRefresh = await fetch(`${f.baseUrl}/api/v1/obras/${f.work.id}`, { headers })
    assert.equal(readAfterRefresh.status, 200)
    assert.equal((await readAfterRefresh.json()).revision, 2)

    const editAfterRefresh = await fetch(`${f.baseUrl}/api/v1/obras/${f.work.id}`, {
      method: 'PUT', headers,
      body: JSON.stringify({ expectedRevision: 2, data: { nome: 'Não deve salvar' } })
    })
    assert.equal(editAfterRefresh.status, 403)
    assert.equal((await editAfterRefresh.json()).error, 'forbidden')

    const persisted = f.repository.get('obras', f.work.id)
    assert.equal(persisted.nome, 'Editada antes do refresh')
    assert.equal(f.security.listDevices().length, 1, 'refresh does not require re-pairing')
  } finally { await close(f) }
})

test('legacy snapshot without permissions keeps pre-F15 role/module policy during rollout', async () => {
  const f = await fixture({ granular: false })
  try {
    const read = await fetch(`${f.baseUrl}/api/v1/obras/${f.work.id}`, { headers })
    assert.equal(read.status, 200)
    const observed = await read.json()

    const edit = await fetch(`${f.baseUrl}/api/v1/obras/${f.work.id}`, {
      method: 'PUT', headers,
      body: JSON.stringify({ expectedRevision: observed.revision, data: { nome: 'Legado permitido' } })
    })
    assert.equal(edit.status, 200)
    assert.equal((await edit.json()).nome, 'Legado permitido')
  } finally { await close(f) }
})
