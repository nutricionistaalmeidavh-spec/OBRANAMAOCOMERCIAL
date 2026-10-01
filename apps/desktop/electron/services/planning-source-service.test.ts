import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const { PlanningSourceService } = require('./planning-source-service.cjs')

function fixture(state:string) {
  const local = { overview: vi.fn(() => ({ budget_centavos: 1, curve: [], cash: [{ competencia: 'local' }], fronts: [] })) }
  const lanClient = { planningOverview: vi.fn(async () => ({ budget_centavos: 2, curve: [], cash: [], fronts: [] })) }
  const moduleStorage = { state: vi.fn(() => ({ module: 'planning', state })) }
  return { local, lanClient, moduleStorage, service: new PlanningSourceService({ local, lanClient, moduleStorage }) }
}

describe('PlanningSourceService', () => {
  it.each(['local', 'migration-required'])('%s preserva o PlanningService local existente', async state => {
    const f = fixture(state)
    await expect(f.service.overview(7)).resolves.toEqual({ budget_centavos: 1, curve: [], cash: [{ competencia: 'local' }], fronts: [] })
    expect(f.local.overview).toHaveBeenCalledWith(7)
    expect(f.lanClient.planningOverview).not.toHaveBeenCalled()
  })

  it('central-active usa somente o overview central e preserva o shape público', async () => {
    const f = fixture('central-active')
    await expect(f.service.overview(7)).resolves.toEqual({ budget_centavos: 2, curve: [], cash: [], fronts: [] })
    expect(f.lanClient.planningOverview).toHaveBeenCalledWith(7)
    expect(f.local.overview).not.toHaveBeenCalled()
  })

  it('central-ready bloqueia em vez de consultar o SQLite local', async () => {
    const f = fixture('central-ready')
    await expect(f.service.overview(7)).rejects.toThrow(/planejamento central.*não está ativo|nenhum dado.*fallback/i)
    expect(f.local.overview).not.toHaveBeenCalled()
    expect(f.lanClient.planningOverview).not.toHaveBeenCalled()
  })

  it('falha de rede no servidor é propagada sem fallback local', async () => {
    const f = fixture('central-active')
    f.lanClient.planningOverview.mockRejectedValueOnce(new Error('Servidor indisponível'))
    await expect(f.service.overview(7)).rejects.toThrow('Servidor indisponível')
    expect(f.local.overview).not.toHaveBeenCalled()
  })
})
