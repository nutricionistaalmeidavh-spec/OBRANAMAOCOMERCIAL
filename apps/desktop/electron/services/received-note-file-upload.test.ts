import { createRequire } from 'node:module'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
const require=createRequire(import.meta.url)
const { DatabaseService }=require('./database.cjs')
const { FileService }=require('./file-service.cjs')
const migrationsDir=resolve(import.meta.dirname,'../../database/migrations')
const pdf={name:'nota.pdf',contentBase64:Buffer.from('%PDF-1.7\nPDF fictício de teste').toString('base64')}

function fixture(){
  const dir=mkdtempSync(join(tmpdir(),'obra-note-upload-'))
  const db=new DatabaseService({dataDir:dir,migrationsDir});db.open()
  const empresa=db.save('empresas',{razao_social:'Empresa de testes'})
  const obra=db.save('obras',{empresa_id:empresa.id,nome:'Obra teste'})
  const docsDir=join(dir,'docs')
  return {dir,db,empresa,obra,docsDir,close(){db.close();rmSync(dir,{recursive:true,force:true})}}
}
describe('Anexo escolhido dentro do formulário de nota recebida',()=>{
  it('registra PDF válido uma única vez na árvore de documentos da obra',async()=>{
    const f=fixture()
    try {
      const files=new FileService({documentsDir:f.docsDir,db:f.db,
        dataAccess:{get:async(table:string,id:number)=>f.db.get(table,id)},
        moduleStorage:{state:()=>({state:'local'})},storage:{state:()=>({mode:'local'})}})
      const document=await files.importReceivedNoteFile({obra_id:f.obra.id,title:'NF exemplo',file:pdf})
      expect(document).toMatchObject({obra_id:f.obra.id,categoria:'nota_fiscal',titulo:'NF exemplo'})
      expect(f.db.get('arquivos',document.arquivo_id).nome_original).toBe('nota.pdf')
      expect(existsSync(f.db.get('arquivos',document.arquivo_id).caminho)).toBe(true)
      expect(f.db.list('documentos')).toHaveLength(1)
    }finally{f.close()}
  })
  it('rejeita conteúdo com extensão falsa e não grava documento órfão',async()=>{
    const f=fixture()
    try{
      const files=new FileService({documentsDir:f.docsDir,db:f.db,
        dataAccess:{get:async(table:string,id:number)=>f.db.get(table,id)},
        moduleStorage:{state:()=>({state:'local'})},storage:{state:()=>({mode:'local'})}})
      await expect(files.importReceivedNoteFile({obra_id:f.obra.id,file:{name:'falso.pdf',contentBase64:Buffer.from('not-a-pdf').toString('base64')}})).rejects.toThrow(/PDF|PNG|JPG/)
      expect(f.db.list('documentos')).toHaveLength(0)
      expect(f.db.list('arquivos')).toHaveLength(0)
    }finally{f.close()}
  })
  it('em modo servidor usa apenas armazenamento central, sem fallback local',async()=>{
    const f=fixture()
    try{
      const uploadDocument=vi.fn(async()=>({document:{id:987,obra_id:f.obra.id,arquivo_id:800,categoria:'nota_fiscal'}}))
      const files=new FileService({documentsDir:f.docsDir,db:f.db,
        dataAccess:{get:async(table:string,id:number)=>f.db.get(table,id)},
        lanClient:{uploadDocument},
        moduleStorage:{state:()=>({state:'central-active'})},
        storage:{state:()=>({mode:'server'})}})
      const result=await files.importReceivedNoteFile({obra_id:f.obra.id,file:pdf})
      expect(result.id).toBe(987)
      expect(uploadDocument).toHaveBeenCalledTimes(1)
      expect(uploadDocument).toHaveBeenCalledWith(expect.objectContaining({file:expect.objectContaining({name:'nota.pdf'})}))
      expect(f.db.list('documentos')).toHaveLength(0)
      expect(f.db.list('arquivos')).toHaveLength(0)
    }finally{f.close()}
  })
})
