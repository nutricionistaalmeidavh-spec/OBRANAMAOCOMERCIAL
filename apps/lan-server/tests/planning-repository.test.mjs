import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { LanRepository } from '../src/repository.mjs'

const migrationsDir = path.resolve(import.meta.dirname, '../migrations')

function fixture() {
  const repository = new LanRepository({ filename: ':memory:' })
  repository.applyMigrations(migrationsDir)
  const company = repository.save('empresas', { razao_social: 'Empresa Planejamento' })
  const work = repository.save('obras', { empresa_id: company.id, nome: 'Obra A' })
  const otherWork = repository.save('obras', { empresa_id: company.id, nome: 'Obra B' })
  const front = repository.save('frentes_obra', { obra_id: work.id, nome: 'Torre A' })
  const otherFront = repository.save('frentes_obra', { obra_id: otherWork.id, nome: 'Torre B' })
  return { repository, work, otherWork, front, otherFront }
}

test('schema central cria etapas, cronograma e orçamento com CRUD equivalente ao Desktop', () => {
  const f = fixture()
  try {
    const stage = f.repository.save('etapas_obra', { obra_id: f.work.id, frente_id: f.front.id, nome: 'Hidráulica', ordem: 2, status: 'em_andamento' })
    const schedule = f.repository.save('cronograma_etapas', {
      obra_id: f.work.id,
      etapa_id: stage.id,
      frente_id: f.front.id,
      nome: 'Prumadas',
      previsto_inicio: '2026-10-01',
      previsto_fim: '2026-10-10',
      percentual_previsto: 60,
      percentual_realizado: 25,
      custo_planejado_centavos: 125000,
      custo_realizado_centavos: 45000,
      status: 'em_andamento'
    })
    const budget = f.repository.save('itens_orcamentarios', {
      obra_id: f.work.id,
      etapa_id: stage.id,
      frente_id: f.front.id,
      codigo: 'HID-01',
      descricao: 'Tubulação PVC',
      unidade: 'm',
      quantidade: 10,
      valor_unitario_centavos: 2500,
      tipo: 'material'
    })

    assert.equal(schedule.percentual_realizado, 25)
    assert.equal(f.repository.list('etapas_obra', { obra_id: f.work.id }).length, 1)
    assert.equal(f.repository.list('cronograma_etapas', { obra_id: f.work.id }).length, 1)
    assert.equal(f.repository.list('itens_orcamentarios', { obra_id: f.work.id }).length, 1)
    assert.equal(Number(budget.quantidade) * Number(budget.valor_unitario_centavos), 25000)

    const updated = f.repository.save('cronograma_etapas', { ...schedule, percentual_realizado: 55 })
    assert.equal(updated.percentual_realizado, 55)
  } finally { f.repository.close() }
})

test('planejamento central mantém constraints de percentual, custo e quantidade', () => {
  const f = fixture()
  try {
    assert.throws(() => f.repository.save('cronograma_etapas', { obra_id: f.work.id, nome: 'Inválida', percentual_previsto: 101 }), /CHECK|percentual/i)
    assert.throws(() => f.repository.save('cronograma_etapas', { obra_id: f.work.id, nome: 'Custo inválido', custo_planejado_centavos: -1 }), /CHECK|custo/i)
    assert.throws(() => f.repository.save('itens_orcamentarios', { obra_id: f.work.id, descricao: 'Qtd inválida', unidade: 'un', quantidade: -1, valor_unitario_centavos: 100, tipo: 'material' }), /CHECK|quantidade/i)
  } finally { f.repository.close() }
})

test('etapa, cronograma e orçamento rejeitam frente ou etapa pertencente a outra obra', () => {
  const f = fixture()
  try {
    const stageA = f.repository.save('etapas_obra', { obra_id: f.work.id, frente_id: f.front.id, nome: 'Etapa A' })
    const stageB = f.repository.save('etapas_obra', { obra_id: f.otherWork.id, frente_id: f.otherFront.id, nome: 'Etapa B' })

    assert.throws(() => f.repository.save('etapas_obra', { obra_id: f.work.id, frente_id: f.otherFront.id, nome: 'Etapa cruzada' }), /mesma obra|obra/i)
    assert.throws(() => f.repository.save('cronograma_etapas', { obra_id: f.work.id, etapa_id: stageB.id, frente_id: f.front.id, nome: 'Cronograma cruzado' }), /mesma obra|obra/i)
    assert.throws(() => f.repository.save('itens_orcamentarios', { obra_id: f.work.id, etapa_id: stageA.id, frente_id: f.otherFront.id, descricao: 'Item cruzado', unidade: 'un', quantidade: 1, valor_unitario_centavos: 100, tipo: 'material' }), /mesma obra|obra/i)
  } finally { f.repository.close() }
})
