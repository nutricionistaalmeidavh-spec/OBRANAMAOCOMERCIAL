import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { afterEach, describe, expect, it, vi } from 'vitest'

const require=createRequire(import.meta.url)
const { RhDocumentService }=require('./rh-document-service.cjs')
const dirs:string[]=[]

function centralFixture(state='central-active'){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rh-doc-source-'));dirs.push(dir)
  const context={
    employee:{id:77,nome:'Funcionário Central',cpf:'12345678909',empresa_id:8,cargo_id:3,status:'ativo'},
    company:{id:8,razao_social:'Empresa Central',cnpj:'12345678000195',politica_recibos:'Café'},
    cargo:{id:3,nome:'Encanador'},
    benefits:[{descricao:'Café',valor_centavos:18000},{descricao:'Transporte',valor_centavos:9000}],
    point:{id:5,competencia:'2026-10',jornada_inicio:'07:00',intervalo_inicio:'11:00',intervalo_fim:'12:00',jornada_fim:'17:00'},
    marks:[{data:'2026-10-01',tipo:'trabalho',entrada:'07:01',intervalo_saida:'11:02',intervalo_entrada:'12:03',saida:'16:59'}],
    documentStorage:'local-derived'
  }
  const rh={
    state:vi.fn(()=>state),
    timeDocumentContext:vi.fn(async()=>context),
    timeAutoFill:vi.fn(async()=>({ok:true}))
  }
  const localTime={
    generateDocuments:vi.fn(async()=>({source:'local'})),
    generateForAll:vi.fn(async()=>[{source:'local-all'}]),
    pointHtml:vi.fn(()=>'<html>ponto</html>'),
    receiptHtml:vi.fn((_d:any,_c:any,_cargo:any,benefits:any[])=>benefits.length?'<html>recibo</html>':null),
    printHtml:vi.fn(async()=>undefined),
    printEntries:vi.fn(async(entries:any[])=>({results:entries,employees:entries.length,documents:entries.length,printed:true,canceled:false}))
  }
  let fileId=40
  const fileService={
    employeeFolders:vi.fn(()=>({base:dir,general:dir,signed:dir})),
    registerCentralFile:vi.fn(async(_source:string,document:any)=>({id:++fileId,...document,storage:'central',registeredInCentralDatabase:true}))
  }
  const dataAccess={list:vi.fn(async()=>[context.employee])}
  return {service:new RhDocumentService({rh,localTime,fileService,dataAccess}),rh,localTime,fileService,dataAccess,context,dir}
}

afterEach(()=>{for(const dir of dirs.splice(0))fs.rmSync(dir,{recursive:true,force:true})})

describe('RH document generation source',()=>{
  it('baixa as duas quinzenas somente após impressão aceita e preserva parcelas já pagas', async()=>{
    const f=centralFixture()
    const getEmployee=vi.fn(async()=>({payments:[{quinzena:1,status:'pago'}],launches:[{quinzena:1,status:'pago'},{quinzena:2,status:'pendente'}]}))
    const confirm=vi.fn(async()=>({ok:true}))
    Object.assign(f.rh,{getEmployee,confirm})
    const result=await f.service.generateForAll({competencia:'2026-10',paymentDate:'2026-11-05',point:true,receipts:true,print:true})
    expect(result.printed).toBe(true)
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({funcionario_id:77,competencia:'2026-10',quinzena:2,data:'2026-11-05'}))
    expect(result.payments[0]).toMatchObject({ok:true,installments:[2]})
  })

  it('cancelamento, somente gerar e reimpressão não dão baixa', async()=>{
    for(const mode of ['cancel','generate','reprint']){
      const f=centralFixture()
      const getEmployee=vi.fn(),confirm=vi.fn()
      Object.assign(f.rh,{getEmployee,confirm})
      if(mode==='cancel')f.localTime.printEntries.mockImplementation(async(entries:any[])=>({results:entries,printed:false,canceled:true}))
      await f.service.generateForAll({competencia:'2026-10',point:true,receipts:true,print:mode==='cancel',reprint:mode==='reprint'})
      expect(getEmployee).not.toHaveBeenCalled()
      expect(confirm).not.toHaveBeenCalled()
    }
  })

  it('informa falha de baixa separadamente sem ocultar impressão concluída', async()=>{
    const f=centralFixture()
    Object.assign(f.rh,{getEmployee:vi.fn(async()=>{throw new Error('Servidor indisponível para baixa')})})
    const result=await f.service.generateForAll({competencia:'2026-10',point:true,receipts:true,print:true})
    expect(result.printed).toBe(true)
    expect(result.payments[0]).toMatchObject({ok:false,error:'Servidor indisponível para baixa'})
  })

  it('mantém geração local intacta enquanto RH não é central', async()=>{
    for(const state of ['local','migration-required']){
      const f=centralFixture(state)
      await expect(f.service.generateDocuments({funcionario_id:77,competencia:'2026-10'})).resolves.toEqual({source:'local'})
      expect(f.localTime.generateDocuments).toHaveBeenCalledTimes(1)
      expect(f.rh.timeDocumentContext).not.toHaveBeenCalled()
    }
  })

  it('gera PDF local derivado do contexto central sem registrar sombra RH local', async()=>{
    const f=centralFixture()
    const result=await f.service.generateDocuments({funcionario_id:77,competencia:'2026-10',paymentDate:'2026-10-15'})
    expect(f.rh.timeDocumentContext).toHaveBeenCalledWith(expect.objectContaining({funcionario_id:77,competencia:'2026-10'}))
    expect(f.localTime.generateDocuments).not.toHaveBeenCalled()
    expect(f.localTime.printHtml).toHaveBeenCalledTimes(2)
    expect(f.localTime.receiptHtml.mock.calls[0][3]).toEqual([{descricao:'Café',valor_centavos:18000}])
    expect(result).toMatchObject({source:'central-rh',storage:'central',registeredInLocalDatabase:false,registeredInCentralDatabase:true})
    expect(result.point).toMatchObject({storage:'central',registeredInCentralDatabase:true})
    expect(result.receipt).toMatchObject({storage:'central',registeredInCentralDatabase:true})
    expect(f.fileService.registerCentralFile).toHaveBeenCalledTimes(2)
  })

  it('central-ready recusa gerar com dados locais como fallback', async()=>{
    const f=centralFixture('central-ready')
    await expect(f.service.generateDocuments({funcionario_id:77,competencia:'2026-10'})).rejects.toThrow(/não serão gerados.*fallback/i)
    expect(f.localTime.generateDocuments).not.toHaveBeenCalled()
    expect(f.rh.timeDocumentContext).not.toHaveBeenCalled()
  })

  it('gera lote central a partir da lista central de funcionários', async()=>{
    const f=centralFixture()
    const result=await f.service.generateForAll({competencia:'2026-10',point:true,receipts:false})
    expect(f.dataAccess.list).toHaveBeenCalledWith('funcionarios',{status:'ativo'})
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({funcionario_id:77,ok:true,documents:{source:'central-rh',storage:'central',registeredInCentralDatabase:true}})
  })
})
