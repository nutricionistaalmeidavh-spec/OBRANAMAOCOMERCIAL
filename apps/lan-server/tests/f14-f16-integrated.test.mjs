import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import path from 'node:path'
import test from 'node:test'
import { granularPermissionDecision } from '../src/business-permissions.mjs'
import { LanRepository } from '../src/repository.mjs'
import { LanSecurityRepository } from '../src/security-repository.mjs'
import { createLanServer } from '../src/server.mjs'

const TOKEN_A = 'f14-f16-device-a'
const TOKEN_B = 'f14-f16-device-b'
const digest = value => createHash('sha256').update(String(value)).digest('hex')

const emptyMatrix = () => ({ core: [], operation: [], planning: [], finance: [], rh: [] })
const matrix = patch => ({ ...emptyMatrix(), ...patch })

function memberA() {
  return {
    memberId: 'member-a', email: 'admin@example.com', role: 'admin',
    modules: ['obra360', 'rdo', 'finance', 'rh'], channels: ['desktop'], status: 'active',
    permissions: matrix({
      core: ['view', 'create', 'edit', 'delete', 'approve'],
      operation: ['view', 'create', 'edit', 'delete', 'approve'],
      finance: ['view', 'create', 'edit', 'delete', 'approve'],
      rh: ['view', 'create', 'edit', 'delete', 'approve']
    }),
    permissionsRevision: 'perm-admin'
  }
}

function memberB({ core = ['view', 'edit'], operation = [], finance = [], rh = [], revision = 'perm-b-1' } = {}) {
  return {
    memberId: 'member-b', email: 'field@example.com', role: 'employee',
    modules: ['obra360', 'rdo', 'finance', 'rh'], channels: ['desktop'], status: 'active',
    permissions: matrix({ core, operation, finance, rh }),
    permissionsRevision: revision
  }
}

function snapshot(revision, b) {
  return {
    companyId: 'company-a', revision, generatedAt: '2026-10-01T18:20:00.000Z',
    members: [memberA(), b]
  }
}

async function fixture() {
  const repository = new LanRepository({ filename: ':memory:' })
  repository.applyMigrations(path.resolve(import.meta.dirname, '../migrations'))
  const company = repository.save('empresas', { razao_social: 'Empresa F14-F16' })
  const work = repository.save('obras', { empresa_id: company.id, nome: 'Obra integrada' })

  const security = new LanSecurityRepository({ db: repository.connection(), now: () => '2026-10-01T18:20:00.000Z' })
  security.initializeServer({ serverId: 'server-a', setupCodeHash: 'setup-hash' })
  security.claimServer({
    company: { id: 'company-a', name: 'Empresa A' },
    cloudBaseUrl: 'https://cloud.example',
    serverToken: 'server-token',
    snapshot: snapshot('snapshot-1', memberB())
  })
  security.createDevice({ memberId: 'member-a', installationId: 'install-a', deviceName: 'PC A', tokenHash: digest(TOKEN_A) })
  security.createDevice({ memberId: 'member-b', installationId: 'install-b', deviceName: 'PC B', tokenHash: digest(TOKEN_B) })

  const financeService = { accountPayment() { return { ok: true } } }
  const payrollService = { confirm() { return { ok: true } } }
  const server = createLanServer({ repository, security, financeService, payrollService })
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

const auth = token => ({ authorization: `Bearer ${token}` })
const jsonHeaders = token => ({ ...auth(token), 'content-type': 'application/json' })

async function readWork(f, token) {
  return fetch(`${f.baseUrl}/api/v1/obras/${f.work.id}`, { headers: auth(token) })
}

async function updateWork(f, token, expectedRevision, nome) {
  return fetch(`${f.baseUrl}/api/v1/obras/${f.work.id}`, {
    method: 'PUT', headers: jsonHeaders(token),
    body: JSON.stringify({ expectedRevision, data: { nome } })
  })
}

test('F14-F16 integrated gate: stale write conflicts and refreshed Cloud policy applies on next LAN request', async () => {
  const f = await fixture()
  try {
    const a = await (await readWork(f, TOKEN_A)).json()
    const b = await (await readWork(f, TOKEN_B)).json()
    assert.equal(a.revision, 1)
    assert.equal(b.revision, 1)

    const first = await updateWork(f, TOKEN_A, a.revision, 'Atualizada pelo PC A')
    assert.equal(first.status, 200)
    assert.equal((await first.json()).revision, 2)

    const stale = await updateWork(f, TOKEN_B, b.revision, 'Sobrescrita pelo PC B')
    assert.equal(stale.status, 409)
    const conflict = await stale.json()
    assert.equal(conflict.error, 'revision_conflict')
    assert.equal(conflict.currentRevision, 2)

    const reloaded = await (await readWork(f, TOKEN_B)).json()
    assert.equal(reloaded.revision, 2)
    assert.equal(reloaded.nome, 'Atualizada pelo PC A')

    f.security.replaceSnapshot(snapshot('snapshot-2', memberB({ core: ['view'], revision: 'perm-b-2' })))
    assert.equal((await readWork(f, TOKEN_B)).status, 200)
    const denied = await updateWork(f, TOKEN_B, 2, 'Não deve salvar')
    assert.equal(denied.status, 403)
    assert.equal(f.repository.get('obras', f.work.id).nome, 'Atualizada pelo PC A')

    const restored = memberB({ core: ['view', 'edit'], operation: ['approve'], revision: 'perm-b-3' })
    f.security.replaceSnapshot(snapshot('snapshot-3', restored))
    const allowed = await updateWork(f, TOKEN_B, 2, 'Atualizada pelo PC B após liberação')
    assert.equal(allowed.status, 200)
    assert.equal((await allowed.json()).revision, 3)

    const activeB = f.security.member('member-b')
    assert.equal(granularPermissionDecision(activeB, 'operation', 'approve'), true)
    assert.equal(granularPermissionDecision(activeB, 'finance', 'approve'), false)
    assert.equal(granularPermissionDecision(activeB, 'rh', 'approve'), false)

    const financeApproval = await fetch(`${f.baseUrl}/api/v1/finance/accounts/1/payment`, {
      method: 'POST', headers: jsonHeaders(TOKEN_B), body: JSON.stringify({ requestId: 'finance-denied', payment: {} })
    })
    assert.equal(financeApproval.status, 403)

    const rhApproval = await fetch(`${f.baseUrl}/api/v1/rh/payroll/confirm`, {
      method: 'POST', headers: jsonHeaders(TOKEN_B), body: JSON.stringify({ funcionario_id: 1, competencia: '2026-10', quinzena: 1 })
    })
    assert.equal(rhApproval.status, 403)

    assert.equal(f.security.listDevices().length, 2, 'policy refresh must not require device re-pairing')
  } finally { await close(f) }
})
