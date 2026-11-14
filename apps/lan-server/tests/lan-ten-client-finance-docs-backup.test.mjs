import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import test from 'node:test'
import { LanRepository } from '../src/repository.mjs'
import { LanSecurityRepository } from '../src/security-repository.mjs'
import { DocumentStorageService } from '../src/document-storage-service.mjs'
import { CentralBackupService } from '../src/central-backup-service.mjs'
import { createLanServer } from '../src/server.mjs'

const CLIENTS = 10
const hash = value => createHash('sha256').update(String(value)).digest('hex')
const p95 = samples => {
  const sorted = [...samples].sort((a, b) => a - b)
  return Math.round(sorted[Math.ceil(sorted.length * 0.95) - 1] || 0)
}

async function fixture() {
  const folder = mkdtempSync(path.join(os.tmpdir(), 'obra-lan-finance-files-'))
  const dbPath = path.join(folder, 'central.sqlite')
  const fileDir = path.join(folder, 'files')
  const repository = new LanRepository({ filename: dbPath })
  let server
  try {
    repository.applyMigrations(path.resolve(import.meta.dirname, '../migrations'))
    const identity = new LanSecurityRepository({ db: repository.connection() })
    identity.initializeServer({ serverId: 'lan-load-finance-documents', setupCodeHash: 'test-only' })
    repository.connection().prepare('UPDATE lan_server_identity SET company_id=?,claimed_at=? WHERE id=1')
      .run('lan-load-test-company', '2026-11-13T12:00:00.000Z')

    const company = repository.save('empresas', { razao_social: 'Empresa LAN teste completo' })
    const work = repository.save('obras', { empresa_id: company.id, nome: 'Obra carga financeira' })
    const category = repository.save('categorias_financeiras', {
      nome: 'Materiais para teste', natureza: 'despesa', grupo_dre: 'custos_obra'
    })
    const account = repository.save('contas', {
      empresa_id: company.id, obra_id: work.id, categoria_id: category.id,
      tipo: 'pagar', descricao: 'Pagamento de materiais',
      competencia: '2026-11', vencimento: '2026-11-20', valor_centavos: 10000
    })

    const tokens = Array.from({ length: CLIENTS }, (_, i) => 'lan-ten-finance-token-' + i)
    const clients = new Map(tokens.map((token, i) => [hash(token), i]))
    const security = {
      serverState: () => ({
        claimed: true, companyId: 'lan-load-test-company', serverId: 'lan-load-finance-documents'
      }),
      deviceByTokenHash(value) {
        const id = clients.get(value)
        return id === undefined ? null : { id: 'device-' + id, memberId: 'member-' + id, status: 'active' }
      },
      member(id) {
        return /^member-\d+$/.test(id)
          ? { memberId: id, role: 'admin', modules: ['obra360', 'finance', 'documents'], channels: ['desktop'], status: 'active' }
          : null
      },
      touchDevice() {}
    }
    const documents = new DocumentStorageService({ repository, filesDir: fileDir })
    const backups = new CentralBackupService({
      repository, security, dataDir: folder, filesDir: fileDir, databasePath: dbPath,
      migrationsDir: path.resolve(import.meta.dirname, '../migrations'), serverVersion: 'load-test'
    })
    server = createLanServer({ repository, security, documentStorageService: documents, centralBackupService: backups })
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    return {
      repository, company, work, account, documents, backups, tokens,
      baseUrl: 'http://127.0.0.1:' + server.address().port,
      async close() {
        await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
        repository.close()
        rmSync(folder, { recursive: true, force: true })
      }
    }
  } catch (error) {
    if (server?.listening) server.close()
    repository.close()
    rmSync(folder, { recursive: true, force: true })
    throw error
  }
}

async function api(f, client, method, route, body, samples) {
  const started = performance.now()
  const response = await fetch(f.baseUrl + route, {
    method,
    headers: {
      authorization: 'Bearer ' + f.tokens[client],
      ...(body === undefined ? {} : { 'content-type': 'application/json' })
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(5000)
  })
  const elapsed = performance.now() - started
  samples.push(elapsed)
  return { status: response.status, data: await response.json() }
}

function expectStatus(result, status, label) {
  assert.equal(result.status, status, label + ': ' + JSON.stringify(result.data))
  return result.data
}

test('ten clients concurrently pay, replay payments, upload documents and read while SQLite/files backup runs', { timeout: 60000 }, async () => {
  const f = await fixture()
  const samples = []
  try {
    const payments = f.tokens.map((_, i) => api(f, i, 'POST',
      '/api/v1/finance/accounts/' + f.account.id + '/payment', {
        requestId: 'lan-ten-finance-' + i,
        payment: { valor_centavos: 1000, data: '2026-11-13', forma_pagamento: 'pix' }
      }, samples))
    const uploads = f.tokens.map((_, i) => api(f, i, 'POST', '/api/v1/documents/upload', {
      file: {
        name: 'laudo-' + i + '.txt',
        mimeType: 'text/plain',
        contentBase64: Buffer.from('Documento LAN ' + i).toString('base64')
      },
      document: {
        empresa_id: f.company.id, obra_id: f.work.id,
        categoria: 'documento_obra', titulo: 'Laudo computador ' + i
      }
    }, samples))
    const results = await Promise.all([...payments, ...uploads])
    results.slice(0, CLIENTS).forEach((result, i) => expectStatus(result, 200, 'Payment ' + i))
    const documents = results.slice(CLIENTS).map((result, i) => expectStatus(result, 201, 'Upload ' + i))
    assert.equal(new Set(documents.map(result => result.file.id)).size, CLIENTS)

    const replay = await Promise.all(f.tokens.map((_, i) => api(f, i, 'POST',
      '/api/v1/finance/accounts/' + f.account.id + '/payment', {
        requestId: 'lan-ten-finance-' + i,
        payment: { valor_centavos: 1000, data: '2026-11-13', forma_pagamento: 'pix' }
      }, samples)))
    replay.forEach((result, i) => expectStatus(result, 200, 'Payment replay ' + i))
    const totals = f.repository.connection()
      .prepare('SELECT COUNT(*) AS quantity, COALESCE(SUM(valor_centavos),0) AS amount FROM pagamentos_conta WHERE conta_id=?')
      .get(f.account.id)
    assert.equal(totals.quantity, CLIENTS)
    assert.equal(totals.amount, 10000)
    assert.equal(f.repository.connection().prepare('SELECT COUNT(*) AS n FROM documentos WHERE obra_id=?').get(f.work.id).n, CLIENTS)
    documents.forEach((item, i) => assert.equal(f.documents.read(item.file.id).bytes.toString(), 'Documento LAN ' + i))

    const duringBackup = await Promise.all([
      api(f, 0, 'POST', '/api/v1/admin/storage/backup', { reason: 'lan-ten-load' }, samples),
      ...f.tokens.map((_, i) => api(f, i, 'GET', '/api/v1/obras/' + f.work.id, undefined, samples))
    ])
    const backup = expectStatus(duringBackup[0], 201, 'SQLite + files backup')
    duringBackup.slice(1).forEach((result, i) => expectStatus(result, 200, 'Read while backup runs ' + i))
    assert.ok(backup.backupId)
    assert.ok(backup.filesCount >= CLIENTS)
    const verified = expectStatus(await api(f, 0, 'POST', '/api/v1/admin/storage/verify', {
      backupId: backup.backupId
    }, samples), 200, 'Backup integrity')
    assert.equal(verified.integrity, 'ok')
    const maximum = Math.round(Math.max(...samples))
    console.log('[LAN-10] financial/docs/backup', JSON.stringify({
      clients: CLIENTS, payments: CLIENTS, idempotentReplays: CLIENTS,
      documents: CLIENTS, backupFiles: backup.filesCount, requests: samples.length,
      p95Ms: p95(samples), maxMs: maximum
    }))
    assert.ok(maximum < 5000, 'At least one request exceeded the Desktop LAN HTTP timeout')
  } finally {
    await f.close()
  }
})
