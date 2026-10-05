import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'

const require=createRequire(import.meta.url)
const { ContractsSourceService }=require('./contracts-source-service.cjs')

function fixture(state='local'){
  const local={createReceivable:vi.fn((p:any)=>({...p,source:'local'})),createAddendum:vi.fn((p:any)=>({...p,source:'local'}))}
  const lanClient={contractCreate:vi.fn(async(p:any)=>({...p,source:'lan'})),contractAddendum:vi.fn(async(p:any)=>({...p,source:'lan'}))}
  const moduleStorage={state:vi.fn(()=>({module:'finance',state}))}
  const dataAccess={get:vi.fn(async()=>({id:7,revision:3}))}
  const product={getEdition:vi.fn(()=>({edition:'empreiteira'}))}
  const randomUUID=vi.fn(()=> 'contract-request')
  return {local,lanClient,moduleStorage,dataAccess,product,randomUUID,service:new ContractsSourceService({local,lanClient,moduleStorage,dataAccess,product,randomUUID})}
}

describe('ContractsSourceService',()=>{
  it.each(['local','migration-required'])('%s mantém serviço local', async state=>{
    const f=fixture(state)
    await expect(f.service.createReceivable({obra_id:1})).resolves.toMatchObject({source:'local'})
    expect(f.lanClient.contractCreate).not.toHaveBeenCalled()
  })

  it('central-ready bloqueia sem fallback', async()=>{
    const f=fixture('central-ready')
    await expect(f.service.createReceivable({obra_id:1})).rejects.toThrow(/nenhum dado.*fallback/i)
    expect(f.local.createReceivable).not.toHaveBeenCalled()
  })

  it('criação central reusa requestId em retry', async()=>{
    const f=fixture('central-active')
    f.lanClient.contractCreate.mockRejectedValueOnce(new Error('timeout'))
    const payload={obra_id:1,descricao:'Contrato',valor_centavos:1000}
    await expect(f.service.createReceivable(payload)).rejects.toThrow('timeout')
    await expect(f.service.createReceivable(payload)).resolves.toMatchObject({source:'lan',requestId:'contract-request',edition:'empreiteira'})
    expect(f.randomUUID).toHaveBeenCalledTimes(1)
  })

  it('edição central envia expectedRevision e não usa CRUD genérico', async()=>{
    const f=fixture('central-active')
    await f.service.createReceivable({id:7,revision:5,obra_id:1,descricao:'Editado'})
    expect(f.lanClient.contractCreate).toHaveBeenCalledWith(expect.objectContaining({id:7,expectedRevision:5,edition:'empreiteira'}))
  })

  it('aditivo usa revision atual do contrato', async()=>{
    const f=fixture('central-active')
    await f.service.createAddendum({contrato_id:7,status:'contratado',valor_centavos:500})
    expect(f.lanClient.contractAddendum).toHaveBeenCalledWith(expect.objectContaining({expectedContractRevision:3,requestId:'contract-request'}))
  })
})
