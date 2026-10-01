import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const { FieldSourceService } = require('./field-source-service.cjs')

function fixture(state: 'local'|'migration-required'|'central-ready'|'central-active') {
  const local = { saveDailyReport: vi.fn((payload:any) => ({ id: 1, ...payload, source: 'local' })) }
  const lanClient = { saveDailyReport: vi.fn(async (payload:any) => ({ id: 2, ...payload, source: 'central' })) }
  const moduleStorage = { state: vi.fn(() => ({ module: 'operation', state, localRecords: state === 'migration-required' ? 3 : 0 })) }
  return { local, lanClient, moduleStorage, service: new FieldSourceService({ local, lanClient, moduleStorage }) }
}

describe('FieldSourceService', () => {
  it.each(['local','migration-required'] as const)('%s preserva o FieldService local', async (state) => {
    const f = fixture(state)
    const payload = { obra_id: 7, data: '2026-09-30', revision: 4 }
    await expect(f.service.saveDailyReport(payload)).resolves.toEqual(expect.objectContaining({ source: 'local', revision: 4 }))
    expect(f.local.saveDailyReport).toHaveBeenCalledWith(payload)
    expect(f.lanClient.saveDailyReport).not.toHaveBeenCalled()
  })

  it('central-active envia o agregado inteiro com expectedRevision e remove revisões auxiliares do payload', async () => {
    const f = fixture('central-active')
    const payload = {
      id: 9,
      revision: 4,
      obra_id: 7,
      data: '2026-09-30',
      equipe: [{ id: 11, revision: 2, nome: 'João' }],
      equipamentos: [{ id: 12, revision: 3, nome: 'Martelete' }],
      ocorrencias: [{ id: 13, revision: 5, descricao: 'Teste' }]
    }
    await expect(f.service.saveDailyReport(payload)).resolves.toEqual(expect.objectContaining({ source: 'central' }))
    expect(f.lanClient.saveDailyReport).toHaveBeenCalledTimes(1)
    expect(f.lanClient.saveDailyReport).toHaveBeenCalledWith({
      id: 9,
      expectedRevision: 4,
      obra_id: 7,
      data: '2026-09-30',
      equipe: [{ id: 11, nome: 'João' }],
      equipamentos: [{ id: 12, nome: 'Martelete' }],
      ocorrencias: [{ id: 13, descricao: 'Teste' }]
    })
    expect(f.local.saveDailyReport).not.toHaveBeenCalled()
  })

  it('central-ready bloqueia escrita até capability/pareamento ficar pronto', async () => {
    const f = fixture('central-ready')
    await expect(f.service.saveDailyReport({ obra_id: 7 })).rejects.toThrow(/ainda não está ativo|central/i)
    expect(f.local.saveDailyReport).not.toHaveBeenCalled()
    expect(f.lanClient.saveDailyReport).not.toHaveBeenCalled()
  })

  it('falha da rede em central-active é propagada sem fallback para o SQLite local', async () => {
    const f = fixture('central-active')
    f.lanClient.saveDailyReport.mockRejectedValueOnce(new Error('Servidor indisponível'))
    await expect(f.service.saveDailyReport({ obra_id: 7 })).rejects.toThrow('Servidor indisponível')
    expect(f.local.saveDailyReport).not.toHaveBeenCalled()
  })
})
