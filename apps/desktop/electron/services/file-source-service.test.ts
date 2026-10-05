import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const { FileSourceService } = require('./file-source-service.cjs')

function fixture(state:'local'|'migration-required'|'central-ready'|'central-active'='central-active'){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'obra-file-source-'))
  const source=path.join(dir,'documento.pdf')
  fs.writeFileSync(source,Buffer.from('arquivo-central'))
  const local:any={
    documentsDir:path.join(dir,'local-docs'),
    employeeFolders:vi.fn(()=>({base:path.join(dir,'employee')})),
    importForEmployee:vi.fn(async()=>({id:1,source:'local'})),
    importForMeasurement:vi.fn(async()=>({id:2,source:'local'})),
    importForWorkDocument:vi.fn(async()=>({id:3,source:'local'})),
    open:vi.fn(async()=>true),reveal:vi.fn(async()=>true),copyPath:vi.fn(async()=>true),
    openDocumentsFolder:vi.fn(async()=>true),deleteDocument:vi.fn(async()=>true)
  }
  const files:any=new Map([[44,{id:44,nome_original:'remoto.pdf',caminho:'server://file/44'}]])
  const documents:any=new Map()
  let nextDocument=100
  const dataAccess:any={
    get:vi.fn(async(table:string,id:number)=>{
      if(table==='funcionarios')return {id,empresa_id:7,obra_atual_id:9,nome:'João'}
      if(table==='medicoes')return {id,obra_id:9,frente_id:3,numero:'M-1'}
      if(table==='obras')return {id,empresa_id:7,nome:'Obra'}
      if(table==='arquivos')return files.get(id)||null
      if(table==='documentos')return documents.get(id)||null
      return null
    }),
    save:vi.fn(async(table:string,data:any)=>{
      if(table==='documentos'){const row={id:nextDocument++,...data,revision:1};documents.set(row.id,row);return row}
      return {id:nextDocument++,...data,revision:1}
    }),
    list:vi.fn(async()=>[]),
    remove:vi.fn(async()=>true)
  }
  const lanClient:any={
    uploadFile:vi.fn(async()=>({id:44,nome_original:'documento.pdf',caminho:'server://file/44'})),
    downloadFile:vi.fn(async()=>Buffer.from('remoto')),
    deleteFile:vi.fn(async()=>({ok:true}))
  }
  const shell:any={openPath:vi.fn(async()=>''),showItemInFolder:vi.fn()}
  const clipboard:any={writeText:vi.fn()}
  const dialog:any={showOpenDialog:vi.fn(async()=>({canceled:false,filePaths:[source]}))}
  const moduleStorage:any={state:vi.fn(()=>({state}))}
  const service=new FileSourceService({local,dataAccess,lanClient,moduleStorage,dialog,shell,clipboard,cacheDir:path.join(dir,'cache')})
  return {dir,source,local,dataAccess,lanClient,shell,clipboard,dialog,service,documents}
}

describe('FileSourceService',()=>{
  it('mantém arquivo local somente enquanto RH/documentos ainda pertencem à fonte local',async()=>{
    const f=fixture('migration-required')
    await expect(f.service.importForEmployee({funcionario_id:1,categoria:'RG'})).resolves.toMatchObject({source:'local'})
    expect(f.local.importForEmployee).toHaveBeenCalled()
    expect(f.lanClient.uploadFile).not.toHaveBeenCalled()
  })

  it('bloqueia central-ready sem fallback silencioso',async()=>{
    const f=fixture('central-ready')
    await expect(f.service.importForEmployee({funcionario_id:1,categoria:'RG'})).rejects.toThrow(/não estão ativos|servidor/i)
    expect(f.local.importForEmployee).not.toHaveBeenCalled()
    expect(f.lanClient.uploadFile).not.toHaveBeenCalled()
  })

  it('central-active envia bytes ao servidor e grava metadado documental central',async()=>{
    const f=fixture('central-active')
    const doc=await f.service.importForEmployee({funcionario_id:1,categoria:'RG',title:'RG João'})
    expect(f.lanClient.uploadFile).toHaveBeenCalledWith(f.source,{origin:'importado'})
    expect(f.dataAccess.save).toHaveBeenCalledWith('documentos',expect.objectContaining({
      arquivo_id:44,empresa_id:7,obra_id:9,funcionario_id:1,categoria:'RG',titulo:'RG João'
    }))
    expect(doc).toMatchObject({arquivo_id:44,categoria:'RG'})
    expect(f.local.importForEmployee).not.toHaveBeenCalled()
  })

  it('materializa arquivo server:// em cache antes de abrir e nunca tenta abrir caminho do host',async()=>{
    const f=fixture('central-active')
    await f.service.open('server://file/44')
    expect(f.lanClient.downloadFile).toHaveBeenCalledWith(44)
    const opened=f.shell.openPath.mock.calls[0][0]
    expect(opened).toContain('cache')
    expect(fs.readFileSync(opened,'utf8')).toBe('remoto')
    expect(f.local.open).not.toHaveBeenCalled()
  })
})
