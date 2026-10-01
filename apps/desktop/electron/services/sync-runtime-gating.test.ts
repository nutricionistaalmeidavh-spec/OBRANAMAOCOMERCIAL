import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { afterEach, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const { DatabaseService } = require('./database.cjs')
const { SyncCoordinator } = require('./sync-coordinator.cjs')

const fixtures: Array<{ dataDir: string; database: any; sync: any }> = []

function fixture() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commercial-sync-gating-'))
  const database = new DatabaseService({ dataDir, migrationsDir: path.resolve(import.meta.dirname, '../../database/migrations') })
  database.open()
  const company = database.save('empresas', { razao_social: 'Local', status: 'ativa' })
  const work = database.save('obras', { empresa_id: company.id, nome: 'Obra A' })
  database.db.prepare('INSERT INTO desktop_sync_scope(id,binding,allowed_modules) VALUES(1,?,?)').run(JSON.stringify({
    companyId: company.id,
    workId: work.id,
    companyName: 'Local',
    workName: 'Obra A',
    baseUrl: 'https://test.example',
    deviceId: 'device-a',
    remoteCompanyId: 'company-a',
    remoteProjectId: 'project-a'
  }), JSON.stringify(['obra360']))

  const online = {
    state: vi.fn(() => ({ linked: true, baseUrl: 'https://test.example' })),
    session: vi.fn(async () => { throw new Error('não deve consultar sessão') }),
    syncPull: vi.fn(),
    syncPush: vi.fn(),
    publishMobileSummary: vi.fn(),
    publishFinanceReference: vi.fn()
  }
  const dataProvider = {
    runtimeState: () => ({ source: 'lan-client', paused: true, pauseReason: 'A sincronização central é responsabilidade do PC principal.' }),
    resolveScope: vi.fn(), listBridge: vi.fn(), getBridge: vi.fn(), summary: vi.fn(), obligations: vi.fn(), applyRemote: vi.fn()
  }
  const sync = new SyncCoordinator({ database, online, dataProvider })
  fixtures.push({ dataDir, database, sync })
  return { database, online, dataProvider, sync }
}

afterEach(async () => {
  for (const f of fixtures.splice(0)) {
    await f.sync.stop()
    f.database.close()
    fs.rmSync(f.dataDir, { recursive: true, force: true })
  }
})

it('lan-client retorna estado pausado sem chamar sessão, pull, push ou publicações Cloud', async () => {
  const f = fixture()
  const state = await f.sync.run({ retryNow: true })
  expect(state.paused).toBe(true)
  expect(state.source).toBe('lan-client')
  expect(state.pauseReason).toMatch(/PC principal/)
  expect(f.online.session).not.toHaveBeenCalled()
  expect(f.online.syncPull).not.toHaveBeenCalled()
  expect(f.online.syncPush).not.toHaveBeenCalled()
  expect(f.online.publishMobileSummary).not.toHaveBeenCalled()
  expect(f.online.publishFinanceReference).not.toHaveBeenCalled()
  expect(f.dataProvider.listBridge).not.toHaveBeenCalled()
})
