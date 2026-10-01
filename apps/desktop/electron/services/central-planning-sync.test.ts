import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { afterEach, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const { DatabaseService } = require('./database.cjs')
const { SyncCoordinator } = require('./sync-coordinator.cjs')

const fixtures:any[] = []

afterEach(async () => {
  for (const f of fixtures.splice(0)) {
    await f.sync.stop()
    f.database.close()
    fs.rmSync(f.dataDir, { recursive: true, force: true })
  }
})

it('cronograma central usa a bridge schedule existente e recebe edição do PWA no banco central', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'central-planning-sync-'))
  const database = new DatabaseService({ dataDir, migrationsDir: path.resolve(import.meta.dirname, '../../database/migrations') })
  database.open()
  const schedule:any = { id: 801, obra_id: 601, nome: 'Prumadas', previsto_inicio: '2026-10-01', previsto_fim: '2026-10-10', percentual_previsto: 60, percentual_realizado: 20, status: 'em_andamento' }
  const rows:Record<string,any[]> = { frentes_obra: [], tarefas_obra: [], rdos: [], cronograma_etapas: [schedule] }
  const dataProvider = {
    runtimeState: () => ({ source: 'lan-host', paused: false, pauseReason: null }),
    resolveScope: vi.fn(async () => ({ companyId: 501, workId: 601, companyName: 'Empresa central', workName: 'Obra central' })),
    syncCapabilities: vi.fn(async () => ({ version: 1, modules: ['core', 'operation', 'planning'], bridgeEntities: ['frentes_obra', 'tarefas_obra', 'rdos', 'cronograma_etapas'] })),
    listBridge: vi.fn(async (entity:string) => rows[entity] || []),
    getBridge: vi.fn(async (entity:string,id:number) => rows[entity]?.find(row => row.id === id) || null),
    applyRemote: vi.fn(async (entity:string,id:number,payload:any) => {
      const row = rows[entity]?.find(item => item.id === id)
      if (!row) return false
      Object.assign(row, payload)
      return true
    }),
    summary: vi.fn(async () => { throw new Error('summary ainda não centralizado') }),
    obligations: vi.fn(async () => { throw new Error('financeiro ainda não centralizado') })
  }
  const session = { authorized: true, company: { id: 'company-a' }, project: { id: 'project-a' }, device: { id: 'device-a' }, access: { modules: ['obra360'] } }
  const online = {
    state: () => ({ linked: true, baseUrl: 'https://test.example' }),
    session: vi.fn(async () => session),
    syncPull: vi.fn(async () => ({ changed: false })),
    syncPush: vi.fn(async (changes:any[]) => ({ accepted: changes.map(change => ({ changeId: change.changeId, status: 'accepted', bridged: true })) })),
    publishMobileSummary: vi.fn(),
    publishFinanceReference: vi.fn(),
    resolveConflict: vi.fn(async () => ({ ok: true }))
  }
  const sync = new SyncCoordinator({ database, online, dataProvider, now: () => Date.parse('2026-10-01T12:00:00Z') })
  fixtures.push({ dataDir, database, sync })

  await sync.configure({ companyId: 501, workId: 601 })
  await sync.run()
  const pushed = online.syncPush.mock.calls.flatMap((call:any[]) => call[0])
  const schedulePush = pushed.find((change:any) => change.entity === 'cronograma_etapas' && change.localId === schedule.id)
  expect(schedulePush).toBeTruthy()
  expect(schedulePush.payload.percentual_realizado).toBe(20)

  online.syncPull.mockResolvedValueOnce({
    changed: true,
    remoteRevision: 3,
    snapshot: { desktopBridge: { schedule: [{ sourceDeviceId: 'device-a', localId: schedule.id, mobileEditedRevision: 3, payload: { percentual_realizado: 55, status: 'em_andamento' } }] } }
  } as any)
  await sync.run()
  expect(schedule.percentual_realizado).toBe(55)
  expect(dataProvider.applyRemote).toHaveBeenCalledWith('cronograma_etapas', schedule.id, expect.objectContaining({ percentual_realizado: 55 }), expect.objectContaining({ workId: 601 }))
})
