import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import path from 'node:path'
import test from 'node:test'
import { LanRepository } from '../src/repository.mjs'
import { FieldService } from '../src/field-service.mjs'
import { createLanServer } from '../src/server.mjs'

const LAN_TOKEN = 'operation-device-token'
const digest = value => createHash('sha256').update(String(value)).digest('hex')
const migrationsDir = path.resolve(import.meta.dirname, '../migrations')

function security({ role = 'employee', modules = ['obra360'], deviceStatus = 'active' } = {}) {
  return {
    serverState() { return { claimed: true, companyId: 'company-a' } },
    deviceByTokenHash(value) {
      return value === digest(LAN_TOKEN) ? { id: 'device-op', memberId: 'member-op', status: deviceStatus } : null
    },
    member(id) {
      return id === 'member-op' ? { memberId: id, role, modules, channels: ['desktop'], status: 'active' } : null
    },
    touchDevice() {}
  }
}

async function fixture(options = {}) {
  const repository = new LanRepository({ filename: ':memory:' })
  repository.applyMigrations(migrationsDir)
  const company = repository.save('empresas', { razao_social: 'Empresa Operação' })
  const work = repository.save('obras', { empresa_id: company.id, nome: 'Obra Central' })
  const fieldService = new FieldService({ repository })
  const server = createLanServer({ repository, security: security(options), fieldService })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Servidor sem porta TCP.')
  return { repository, server, company, work, fieldService, baseUrl: `http://127.0.0.1:${address.port}` }
}

async function close(f) {
  f.server.close()
  await once(f.server, 'close')
  f.repository.close()
}

const headers = (json = false) => ({ authorization: `Bearer ${LAN_TOKEN}`, ...(json ? { 'content-type': 'application/json' } : {}) })
const request = (baseUrl, pathName, options = {}) => fetch(`${baseUrl}${pathName}`, { ...options, headers: { ...headers(options.body !== undefined), ...(options.headers || {}) } })

async function post(baseUrl, pathName, body) {
  return request(baseUrl, pathName, { method: 'POST', body: JSON.stringify(body) })
}

test('CRUD operacional autenticado compartilha frentes, RDOs, filhos e tarefas no banco central', async () => {
  const f = await fixture()
  try {
    const frontResponse = await post(f.baseUrl, '/api/v1/frentes_obra', { obra_id: f.work.id, nome: 'Torre A', status: 'ativa', serverToken: 'nao-persistir' })
    assert.equal(frontResponse.status, 201)
    const front = await frontResponse.json()
    assert.equal(front.nome, 'Torre A')
    assert.equal(Object.hasOwn(front, 'serverToken'), false)

    const rdoResponse = await post(f.baseUrl, '/api/v1/rdos', { obra_id: f.work.id, frente_id: front.id, data: '2026-09-30', atividades: 'Instalação hidráulica' })
    assert.equal(rdoResponse.status, 201)
    const rdo = await rdoResponse.json()

    const teamResponse = await post(f.baseUrl, '/api/v1/rdo_equipe', { rdo_id: rdo.id, frente_id: front.id, funcionario_id: 9001, nome: 'Equipe A', funcao: 'Encanador', horas: 8 })
    assert.equal(teamResponse.status, 201)
    const occurrenceResponse = await post(f.baseUrl, '/api/v1/rdo_ocorrencias', { rdo_id: rdo.id, frente_id: front.id, tipo: 'pendencia', descricao: 'Revisar prumada' })
    assert.equal(occurrenceResponse.status, 201)
    const occurrence = await occurrenceResponse.json()

    const taskResponse = await post(f.baseUrl, '/api/v1/tarefas_obra', { obra_id: f.work.id, frente_id: front.id, rdo_ocorrencia_id: occurrence.id, titulo: 'Revisar prumada', origem_tipo: 'rdo_ocorrencia', origem_id: occurrence.id })
    assert.equal(taskResponse.status, 201)
    const task = await taskResponse.json()

    const list = await request(f.baseUrl, `/api/v1/rdos?obra_id=${f.work.id}`)
    assert.equal(list.status, 200)
    assert.equal((await list.json()).length, 1)

    const removed = await request(f.baseUrl, `/api/v1/tarefas_obra/${task.id}`, { method: 'DELETE' })
    assert.equal(removed.status, 200)
    const visibleTasks = await request(f.baseUrl, `/api/v1/tarefas_obra?obra_id=${f.work.id}`)
    assert.deepEqual(await visibleTasks.json(), [])
  } finally { await close(f) }
})

test('POST /api/v1/field/rdo salva o agregado inteiro usando uma única rota de domínio', async () => {
  const f = await fixture()
  try {
    const front = f.repository.save('frentes_obra', { obra_id: f.work.id, nome: 'Torre B' })
    const response = await post(f.baseUrl, '/api/v1/field/rdo', {
      obra_id: f.work.id,
      frente_id: front.id,
      data: '2026-10-02',
      atividades: 'Teste de pressão',
      equipe: [{ nome: 'Equipe hidráulica', horas: 8 }],
      ocorrencias: [{ tipo: 'pendencia', descricao: 'Revisar conexão', status: 'aberta' }]
    })
    assert.equal(response.status, 201)
    const rdo = await response.json()
    assert.equal(rdo.obra_id, f.work.id)
    assert.equal(f.repository.connection().prepare('SELECT COUNT(*) AS n FROM rdo_equipe WHERE rdo_id=?').get(rdo.id).n, 1)
    assert.equal(f.repository.connection().prepare('SELECT COUNT(*) AS n FROM tarefas_obra WHERE obra_id=? AND deleted_at IS NULL').get(f.work.id).n, 1)
  } finally { await close(f) }
})

test('rota de domínio do RDO exige permissão operacional atual', async () => {
  const f = await fixture({ modules: [] })
  try {
    const response = await post(f.baseUrl, '/api/v1/field/rdo', { obra_id: f.work.id, data: '2026-10-03' })
    assert.equal(response.status, 403)
    assert.equal((await response.json()).error, 'forbidden')
  } finally { await close(f) }
})

test('operações rejeitam usuário sem módulo e dispositivo revogado', async () => {
  const noModule = await fixture({ modules: [] })
  try {
    const response = await request(noModule.baseUrl, `/api/v1/frentes_obra?obra_id=${noModule.work.id}`)
    assert.equal(response.status, 403)
    assert.equal((await response.json()).error, 'forbidden')
  } finally { await close(noModule) }

  const revoked = await fixture({ deviceStatus: 'revoked' })
  try {
    const response = await request(revoked.baseUrl, `/api/v1/rdos?obra_id=${revoked.work.id}`)
    assert.equal(response.status, 403)
    assert.equal((await response.json()).error, 'device_revoked')
  } finally { await close(revoked) }
})

test('FKs operacionais impedem vínculos com obra ou RDO inexistentes', async () => {
  const f = await fixture()
  try {
    const invalidFront = await post(f.baseUrl, '/api/v1/frentes_obra', { obra_id: 999999, nome: 'Inválida' })
    assert.equal(invalidFront.status, 400)
    assert.match((await invalidFront.json()).message, /referência/i)

    const invalidTeam = await post(f.baseUrl, '/api/v1/rdo_equipe', { rdo_id: 999999, nome: 'Sem RDO' })
    assert.equal(invalidTeam.status, 400)
    assert.match((await invalidTeam.json()).message, /referência/i)
  } finally { await close(f) }
})
