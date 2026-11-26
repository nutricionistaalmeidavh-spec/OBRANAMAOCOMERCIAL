import { describe, expect, it, vi } from 'vitest'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { SyncCoordinator } = require('./sync-coordinator.cjs')

function coordinator(source: string, provider: any) {
  const c = Object.create(SyncCoordinator.prototype)
  c.dataProvider = { runtimeState: () => ({ source }), ...provider }
  c.now = () => 0
  return c
}

describe('Obra360 no modo servidor', () => {
  it('envia o que veio do celular para o servidor (LAN ou servidor próprio)', async () => {
    for (const source of ['lan-host', 'remote']) {
      const obra360 = vi.fn().mockResolvedValue({})
      const c = coordinator(source, { obra360 })
      await c.applyFieldInbox({ workId: 1, remoteProjectId: 'p' }, { changed: true, snapshot: { floors: [], history: [], issues: [], secret: 'x' } })
      expect(obra360).toHaveBeenCalledWith('apply', { scope: { workId: 1, remoteProjectId: 'p' }, snapshot: { issues: [], days: undefined, employees: undefined, floors: [], history: [] } })
    }
  })
  it('telas dos PCs clientes da LAN leem direto do servidor', async () => {
    const obra360 = vi.fn().mockResolvedValue([{ nivel: 0 }])
    const c = coordinator('lan-client', { lanProvider: { obra360 } })
    await expect(c.obra360('progressList', { workId: 3 })).resolves.toEqual([{ nivel: 0 }])
    expect(obra360).toHaveBeenCalledWith('progressList', { workId: 3 })
  })
  it('falha visível quando a fonte não tem Obra360', async () => {
    const c = coordinator('remote', {})
    await expect(c.obra360('progressList', { workId: 3 })).rejects.toThrow(/indisponível/)
  })
})
