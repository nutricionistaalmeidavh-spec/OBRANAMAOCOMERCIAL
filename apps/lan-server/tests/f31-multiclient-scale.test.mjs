import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import path from 'node:path'
import test from 'node:test'
import { LanRepository } from '../src/repository.mjs'
import { createLanServer } from '../src/server.mjs'

const migrationsDir = path.resolve(import.meta.dirname, '../migrations')
const digest = value => createHash('sha256').update(String(value)).digest('hex')
const headers = token => ({ authorization: `Bearer ${token}`, 'content-type': 'application/json' })
const get = (base, route, token) => fetch(base + route, { headers: { authorization: `Bearer ${token}` } })
const post = (base, route, body, token) => fetch(base + route, { method: 'POST', headers: headers(token), body: JSON.stringify(body) })

function makeSecurity(clientCount) {
  const tokens = Array.from({ length: clientCount }, (_, index) => `f31-client-${index + 1}-token`)
  const devices = new Map()
  const members = new Map()

  tokens.forEach((token, index) => {
    const number = index + 1
    const memberId = `f31-member-${number}`
    devices.set(digest(token), { id: `f31-device-${number}`, memberId, status: 'active' })
    members.set(memberId, {
      memberId,
      role: 'admin',
      modules: ['obra360', 'rdo', 'finance', 'rh'],
      channels: ['desktop'],
      status: 'active'
    })
  })

  return {
    tokens,
    security: {
      serverState() { return { claimed: true, companyId: 'company-f31' } },
      deviceByTokenHash(value) { return devices.get(value) || null },
      member(id) { return members.get(id) || null },
      touchDevice() {}
    }
  }
}

async function close(server, repository) {
  server.close()
  await once(server, 'close')
  repository.close()
}

for (const clientCount of [1, 2, 5]) {
  test(`F31: ${clientCount} cliente(s) compartilham o mesmo banco central sem isolamento acidental`, async () => {
    const repository = new LanRepository({ filename: ':memory:' })
    repository.applyMigrations(migrationsDir)
    const { tokens, security } = makeSecurity(clientCount)
    const server = createLanServer({ repository, security })
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Servidor F31 sem porta TCP.')
    const base = `http://127.0.0.1:${address.port}`

    try {
      const companyResponse = await post(base, '/api/v1/empresas', {
        razao_social: `Empresa F31 ${clientCount}`,
        cnpj: `12345678000${String(clientCount).padStart(3, '0')}`
      }, tokens[0])
      assert.equal(companyResponse.status, 201)
      const company = await companyResponse.json()

      const visibility = await Promise.all(tokens.map(token => get(base, '/api/v1/empresas', token)))
      for (const response of visibility) {
        assert.equal(response.status, 200)
        assert.ok((await response.json()).some(item => item.id === company.id))
      }

      const createdClients = await Promise.all(tokens.map(async (token, index) => {
        const response = await post(base, '/api/v1/clientes', {
          empresa_id: company.id,
          nome: `Cliente F31-${clientCount}-${index + 1}`
        }, token)
        assert.equal(response.status, 201)
        return response.json()
      }))

      const expectedIds = new Set(createdClients.map(item => item.id))
      for (const token of tokens) {
        const response = await get(base, `/api/v1/clientes?empresa_id=${company.id}`, token)
        assert.equal(response.status, 200)
        const rows = await response.json()
        const visibleIds = new Set(rows.map(item => item.id))
        for (const id of expectedIds) assert.equal(visibleIds.has(id), true)
      }

      assert.equal(
        repository.connection().prepare('SELECT COUNT(*) AS n FROM clientes WHERE empresa_id=? AND deleted_at IS NULL').get(company.id).n,
        clientCount
      )
    } finally {
      await close(server, repository)
    }
  })
}
