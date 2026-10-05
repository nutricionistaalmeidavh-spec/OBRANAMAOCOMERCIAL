import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const { MeasurementSourceService } = require('./measurement-source-service.cjs')

function fixture(state='local') {
  const local={ saveMeasurement:vi.fn((payload:any)=>({ ...payload, source:'local' })) }
  const lanClient={ saveMeasurement:vi.fn(async(payload:any)=>({ ...payload, source:'lan' })) }
  const moduleStorage={ state:vi.fn(()=>({ module:'planning', state })) }
  const randomUUID=vi.fn(()=> 'measurement-request')
  return { local,lanClient,moduleStorage,randomUUID,service:new MeasurementSourceService({local,lanClient,moduleStorage,randomUUID}) }
}

describe('MeasurementSourceService',()=>{
  it.each(['local','migration-required'])('%s preserva serviço local existente', async state=>{
    const f=fixture(state)
    await expect(f.service.saveWithItems({obra_id:1,numero:'1'})).resolves.toMatchObject({source:'local'})
    expect(f.lanClient.saveMeasurement).not.toHaveBeenCalled()
  })

  it('central-ready bloqueia sem fallback local', async()=>{
    const f=fixture('central-ready')
    await expect(f.service.saveWithItems({obra_id:1,numero:'1'})).rejects.toThrow(/nenhum dado.*fallback/i)
    expect(f.local.saveMeasurement).not.toHaveBeenCalled()
  })

  it('central-active usa LAN e mantém requestId após falha ambígua', async()=>{
    const f=fixture('central-active')
    f.lanClient.saveMeasurement.mockRejectedValueOnce(new Error('rede caiu depois do commit'))
    const payload={obra_id:1,numero:'M-1',itens:[]}
    await expect(f.service.saveWithItems(payload)).rejects.toThrow('rede caiu')
    await expect(f.service.saveWithItems(payload)).resolves.toMatchObject({source:'lan',requestId:'measurement-request'})
    expect(f.randomUUID).toHaveBeenCalledTimes(1)
    expect(f.lanClient.saveMeasurement.mock.calls[0][0].requestId).toBe('measurement-request')
    expect(f.lanClient.saveMeasurement.mock.calls[1][0].requestId).toBe('measurement-request')
  })

  it('edição envia revision como expectedRevision', async()=>{
    const f=fixture('central-active')
    await f.service.saveWithItems({id:9,revision:4,obra_id:1,numero:'M-1'})
    expect(f.lanClient.saveMeasurement).toHaveBeenCalledWith(expect.objectContaining({id:9,expectedRevision:4}))
  })
})
