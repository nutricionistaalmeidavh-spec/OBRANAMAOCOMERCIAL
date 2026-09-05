import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { afterEach, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const { DatabaseService } = require('./database.cjs')
const { SyncCoordinator } = require('./sync-coordinator.cjs')
const fixtures: any[] = []

function fixture() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commercial-sync-hardening-'))
  const database = new DatabaseService({ dataDir, migrationsDir: path.resolve(import.meta.dirname, '../../database/migrations') })
  database.open()
  const company = database.save('empresas', { razao_social: 'Local', status: 'ativa' })
  const work = database.save('obras', { empresa_id: company.id, nome: 'Obra A' })
  const task = database.save('tarefas_obra', { obra_id: work.id, titulo: 'Tarefa A', status: 'aberta' })
  const session = { authorized: true, company: { id: 'company-a' }, project: { id: 'project-a' }, device: { id: 'device-a' }, access: { modules: ['obra360', 'finance', 'dre', 'rdo', 'documents'] } }
  const online = {
    state: () => ({ linked: true, baseUrl: 'https://test.example' }),
    session: vi.fn(async () => session),
    syncPull: vi.fn(async () => ({ changed: false })),
    syncPush: vi.fn(async (changes: any[]) => ({ accepted: changes.map(c => ({ changeId: c.changeId, status: 'accepted', bridged: true })) })),
    publishMobileSummary: vi.fn(async () => ({ ok: true })),
    publishFinanceReference: vi.fn(async () => ({ accepted: 1 })),
    resolveConflict: vi.fn(async () => ({ ok: true }))
  }
  const now = Date.parse('2026-09-05T12:00:00Z')
  const sync = new SyncCoordinator({ database, online, now: () => now })
  const f = { dataDir, database, company, work, task, online, session, sync, now }
  fixtures.push(f)
  return f
}

afterEach(async () => {
  for (const f of fixtures.splice(0)) { await f.sync.stop(); f.database.close(); fs.rmSync(f.dataDir, { recursive: true, force: true }) }
})

it('supersedes queued bridge and finance jobs when permissions are revoked', async () => {
  const f = fixture()
  await f.sync.configure({ companyId: f.company.id, workId: f.work.id }); await f.sync.run()
  f.online.syncPush.mockClear(); f.online.publishFinanceReference.mockClear()
  f.database.save('tarefas_obra', { ...f.task, titulo: 'Mudança pendente' })
  f.database.save('contas', { empresa_id: f.company.id, obra_id: f.work.id, tipo: 'pagar', descricao: 'Material', valor_centavos: 10000, competencia: '2026-09', vencimento: '2026-09-10' })
  f.session.access.modules = ['rdo', 'documents']
  await f.sync.run()
  const rows = f.database.db.prepare("SELECT kind,status,last_error FROM desktop_sync_outbox WHERE status='superseded'").all()
  expect(rows.some((x: any) => x.kind === 'bridge' && /Obra360/.test(x.last_error))).toBe(true)
  expect(rows.some((x: any) => x.kind === 'finance' && /administrativos/.test(x.last_error))).toBe(true)
  expect(f.sync.state().pending).toBe(0)
  expect(f.online.syncPush).not.toHaveBeenCalled()
  expect(f.online.publishFinanceReference).not.toHaveBeenCalled()
})

it('allows an independent ready job past a delayed job', async () => {
  const f = fixture()
  const taskB = f.database.save('tarefas_obra', { obra_id: f.work.id, titulo: 'Tarefa B', status: 'aberta' })
  await f.sync.configure({ companyId: f.company.id, workId: f.work.id }); await f.sync.run()
  f.online.syncPush.mockClear()
  f.database.save('tarefas_obra', { ...f.database.get('tarefas_obra', f.task.id), titulo: 'A alterada' })
  f.database.save('tarefas_obra', { ...f.database.get('tarefas_obra', taskB.id), titulo: 'B alterada' })
  const scope = f.sync.binding().scope
  f.sync.capture(scope, f.session.access.modules)
  const first = f.database.db.prepare("SELECT id FROM desktop_sync_outbox WHERE kind='bridge' AND local_id=? AND status='pending' ORDER BY id LIMIT 1").get(f.task.id)
  f.database.db.prepare('UPDATE desktop_sync_outbox SET next_attempt_at=? WHERE id=?').run(f.now + 3600000, first.id)
  await f.sync.run()
  const sentIds = f.online.syncPush.mock.calls.map((call: any[]) => call[0][0].localId)
  expect(sentIds).toContain(taskB.id)
  expect(sentIds).not.toContain(f.task.id)
})

it('does not reorder two pending changes for the same record around backoff', async () => {
  const f = fixture()
  await f.sync.configure({ companyId: f.company.id, workId: f.work.id }); await f.sync.run()
  f.online.syncPush.mockClear()
  const scope = f.sync.binding().scope
  f.database.save('tarefas_obra', { ...f.database.get('tarefas_obra', f.task.id), titulo: 'Versão A' }); f.sync.capture(scope, f.session.access.modules)
  f.database.save('tarefas_obra', { ...f.database.get('tarefas_obra', f.task.id), titulo: 'Versão B' }); f.sync.capture(scope, f.session.access.modules)
  const pending = f.database.db.prepare("SELECT id FROM desktop_sync_outbox WHERE kind='bridge' AND local_id=? AND status='pending' ORDER BY id").all(f.task.id)
  expect(pending.length).toBe(2)
  f.database.db.prepare('UPDATE desktop_sync_outbox SET next_attempt_at=? WHERE id=?').run(f.now + 3600000, pending[0].id)
  await f.sync.run()
  expect(f.online.syncPush).not.toHaveBeenCalled()
})