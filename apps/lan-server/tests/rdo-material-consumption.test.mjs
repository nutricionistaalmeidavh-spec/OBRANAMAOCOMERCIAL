import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { LanRepository } from '../src/repository.mjs'
import { RdoMaterialConsumption } from '../src/rdo-material-consumption.mjs'

const migrationsDir = path.resolve(import.meta.dirname, '../migrations')
function fixture() {
  const repository = new LanRepository({ filename: ':memory:' })
  repository.applyMigrations(migrationsDir)
  const company = repository.save('empresas', { razao_social: 'Empresa Teste' })
  const work = repository.save('obras', { empresa_id: company.id, nome: 'Obra Teste' })
  const front = repository.save('frentes_obra', { obra_id: work.id, nome: 'Hidráulica' })
  const rdo = repository.save('rdos', { obra_id: work.id, frente_id: front.id, data: '2026-11-15', status: 'rascunho' })
  repository.save('movimentacoes_estoque', { obra_id: work.id, frente_id: null, tipo: 'entrada', descricao: 'Tubo PVC 25 mm', unidade: 'm', quantidade: 40, data: '2026-11-15', request_id: 'entrada-1' })
  return { repository, company, work, front, rdo, service: new RdoMaterialConsumption({ repository }) }
}
const item = (front, quantity) => ({ id: 'tubo-25', descricao: 'Tubo PVC 25 mm', unidade: 'm', frente_id: front.id, quantidade: quantity })
const payload = (f, quantity, requestId, expectedRevision) => ({ rdoId: f.rdo.id, requestId, expectedRevision, items: [item(f.front, quantity)] })
const balance = f => f.repository.connection().prepare("SELECT COALESCE(SUM(CASE WHEN tipo='saida' THEN -quantidade ELSE quantidade END),0) saldo FROM movimentacoes_estoque WHERE obra_id=?").get(f.work.id).saldo

test('RDO baixa estoque somente uma vez em chamadas repetidas com a mesma chave', () => {
  const f = fixture()
  try {
    const first = f.service.save(payload(f, 12, 'rdo-material-1', 0))
    const again = f.service.save(payload(f, 12, 'rdo-material-1', 0))
    assert.equal(first.revision, 1)
    assert.equal(again.replayed, true)
    assert.equal(balance(f), 28)
    assert.equal(f.repository.connection().prepare("SELECT COUNT(*) n FROM movimentacoes_estoque WHERE tipo='saida'").get().n, 1)
  } finally { f.repository.close() }
})

test('correção de 12 para 10 repõe 2 sem outra saída de 10', () => {
  const f = fixture()
  try {
    f.service.save(payload(f, 12, 'rdo-material-1', 0))
    const corrected = f.service.save(payload(f, 10, 'rdo-material-2', 1))
    assert.equal(corrected.revision, 2)
    assert.equal(balance(f), 30)
    assert.equal(f.repository.connection().prepare("SELECT COUNT(*) n FROM movimentacoes_estoque WHERE tipo='saida'").get().n, 1)
    assert.equal(f.repository.connection().prepare("SELECT COUNT(*) n FROM movimentacoes_estoque WHERE tipo='entrada'").get().n, 2)
  } finally { f.repository.close() }
})

test('falha por saldo insuficiente não deixa consumos parciais', () => {
  const f = fixture()
  try {
    assert.throws(() => f.service.save(payload(f, 45, 'rdo-material-1', 0)), /insuficiente|negativo/i)
    assert.equal(balance(f), 40)
    assert.equal(f.repository.connection().prepare('SELECT COUNT(*) n FROM rdo_material_linhas').get().n, 0)
  } finally { f.repository.close() }
})

test('revisão desatualizada ou repetição alterada são rejeitadas', () => {
  const f = fixture()
  try {
    f.service.save(payload(f, 12, 'rdo-material-1', 0))
    assert.throws(() => f.service.save(payload(f, 13, 'rdo-material-1', 0)), /idempotente|reutilizad/i)
    assert.throws(() => f.service.save(payload(f, 13, 'rdo-material-2', 0)), /revisão|revisao|conflito/i)
    assert.equal(balance(f), 28)
  } finally { f.repository.close() }
})

test('consumo precisa pertencer à mesma obra do RDO', () => {
  const f = fixture()
  try {
    const otherWork = f.repository.save('obras', { empresa_id: f.company.id, nome: 'Outra Obra' })
    const otherFront = f.repository.save('frentes_obra', { obra_id: otherWork.id, nome: 'Frente Externa' })
    assert.throws(() => f.service.save({ ...payload(f, 2, 'rdo-material-2', 0), items: [item(otherFront, 2)] }), /frente|obra/i)
    assert.equal(balance(f), 40)
  } finally { f.repository.close() }
})
