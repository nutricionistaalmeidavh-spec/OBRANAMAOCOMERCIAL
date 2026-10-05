import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const { MeasurementSourceService } = require('./measurement-source-service.cjs')
const { ProcurementSourceService } = require('./procurement-source-service.cjs')
const { ContractsSourceService } = require('./contracts-source-service.cjs')

function moduleStorage(state:string){
  return { state:vi.fn(()=>({state})) }
}

describe('phase 2-5 canonical desktop sources',()=>{
  it('medição usa LAN quando planning está central-active e não cai no SQLite',async()=>{
    const local={saveMeasurement:vi.fn()}
    const lan={saveMeasurement:vi.fn(async payload=>({id:1,...payload}))}
    const service=new MeasurementSourceService({local,lanClient:lan,moduleStorage:moduleStorage('central-active')})
    await service.saveWithItems({id:1,revision:3,obra_id:2,itens:[]})
    expect(local.saveMeasurement).not.toHaveBeenCalled()
    expect(lan.saveMeasurement).toHaveBeenCalledWith(expect.objectContaining({id:1,expectedRevision:3}))
  })

  it('medição em central-ready bloqueia sem fallback local',async()=>{
    const local={saveMeasurement:vi.fn()}
    const service=new MeasurementSourceService({local,lanClient:{},moduleStorage:moduleStorage('central-ready')})
    await expect(service.saveWithItems({obra_id:1})).rejects.toThrow(/nenhum dado será salvo localmente/i)
    expect(local.saveMeasurement).not.toHaveBeenCalled()
  })

  it('compras reutilizam requestId após falha de rede e não chamam serviço local',async()=>{
    const local={createOrder:vi.fn()}
    const attempts:any[]=[]
    const lan={procurementCreateOrder:vi.fn(async payload=>{attempts.push(payload); if(attempts.length===1) throw new Error('rede'); return {id:10}})}
    const service=new ProcurementSourceService({local,lanClient:lan,moduleStorage:moduleStorage('central-active'),randomUUID:()=> 'req-fixed'})
    const payload={obra_id:1,descricao:'Tubos',itens:[{descricao:'Tubo',quantidade_pedida:1}]}
    await expect(service.createOrder(payload)).rejects.toThrow('rede')
    await expect(service.createOrder(payload)).resolves.toEqual({id:10})
    expect(attempts.map(item=>item.requestId)).toEqual(['req-fixed','req-fixed'])
    expect(local.createOrder).not.toHaveBeenCalled()
  })

  it('contrato central envia revision na edição e requestId apenas na criação',async()=>{
    const lan={contractCreate:vi.fn(async payload=>payload)}
    const local={createReceivable:vi.fn(),createAddendum:vi.fn()}
    const dataAccess={get:vi.fn(async()=>({id:7,revision:4}))}
    const product={getEdition:()=>({edition:'empreiteira'})}
    const service=new ContractsSourceService({local,lanClient:lan,moduleStorage:moduleStorage('central-active'),dataAccess,product,randomUUID:()=> 'contract-req'})
    await service.createReceivable({obra_id:1,descricao:'Novo',valor_centavos:100})
    await service.createReceivable({id:7,revision:4,obra_id:1,descricao:'Editado',valor_centavos:200})
    expect(lan.contractCreate.mock.calls[0][0]).toEqual(expect.objectContaining({requestId:'contract-req',edition:'empreiteira'}))
    expect(lan.contractCreate.mock.calls[1][0]).toEqual(expect.objectContaining({id:7,expectedRevision:4,edition:'empreiteira'}))
    expect(lan.contractCreate.mock.calls[1][0].requestId).toBeUndefined()
    expect(local.createReceivable).not.toHaveBeenCalled()
  })

  it('aditivo lê revision atual do contrato antes de aplicar valor central',async()=>{
    const lan={contractAddendum:vi.fn(async payload=>payload)}
    const local={createReceivable:vi.fn(),createAddendum:vi.fn()}
    const dataAccess={get:vi.fn(async()=>({id:7,revision:9}))}
    const service=new ContractsSourceService({local,lanClient:lan,moduleStorage:moduleStorage('central-active'),dataAccess,product:{getEdition:()=>({edition:'construtora'})},randomUUID:()=> 'add-req'})
    await service.createAddendum({contrato_id:7,descricao:'Aditivo',valor_centavos:100,status:'contratado'})
    expect(lan.contractAddendum).toHaveBeenCalledWith(expect.objectContaining({requestId:'add-req',expectedContractRevision:9}))
  })
})
