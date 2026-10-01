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
  return { repository, company, work, payable, server, baseUrl: `http://127.0.0.1:${address.port}` }
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
  } finally { await close(f) }
})
