import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { LanRepository } from '../src/repository.mjs'
import { PayrollService } from '../src/payroll-service.mjs'

const migrationsDir = path.resolve(import.meta.dirname, '../migrations')

function fixture() {
  const repository = new LanRepository({ filename: ':memory:' })
  repository.applyMigrations(migrationsDir)
  const company = repository.save('empresas', { razao_social: 'Empresa Folha' })
  const cargo = repository.save('cargos', { empresa_id: company.id, nome: 'Encanador', salario_base_centavos: 250000, ativo: 1 })
  const benefit = repository.save('beneficios', { empresa_id: company.id, nome: 'Café', tipo: 'alimentacao', valor_padrao_centavos: 18000, ativo: 1 })
  repository.save('cargo_beneficios', { empresa_id: company.id, cargo_id: cargo.id, beneficio_id: benefit.id, valor_centavos: 18000, quinzena: 1, natureza: 'credito', ativo: 1 })
  const employee = repository.save('funcionarios', { empresa_id: company.id, cargo_id: cargo.id, nome: 'Funcionário Central', status: 'ativo', salario_centavos: 250000 })
  return { repository, company, cargo, benefit, employee, payroll: new PayrollService({ repository }) }
}

test('folha central pré-cria salário/benefícios e aceita variável com paridade local', () => {
  const f = fixture()
  try {
    const first = f.payroll.getEmployee({ funcionario_id: f.employee.id, competencia: '2026-10' })
    assert.ok(first.launches.some(item => item.tipo === 'salario' && !item.editavel))
    assert.ok(first.launches.some(item => item.descricao === 'Café' && !item.editavel))
    f.payroll.saveVariable({ funcionario_id: f.employee.id, competencia: '2026-10', tipo: 'diaria', descricao: 'Diária', natureza: 'credito', quinzena: 1, valor_centavos: 10000 })
    const updated = f.payroll.getEmployee({ funcionario_id: f.employee.id, competencia: '2026-10' })
    assert.equal(updated.launches.find(item => item.tipo === 'diaria').editavel, 1)
  } finally { f.repository.close() }
})

test('folha central confirma quinzena atomicamente e rejeita confirmação duplicada', () => {
  const f = fixture()
  try {
    f.payroll.getEmployee({ funcionario_id: f.employee.id, competencia: '2026-10' })
    const payment = f.payroll.confirm({ funcionario_id: f.employee.id, competencia: '2026-10', quinzena: 1, data: '2026-10-15', forma_pagamento: 'PIX' })
    assert.equal(payment.status, 'pago')
    assert.equal(payment.valor_centavos, 268000)
    assert.throws(() => f.payroll.confirm({ funcionario_id: f.employee.id, competencia: '2026-10', quinzena: 1, data: '2026-10-15' }), /confirmada/i)
    const state = f.payroll.getEmployee({ funcionario_id: f.employee.id, competencia: '2026-10' })
    assert.ok(state.launches.filter(item => item.quinzena === 1).every(item => item.status === 'pago'))
  } finally { f.repository.close() }
})

test('falha após inserir pagamento reverte toda confirmação da folha', () => {
  const f = fixture()
  try {
    const state = f.payroll.getEmployee({ funcionario_id: f.employee.id, competencia: '2026-10' })
    assert.ok(state.launches.length > 0)
    f.repository.connection().exec(`
      CREATE TRIGGER fail_payroll_launch_update BEFORE UPDATE OF status ON folha_lancamentos
      WHEN NEW.status='pago' BEGIN SELECT RAISE(ABORT, 'falha injetada folha'); END;
    `)
    assert.throws(() => f.payroll.confirm({ funcionario_id: f.employee.id, competencia: '2026-10', quinzena: 1, data: '2026-10-15' }), /falha injetada/i)
    assert.equal(f.repository.connection().prepare('SELECT COUNT(*) AS n FROM pagamentos_funcionario').get().n, 0)
    assert.equal(f.repository.connection().prepare("SELECT COUNT(*) AS n FROM folha_lancamentos WHERE status='pago'").get().n, 0)
  } finally { f.repository.close() }
})

test('pending central preserva a regra local: segunda quinzena só existe quando há lançamento e apenas funcionário ativo entra', () => {
  const f = fixture()
  try {
    const inactive = f.repository.save('funcionarios', { empresa_id: f.company.id, cargo_id: f.cargo.id, nome: 'Funcionário Inativo', status: 'inativo', salario_centavos: 250000 })
    const pending1 = f.payroll.pending('2026-10')
    assert.ok(pending1.some(item => item.funcionario_id === f.employee.id && item.quinzena === 1))
    assert.equal(pending1.some(item => item.funcionario_id === inactive.id), false)

    f.payroll.saveVariable({ funcionario_id: f.employee.id, competencia: '2026-10', tipo: 'diaria_2q', descricao: 'Diária 2ª quinzena', natureza: 'credito', quinzena: 2, valor_centavos: 10000 })
    f.payroll.confirm({ funcionario_id: f.employee.id, competencia: '2026-10', quinzena: 1, data: '2026-10-15' })
    const pending2 = f.payroll.pending('2026-10')
    assert.ok(pending2.some(item => item.funcionario_id === f.employee.id && item.quinzena === 2 && item.valor_centavos === 10000))
    assert.equal(pending2.some(item => item.funcionario_id === inactive.id), false)
  } finally { f.repository.close() }
})
