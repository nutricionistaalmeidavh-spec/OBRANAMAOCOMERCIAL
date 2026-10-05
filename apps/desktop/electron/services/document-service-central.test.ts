import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PDFDocument } from 'pdf-lib'

const require=createRequire(import.meta.url)
const { DocumentService }=require('./document-service.cjs')
const dirs:string[]=[]

async function writePdf(destination:string){
  const pdf=await PDFDocument.create();pdf.addPage([200,200]);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,await pdf.save())
}

describe('DocumentService central admission generation',()=>{
  afterEach(()=>dirs.splice(0).forEach(dir=>fs.rmSync(dir,{recursive:true,force:true})))

  it('uses canonical RH/document data and registers generated PDF in shared server storage',async()=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'obra-central-admission-'));dirs.push(dir)
    const employee={id:7,empresa_id:1,obra_atual_id:9,cargo_id:3,nome:'Ana Teste',cpf:'123',admissao:'2026-10-05'}
    const company={id:1,razao_social:'Empresa A',nome_fantasia:'Empresa A'}
    const cargo={id:3,empresa_id:1,nome:'Encanador',cbo:'724110'}
    const dataAccess={
      get:vi.fn(async(table:string,id:number)=>table==='funcionarios'?employee:table==='empresas'?company:table==='cargos'?cargo:null),
      list:vi.fn(async(table:string)=>{
        if(table==='empresa_documentos_admissionais')return[]
        if(table==='cargo_epi_kits')return[]
        if(table==='funcionario_epis')return[]
        if(table==='epis')return[]
        if(table==='modelos_documento_rh')return[]
        if(table==='documentos')return[]
        return[]
      }),
      save:vi.fn()
    }
    const fileService={
      documentsDir:dir,
      registerCentralFile:vi.fn(async(source:string,document:any)=>({id:41,...document,path:'server://file/51',localPath:source,storage:'central',registeredInCentralDatabase:true}))
    }
    const localDb={
      get:vi.fn(()=>{throw new Error('fallback local proibido')}),
      list:vi.fn(()=>{throw new Error('fallback local proibido')}),
      save:vi.fn(()=>{throw new Error('fallback local proibido')}),
      db:{prepare:vi.fn(()=>({get:()=>null,all:()=>[],run:()=>({changes:1})}))}
    }
    const moduleStorage={state:(module:string)=>({state:['rh','documents','core'].includes(module)?'central-active':'central-active'})}
    const service=new DocumentService({db:localDb,fileService,dialog:null,dataAccess,moduleStorage})
    service.printHtml=vi.fn(async(_html:string,destination:string)=>writePdf(destination))

    const result=await service.generate({funcionario_id:7,selected:['ordem_servico']})

    expect(result.generated).toHaveLength(1)
    expect(result.generated[0]).toMatchObject({id:41,storage:'central',registeredInCentralDatabase:true})
    expect(fileService.registerCentralFile).toHaveBeenCalledTimes(2)
    expect(fileService.registerCentralFile).toHaveBeenCalledWith(expect.any(String),expect.objectContaining({empresa_id:1,obra_id:9,funcionario_id:7,categoria:'ordem_servico'}))
    expect(fileService.registerCentralFile).toHaveBeenCalledWith(expect.any(String),expect.objectContaining({empresa_id:1,obra_id:9,funcionario_id:7,categoria:'dossie_admissao'}))
    expect(localDb.get).not.toHaveBeenCalled()
  })
})
