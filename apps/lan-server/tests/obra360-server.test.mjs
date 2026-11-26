import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import path from 'node:path'
import test from 'node:test'
import { LanRepository } from '../src/repository.mjs'
import { createLanServer } from '../src/server.mjs'

const TOKEN = 'obra360-server-token'
const digest = value => createHash('sha256').update(String(value)).digest('hex')
const security = (role = 'admin', modules = ['obra360', 'rdo', 'rh']) => ({
  serverState() { return { claimed: true, companyId: 'company-a' } },
  deviceByTokenHash(value) { return value === digest(TOKEN) ? { id: 'dev', memberId: 'm', status: 'active' } : null },
  member(id) { return id === 'm' ? { memberId: id, email: 'op@obra.local', role, modules, channels: ['desktop'], status: 'active' } : null },
  touchDevice() {},
})

async function fixture(role, modules) {
  const repository = new LanRepository({ filename: ':memory:' })
  repository.applyMigrations(path.resolve(import.meta.dirname, '../migrations'))
  const company = repository.save('empresas', { razao_social: 'Empresa' })
  const client = repository.save('clientes', { empresa_id: company.id, nome: 'Cliente' })
  const work = repository.save('obras', { empresa_id: company.id, cliente_id: client.id, nome: 'Obra', status: 'ativa' })
  const stage = repository.save('etapas_obra', { obra_id: work.id, nome: 'Alvenaria' })
  const server = createLanServer({ repository, security: security(role, modules) })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const { port } = server.address()
  const post = body => fetch(`http://127.0.0.1:${port}/api/v1/field/obra360`, { method: 'POST', headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' }, body: JSON.stringify(body) })
  return { repository, server, post, work, stage }
}
async function close(f) { f.server.close(); await once(f.server, 'close'); f.repository.close() }

test('servidor aplica pavimentos, andamento, histórico e pendências do celular', async () => {
  const f = await fixture()
  try {
    const service = `etapa:${f.stage.id}`
    const snapshot = {
      floors: [{ number: 0, stages: [{ service, status: 'in_progress', checklist: [] }] }, { number: 1, stages: [] }],
      history: [{ id: 'h1', floor: 0, service, date: '2026-11-26', time: '09:00', label: 'Alvenaria Térreo: em execução' }],
      issues: [{ id: 'i1', title: 'Falta bloco', status: 'open', floor: 1 }],
    }
    const scope = { remoteProjectId: 'p1', workId: f.work.id, remoteCompanyId: 'company-a' }
    const applied = await f.post({ op: 'apply', scope, snapshot })
    assert.equal(applied.status, 200)
    assert.deepEqual(await applied.json(), { issues: 1, staged: 0, floors: 2, progress: 1 })
    assert.equal(f.repository.connection().prepare('SELECT COUNT(*) n FROM locais_obra WHERE obra_id=? AND nivel IS NOT NULL').get(f.work.id).n, 2)
    assert.equal(f.repository.connection().prepare('SELECT COUNT(*) n FROM tarefas_obra WHERE obra_id=?').get(f.work.id).n, 1)
    const linked = f.repository.connection().prepare('SELECT l.nivel FROM tarefas_obra t JOIN locais_obra l ON l.id=t.local_id WHERE t.obra_id=?').get(f.work.id)
    assert.equal(linked.nivel, 1)

    const saved = await f.post({ op: 'progressSave', workId: f.work.id, nivel: 0, service, status: 'completed', checklist: [] })
    assert.equal(saved.status, 200)
    const progress = await (await f.post({ op: 'progressList', workId: f.work.id })).json()
    assert.equal(progress.find(p => p.nivel === 0).origin, 'escritorio')
    const history = await (await f.post({ op: 'historyList', workId: f.work.id, nivel: 0 })).json()
    assert.equal(history.length, 2)

    const all = await (await f.post({ op: 'pending', allWorks: true })).json()
    assert.equal(Array.isArray(all), true)
    const wrongTenant = await f.post({ op: 'apply', scope: { ...scope, remoteCompanyId: 'outra' }, snapshot })
    assert.equal(wrongTenant.status, 403)
    const unknown = await f.post({ op: 'progressList', workId: 9999 })
    assert.equal(unknown.status, 404)
  } finally { await close(f) }
})

test('perfil sem Obra360 não altera o andamento no servidor', async () => {
  const f = await fixture('member', ['dre'])
  try {
    const response = await f.post({ op: 'progressSave', workId: f.work.id, nivel: 0, service: `etapa:${f.stage.id}`, status: 'completed' })
    assert.equal(response.status, 403)
  } finally { await close(f) }
})

test('servidor devolve contadores por local', async () => {
  const f = await fixture()
  try {
    const port = f.server.address().port
    const floor = f.repository.save('locais_obra', { obra_id: f.work.id, nome: 'Térreo', nivel: 0 })
    f.repository.save('tarefas_obra', { obra_id: f.work.id, titulo: 'X', local_id: floor.id, status: 'aberta', prioridade: 'normal' })
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/locais/counts?obra_id=${f.work.id}`, { headers: { authorization: `Bearer ${TOKEN}` } })
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.byLocal[floor.id].total, 1)
    assert.equal(body.open, 1)
  } finally { await close(f) }
})

test('servidor anuncia o Obra360 nas capacidades', async () => {
  const f = await fixture()
  try {
    const port = f.server.address().port
    const caps = await (await fetch(`http://127.0.0.1:${port}/api/v1/sync-source/capabilities`, { headers: { authorization: `Bearer ${TOKEN}` } })).json()
    assert.ok(caps.features.includes('obra360-field-inbox-v1'))
  } finally { await close(f) }
})
