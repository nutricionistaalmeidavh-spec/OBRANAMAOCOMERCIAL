import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { LanRepository } from '../src/repository.mjs'
import { FieldService } from '../src/field-service.mjs'
import { PayrollService } from '../src/payroll-service.mjs'
import { TimeService } from '../src/time-service.mjs'

const migrationsDir = path.resolve(import.meta.dirname, '../migrations')

function baseRepository(label) {
  const repository = new LanRepository({ filename: ':memory:' })
  repository.applyMigrations(migrationsDir)
  const company = repository.save('empresas', { razao_social: `Empresa ${label}` })
  return { repository, company }
}

test('RDO stale root revision cannot replace children after another client saves', () => {
  const { repository, company } = baseRepository('RDO concorrente')
  try {
    const work = repository.save('obras', { empresa_id: company.id, nome: 'Obra concorrente' })
    const front = repository.save('frentes_obra', { obra_id: work.id, nome: 'Torre A' })
    const field = new FieldService({ repository })
    const original = field.saveDailyReport({
      obra_id: work.id,
      frente_id: front.id,
      data: '2026-10-01',
      atividades: 'Original',
      equipe: [{ nome: 'Equipe original', horas: 8 }]
    })
    const observedRevision = original.revision ?? 1

    const first = field.saveDailyReport({
      id: original.id,
      expectedRevision: observedRevision,
      obra_id: work.id,
      frente_id: front.id,
      data: '2026-10-01',
      atividades: 'PC A',
      equipe: [{ nome: 'Equipe A', horas: 8 }]
    })
    assert.equal(first.revision, observedRevision + 1)

    assert.throws(() => field.saveDailyReport({
      id: original.id,
      expectedRevision: observedRevision,
      obra_id: work.id,
      frente_id: front.id,
      data: '2026-10-01',
      atividades: 'PC B stale',
      equipe: [{ nome: 'Equipe B', horas: 8 }]
    }), error => error?.code === 'revision_conflict' && error.currentRevision === observedRevision + 1)

    const root = repository.get('rdos', original.id)
    const team = repository.connection().prepare('SELECT * FROM rdo_equipe WHERE rdo_id=?').all(original.id)
    assert.equal(root.atividades, 'PC A')
    assert.equal(team.length, 1)
    assert.equal(team[0].nome, 'Equipe A')
  } finally { repository.close() }
})

test('stale payroll confirmation conflicts before duplicating or mutating sheet children', () => {
  const { repository, company } = baseRepository('Folha concorrente')
  try {
    const cargo = repository.save('cargos', { empresa_id: company.id, nome: 'Encanador', salario_base_centavos: 250000, ativo: 1 })
    const employee = repository.save('funcionarios', { empresa_id: company.id, cargo_id: cargo.id, nome: 'Funcionário', status: 'ativo', salario_centavos: 250000 })
    const payroll = new PayrollService({ repository })
    const state = payroll.getEmployee({ funcionario_id: employee.id, competencia: '2026-10' })
    const observedRevision = state.sheet.revision ?? 1

    const payment = payroll.confirm({
      funcionario_id: employee.id,
      competencia: '2026-10',
      quinzena: 1,
      data: '2026-10-15',
      expectedRevision: observedRevision
    })
    assert.equal(payment.sheetRevision, observedRevision + 1)
    const paymentCount = repository.connection().prepare('SELECT COUNT(*) AS n FROM pagamentos_funcionario').get().n

    assert.throws(() => payroll.confirm({
      funcionario_id: employee.id,
      competencia: '2026-10',
      quinzena: 1,
      data: '2026-10-15',
      expectedRevision: observedRevision
    }), error => error?.code === 'revision_conflict' && error.currentRevision === observedRevision + 1)

    assert.equal(repository.connection().prepare('SELECT COUNT(*) AS n FROM pagamentos_funcionario').get().n, paymentCount)
    const after = payroll.getEmployee({ funcionario_id: employee.id, competencia: '2026-10' })
    assert.equal(after.sheet.revision, observedRevision + 1)
    assert.ok(after.launches.filter(item => item.quinzena === 1).every(item => item.status === 'pago'))
  } finally { repository.close() }
})

test('stale monthly-time save leaves root and marks from newer client untouched', () => {
  const { repository, company } = baseRepository('Ponto concorrente')
  try {
    const employee = repository.save('funcionarios', {
      empresa_id: company.id,
      nome: 'Funcionário Ponto',
      status: 'ativo',
      jornada_inicio: '07:00',
      intervalo_inicio: '11:00',
      intervalo_fim: '12:00',
      jornada_fim: '17:00'
    })
    const time = new TimeService({ repository })
    const observed = time.get({ funcionario_id: employee.id, competencia: '2026-10' })
    const observedRevision = observed.point.revision ?? 1

    const first = time.save({
      funcionario_id: employee.id,
      competencia: '2026-10',
      expectedRevision: observedRevision,
      marks: [{ data: '2026-10-01', tipo: 'trabalho', entrada: '07:01', saida: '17:01' }]
    })
    assert.equal(first.point.revision, observedRevision + 1)

    assert.throws(() => time.save({
      funcionario_id: employee.id,
      competencia: '2026-10',
      expectedRevision: observedRevision,
      marks: [{ data: '2026-10-01', tipo: 'trabalho', entrada: '08:30', saida: '18:30' }]
    }), error => error?.code === 'revision_conflict' && error.currentRevision === observedRevision + 1)

    const after = time.get({ funcionario_id: employee.id, competencia: '2026-10' })
    assert.equal(after.point.revision, observedRevision + 1)
    assert.equal(after.marks[0].entrada, '07:01')
    assert.equal(after.marks[0].saida, '17:01')
  } finally { repository.close() }
})
