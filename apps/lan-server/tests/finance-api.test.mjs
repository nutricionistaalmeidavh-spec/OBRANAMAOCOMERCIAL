import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import path from 'node:path'
import test from 'node:test'
import { LanRepository } from '../src/repository.mjs'
import { FinanceService } from '../src/finance-service.mjs'
import { createLanServer } from '../src/server.mjs'

const migrationsDir = path.resolve(import.meta.dirname, '../migrations')
const TOKEN = 'finance-device-token'
const digest = value => createHash('sha256').update(String(value)).digest('hex')

function security({ modules = ['finance'], role = 'employee', status = 'active' } = {}) {
  return {
    serverState() { return { claimed: true, companyId: 'company-a' } },
    deviceByTokenHash(value) { return value === digest(TOKEN) ? { id: 'device-finance', memberId: 'member-finance', status } : null },
    member(id) { return id === 'member-finance' ? { memberId: id, role, modules, channels: ['desktop'], status: 'active' } : null },
    touchDevice() {}
  }
}

async function fixture(options = {}) {
  const repository = new LanRepository({ filename: ':memory:' })
  repository.applyMigrations(migrationsDir)
  const company = repository.save('empresas', { razao_social: 'Empresa API Finance' })
  const work = repository.save('obras', { empresa_id: company.id, nome: 'Obra Finance API', valor_contratado_centavos: 100000 })
  const category = repository.save('categorias_financeiras', { nome: `Material API ${Math.random()}`, natureza: 'despesa', grupo_dre: 'custos_obra' })
  const account = repository.save('contas', { tipo: 'pagar', empresa_id: company.id, obra_id: work.id, categoria_id: category.id, descricao: 'Tubos', competencia: '2026-10', vencimento: '2026-10-10', valor_centavos: 10000 })
  const service = new FinanceService({ repository })
  const server = createLanServer({ repository, security: security(options), financeService: service })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Servidor sem porta TCP.')
  return { repository, company, work, account, service, server, baseUrl: `http://127.0.0.1:${address.port}` }
}

async function close(f) {
  f.server.close()
  await once(f.server, 'close')
  f.repository.close()
}

const headers = (json = false) => ({ authorization: `Bearer ${TOKEN}`, ...(json ? { 'content-type': 'application/json' } : {}) })

test('rotas financeiras expõem pagamento idempotente, DRE e dashboard sob a mesma autorização', async () => {
  const f = await fixture()
  try {
    const payment = await fetch(`${f.baseUrl}/api/v1/finance/accounts/${f.account.id}/payment`, {
      method: 'POST', headers: headers(true), body: JSON.stringify({ requestId: 'api-payment-001', payment: { valor_centavos: 4000, data: '2026-10-01', forma_pagamento: 'pix' } })
    })
    assert.equal(payment.status, 200)
    assert.equal((await payment.json()).pago_centavos, 4000)

    const replay = await fetch(`${f.baseUrl}/api/v1/finance/accounts/${f.account.id}/payment`, {
      method: 'POST', headers: headers(true), body: JSON.stringify({ requestId: 'api-payment-001', payment: { valor_centavos: 4000, data: '2026-10-01', forma_pagamento: 'pix' } })
    })
    assert.equal(replay.status, 200)
    assert.equal(f.repository.connection().prepare('SELECT COUNT(*) AS n FROM pagamentos_conta WHERE conta_id=?').get(f.account.id).n, 1)

    const dre = await fetch(`${f.baseUrl}/api/v1/finance/dre?competencia=2026-10&empresa_id=${f.company.id}&obra_id=${f.work.id}`, { headers: headers() })
    assert.equal(dre.status, 200)
    assert.equal(Array.isArray(await dre.json()), true)

    const dashboard = await fetch(`${f.baseUrl}/api/v1/finance/dashboard?competencia=2026-10&empresa_id=${f.company.id}`, { headers: headers() })
    assert.equal(dashboard.status, 200)
    assert.equal(Object.hasOwn(await dashboard.json(), 'resultado'), true)
  } finally { await close(f) }
})

test('CRUD financeiro genérico é permitido apenas para perfil com módulo finance ou admin', async () => {
  const allowed = await fixture()
  try {
    const list = await fetch(`${allowed.baseUrl}/api/v1/contas?empresa_id=${allowed.company.id}`, { headers: headers() })
    assert.equal(list.status, 200)
    assert.equal((await list.json()).length, 1)
  } finally { await close(allowed) }

  const denied = await fixture({ modules: ['obra360'] })
  try {
    const list = await fetch(`${denied.baseUrl}/api/v1/contas?empresa_id=${denied.company.id}`, { headers: headers() })
    assert.equal(list.status, 403)
    const payment = await fetch(`${denied.baseUrl}/api/v1/finance/accounts/${denied.account.id}/payment`, {
      method: 'POST', headers: headers(true), body: JSON.stringify({ requestId: 'blocked', payment: { valor_centavos: 1000, data: '2026-10-01' } })
    })
    assert.equal(payment.status, 403)
  } finally { await close(denied) }

  const admin = await fixture({ modules: [], role: 'admin' })
  try {
    const list = await fetch(`${admin.baseUrl}/api/v1/contas?empresa_id=${admin.company.id}`, { headers: headers() })
    assert.equal(list.status, 200)
  } finally { await close(admin) }
})

test('rotas financeiras rejeitam chamada sem credencial ou dispositivo revogado', async () => {
  const f = await fixture()
  try {
    const unauthenticated = await fetch(`${f.baseUrl}/api/v1/finance/dashboard?competencia=2026-10`)
    assert.equal(unauthenticated.status, 401)
  } finally { await close(f) }

  const revoked = await fixture({ status: 'revoked' })
  try {
    const response = await fetch(`${revoked.baseUrl}/api/v1/finance/dashboard?competencia=2026-10`, { headers: headers() })
    assert.equal(response.status, 403)
    assert.equal((await response.json()).error, 'device_revoked')
  } finally { await close(revoked) }
})
