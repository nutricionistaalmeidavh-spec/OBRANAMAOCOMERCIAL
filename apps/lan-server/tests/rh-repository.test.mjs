import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { LanRepository } from '../src/repository.mjs'

const migrationsDir = path.resolve(import.meta.dirname, '../migrations')

function fixture() {
  const repository = new LanRepository({ filename: ':memory:' })
  const migration = repository.applyMigrations(migrationsDir)
  const company = repository.save('empresas', { razao_social: 'Empresa RH' })
  const otherCompany = repository.save('empresas', { razao_social: 'Outra Empresa RH' })
  const work = repository.save('obras', { empresa_id: company.id, nome: 'Obra RH' })
  const otherWork = repository.save('obras', { empresa_id: otherCompany.id, nome: 'Obra RH externa' })
  return { repository, migration, company, otherCompany, work, otherWork }
}

const RH_TABLES = [
  'funcionarios', 'funcionario_obras', 'cargos', 'beneficios', 'cargo_beneficios',
  'funcionario_beneficios', 'folhas_pagamento', 'folha_lancamentos',
  'pagamentos_funcionario', 'pontos_mensais', 'ponto_marcacoes', 'epis', 'funcionario_epis'
]

test('migration F12 cria schema RH central e alcança versão 5', () => {
  const f = fixture()
  try {
    assert.equal(f.migration.version, 5)
    for (const table of RH_TABLES) {
      const row = f.repository.connection().prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table)
      assert.equal(row?.name, table)
    }
    const launchColumns = f.repository.connection().prepare('PRAGMA table_info(folha_lancamentos)').all().map(column => column.name)
    for (const column of ['origem', 'editavel', 'status', 'updated_at']) assert.ok(launchColumns.includes(column))
    const paymentColumns = f.repository.connection().prepare('PRAGMA table_info(pagamentos_funcionario)').all().map(column => column.name)
    for (const column of ['forma_pagamento', 'confirmado_em']) assert.ok(paymentColumns.includes(column))
  } finally { f.repository.close() }
})

test('CRUD RH central preserva empresa, obra, cargo, benefício, EPI e relações', () => {
  const f = fixture()
  try {
    const cargo = f.repository.save('cargos', { empresa_id: f.company.id, nome: 'Encanador', salario_base_centavos: 350000, ativo: 1 })
    const benefit = f.repository.save('beneficios', { empresa_id: f.company.id, nome: 'Vale alimentação', tipo: 'alimentacao', valor_padrao_centavos: 30000, ativo: 1 })
    const link = f.repository.save('cargo_beneficios', { empresa_id: f.company.id, cargo_id: cargo.id, beneficio_id: benefit.id, valor_centavos: 30000, quinzena: 1, natureza: 'credito', ativo: 1 })
    const employee = f.repository.save('funcionarios', {
      empresa_id: f.company.id,
      obra_atual_id: f.work.id,
      cargo_id: cargo.id,
      nome: 'Funcionário Central',
      cpf: '11122233344',
      salario_centavos: 400000,
      status: 'ativo'
    })
    const employeeWork = f.repository.save('funcionario_obras', { empresa_id: f.company.id, funcionario_id: employee.id, obra_id: f.work.id, inicio: '2026-10-01' })
    const employeeBenefit = f.repository.save('funcionario_beneficios', { empresa_id: f.company.id, funcionario_id: employee.id, beneficio_id: benefit.id, valor_centavos: 35000, inicio: '2026-10-01' })
    const epi = f.repository.save('epis', { empresa_id: f.company.id, nome: 'Capacete', ca: '12345', unidade: 'un', ativo: 1 })
    const delivered = f.repository.save('funcionario_epis', { empresa_id: f.company.id, funcionario_id: employee.id, epi_id: epi.id, data_entrega: '2026-10-01', quantidade: 1 })

    assert.equal(link.cargo_id, cargo.id)
    assert.equal(employeeWork.obra_id, f.work.id)
    assert.equal(employeeBenefit.valor_centavos, 35000)
    assert.equal(delivered.epi_id, epi.id)
    assert.deepEqual(f.repository.list('funcionarios', { empresa_id: f.company.id }).map(row => row.id), [employee.id])
    assert.equal(f.repository.list('funcionarios', { empresa_id: f.otherCompany.id }).length, 0)
  } finally { f.repository.close() }
})

test('relações RH rejeitam referências de outra empresa', () => {
  const f = fixture()
  try {
    const cargo = f.repository.save('cargos', { empresa_id: f.company.id, nome: 'Cargo A', salario_base_centavos: 100000 })
    const otherCargo = f.repository.save('cargos', { empresa_id: f.otherCompany.id, nome: 'Cargo B', salario_base_centavos: 100000 })
    const benefit = f.repository.save('beneficios', { empresa_id: f.company.id, nome: 'Benefício A', tipo: 'outro' })
    const otherBenefit = f.repository.save('beneficios', { empresa_id: f.otherCompany.id, nome: 'Benefício B', tipo: 'outro' })

    assert.throws(() => f.repository.save('funcionarios', {
      empresa_id: f.company.id,
      obra_atual_id: f.otherWork.id,
      cargo_id: cargo.id,
      nome: 'Obra externa'
    }), /empresa|mesma empresa/i)

    assert.throws(() => f.repository.save('funcionarios', {
      empresa_id: f.company.id,
      obra_atual_id: f.work.id,
      cargo_id: otherCargo.id,
      nome: 'Cargo externo'
    }), /empresa|mesma empresa/i)

    assert.throws(() => f.repository.save('cargo_beneficios', {
      empresa_id: f.company.id,
      cargo_id: cargo.id,
      beneficio_id: otherBenefit.id,
      valor_centavos: 1000
    }), /empresa|mesma empresa/i)

    const employee = f.repository.save('funcionarios', { empresa_id: f.company.id, cargo_id: cargo.id, nome: 'Funcionário A' })
    const otherEmployee = f.repository.save('funcionarios', { empresa_id: f.otherCompany.id, cargo_id: otherCargo.id, nome: 'Funcionário B' })
    assert.throws(() => f.repository.save('funcionario_beneficios', {
      empresa_id: f.company.id,
      funcionario_id: otherEmployee.id,
      beneficio_id: benefit.id,
      valor_centavos: 1000
    }), /empresa|mesma empresa/i)
    assert.throws(() => f.repository.save('funcionario_obras', {
      empresa_id: f.company.id,
      funcionario_id: employee.id,
      obra_id: f.otherWork.id,
      inicio: '2026-10-01'
    }), /empresa|mesma empresa/i)
  } finally { f.repository.close() }
})

test('folha, ponto e vínculos RH mantêm constraints e filtros centrais', () => {
  const f = fixture()
  try {
    const cargo = f.repository.save('cargos', { empresa_id: f.company.id, nome: 'Cargo folha', salario_base_centavos: 200000 })
    const employee = f.repository.save('funcionarios', { empresa_id: f.company.id, cargo_id: cargo.id, nome: 'Funcionário folha' })
    const sheet = f.repository.save('folhas_pagamento', { empresa_id: f.company.id, competencia: '2026-10', status: 'aberta' })
    const launch = f.repository.save('folha_lancamentos', {
      empresa_id: f.company.id,
      folha_id: sheet.id,
      funcionario_id: employee.id,
      tipo: 'salario',
      descricao: 'Salário base',
      natureza: 'credito',
      quinzena: 1,
      valor_centavos: 200000,
      origem: 'cargo',
      editavel: 0,
      status: 'pendente'
    })
    const payment = f.repository.save('pagamentos_funcionario', {
      empresa_id: f.company.id,
      funcionario_id: employee.id,
      folha_id: sheet.id,
      competencia: '2026-10',
      quinzena: 1,
      valor_centavos: 200000,
      data: '2026-10-15',
      status: 'pago',
      forma_pagamento: 'PIX'
    })
    const point = f.repository.save('pontos_mensais', { empresa_id: f.company.id, funcionario_id: employee.id, competencia: '2026-10' })
    const mark = f.repository.save('ponto_marcacoes', { empresa_id: f.company.id, ponto_mensal_id: point.id, data: '2026-10-01', tipo: 'trabalho', entrada: '07:00', saida: '17:00' })

    assert.equal(launch.status, 'pendente')
    assert.equal(payment.status, 'pago')
    assert.equal(mark.data, '2026-10-01')
    assert.equal(f.repository.list('folhas_pagamento', { empresa_id: f.company.id }).length, 1)
    assert.equal(f.repository.list('pontos_mensais', { funcionario_id: employee.id, competencia: '2026-10' }).length, 1)

    assert.throws(() => f.repository.save('folha_lancamentos', { ...launch, id: undefined, natureza: 'invalida' }), /CHECK|natureza/i)
    assert.throws(() => f.repository.save('ponto_marcacoes', { empresa_id: f.company.id, ponto_mensal_id: point.id, data: '2026-10-02', tipo: 'qualquer' }), /CHECK|tipo/i)
  } finally { f.repository.close() }
})
