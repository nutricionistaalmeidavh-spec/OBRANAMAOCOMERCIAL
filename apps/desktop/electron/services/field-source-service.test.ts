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
    await expect(f.service.saveDailyReport({ obra_id: 7, data: '2026-09-30' })).resolves.toEqual(expect.objectContaining({ source: 'local' }))
    expect(f.local.saveDailyReport).toHaveBeenCalledTimes(1)
    expect(f.lanClient.saveDailyReport).not.toHaveBeenCalled()
  })

  it('central-active envia o agregado inteiro em uma única chamada LAN', async () => {
    const f = fixture('central-active')
    const payload = { obra_id: 7, data: '2026-09-30', equipe: [{ nome: 'João' }], ocorrencias: [{ descricao: 'Teste' }] }
    await expect(f.service.saveDailyReport(payload)).resolves.toEqual(expect.objectContaining({ source: 'central' }))
    expect(f.lanClient.saveDailyReport).toHaveBeenCalledTimes(1)
    expect(f.lanClient.saveDailyReport).toHaveBeenCalledWith(payload)
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
