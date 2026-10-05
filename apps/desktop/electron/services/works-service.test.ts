import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const { WorksService } = require('./works-service.cjs')

describe('WorksService canonical overview routing',()=>{
  it('keeps local overview while core is not central-active',async()=>{
    const local={obra:{id:7,nome:'Local'}}
    const db={workOverview:vi.fn(()=>local)}
    const moduleStorage={state:vi.fn(()=>({state:'migration-required'}))}
    const dataAccess={get:vi.fn(),list:vi.fn()}
    const service=new WorksService({db,dataAccess,moduleStorage})

    await expect(service.overview(7)).resolves.toBe(local)
    expect(db.workOverview).toHaveBeenCalledWith(7)
    expect(dataAccess.get).not.toHaveBeenCalled()
  })

  it('builds a central overview only from canonical active modules',async()=>{
    const state:Record<string,string>={core:'central-active',operation:'central-active',planning:'central-active',finance:'central-active',rh:'migration-required'}
    const moduleStorage={state:(module:string)=>({state:state[module]||'local'})}
    const rows:Record<string,any[]>={
      frentes_obra:[{id:11,obra_id:9,nome:'Hidráulica',status:'ativa'}],
      rdos:[{id:12,obra_id:9,data:'2026-10-05',atividades:'Teste',status:'concluido'}],
      tarefas_obra:[{id:13,obra_id:9,frente_id:11,titulo:'Pendência',status:'aberta'}],
      cronograma_etapas:[{id:14,obra_id:9,nome:'Etapa',previsto_inicio:'2026-10-06'}],
      itens_orcamentarios:[{id:15,obra_id:9,frente_id:11,quantidade:2,valor_unitario_centavos:5000}],
      contas:[{id:16,obra_id:9,frente_id:11,tipo:'pagar',status:'pago',valor_centavos:3000}]
    }
    const dataAccess={
      get:vi.fn(async(table:string,id:number)=>table==='obras'&&id===9?{id:9,nome:'Central',status:'ativa'}:null),
      list:vi.fn(async(table:string)=>rows[table]||[])
    }
    const db={workOverview:vi.fn()}
    const service=new WorksService({db,dataAccess,moduleStorage})
    const result=await service.overview(9)

    expect(result.serverPartial).toBe(true)
    expect(result.obra.nome).toBe('Central')
    expect(result.orcado_centavos).toBe(10000)
    expect(result.frentes[0]).toMatchObject({id:11,orcado_centavos:10000,comprometido_centavos:3000,pago_centavos:3000,pendencias_abertas:1})
    expect(result.availability).toMatchObject({core:true,operation:true,planning:true,finance:true,rh:false,documentos:false,contratos:true,compras:true,medicoes:true})
    expect(dataAccess.list).not.toHaveBeenCalledWith('funcionario_obras',expect.anything())
    expect(db.workOverview).not.toHaveBeenCalled()
  })
})
