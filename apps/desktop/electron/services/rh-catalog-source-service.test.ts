import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'

const require=createRequire(import.meta.url)
const { RhCatalogSourceService }=require('./rh-catalog-source-service.cjs')

function fixture(state='central-active'){
  const local={list:vi.fn(()=>({cargos:[{source:'local'}],beneficios:[],links:[]})),saveCargo:vi.fn((data:any)=>({source:'local',...data})),saveCompensationPolicy:vi.fn((data:any)=>({source:'local-policy',...data})),saveBenefit:vi.fn((data:any)=>({source:'local',...data})),saveLink:vi.fn(()=>true),deactivate:vi.fn(()=>true)}
  const rows:any={
    empresas:[{id:9,razao_social:'Empresa Central',status:'ativa'}],
    cargos:[{id:2,empresa_id:9,nome:'Encanador',ativo:1}],
    beneficios:[{id:3,empresa_id:9,nome:'Café',tipo:'alimentacao',ativo:1}],
    cargo_beneficios:[]
  }
  const dataAccess={
    list:vi.fn(async(table:string,filters:any={})=>(rows[table]||[]).filter((item:any)=>Object.entries(filters).every(([key,value])=>value===''||value==null||String(item[key])===String(value)))),
    get:vi.fn(async(table:string,id:number)=>(rows[table]||[]).find((item:any)=>Number(item.id)===Number(id))||null),
    save:vi.fn(async(table:string,data:any)=>({source:'central',table,...data,id:data.id||99})),
    remote:{saveCompensationPolicy:vi.fn(async(payload:any)=>({cargo:{...payload.cargo,id:payload.cargo.id||99,revision:2},links:payload.links.map((link:any,index:number)=>({...link,id:link.id||100+index,revision:2}))}))},
    rememberRevision:vi.fn(),
    rememberMany:vi.fn()
  }
  const moduleStorage={state:vi.fn(()=>({state}))}
  return {service:new RhCatalogSourceService({local,dataAccess,moduleStorage}),local,dataAccess,rows}
}

describe('RhCatalogSourceService',()=>{
  it('preserva catálogo local em local/migration-required',async()=>{
    for(const state of ['local','migration-required']){
      const f=fixture(state)
      await expect(f.service.list()).resolves.toMatchObject({cargos:[{source:'local'}]})
      await expect(f.service.saveCargo({nome:'Local'})).resolves.toMatchObject({source:'local'})
      expect(f.dataAccess.list).not.toHaveBeenCalled()
    }
  })

  it('central-active lê catálogo da empresa única e nunca consulta o SQLite local',async()=>{
    const f=fixture()
    await expect(f.service.list()).resolves.toMatchObject({empresa_id:9,source:'central-rh',cargos:[{id:2,empresa_id:9}],beneficios:[{id:3,empresa_id:9}]})
    expect(f.local.list).not.toHaveBeenCalled()
    expect(f.dataAccess.list).toHaveBeenCalledWith('cargos',{empresa_id:9})
    expect(f.dataAccess.list).toHaveBeenCalledWith('beneficios',{empresa_id:9})
    expect(f.dataAccess.list).toHaveBeenCalledWith('cargo_beneficios',{empresa_id:9})
  })

  it('central-active injeta empresa no novo cargo/benefício e valida link entre empresas',async()=>{
    const f=fixture()
    await expect(f.service.saveCargo({nome:'Mestre',salario_base_centavos:350000})).resolves.toMatchObject({source:'central',table:'cargos',empresa_id:9,nome:'Mestre'})
    await expect(f.service.saveBenefit({nome:'Refeição',tipo:'alimentacao',valor_padrao_centavos:22000})).resolves.toMatchObject({source:'central',table:'beneficios',empresa_id:9,nome:'Refeição'})
    f.rows.cargo_beneficios=[]
    await expect(f.service.saveLink({cargo_id:2,beneficio_id:3,valor_centavos:18000,quinzena:1,natureza:'credito'})).resolves.toBe(true)
    expect(f.dataAccess.save).toHaveBeenLastCalledWith('cargo_beneficios',expect.objectContaining({empresa_id:9,cargo_id:2,beneficio_id:3,valor_centavos:18000}))
  })

  it('salva cargo e vínculos pela operação canônica única no RH central',async()=>{
    const f=fixture()
    f.rows.cargos[0].revision=1
    f.rows.cargo_beneficios.push({id:8,revision:1,empresa_id:9,cargo_id:2,beneficio_id:3,valor_centavos:18000,ativo:1})
    const result=await f.service.saveCompensationPolicy({
      cargo:{...f.rows.cargos[0],salario_base_centavos:360000},
      links:[{id:8,revision:1,beneficio_id:3,valor_centavos:22000,quinzena:1,natureza:'credito',ativo:1}]
    })
    expect(result.cargo).toMatchObject({id:2,empresa_id:9,salario_base_centavos:360000})
    expect(f.dataAccess.remote.saveCompensationPolicy).toHaveBeenCalledTimes(1)
    expect(f.dataAccess.save).not.toHaveBeenCalled()
    expect(f.dataAccess.rememberRevision).toHaveBeenCalledWith('cargos',expect.objectContaining({revision:2}))
    expect(f.dataAccess.rememberMany).toHaveBeenCalledWith('cargo_beneficios',expect.any(Array))
  })

  it('central-ready bloqueia alteração sem fallback e múltiplas empresas exigem contexto explícito',async()=>{
    const blocked=fixture('central-ready')
    await expect(blocked.service.saveCargo({nome:'Não salvar'})).rejects.toThrow(/não será alterado localmente.*fallback/i)
    expect(blocked.local.saveCargo).not.toHaveBeenCalled()
    const multi=fixture()
    multi.rows.empresas.push({id:10,razao_social:'Empresa B',status:'ativa'})
    await expect(multi.service.saveBenefit({nome:'Sem contexto'})).rejects.toThrow(/mais de uma empresa ativa/i)
  })
})
