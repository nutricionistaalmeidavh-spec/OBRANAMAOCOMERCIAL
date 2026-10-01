import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'

const main = fs.readFileSync(path.resolve(process.cwd(), 'electron/main.cjs'), 'utf8')
const require = createRequire(import.meta.url)
const { LanSyncDataProvider } = require('../electron/services/lan-sync-data-provider.cjs')

describe('wiring da fonte financeira central F11', () => {
  it('usa FinanceSourceService nos IPCs financeiros existentes', () => {
    expect(main).toContain("require('./services/finance-source-service.cjs')")
    expect(main).toMatch(/const finance = new FinanceSourceService\(\{ local: db, lanClient: dataAccess\.remote, moduleStorage \}\)/)
    expect(main).toContain('finance,')
    expect(main).toContain("ipcMain.handle('dashboard:get', envelope((filters) => services.finance.dashboard(filters)))")
    expect(main).toContain("ipcMain.handle('dre:get', envelope((filters) => services.finance.dre(filters)))")
    expect(main).toContain("ipcMain.handle('accounts:payment', envelope(({ id, payment }) => services.finance.accountPayment(id, payment)))")
  })

  it('envia o escopo financeiro ao servidor LAN sem consultar SQLite local', async () => {
    const request = vi.fn(async () => ({ modules: {} }))
    const provider = new LanSyncDataProvider({
      lanClient: {
        syncSourceCapabilities: vi.fn(async () => ({ version: 1, modules: ['finance', 'summary'], bridgeEntities: [] })),
        request
      }
    })
    const scope = {
      companyId: 10,
      workId: 20,
      workName: 'Obra F11',
      remoteProjectId: 'project-20',
      deviceId: 'device-10'
    }

    await provider.summary(scope, ['finance', 'dre'])
    expect(request).toHaveBeenCalledWith('GET', expect.stringMatching(/^\/api\/v1\/sync-source\/summary\?/))
    expect(request.mock.calls[0][1]).toContain('company_id=10')
    expect(request.mock.calls[0][1]).toContain('obra_id=20')
    expect(request.mock.calls[0][1]).toContain('remote_project_id=project-20')
    expect(request.mock.calls[0][1]).toContain('device_id=device-10')
    expect(request.mock.calls[0][1]).toContain('modules=finance%2Cdre')

    request.mockClear()
    await provider.obligations(scope)
    expect(request.mock.calls[0][1]).toContain('/api/v1/sync-source/obligations?')
    expect(request.mock.calls[0][1]).toContain('obra_id=20')
    expect(request.mock.calls[0][1]).toContain('remote_project_id=project-20')
  })
})
