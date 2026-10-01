import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import test from 'node:test'
import { createLanServer } from '../src/server.mjs'

const LAN_TOKEN = 'test-device-token'
const tokenHash = value => createHash('sha256').update(String(value)).digest('hex')

function createRepository() {
  const rows = {
    empresas: [{ id: 1, razao_social: 'Empresa A', status: 'ativa' }],
    clientes: [{ id: 2, empresa_id: 1, nome: 'Cliente A' }],
    obras: [{ id: 3, empresa_id: 1, cliente_id: 2, nome: 'Obra A' }]
  }
  return {
    connection() { return {} },
    list(table, filters = {}) {
      return rows[table].filter((row) => Object.entries(filters).every(([key, value]) => String(row[key]) === String(value)))
    },
    get(table, id) {
      return rows[table].find((row) => row.id === Number(id)) || null
    },
    save(table, data) {
      if (data.id) {
        const index = rows[table].findIndex((row) => row.id === Number(data.id))
        if (index < 0) return null
        rows[table][index] = { ...rows[table][index], ...data, id: Number(data.id) }
        return rows[table][index]
      }
      const created = { ...data, id: Math.max(0, ...rows[table].map((row) => row.id)) + 1 }
      rows[table].push(created)
      return created
    },
    remove(table, id) {
      const index = rows[table].findIndex((row) => row.id === Number(id))
      if (index < 0) return false
      rows[table].splice(index, 1)
      return true
    }
  }
}

function createSecurity() {
  return {
    serverState() { return { claimed: true, companyId: 'company-a' } },
    deviceByTokenHash(value) {
      return value === tokenHash(LAN_TOKEN) ? { id: 'device-a', memberId: 'member-a', status: 'active' } : null
    },
    member(id) {
      return id === 'member-a' ? { memberId: id, email: 'admin@example.com', role: 'admin', modules: ['obra360'], channels: ['desktop'], status: 'active' } : null
    },
    touchDevice() {}
  }
}

async function fixture() {
  const server = createLanServer({ serverVersion: '0.3.0', repository: createRepository(), security: createSecurity() })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Servidor sem porta TCP.')
  return { server, baseUrl: `http://127.0.0.1:${address.port}` }
}

async function close(server) {
  server.close()
  await once(server, 'close')
}

function authHeaders(extra = {}) {
  return { authorization: `Bearer ${LAN_TOKEN}`, ...extra }
}

async function authorizedFetch(url, options = {}) {
  return fetch(url, { ...options, headers: authHeaders(options.headers || {}) })
}

async function jsonRequest(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: authHeaders({ 'content-type': 'application/json', ...(options.headers || {}) })
  })
}

test('GET /health identifica a API LAN v1 sem expor identidade', async () => {
  const { server, baseUrl } = await fixture()
  try {
    const response = await fetch(`${baseUrl}/health`)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { status: 'ok', product: 'Obra na Mão', apiVersion: '1' })
  } finally { await close(server) }
})

test('GET /version informa somente a versao publica do processo servidor', async () => {
  const { server, baseUrl } = await fixture()
  try {
    const response = await fetch(`${baseUrl}/version`)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { product: 'Obra na Mão', apiVersion: '1', serverVersion: '0.3.0' })
  } finally { await close(server) }
})

test('CRUD HTTP autenticado funciona para empresas, clientes e obras', async () => {
  const { server, baseUrl } = await fixture()
  try {
    for (const table of ['empresas', 'clientes', 'obras']) {
      const list = await authorizedFetch(`${baseUrl}/api/v1/${table}`)
      assert.equal(list.status, 200)
      assert.ok(Array.isArray(await list.json()))
    }

    const filtered = await authorizedFetch(`${baseUrl}/api/v1/clientes?empresa_id=1`)
    assert.equal(filtered.status, 200)
    assert.equal((await filtered.json()).length, 1)

    const company = await authorizedFetch(`${baseUrl}/api/v1/empresas/1`)
    assert.equal(company.status, 200)
    assert.equal((await company.json()).razao_social, 'Empresa A')

    const created = await jsonRequest(`${baseUrl}/api/v1/clientes`, {
      method: 'POST',
      body: JSON.stringify({ empresa_id: 1, nome: 'Cliente B' })
    })
    assert.equal(created.status, 201)
    const createdBody = await created.json()
    assert.equal(createdBody.nome, 'Cliente B')

    const updated = await jsonRequest(`${baseUrl}/api/v1/obras/3`, {
      method: 'PUT',
      body: JSON.stringify({ empresa_id: 1, cliente_id: 2, nome: 'Obra Atualizada' })
    })
    assert.equal(updated.status, 200)
    assert.equal((await updated.json()).nome, 'Obra Atualizada')

    const removed = await authorizedFetch(`${baseUrl}/api/v1/clientes/${createdBody.id}`, { method: 'DELETE' })
    assert.equal(removed.status, 200)
    assert.deepEqual(await removed.json(), { ok: true })
  } finally { await close(server) }
})

test('business CRUD rejeita chamadas sem credencial de dispositivo', async () => {
  const { server, baseUrl } = await fixture()
  try {
    const response = await fetch(`${baseUrl}/api/v1/empresas`)
    assert.equal(response.status, 401)
    assert.equal((await response.json()).error, 'missing_device_token')
  } finally { await close(server) }
})

test('API protege entidade RH central e rejeita corpo JSON invalido', async () => {
  const { server, baseUrl } = await fixture()
  try {
    const protectedRh = await fetch(`${baseUrl}/api/v1/funcionarios`)
    assert.equal(protectedRh.status, 401)
    assert.equal((await protectedRh.json()).error, 'missing_device_token')

    const invalid = await jsonRequest(`${baseUrl}/api/v1/empresas`, { method: 'POST', body: '{' })
    assert.equal(invalid.status, 400)
    assert.equal((await invalid.json()).error, 'invalid_json')
  } finally { await close(server) }
})

test('rotas desconhecidas retornam 404 JSON', async () => {
  const { server, baseUrl } = await fixture()
  try {
    const response = await fetch(`${baseUrl}/desconhecida`)
    assert.equal(response.status, 404)
    assert.deepEqual(await response.json(), { error: 'not_found' })
  } finally { await close(server) }
})

test('metodos fora do contrato retornam 405 com Allow correto', async () => {
  const { server, baseUrl } = await fixture()
  try {
    const health = await fetch(`${baseUrl}/health`, { method: 'POST' })
    assert.equal(health.status, 405)
    assert.equal(health.headers.get('allow'), 'GET')

    const collection = await authorizedFetch(`${baseUrl}/api/v1/empresas`, { method: 'PATCH' })
    assert.equal(collection.status, 405)
    assert.equal(collection.headers.get('allow'), 'GET, POST')
  } finally { await close(server) }
})
