import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { LanRepository } from '../src/repository.mjs'
import { FinanceService } from '../src/finance-service.mjs'

const migrationsDir = path.resolve(import.meta.dirname, '../migrations')

function fixture() {
  const repository = new LanRepository({ filename: ':memory:' })
  repository.applyMigrations(migrationsDir)
  const company = repository.save('empresas', { razao_social: 'Empresa Finance' })
  const work = repository.save('obras', { empresa_id: company.id, nome: 'Obra Finance', valor_contratado_centavos: 500000, status: 'em_andamento' })
  const categoryExpense = repository.save('categorias_financeiras', { nome: 'Material F11', natureza: 'despesa', grupo_dre: 'custos_obra' })
  const categoryRevenue = repository.save('categorias_financeiras', { nome: 'Receita F11', natureza: 'receita', grupo_dre: 'receita_operacional' })
  const service = new FinanceService({ repository })
  return { repository, company, work, categoryExpense, categoryRevenue, service }
}

function account(f, overrides = {}) {
  return f.repository.save('contas', {
    tipo: 'pagar',
    empresa_id: f.company.id,
    obra_id: f.work.id,
    categoria_id: f.categoryExpense.id,
    descricao: 'Tubulação',
    competencia: '2026-10',
    vencimento: '2026-10-15',
    valor_centavos: 10000,
    status: 'pendente',
    ...overrides
  })
}

test('pagamento central mantém semântica local de parcial, quitado e recebimento', () => {
  const f = fixture()
  try {
    const payable = account(f)
    const partial = f.service.accountPayment(payable.id, { valor_centavos: 4000, data: '2026-10-01', forma_pagamento: 'pix' }, 'req-partial')
    assert.equal(partial.pago_centavos, 4000)
    assert.equal(partial.status, 'parcialmente_pago')
    assert.equal(partial.data_efetiva, '2026-10-01')

    const paid = f.service.accountPayment(payable.id, { valor_centavos: 6000, data: '2026-10-02' }, 'req-final')
    assert.equal(paid.pago_centavos, 10000)
    assert.equal(paid.status, 'pago')

    const receivable = account(f, { tipo: 'receber', categoria_id: f.categoryRevenue.id, descricao: 'Medição', valor_centavos: 5000 })
    const received = f.service.accountPayment(receivable.id, { valor_centavos: 5000, data: '2026-10-03' }, 'req-received')
    assert.equal(received.status, 'recebido')
  } finally { f.repository.close() }
})

test('replay do mesmo request_id devolve o resultado original sem duplicar pagamento', () => {
  const f = fixture()
  try {
    const payable = account(f)
    const first = f.service.accountPayment(payable.id, { valor_centavos: 3000, data: '2026-10-01' }, 'req-idempotent')
    const replay = f.service.accountPayment(payable.id, { valor_centavos: 3000, data: '2026-10-01' }, 'req-idempotent')
    assert.deepEqual(replay, first)
    assert.equal(f.repository.connection().prepare('SELECT COUNT(*) AS n FROM pagamentos_conta WHERE conta_id=?').get(payable.id).n, 1)
    assert.equal(replay.pago_centavos, 3000)
  } finally { f.repository.close() }
})

test('falha após inserir pagamento faz rollback da transação inteira', () => {
  const f = fixture()
  try {
    const payable = account(f)
    f.repository.connection().exec(`
      CREATE TRIGGER fail_finance_status BEFORE UPDATE OF status ON contas
      BEGIN SELECT RAISE(ABORT, 'forced status failure'); END;
    `)
    assert.throws(() => f.service.accountPayment(payable.id, { valor_centavos: 2500, data: '2026-10-01' }, 'req-rollback'), /forced status failure/)
    assert.equal(f.repository.connection().prepare('SELECT COUNT(*) AS n FROM pagamentos_conta WHERE conta_id=?').get(payable.id).n, 0)
    assert.equal(f.repository.get('contas', payable.id).status, 'pendente')
  } finally { f.repository.close() }
})

test('pagamento valida conta e valor da mesma forma que o Desktop local', () => {
  const f = fixture()
  try {
    const payable = account(f)
    assert.throws(() => f.service.accountPayment(999999, { valor_centavos: 100, data: '2026-10-01' }, 'req-missing'), /Conta não encontrada/)
    assert.throws(() => f.service.accountPayment(payable.id, { valor_centavos: 0, data: '2026-10-01' }, 'req-zero'), /Valor de pagamento inválido/)
    assert.throws(() => f.service.accountPayment(payable.id, { valor_centavos: 1.5, data: '2026-10-01' }, 'req-decimal'), /Valor de pagamento inválido/)
  } finally { f.repository.close() }
})

test('DRE central preserva agrupamento por competência, tipo, grupo e categoria', () => {
  const f = fixture()
  try {
    account(f, { descricao: 'Material A', valor_centavos: 7000 })
    account(f, { descricao: 'Receita A', tipo: 'receber', categoria_id: f.categoryRevenue.id, valor_centavos: 12000 })
    account(f, { descricao: 'Cancelada', valor_centavos: 9000, status: 'cancelado' })

    const rows = f.service.dre({ competencia: '2026-10', empresa_id: f.company.id, obra_id: f.work.id })
    assert.deepEqual(rows.map(row => ({ tipo: row.tipo, grupo: row.grupo, categoria: row.categoria, valor: Number(row.valor) })), [
      { tipo: 'pagar', grupo: 'custos_obra', categoria: 'Material F11', valor: 7000 },
      { tipo: 'receber', grupo: 'receita_operacional', categoria: 'Receita F11', valor: 12000 }
    ])
  } finally { f.repository.close() }
})

test('dashboard central mantém as chaves financeiras públicas e usa apenas o banco central', () => {
  const f = fixture()
  try {
    account(f, { descricao: 'Despesa', valor_centavos: 10000, status: 'pendente', vencimento: '2020-01-01' })
    account(f, { descricao: 'Receita', tipo: 'receber', categoria_id: f.categoryRevenue.id, valor_centavos: 15000, status: 'pendente' })
    f.repository.save('itens_orcamentarios', { obra_id: f.work.id, descricao: 'Item', unidade: 'un', quantidade: 2, valor_unitario_centavos: 2000, tipo: 'material' })

    const dashboard = f.service.dashboard({ competencia: '2026-10', empresa_id: f.company.id })
    for (const key of ['receitas', 'despesas', 'pagar', 'receber', 'vencidos', 'resultado', 'contratos_ativos', 'total_contratado', 'total_orcado', 'total_medido', 'saldo_medir', 'trend', 'obras_atencao']) {
      assert.equal(Object.hasOwn(dashboard, key), true, `dashboard deve expor ${key}`)
    }
    assert.equal(Number(dashboard.receitas), 15000)
    assert.equal(Number(dashboard.despesas), 10000)
    assert.equal(Number(dashboard.resultado), 5000)
    assert.equal(Number(dashboard.total_orcado), 4000)
    assert.equal(Number(dashboard.total_medido), 0)
  } finally { f.repository.close() }
})
