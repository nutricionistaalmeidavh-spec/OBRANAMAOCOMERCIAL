import assert from 'node:assert/strict'
import { once } from 'node:events'
import test from 'node:test'
import { createLanServer } from '../src/server.mjs'

async function fixture() {
  const server = createLanServer({ serverVersion: '0.1.0' })
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

test('GET /health identifica a API LAN v1', async () => {
  const { server, baseUrl } = await fixture()
  try {
    const response = await fetch(`${baseUrl}/health`)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { status: 'ok', product: 'Obra na Mão', apiVersion: '1' })
  } finally { await close(server) }
})

test('GET /version informa a versao do processo servidor', async () => {
  const { server, baseUrl } = await fixture()
  try {
    const response = await fetch(`${baseUrl}/version`)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { product: 'Obra na Mão', apiVersion: '1', serverVersion: '0.1.0' })
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

test('metodos fora do contrato retornam 405 e Allow GET', async () => {
  const { server, baseUrl } = await fixture()
  try {
    const response = await fetch(`${baseUrl}/health`, { method: 'POST' })
    assert.equal(response.status, 405)
    assert.equal(response.headers.get('allow'), 'GET')
    assert.deepEqual(await response.json(), { error: 'method_not_allowed' })
  } finally { await close(server) }
})
