import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const { OperationalSyncDataProvider } = require('./lan-sync-data-provider.cjs')

function fixture(operationalMode: string) {
  const local = {
    resolveScope: vi.fn(async ({ companyId, workId }: any) => ({ companyId, workId, companyName: 'Local', workName: 'Obra local' })),
    listBridge: vi.fn(() => [{ id: 1 }]),
    getBridge: vi.fn(() => ({ id: 1 })),
    summary: vi.fn(() => ({ modules: {} })),
    obligations: vi.fn(() => []),
    applyRemote: vi.fn(() => true)
  }
  const lanClient = {
    syncSourceCapabilities: vi.fn(async () => ({ version: 1, modules: ['core'], bridgeEntities: [] })),
    get: vi.fn(async (table: string, id: number) => table === 'empresas'
      ? { id, razao_social: 'Empresa central' }
      : { id, empresa_id: 10, nome: 'Obra central' }),
    list: vi.fn(async () => [{ id: 99 }]),
    save: vi.fn(async () => ({ id: 99 }))
  }
  const storage = { state: () => ({ mode: operationalMode === 'local' ? 'local' : 'server', operationalMode }) }
  const provider = new OperationalSyncDataProvider({ storage, localProvider: local, lanClient })
  return { provider, local, lanClient }
}

describe('OperationalSyncDataProvider', () => {
  it('mantém modo local no provider local', async () => {
    const f = fixture('local')
    expect(f.provider.runtimeState()).toEqual({ source: 'local', paused: false, pauseReason: null })
    await expect(f.provider.resolveScope({ companyId: 1, workId: 2 })).resolves.toMatchObject({ companyName: 'Local' })
    expect(f.local.resolveScope).toHaveBeenCalled()
    expect(f.lanClient.get).not.toHaveBeenCalled()
  })

  it('lan-host resolve empresa e obra exclusivamente pela fonte central', async () => {
    const f = fixture('lan-host')
    expect(f.provider.runtimeState()).toEqual({ source: 'lan-host', paused: false, pauseReason: null })
    await expect(f.provider.resolveScope({ companyId: 10, workId: 20 })).resolves.toEqual({
      companyId: 10,
      workId: 20,
      companyName: 'Empresa central',
      workName: 'Obra central'
    })
    expect(f.lanClient.get).toHaveBeenCalledTimes(2)
    expect(f.local.resolveScope).not.toHaveBeenCalled()
  })

  it('lan-host nunca cai no SQLite local quando a bridge ainda não é suportada', async () => {
    const f = fixture('lan-host')
    await expect(f.provider.listBridge('rdos', { workId: 20 })).rejects.toThrow('Fonte central ainda não suporta este módulo.')
    expect(f.local.listBridge).not.toHaveBeenCalled()
    expect(f.lanClient.list).not.toHaveBeenCalled()
  })

  it('lan-client e remote ficam pausados e não acessam fonte local ou LAN para sincronização', async () => {
    for (const mode of ['lan-client', 'remote']) {
      const f = fixture(mode)
      expect(f.provider.runtimeState().paused).toBe(true)
      expect(f.provider.runtimeState().pauseReason).toMatch(/PC principal|remoto/i)
      await expect(f.provider.resolveScope({ companyId: 1, workId: 2 })).rejects.toThrow(/pausada/i)
      expect(f.local.resolveScope).not.toHaveBeenCalled()
      expect(f.lanClient.get).not.toHaveBeenCalled()
    }
  })
})
