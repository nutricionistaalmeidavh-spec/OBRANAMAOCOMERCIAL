import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { LanRepository } from '../src/repository.mjs'
import { TimeService } from '../src/time-service.mjs'

const migrationsDir = path.resolve(import.meta.dirname, '../migrations')

function fixture() {
  const repository = new LanRepository({ filename: ':memory:' })
  repository.applyMigrations(migrationsDir)
  const company = repository.save('empresas', { razao_social: 'Empresa Ponto', cnpj: '12345678000100' })
  const cargo = repository.save('cargos', { empresa_id: company.id, nome: 'Encanador', salario_base_centavos: 300000 })
  const benefit = repository.save('beneficios', { empresa_id: company.id, nome: 'Vale refeição', tipo: 'alimentacao', valor_padrao_centavos: 25000 })
  repository.save('cargo_beneficios', { empresa_id: company.id, cargo_id: cargo.id, beneficio_id: benefit.id, valor_centavos: 25000, quinzena: 1, natureza: 'credito', ativo: 1 })
  const employee = repository.save('funcionarios', {
    empresa_id: company.id,
    cargo_id: cargo.id,
    nome: 'Funcionário Ponto',
    cpf: '11122233344',
    status: 'ativo',
    jornada_inicio: '07:00',
    intervalo_inicio: '11:00',
    intervalo_fim: '12:00',
    jornada_fim: '17:00'
  })
  return { repository, company, cargo, benefit, employee, time: new TimeService({ repository }) }
}

test('ponto central cria competência e autofill determinístico preserva fins de semana', () => {
  const f = fixture()
  try {
    const first = f.time.autoFill({ funcionario_id: f.employee.id, competencia: '2026-10' })
    assert.equal(first.marks.length, 31)
    assert.ok(first.marks.some(mark => mark.tipo === 'sabado'))
    assert.ok(first.marks.some(mark => mark.tipo === 'domingo'))
    const snapshot = first.marks.map(mark => [mark.data, mark.tipo, mark.entrada, mark.saida])
    const second = f.time.autoFill({ funcionario_id: f.employee.id, competencia: '2026-10', overwrite: true })
    assert.deepEqual(second.marks.map(mark => [mark.data, mark.tipo, mark.entrada, mark.saida]), snapshot)
    assert.equal(second.point.preenchimento_automatico, 1)
  } finally { f.repository.close() }
})

test('save central atualiza marcações atomicamente e normaliza horários/tipo', () => {
  const f = fixture()
  try {
    const state = f.time.save({ funcionario_id: f.employee.id, competencia: '2026-10', marks: [
      { data: '2026-10-01', tipo: 'trabalho', entrada: '07:02', intervalo_saida: '11:00', intervalo_entrada: '12:00', saida: '17:03', observacoes: 'normal' },
      { data: '2026-10-02', tipo: 'falta', entrada: '07:00', saida: '17:00', observacoes: 'atestado' }
    ] })
    assert.equal(state.point.status, 'preenchido')
    assert.equal(state.marks[0].entrada, '07:02')
    assert.equal(state.marks[1].entrada, null)
    assert.equal(state.marks[1].tipo, 'falta')

    f.repository.connection().exec(`
      CREATE TRIGGER fail_time_mark BEFORE INSERT ON ponto_marcacoes
      WHEN NEW.data='2026-10-04' BEGIN SELECT RAISE(ABORT, 'falha injetada ponto'); END;
    `)
    assert.throws(() => f.time.save({ funcionario_id: f.employee.id, competencia: '2026-10', marks: [
      { data: '2026-10-03', tipo: 'trabalho', entrada: '07:00', saida: '17:00' },
      { data: '2026-10-04', tipo: 'trabalho', entrada: '07:00', saida: '17:00' }
    ] }), /falha injetada ponto/i)
    assert.equal(f.repository.connection().prepare("SELECT COUNT(*) AS n FROM ponto_marcacoes WHERE data='2026-10-03'").get().n, 0)
  } finally { f.repository.close() }
})

test('document-context retorna somente contexto RH central necessário à geração local', () => {
  const f = fixture()
  try {
    f.time.save({ funcionario_id: f.employee.id, competencia: '2026-10', marks: [{ data: '2026-10-01', tipo: 'trabalho', entrada: '07:00', saida: '17:00' }] })
    const context = f.time.documentContext({ funcionario_id: f.employee.id, competencia: '2026-10' })
    assert.equal(context.employee.nome, 'Funcionário Ponto')
    assert.equal(context.company.razao_social, 'Empresa Ponto')
    assert.equal(context.cargo.nome, 'Encanador')
    assert.equal(context.benefits[0].descricao, 'Vale refeição')
    assert.equal(context.marks[0].data, '2026-10-01')
    assert.equal(context.documentStorage, 'local-derived')
  } finally { f.repository.close() }
})

test('ponto central rejeita funcionário removido e não cruza empresa', () => {
  const f = fixture()
  try {
    f.repository.remove('funcionarios', f.employee.id)
    assert.throws(() => f.time.get({ funcionario_id: f.employee.id, competencia: '2026-10' }), /Funcionário/i)
  } finally { f.repository.close() }
})
