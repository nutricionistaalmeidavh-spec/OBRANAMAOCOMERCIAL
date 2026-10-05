import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { LanRepository } from '../src/repository.mjs'
import { MeasurementService } from '../src/measurement-service.mjs'

const migrationsDir = path.resolve(import.meta.dirname, '../migrations')

function fixture() {
  const repository = new LanRepository({ filename:':memory:' })
  repository.applyMigrations(migrationsDir)
  const company = repository.save('empresas', { razao_social:'Empresa Medição' })
  const work = repository.save('obras', { empresa_id:company.id, nome:'Obra Medição' })
  const front = repository.save('frentes_obra', { obra_id:work.id, nome:'Hidráulica' })
  const budget = repository.save('itens_orcamentarios', { obra_id:work.id, frente_id:front.id, descricao:'Tubulação', unidade:'m', quantidade:10, valor_unitario_centavos:1000, tipo:'material' })
  return { repository, company, work, front, budget, service:new MeasurementService({ repository }) }
}

function payload(f, overrides={}) {
  return {
    requestId:'measurement-request', obra_id:f.work.id, frente_id:f.front.id, numero:'M-01', competencia:'2026-10', data:'2026-10-01',
    status:'faturada', valor_bruto_centavos:5000, valor_liquido_centavos:5000,
    itens:[{ item_orcamentario_id:f.budget.id, quantidade_periodo:5, valor_periodo_centavos:5000 }],
    conta:{ empresa_id:f.company.id, competencia:'2026-10', vencimento:'2026-10-15' },
    ...overrides
  }
}

test('medição salva cabeçalho, itens e conta em uma transação versionada', () => {
  const f=fixture()
  try {
    const saved=f.service.save(payload(f))
    assert.equal(saved.revision,1)
    assert.equal(saved.itens.length,1)
    const account=f.repository.connection().prepare("SELECT * FROM contas WHERE origem_tipo='medicao' AND origem_id=?").get(saved.id)
    assert.ok(account)
    assert.equal(account.valor_centavos,5000)
  } finally { f.repository.close() }
})

test('criação de medição é idempotente em replay do mesmo requestId', () => {
  const f=fixture()
  try {
    const first=f.service.save(payload(f))
    const replay=f.service.save(payload(f))
    assert.equal(replay.id, first.id)
    assert.equal(replay.replayed, true)
    assert.equal(f.repository.connection().prepare('SELECT COUNT(*) n FROM medicoes').get().n,1)
    assert.equal(f.repository.connection().prepare('SELECT COUNT(*) n FROM medicao_itens').get().n,1)
  } finally { f.repository.close() }
})

test('excesso sem justificativa não deixa medição parcial', () => {
  const f=fixture()
  try {
    assert.throws(()=>f.service.save(payload(f,{requestId:'measurement-over',numero:'M-X',itens:[{item_orcamentario_id:f.budget.id,quantidade_periodo:11,valor_periodo_centavos:11000}]})),/excede o orçamento/i)
    assert.equal(f.repository.connection().prepare('SELECT COUNT(*) n FROM medicoes').get().n,0)
    assert.equal(f.repository.connection().prepare('SELECT COUNT(*) n FROM medicao_itens').get().n,0)
  } finally { f.repository.close() }
})

test('edição concorrente de medição exige revision atual', () => {
  const f=fixture()
  try {
    const saved=f.service.save(payload(f))
    const updated=f.service.save(payload(f,{id:saved.id,expectedRevision:saved.revision,descricao:'Atualizada'}))
    assert.equal(updated.revision,saved.revision+1)
    assert.throws(()=>f.service.save(payload(f,{id:saved.id,expectedRevision:saved.revision,descricao:'Stale'})),/revis|conflit/i)
  } finally { f.repository.close() }
})
