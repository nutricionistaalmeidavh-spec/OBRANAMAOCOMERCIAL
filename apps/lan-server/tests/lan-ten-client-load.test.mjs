import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import test from 'node:test'
import { LanRepository } from '../src/repository.mjs'
import { createLanServer } from '../src/server.mjs'

// Reproduces ten different Desktop connections without touching production, D1 or a real LAN.
// Run: npm run test:lan10
// Extended local run: LAN_LOAD_ROUNDS=100 npm run test:lan10
const CLIENTS = 10
const ROUNDS = Math.max(1, Math.min(100, Number(process.env.LAN_LOAD_ROUNDS) || 5))
const MAX_HTTP_MS = 5000 // matches the Desktop LAN HTTP client's current timeout
const digest = value => createHash('sha256').update(value).digest('hex')
const percentile = (samples, fraction) => {
  const sorted = [...samples].sort((a, b) => a - b)
  return Math.round(sorted[Math.ceil(sorted.length * fraction) - 1] || 0)
}

function dateForRound(round) {
  return new Date(Date.UTC(2026, 10, 13 + round)).toISOString().slice(0, 10)
}

async function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'obra-lan-ten-clients-'))
  const repository = new LanRepository({ filename: path.join(root, 'central.sqlite') })
  let server
  try {
    repository.applyMigrations(path.resolve(import.meta.dirname, '../migrations'))
    const company = repository.save('empresas', { razao_social: 'Empresa de carga LAN' })
    const customer = repository.save('clientes', { empresa_id: company.id, nome: 'Cliente de carga' })
    const tokens = Array.from({ length: CLIENTS }, (_, i) => 'lan-benchmark-token-' + i)
    const tokenHashes = new Map(tokens.map((token, i) => [digest(token), i]))
    const security = {
      serverState: () => ({ claimed: true, companyId: 'tenant-test-only' }),
      deviceByTokenHash(hash) {
        const index = tokenHashes.get(hash)
        return index === undefined ? null : { id: 'device-' + index, memberId: 'member-' + index, status: 'active' }
      },
      member(id) {
        return /^member-\d+$/.test(id)
          ? { memberId: id, role: 'admin', modules: ['obra360', 'rdo', 'finance', 'rh'], channels: ['desktop'], status: 'active' }
          : null
      },
      touchDevice() {}
    }
    server = createLanServer({ repository, security })
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    return {
      repository, company, customer, tokens, server,
      baseUrl: 'http://127.0.0.1:' + server.address().port,
      async close() {
        await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
        repository.close()
        rmSync(root, { recursive: true, force: true })
      }
    }
  } catch (error) {
    if (server?.listening) server.close()
    repository.close()
    rmSync(root, { recursive: true, force: true })
    throw error
  }
}

async function request(f, clientIndex, method, pathname, body, latencies) {
  const start = performance.now()
  const response = await fetch(f.baseUrl + pathname, {
    method,
    headers: {
      authorization: 'Bearer ' + f.tokens[clientIndex],
      ...(body === undefined ? {} : { 'content-type': 'application/json' })
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(MAX_HTTP_MS)
  })
  const elapsed = performance.now() - start
  if (latencies) latencies.push(elapsed)
  const data = await response.json()
  return { status: response.status, data }
}

function success(result, status, context) {
  assert.equal(result.status, status, context + ': ' + JSON.stringify(result.data))
  return result.data
}

test('10 LAN Desktop clients can concurrently create, read and update independent works and daily reports', { timeout: 120_000 }, async () => {
  const f = await fixture()
  const latency = []
  try {
    const workIds = await Promise.all(f.tokens.map(async (_, client) => {
      const work = success(
        await request(f, client, 'POST', '/api/v1/obras', {
          empresa_id: f.company.id, cliente_id: f.customer.id, nome: 'Obra - PC ' + client
        }, latency),
        201,
        'creating work for PC ' + client
      )
      for (let round = 0; round < ROUNDS; round++) {
        const report = success(
          await request(f, client, 'POST', '/api/v1/field/rdo', {
            obra_id: work.id, data: dateForRound(round),
            atividades: 'Criado pelo PC ' + client,
            equipe: [{ nome: 'Trabalhador ' + client, horas: 8 }]
          }, latency),
          201,
          'creating RDO for PC ' + client
        )
        const observed = success(
          await request(f, client, 'GET', '/api/v1/rdos/' + report.id, undefined, latency),
          200,
          'reading RDO for PC ' + client
        )
        const updated = success(
          await request(f, client, 'POST', '/api/v1/field/rdo', {
            id: report.id, expectedRevision: observed.revision,
            obra_id: work.id, data: dateForRound(round),
            atividades: 'Revisado pelo PC ' + client,
            equipe: [{ nome: 'Trabalhador ' + client, horas: 7 }]
          }, latency),
          201,
          'updating RDO for PC ' + client
        )
        assert.equal(updated.revision, observed.revision + 1)
        const actual = success(
          await request(f, client, 'GET', '/api/v1/rdos/' + report.id, undefined, latency),
          200,
          'verifying RDO for PC ' + client
        )
        assert.equal(actual.atividades, 'Revisado pelo PC ' + client)
      }
      const savedWork = success(
        await request(f, client, 'PUT', '/api/v1/obras/' + work.id, {
          expectedRevision: work.revision, data: { nome: 'Finalizada - PC ' + client }
        }, latency),
        200,
        'updating work for PC ' + client
      )
      assert.equal(savedWork.revision, work.revision + 1)
      return work.id
    }))

    assert.equal(new Set(workIds).size, CLIENTS)
    const db = f.repository.connection()
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM obras WHERE id IN (' + workIds.map(() => '?').join(',') + ')')
      .get(...workIds).n, CLIENTS)
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM rdos').get().n, CLIENTS * ROUNDS)
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM rdo_equipe').get().n, CLIENTS * ROUNDS)
    const p95 = percentile(latency, 0.95)
    const max = Math.round(Math.max(...latency))
    console.log('[LAN-10] mixed traffic', JSON.stringify({
      clients: CLIENTS, rounds: ROUNDS, requests: latency.length,
      p50Ms: percentile(latency, 0.50), p95Ms: p95, maxMs: max
    }))
    assert.ok(max < MAX_HTTP_MS, 'At least one request exceeded the Desktop 5-second timeout')
  } finally {
    await f.close()
  }
})

test('10 simultaneous edits of the same record persist exactly one winner and report nine revision conflicts', { timeout: 30_000 }, async () => {
  const f = await fixture()
  try {
    const work = f.repository.save('obras', {
      empresa_id: f.company.id, cliente_id: f.customer.id, nome: 'Registro concorrente'
    })
    const revisions = await Promise.all(f.tokens.map((_, i) =>
      request(f, i, 'GET', '/api/v1/obras/' + work.id)
    ))
    revisions.forEach(result => {
      assert.equal(result.status, 200)
      assert.equal(result.data.revision, 1)
    })
    const results = await Promise.all(f.tokens.map((_, i) =>
      request(f, i, 'PUT', '/api/v1/obras/' + work.id, {
        expectedRevision: 1, data: { nome: 'Alteração do PC ' + i }
      })
    ))
    assert.equal(results.filter(result => result.status === 200).length, 1)
    const conflicts = results.filter(result => result.status === 409)
    assert.equal(conflicts.length, CLIENTS - 1)
    conflicts.forEach(result => {
      assert.equal(result.data.error, 'revision_conflict')
      assert.equal(result.data.currentRevision, 2)
    })
    const persisted = f.repository.get('obras', work.id)
    assert.equal(persisted.nome, results.find(result => result.status === 200).data.nome)
    const revision = f.repository.connection()
      .prepare("SELECT revision FROM record_revisions WHERE resource_type='obras' AND resource_id=?")
      .get(String(work.id)).revision
    assert.equal(revision, 2)
    console.log('[LAN-10] shared record', JSON.stringify({ clients: CLIENTS, winners: 1, conflicts: conflicts.length }))
  } finally {
    await f.close()
  }
})
