import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'

const require=createRequire(import.meta.url)
const { ProcurementSourceService }=require('./procurement-source-service.cjs')

function fixture(state='local'){
  const local={
    summary:vi.fn(()=>({source:'local'})),
    createOrder:vi.fn((p:any)=>({...p,source:'local'})),
    receiveMaterial:vi.fn((p:any)=>({...p,source:'local'})),
    moveStock:vi.fn((p:any)=>({...p,source:'local'}))
  }
  const lanClient={
    procurementSummary:vi.fn(async()=>({source:'lan'})),
    procurementCreateOrder:vi.fn(async(p:any)=>({...p,source:'lan'})),
    procurementReceiveMaterial:vi.fn(async(p:any)=>({...p,source:'lan'})),
    procurementMoveStock:vi.fn(async(p:any)=>({...p,source:'lan'}))
  }
  const moduleStorage={state:vi.fn(()=>({module:'finance',state}))}
  const randomUUID=vi.fn(()=> 'proc-request')
  return {local,lanClient,moduleStorage,randomUUID,service:new ProcurementSourceService({local,lanClient,moduleStorage,randomUUID})}
}

describe('ProcurementSourceService',()=>{
  it.each(['local','migration-required'])('%s mantém compras locais', async state=>{
    const f=fixture(state)
    await expect(f.service.createOrder({obra_id:1})).resolves.toMatchObject({source:'local'})
    expect(f.lanClient.procurementCreateOrder).not.toHaveBeenCalled()
  })

  it('central-ready bloqueia sem fallback', async()=>{
    const f=fixture('central-ready')
    await expect(f.service.createOrder({obra_id:1})).rejects.toThrow(/nenhum dado.*fallback/i)
    expect(f.local.createOrder).not.toHaveBeenCalled()
  })

  it('central-active usa LAN e reusa idempotency key após erro ambíguo', async()=>{
    const f=fixture('central-active')
    f.lanClient.procurementCreateOrder.mockRejectedValueOnce(new Error('timeout'))
    const payload={obra_id:1,descricao:'Tubos'}
    await expect(f.service.createOrder(payload)).rejects.toThrow('timeout')
    await expect(f.service.createOrder(payload)).resolves.toMatchObject({source:'lan',requestId:'proc-request'})
    expect(f.randomUUID).toHaveBeenCalledTimes(1)
    expect(f.lanClient.procurementCreateOrder.mock.calls[0][0].requestId).toBe('proc-request')
    expect(f.lanClient.procurementCreateOrder.mock.calls[1][0].requestId).toBe('proc-request')
  })

  it('não usa serviço local se LAN falhar em central-active', async()=>{
    const f=fixture('central-active')
    f.lanClient.procurementMoveStock.mockRejectedValueOnce(new Error('server down'))
    await expect(f.service.moveStock({obra_id:1,tipo:'saida'})).rejects.toThrow('server down')
    expect(f.local.moveStock).not.toHaveBeenCalled()
  })
})
