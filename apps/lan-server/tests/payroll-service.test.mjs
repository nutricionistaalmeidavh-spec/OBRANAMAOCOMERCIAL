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
    assert.equal(first.sheet.revision, 1)
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
    const initial = f.payroll.getEmployee({ funcionario_id: f.employee.id, competencia: '2026-10' })
    const payment = f.payroll.confirm({ funcionario_id: f.employee.id, competencia: '2026-10', quinzena: 1, data: '2026-10-15', forma_pagamento: 'PIX', expectedRevision: initial.sheet.revision })
    assert.equal(payment.status, 'pago')
    assert.equal(payment.valor_centavos, 268000)
    assert.equal(payment.sheetRevision, initial.sheet.revision + 1)

    const current = f.payroll.getEmployee({ funcionario_id: f.employee.id, competencia: '2026-10' })
    assert.throws(() => f.payroll.confirm({ funcionario_id: f.employee.id, competencia: '2026-10', quinzena: 1, data: '2026-10-15', expectedRevision: current.sheet.revision }), /confirmada/i)
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
    assert.throws(() => f.payroll.confirm({ funcionario_id: f.employee.id, competencia: '2026-10', quinzena: 1, data: '2026-10-15', expectedRevision: state.sheet.revision }), /falha injetada/i)
    assert.equal(f.repository.connection().prepare('SELECT COUNT(*) AS n FROM pagamentos_funcionario').get().n, 0)
    assert.equal(f.repository.connection().prepare("SELECT COUNT(*) AS n FROM folha_lancamentos WHERE status='pago'").get().n, 0)
    assert.equal(f.payroll.getEmployee({ funcionario_id: f.employee.id, competencia: '2026-10' }).sheet.revision, state.sheet.revision)
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
    const beforeConfirm = f.payroll.getEmployee({ funcionario_id: f.employee.id, competencia: '2026-10' })
    f.payroll.confirm({ funcionario_id: f.employee.id, competencia: '2026-10', quinzena: 1, data: '2026-10-15', expectedRevision: beforeConfirm.sheet.revision })
    const pending2 = f.payroll.pending('2026-10')
    assert.ok(pending2.some(item => item.funcionario_id === f.employee.id && item.quinzena === 2 && item.valor_centavos === 10000))
    assert.equal(pending2.some(item => item.funcionario_id === inactive.id), false)
  } finally { f.repository.close() }
})


test('visão geral central consolida folha e contas da competência com o mesmo contrato', () => {
  const f = fixture()
  try {
    f.payroll.getEmployee({ funcionario_id: f.employee.id, competencia: '2026-10' })
    f.payroll.saveVariable({ funcionario_id: f.employee.id, competencia: '2026-10', tipo: 'vale_salario', descricao: 'Vale / adiantamento', natureza: 'credito', quinzena: 2, valor_centavos: 50000 })
    const category = f.repository.save('categorias_financeiras', { empresa_id:f.company.id, nome:'Impostos overview', natureza:'despesa', grupo_dre:'operacional', ativa:1 })
    f.repository.save('contas', { empresa_id:f.company.id, tipo:'pagar', categoria_id:category.id, descricao:'DAS Simples Nacional', competencia:'2026-10', vencimento:'2026-10-20', valor_bruto_centavos:435000, valor_centavos:435000, status:'pendente' })
    f.repository.save('contas', { empresa_id:f.company.id, tipo:'pagar', categoria_id:category.id, descricao:'Folha Funcionário Central', competencia:'2026-10', vencimento:'2026-10-05', valor_bruto_centavos:318000, valor_centavos:318000, status:'pendente', origem_tipo:'folha_pagamento' })

    const overview = f.payroll.overview({ competencia:'2026-10', empresa_id:f.company.id })
    assert.equal(overview.contract_version, 1)
    assert.equal(overview.employees.length, 1)
    assert.equal(overview.employees[0].remuneracao.salario_centavos, 250000)
    assert.equal(overview.employees[0].remuneracao.vale_adiantamento_centavos, 50000)
    assert.equal(overview.employees[0].beneficios.alimentacao_centavos, 18000)
    assert.deepEqual(overview.company_expenses.map(item => item.descricao), ['DAS Simples Nacional'])
    assert.equal(overview.totals.custo_competencia_centavos, 753000)
  } finally { f.repository.close() }
})


test('importação central da folha mantém conflito, auditoria e undo equivalentes', () => {
  const f = fixture()
  try {
    const payload={
      competencia:'2026-10',empresa_id:f.company.id,
      file:{name:'folha-central.xlsx',hash:'hash-payroll-central',sheet:'Folha'},
      mode:'template',
      rows:[
        {id:'row-2',row_number:2,cell:'Folha!2',kind:'employee',funcionario:'Funcionário Central',values:{salario_centavos:260000,diarias_centavos:12000}},
        {id:'row-3',row_number:3,cell:'Folha!3',kind:'expense',descricao:'Contabilidade',categoria:'Serviços terceiros',valor_centavos:85000,vencimento:'2026-10-20'}
      ]
    }
    const preview=f.payroll.importPreview(payload)
    const conflict=preview.conflicts.find(item=>item.field==='salario_centavos')
    assert.equal(conflict.type,'value_conflict')
    const result=f.payroll.importCommit({...payload,resolutions:{[conflict.id]:'use_import'}})
    assert.equal(result.imported_values,2)
    assert.equal(result.imported_expenses,1)
    const overview=f.payroll.overview({competencia:'2026-10',empresa_id:f.company.id})
    assert.equal(overview.employees[0].remuneracao.salario_centavos,260000)
    assert.equal(overview.employees[0].remuneracao.diarias_centavos,12000)
    assert.ok(overview.company_expenses.some(item=>item.descricao==='Contabilidade'))
    assert.equal(f.payroll.importHistory().find(item=>item.id===result.importacao_id).can_undo,true)

    const undone=f.payroll.importUndo(result.importacao_id)
    assert.equal(undone.status,'desfeita')
    const restored=f.payroll.overview({competencia:'2026-10',empresa_id:f.company.id})
    assert.equal(restored.employees[0].remuneracao.salario_centavos,250000)
    assert.equal(restored.employees[0].remuneracao.diarias_centavos,0)
    assert.equal(restored.company_expenses.some(item=>item.descricao==='Contabilidade'),false)
  } finally { f.repository.close() }
})

test('importação central rejeita duplicidade por hash, aba e competência', () => {
  const f=fixture()
  try{
    const payload={
      competencia:'2026-12',empresa_id:f.company.id,file:{name:'x.xlsx',hash:'same-central',sheet:'Folha'},
      rows:[{id:'row-2',row_number:2,cell:'Folha!2',kind:'employee',funcionario:'Funcionário Central',values:{diarias_centavos:12000}}]
    }
    f.payroll.importCommit(payload)
    const duplicate=f.payroll.importPreview(payload)
    assert.equal(duplicate.canCommit,false)
    assert.ok(duplicate.blockers.some(item=>item.kind==='duplicate_import'))
  }finally{f.repository.close()}
})
