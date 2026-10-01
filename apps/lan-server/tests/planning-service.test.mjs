import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import path from 'node:path'
import test from 'node:test'
import { LanRepository } from '../src/repository.mjs'
import { PlanningService } from '../src/planning-service.mjs'
import { createLanServer } from '../src/server.mjs'

const migrationsDir = path.resolve(import.meta.dirname, '../migrations')
const TOKEN = 'planning-device-token'
const digest = value => createHash('sha256').update(String(value)).digest('hex')

function seed() {
  const repository = new LanRepository({ filename: ':memory:' })
  repository.applyMigrations(migrationsDir)
  const company = repository.save('empresas', { razao_social: 'Empresa Planejamento' })
  const work = repository.save('obras', { empresa_id: company.id, nome: 'Obra A' })
  const frontA = repository.save('frentes_obra', { obra_id: work.id, nome: 'Torre A', ordem: 1 })
  const frontB = repository.save('frentes_obra', { obra_id: work.id, nome: 'Torre B', ordem: 2 })
  const stageA = repository.save('etapas_obra', { obra_id: work.id, frente_id: frontA.id, nome: 'Hidráulica', ordem: 1 })
  const stageB = repository.save('etapas_obra', { obra_id: work.id, frente_id: frontB.id, nome: 'Acabamento', ordem: 2 })
  repository.save('cronograma_etapas', { obra_id: work.id, etapa_id: stageA.id, frente_id: frontA.id, nome: 'Prumadas', previsto_fim: '2026-10-10', percentual_previsto: 50, percentual_realizado: 20, custo_planejado_centavos: 10000, custo_realizado_centavos: 2500 })
  repository.save('cronograma_etapas', { obra_id: work.id, etapa_id: stageB.id, frente_id: frontB.id, nome: 'Louças', previsto_fim: '2026-10-20', percentual_previsto: 100, percentual_realizado: 40, custo_planejado_centavos: 20000, custo_realizado_centavos: 7000 })
  repository.save('itens_orcamentarios', { obra_id: work.id, etapa_id: stageA.id, frente_id: frontA.id, descricao: 'Tubos', unidade: 'm', quantidade: 10, valor_unitario_centavos: 500, tipo: 'material' })
  repository.save('itens_orcamentarios', { obra_id: work.id, etapa_id: stageB.id, frente_id: frontB.id, descricao: 'Louças', unidade: 'un', quantidade: 2, valor_unitario_centavos: 2500, tipo: 'material' })
  return { repository, work, frontA, frontB }
}

function security({ modules = ['obra360'], status = 'active' } = {}) {
  return {
    serverState() { return { claimed: true, companyId: 'company-a' } },
    deviceByTokenHash(value) { return value === digest(TOKEN) ? { id: 'device-planning', memberId: 'member-planning', status } : null },
    member(id) { return id === 'member-planning' ? { memberId: id, role: 'employee', modules, channels: ['desktop'], status: 'active' } : null },
    touchDevice() {}
  }
}

test('overview central preserva shape público, curva acumulada e orçamento sem misturar financeiro local', () => {
  const f = seed()
  try {
    const service = new PlanningService({ repository: f.repository })
    const overview = service.overview(f.work.id)
    assert.equal(overview.budget_centavos, 10000)
    assert.deepEqual(overview.curve.map(item => [item.nome, item.previsto_centavos, item.realizado_centavos]), [
      ['Prumadas', 10000, 2500],
      ['Louças', 30000, 9500]
    ])
    assert.deepEqual(overview.cash, [])
    assert.deepEqual(overview.fronts.map(item => [item.nome, item.orcado_centavos, item.realizado_centavos]), [
      ['Torre A', 5000, 0],
      ['Torre B', 5000, 0]
    ])
  } finally { f.repository.close() }
})

test('overview central rejeita obra ausente ou removida', () => {
  const f = seed()
  try {
    const service = new PlanningService({ repository: f.repository })
    assert.throws(() => service.overview(99999), /obra.*não encontrada|obra.*inexistente/i)
    f.repository.remove('obras', f.work.id)
    assert.throws(() => service.overview(f.work.id), /obra.*não encontrada|obra.*inexistente/i)
  } finally { f.repository.close() }
})

test('GET planning overview exige autenticação e permissão operacional', async () => {
  const f = seed()
  const server = createLanServer({ repository: f.repository, security: security(), planningService: new PlanningService({ repository: f.repository }) })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Servidor sem porta TCP.')
  const baseUrl = `http://127.0.0.1:${address.port}`
  try {
    const unauthenticated = await fetch(`${baseUrl}/api/v1/planning/overview?obra_id=${f.work.id}`)
    assert.equal(unauthenticated.status, 401)
    const allowed = await fetch(`${baseUrl}/api/v1/planning/overview?obra_id=${f.work.id}`, { headers: { authorization: `Bearer ${TOKEN}` } })
    assert.equal(allowed.status, 200)
    assert.equal((await allowed.json()).budget_centavos, 10000)
  } finally {
    server.close(); await once(server, 'close'); f.repository.close()
  }

  const deniedFixture = seed()
  const deniedServer = createLanServer({ repository: deniedFixture.repository, security: security({ modules: [] }), planningService: new PlanningService({ repository: deniedFixture.repository }) })
  deniedServer.listen(0, '127.0.0.1')
  await once(deniedServer, 'listening')
  const deniedAddress = deniedServer.address()
  if (!deniedAddress || typeof deniedAddress === 'string') throw new Error('Servidor sem porta TCP.')
  try {
    const denied = await fetch(`http://127.0.0.1:${deniedAddress.port}/api/v1/planning/overview?obra_id=${deniedFixture.work.id}`, { headers: { authorization: `Bearer ${TOKEN}` } })
    assert.equal(denied.status, 403)
  } finally {
    deniedServer.close(); await once(deniedServer, 'close'); deniedFixture.repository.close()
  }
})
