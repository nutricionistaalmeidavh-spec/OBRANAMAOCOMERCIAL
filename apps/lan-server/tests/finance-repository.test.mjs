import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { LanRepository } from '../src/repository.mjs'

const migrationsDir = path.resolve(import.meta.dirname, '../migrations')

function fixture() {
  const repository = new LanRepository({ filename: ':memory:' })
  const migration = repository.applyMigrations(migrationsDir)
  const company = repository.save('empresas', { razao_social: 'Empresa Financeiro' })
  const otherCompany = repository.save('empresas', { razao_social: 'Outra Empresa' })
  const work = repository.save('obras', { empresa_id: company.id, nome: 'Obra Financeira' })
  const otherWork = repository.save('obras', { empresa_id: otherCompany.id, nome: 'Obra Externa' })
  return { repository, migration, company, otherCompany, work, otherWork }
}

test('migration F11 cria schema financeiro central e alcança versão 4', () => {
  const f = fixture()
  try {
    assert.equal(f.migration.version, 4)
    for (const table of ['fornecedores', 'categorias_financeiras', 'contas', 'pagamentos_conta']) {
      const row = f.repository.connection().prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table)
      assert.equal(row?.name, table)
    }
    const columns = f.repository.connection().prepare('PRAGMA table_info(pagamentos_conta)').all().map(column => column.name)
    assert.equal(columns.includes('request_id'), true)
  } finally { f.repository.close() }
})

test('CRUD financeiro central preserva filtros por empresa/obra e soft delete', () => {
  const f = fixture()
  try {
    const supplier = f.repository.save('fornecedores', { empresa_id: f.company.id, nome: 'Fornecedor A', documento: '123' })
    const category = f.repository.save('categorias_financeiras', { nome: 'Materiais teste', natureza: 'despesa', grupo_dre: 'custos_obra', ativa: 1 })
    const account = f.repository.save('contas', {
      tipo: 'pagar',
      empresa_id: f.company.id,
      obra_id: f.work.id,
      fornecedor_id: supplier.id,
      categoria_id: category.id,
      descricao: 'Tubulação',
      competencia: '2026-10',
      vencimento: '2026-10-10',
      valor_centavos: 125000,
      status: 'pendente'
    })

    assert.equal(f.repository.list('fornecedores', { empresa_id: f.company.id }).length, 1)
    assert.equal(f.repository.list('contas', { empresa_id: f.company.id, obra_id: f.work.id }).length, 1)
    assert.equal(f.repository.list('contas', { empresa_id: f.otherCompany.id }).length, 0)

    assert.equal(f.repository.remove('contas', account.id), true)
    assert.equal(f.repository.list('contas', { empresa_id: f.company.id, obra_id: f.work.id }).length, 0)
    assert.notEqual(f.repository.get('contas', account.id)?.deleted_at, null)

    assert.equal(f.repository.remove('fornecedores', supplier.id), true)
    assert.equal(f.repository.list('fornecedores', { empresa_id: f.company.id }).length, 0)
  } finally { f.repository.close() }
})

test('conta rejeita obra, fornecedor ou cliente pertencente a outra empresa', () => {
  const f = fixture()
  try {
    const supplierOther = f.repository.save('fornecedores', { empresa_id: f.otherCompany.id, nome: 'Fornecedor externo' })
    const clientOther = f.repository.save('clientes', { empresa_id: f.otherCompany.id, nome: 'Cliente externo' })
    const base = {
      tipo: 'pagar',
      empresa_id: f.company.id,
      descricao: 'Conta inválida',
      competencia: '2026-10',
      vencimento: '2026-10-10',
      valor_centavos: 1000
    }

    assert.throws(() => f.repository.save('contas', { ...base, obra_id: f.otherWork.id }), /mesma empresa|empresa/i)
    assert.throws(() => f.repository.save('contas', { ...base, obra_id: f.work.id, fornecedor_id: supplierOther.id }), /mesma empresa|empresa/i)
    assert.throws(() => f.repository.save('contas', { ...base, obra_id: f.work.id, cliente_id: clientOther.id }), /mesma empresa|empresa/i)
  } finally { f.repository.close() }
})

test('pagamento exige conta válida, valor positivo e request_id idempotente único', () => {
  const f = fixture()
  try {
    const account = f.repository.save('contas', {
      tipo: 'pagar',
      empresa_id: f.company.id,
      obra_id: f.work.id,
      descricao: 'Conta de teste',
      competencia: '2026-10',
      vencimento: '2026-10-10',
      valor_centavos: 5000
    })

    const payment = f.repository.save('pagamentos_conta', {
      conta_id: account.id,
      valor_centavos: 2000,
      data: '2026-10-01',
      forma_pagamento: 'pix',
      request_id: 'req-payment-001'
    })
    assert.equal(payment.request_id, 'req-payment-001')

    assert.throws(() => f.repository.save('pagamentos_conta', {
      conta_id: account.id,
      valor_centavos: 1000,
      data: '2026-10-01',
      request_id: 'req-payment-001'
    }), /UNIQUE|request_id/i)
    assert.throws(() => f.repository.save('pagamentos_conta', { conta_id: 999999, valor_centavos: 1000, data: '2026-10-01', request_id: 'req-missing' }), /referência|FOREIGN KEY/i)
    assert.throws(() => f.repository.save('pagamentos_conta', { conta_id: account.id, valor_centavos: 0, data: '2026-10-01', request_id: 'req-zero' }), /CHECK|valor/i)
  } finally { f.repository.close() }
})

test('categorias financeiras mantêm constraints de natureza e contas rejeitam valor negativo', () => {
  const f = fixture()
  try {
    assert.throws(() => f.repository.save('categorias_financeiras', { nome: 'Inválida', natureza: 'outra', grupo_dre: 'x' }), /CHECK|natureza/i)
    assert.throws(() => f.repository.save('contas', {
      tipo: 'pagar',
      empresa_id: f.company.id,
      obra_id: f.work.id,
      descricao: 'Valor inválido',
      competencia: '2026-10',
      vencimento: '2026-10-10',
      valor_centavos: -1
    }), /CHECK|valor/i)
  } finally { f.repository.close() }
})
