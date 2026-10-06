import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import path from 'node:path'
import test from 'node:test'
import { LanRepository } from '../src/repository.mjs'
import { FinanceService } from '../src/finance-service.mjs'
import { createLanServer } from '../src/server.mjs'

const migrationsDir = path.resolve(import.meta.dirname, '../migrations')
const TOKEN = 'finance-sync-device-token'
const digest = value => createHash('sha256').update(String(value)).digest('hex')

function security() {
  return {
    serverState() { return { claimed: true, companyId: 'company-a' } },
    deviceByTokenHash(value) { return value === digest(TOKEN) ? { id: 'device-finance-sync', memberId: 'member-finance-sync', status: 'active' } : null },
    member(id) { return id === 'member-finance-sync' ? { memberId: id, role: 'employee', modules: ['finance', 'dre', 'obra360'], channels: ['desktop'], status: 'active' } : null },
    touchDevice() {}
  }
}

async function fixture() {
  const repository = new LanRepository({ filename: ':memory:' })
  repository.applyMigrations(migrationsDir)
  const company = repository.save('empresas', { razao_social: 'Empresa Sync Finance' })
  const work = repository.save('obras', { empresa_id: company.id, nome: 'Obra Sync Finance', valor_contratado_centavos: 100000, percentual_fisico: 25 })
  const category = repository.save('categorias_financeiras', { nome: `Sync Finance ${Math.random()}`, natureza: 'despesa', grupo_dre: 'custos_obra' })
  const supplier = repository.save('fornecedores', { empresa_id: company.id, nome: 'Fornecedor Sync' })
  const payable = repository.save('contas', { tipo: 'pagar', empresa_id: company.id, obra_id: work.id, fornecedor_id: supplier.id, categoria_id: category.id, descricao: 'Tubos', competencia: '2026-10', vencimento: '2026-10-10', valor_centavos: 10000 })
  const finance = new FinanceService({ repository, now: () => Date.parse('2026-10-20T12:00:00Z') })
  finance.accountPayment(payable.id, { valor_centavos: 2500, data: '2026-10-01' }, 'sync-payment-001')
  const server = createLanServer({ repository, security: security(), financeService: finance, nowMs: () => Date.parse('2026-10-20T12:00:00Z') })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Servidor sem porta TCP.')
  return { repository, company, work, payable, finance, server, baseUrl: `http://127.0.0.1:${address.port}` }
}

async function close(f) {
  f.server.close()
  await once(f.server, 'close')
  f.repository.close()
}

const headers = { authorization: `Bearer ${TOKEN}` }

test('F11 anuncia finance e expõe summary/obligations usando somente a fonte central', async () => {
  const f = await fixture()
  try {
    const capabilitiesResponse = await fetch(`${f.baseUrl}/api/v1/sync-source/capabilities`, { headers })
    assert.equal(capabilitiesResponse.status, 200)
    const capabilities = await capabilitiesResponse.json()
    assert.ok(capabilities.modules.includes('finance'))

    const scope = new URLSearchParams({
      company_id: String(f.company.id),
      obra_id: String(f.work.id),
      remote_project_id: 'remote-project-9',
      device_id: 'desktop-device-7',
      work_name: f.work.nome,
      modules: 'finance,dre,obra360'
    })
    const summaryResponse = await fetch(`${f.baseUrl}/api/v1/sync-source/summary?${scope}`, { headers })
    assert.equal(summaryResponse.status, 200)
    const summary = await summaryResponse.json()
    assert.equal(summary.scope.projectId, 'remote-project-9')
    assert.equal(summary.modules.finance.payableCents, 7500)
    assert.equal(summary.modules.finance.overdueCents, 7500)
    assert.equal(summary.modules.dre.expense, 2500)

    const obligationsResponse = await fetch(`${f.baseUrl}/api/v1/sync-source/obligations?${scope}`, { headers })
    assert.equal(obligationsResponse.status, 200)
    const obligations = await obligationsResponse.json()
    assert.equal(obligations.length, 1)
    assert.equal(obligations[0].sourceId, `desktop-device-7:conta:${f.payable.id}`)
    assert.equal(obligations[0].amountCents, 10000)
    assert.equal(obligations[0].projectId, 'remote-project-9')
    assert.equal(obligations[0].beneficiaryName, 'Fornecedor Sync')
    assert.equal(obligations[0].canonicalEntity, 'conta')
    assert.equal(obligations[0].canonicalId, `lan:${f.company.id}:${f.payable.id}`)
    assert.equal(obligations[0].originModule, 'finance')
    assert.equal(obligations[0].originEntity, 'contas')
  } finally { await close(f) }
})


test('F11 preserves tax category semantics in the canonical obligation', async () => {
  const f = await fixture()
  try {
    const category = f.finance.db.prepare("SELECT * FROM categorias_financeiras WHERE nome='Encargos trabalhistas'").get()
    const tax = f.repository.save('contas', {
      tipo: 'pagar',
      empresa_id: f.company.id,
      obra_id: f.work.id,
      categoria_id: category.id,
      descricao: 'INSS outubro',
      competencia: '2026-10',
      vencimento: '2026-10-20',
      valor_centavos: 125000
    })
    const obligations = f.finance.syncObligations({
      companyId: f.company.id,
      workId: f.work.id,
      remoteProjectId: 'remote-project-9',
      deviceId: 'desktop-device-7'
    })
    const obligation = obligations.find(item => item.canonicalId === `lan:${f.company.id}:${tax.id}`)
    assert.equal(obligation.sourceType, 'tax')
    assert.equal(obligation.category, 'Encargos trabalhistas')
    assert.equal(obligation.originModule, 'finance')
    assert.equal(obligation.originEntity, 'contas')
  } finally { await close(f) }
})


test('F11 publishes direct purchase and contract lineage from canonical accounts', async () => {
  const f = await fixture()
  try {
    const supplier = f.repository.save('fornecedores', { empresa_id: f.company.id, nome: 'Fornecedor Cadeia' })
    const purchase = f.repository.save('pedidos_compra', { obra_id: f.work.id, fornecedor_id: supplier.id, numero: 'PC-77', descricao: 'Conexões', valor_centavos: 42000, status: 'emitido' })
    const purchaseAccount = f.repository.save('contas', { tipo: 'pagar', empresa_id: f.company.id, obra_id: f.work.id, fornecedor_id: supplier.id, descricao: 'Compra conexões', competencia: '2026-10', vencimento: '2026-10-18', valor_centavos: 42000, pedido_compra_id: purchase.id })
    const contract = f.repository.save('contratos_obra', { obra_id: f.work.id, fornecedor_id: supplier.id, numero: 'CT-5', descricao: 'Instalação terceirizada', valor_centavos: 88000, status: 'ativo' })
    const contractAccount = f.repository.save('contas', { tipo: 'pagar', empresa_id: f.company.id, obra_id: f.work.id, fornecedor_id: supplier.id, descricao: 'Parcela contrato', competencia: '2026-10', vencimento: '2026-10-25', valor_centavos: 88000, contrato_id: contract.id })

    const obligations = f.finance.syncObligations({ companyId: f.company.id, workId: f.work.id, remoteProjectId: 'remote-project-9', deviceId: 'desktop-device-7' })
    const purchaseObligation = obligations.find(x => x.canonicalId === `lan:${f.company.id}:${purchaseAccount.id}`)
    const contractObligation = obligations.find(x => x.canonicalId === `lan:${f.company.id}:${contractAccount.id}`)
    assert.equal(purchaseObligation.sourceType, 'purchase')
    assert.equal(purchaseObligation.originModule, 'procurement')
    assert.equal(purchaseObligation.originEntity, 'pedidos_compra')
    assert.equal(purchaseObligation.originId, String(purchase.id))
    assert.equal(purchaseObligation.originLabel, 'Pedido PC-77 · Conexões')
    assert.equal(contractObligation.sourceType, 'contract')
    assert.equal(contractObligation.originModule, 'contracts')
    assert.equal(contractObligation.originEntity, 'contratos_obra')
    assert.equal(contractObligation.originId, String(contract.id))
    assert.equal(contractObligation.originLabel, 'Contrato CT-5 · Instalação terceirizada')
  } finally { await close(f) }
})

test('F12 publishes payroll components inside the canonical account only once', async () => {
  const f = await fixture()
  try {
    const category = f.finance.db.prepare("SELECT * FROM categorias_financeiras WHERE nome='Folha de pagamento'").get()
    const employee = f.repository.save('funcionarios', { empresa_id: f.company.id, obra_atual_id: f.work.id, nome: 'João Silva', salario_centavos: 230000, status: 'ativo' })
    const payrollAccount = f.repository.save('contas', { tipo: 'pagar', empresa_id: f.company.id, obra_id: f.work.id, categoria_id: category.id, descricao: 'Folha outubro', competencia: '2026-10', vencimento: '2026-10-05', valor_centavos: 280000 })
    const sheet = f.repository.save('folhas_pagamento', { empresa_id: f.company.id, competencia: '2026-10', status: 'fechada', conta_id: payrollAccount.id })
    f.repository.save('folha_lancamentos', { empresa_id: f.company.id, folha_id: sheet.id, funcionario_id: employee.id, tipo: 'salario', descricao: 'Salário', natureza: 'credito', valor_centavos: 230000, quinzena: 2, origem: 'manual', editavel: 1 })
    f.repository.save('folha_lancamentos', { empresa_id: f.company.id, folha_id: sheet.id, funcionario_id: employee.id, tipo: 'vale', descricao: 'Vale', natureza: 'credito', valor_centavos: 50000, quinzena: 1, origem: 'manual', editavel: 1 })

    const obligations = f.finance.syncObligations({ companyId: f.company.id, workId: f.work.id, remoteProjectId: 'remote-project-9', deviceId: 'desktop-device-7' })
    const payroll = obligations.filter(x => x.canonicalId === `lan:${f.company.id}:${payrollAccount.id}`)
    assert.equal(payroll.length, 1)
    assert.deepEqual(payroll[0].components.map(x => ({ type:x.type, label:x.label, amountCents:x.amountCents, employeeName:x.employeeName })), [
      { type:'salario', label:'Salário', amountCents:230000, employeeName:'João Silva' },
      { type:'vale', label:'Vale', amountCents:50000, employeeName:'João Silva' }
    ])
  } finally { await close(f) }
})
