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
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commercial-sync-'))
  const database = new DatabaseService({ dataDir, migrationsDir: path.resolve(import.meta.dirname, '../../database/migrations') })
  database.open()
  const company = database.save('empresas', { razao_social: 'Local', status: 'ativa' })
  const work = database.save('obras', { empresa_id: company.id, nome: 'Obra A' })
  const task = database.save('tarefas_obra', { obra_id: work.id, titulo: 'Instalar tubo', status: 'aberta' })
  const session = { authorized: true, company: { id: 'company-a' }, project: { id: 'project-a' }, device: { id: 'device-a' }, access: { modules: ['obra360', 'finance', 'dre', 'rdo', 'documents'] } }
  const online = {
    state: () => ({ linked: true, baseUrl: 'https://test.example' }),
    session: vi.fn(async () => session),
    syncPull: vi.fn(async (_revision: number) => ({ changed: false })),
    syncPush: vi.fn(async (changes: any[]) => ({ accepted: changes.map(c => ({ changeId: c.changeId, status: 'accepted', bridged: true })) })),
    publishMobileSummary: vi.fn(async (_summary: any) => ({ ok: true })),
    publishFinanceReference: vi.fn(async (_obligations: any[]) => ({ accepted: 1 })),
    resolveConflict: vi.fn(async () => ({ ok: true }))
  }
  const sync = new SyncCoordinator({ database, online, now: () => Date.parse('2026-09-05T12:00:00Z') })
  const f = { dataDir, database, company, work, task, online, session, sync }
  fixtures.push(f)
  return f
}
afterEach(async () => {
  for (const f of fixtures.splice(0)) { await f.sync.stop(); f.database.close(); fs.rmSync(f.dataDir, { recursive: true, force: true }) }
})
it('persists changes while offline and retries the same id after restart', async () => {
  const f = fixture()
  await f.sync.configure({ companyId: f.company.id, workId: f.work.id })
  f.online.syncPush.mockRejectedValueOnce(new Error('offline'))
  await expect(f.sync.run()).rejects.toThrow('offline')
  const changeId = f.online.syncPush.mock.calls[0][0][0].changeId
  f.database.close(); f.database.open()
  f.sync = new SyncCoordinator({ database: f.database, online: f.online })
  await f.sync.run({ retryNow: true })
  expect(f.online.syncPush.mock.calls[1][0][0].changeId).toBe(changeId)
  expect(f.sync.state().pending).toBe(0)
  f.database.save('tarefas_obra', { ...f.task, titulo: 'Mudança offline' })
  f.online.session.mockRejectedValueOnce(new Error('offline'))
  await expect(f.sync.run()).rejects.toThrow('offline')
  expect(f.sync.state().pending).toBeGreaterThan(0)
})
it('does not send old jobs to another remote device or project', async () => {
  const f = fixture()
  await f.sync.configure({ companyId: f.company.id, workId: f.work.id })
  f.session.device.id = 'device-b'
  await expect(f.sync.run()).rejects.toThrow(/Vínculo online mudou/)
  expect(f.online.syncPush).not.toHaveBeenCalled()
  await f.sync.configure({ companyId: f.company.id, workId: f.work.id })
  await f.sync.run()
  expect(f.database.db.prepare("SELECT COUNT(*) n FROM desktop_sync_outbox WHERE status='pending'").get().n).toBeGreaterThan(0)
  expect(f.sync.state().pending).toBe(0)
})
it('applies remote changes only for its device and creates a manual conflict on concurrent local edits', async () => {
  const f = fixture()
  await f.sync.configure({ companyId: f.company.id, workId: f.work.id }); await f.sync.run()
  const remote = (device: string, revision: number, title: string) => ({ changed: true, remoteRevision: revision, snapshot: { desktopBridge: { tasks: [{ sourceDeviceId: device, localId: f.task.id, mobileEditedRevision: revision, payload: { titulo: title } }] } } })
  f.online.syncPull.mockResolvedValue(remote('other-device', 1, 'Não alterar') as any)
  await f.sync.run()
  expect(f.database.get('tarefas_obra', f.task.id).titulo).toBe('Instalar tubo')
  f.online.syncPull.mockResolvedValue(remote('device-a', 2, 'Título remoto') as any)
  await f.sync.run()
  expect(f.database.get('tarefas_obra', f.task.id).titulo).toBe('Título remoto')
  f.database.save('tarefas_obra', { ...f.database.get('tarefas_obra', f.task.id), titulo: 'Título local' })
  f.online.syncPull.mockResolvedValue(remote('device-a', 3, 'Remoto concorrente') as any)
  await f.sync.run()
  expect(f.database.get('tarefas_obra', f.task.id).titulo).toBe('Título local')
  expect(f.sync.state().conflicts).toHaveLength(1)
  await f.sync.resolveLocalConflict(f.sync.state().conflicts[0].id, 'accept_remote')
  expect(f.database.get('tarefas_obra', f.task.id).titulo).toBe('Remoto concorrente')
  expect(f.sync.state().conflicts).toHaveLength(0)
})
it('publishes actual partial-payment balances in cents and excludes another work', async () => {
  const f = fixture()
  const account = f.database.save('contas', { empresa_id: f.company.id, obra_id: f.work.id, tipo: 'pagar', descricao: 'Tubos', valor_centavos: 10000, competencia: '2026-09', vencimento: '2026-09-01' })
  f.database.accountPayment(account.id, { valor_centavos: 4000, data: '2026-09-01' })
  const other = f.database.save('obras', { empresa_id: f.company.id, nome: 'Outra obra' })
  f.database.save('contas', { empresa_id: f.company.id, obra_id: other.id, tipo: 'pagar', descricao: 'Outra', valor_centavos: 90000, competencia: '2026-09', vencimento: '2026-09-01' })
  await f.sync.configure({ companyId: f.company.id, workId: f.work.id }); await f.sync.run()
  const summary = f.online.publishMobileSummary.mock.calls.at(-1)![0]
  expect(summary.modules.finance.payableCents).toBe(6000)
  expect(summary.modules.finance.overdueCents).toBe(6000)
  expect(summary.modules.dre.expense).toBe(4000)
  expect(summary.modules.dre.result).toBe(-4000)
  expect(f.online.publishFinanceReference).toHaveBeenCalledTimes(1)
})
it('stop waits for in-flight HTTP before allowing the database to close', async () => {
  const f = fixture()
  await f.sync.configure({ companyId: f.company.id, workId: f.work.id })
  let release!: () => void
  f.online.syncPull.mockImplementationOnce(async () => { await new Promise<void>(r => { release = r }); return { changed: false } })
  const running = f.sync.run().catch(() => {})
  await vi.waitFor(() => expect(release).toBeTypeOf('function'))
  let stopped = false
  const stopping = f.sync.stop().then(() => { stopped = true })
  await Promise.resolve(); expect(stopped).toBe(false)
  release(); await stopping; await running
  expect(stopped).toBe(true)
  expect(f.online.syncPush).not.toHaveBeenCalled()
})
