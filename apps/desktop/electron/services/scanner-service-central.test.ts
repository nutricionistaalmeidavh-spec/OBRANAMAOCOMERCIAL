import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { afterEach, describe, expect, it, vi } from 'vitest'

const require=createRequire(import.meta.url)
const {ScannerService}=require('./scanner-service.cjs')
const JPEG_1PX='/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAIBAQEBAQIBAQECAgICAgQDAgICAgUEBAMEBgUGBgYFBgYGBwkIBgcJBwYGCAsICQoKCgoKBggLDAsKDAkKCgr/2wBDAQICAgICAgUDAwUKBwYHCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgr/wAARCAAKAAoDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD9sfCvhXwx4F8Mab4J8E+HLDRtF0awhsdI0jSrNLe1sbWJBHFBDFGAkUaIqqqKAqqoAAAq/RRQB//Z'
const dirs:string[]=[]
afterEach(()=>dirs.splice(0).forEach(dir=>fs.rmSync(dir,{recursive:true,force:true})))

describe('scanner no módulo Documentos central',()=>{
  it('publica a versão assinada no Server sem consultar/gravar o SQLite local',async()=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'obra-scanner-central-'));dirs.push(dir)
    const original={id:10,arquivo_id:20,empresa_id:1,obra_id:9,frente_id:2,funcionario_id:7,categoria:'ponto',titulo:'Ficha',status_assinatura:'nao_assinado',versao:1}
    const dataAccess={
      get:vi.fn(async(table:string,id:number)=>table==='documentos'&&id===10?original:null),
      list:vi.fn(async()=>[])
    }
    const db={get:vi.fn(()=>{throw new Error('fallback local proibido')}),save:vi.fn(),db:{prepare:vi.fn()}}
    const fileService={
      documentsDir:path.join(dir,'docs'),
      registerCentralFile:vi.fn(async(source:string,document:any)=>({id:30,...document,path:'server://file/40',localPath:source,storage:'central'}))
    }
    const acquirePage=async({destination}:{destination:string})=>{fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,Buffer.from(JPEG_1PX,'base64'))}
    const scanner=new ScannerService({db,fileService,dataDir:dir,platform:'win32',acquirePage,dataAccess,moduleStorage:{state:()=>({state:'central-active'})}})
    const session=await scanner.start({mode:'grayscale'})
    const saved=await scanner.saveSigned({sessionId:session.sessionId,documentId:10,replace:false})

    expect(saved).toMatchObject({conflict:false,document:{id:30,status_assinatura:'assinado',documento_origem_id:10}})
    expect(fileService.registerCentralFile).toHaveBeenCalledWith(expect.any(String),expect.objectContaining({empresa_id:1,funcionario_id:7,status_assinatura:'assinado',documento_origem_id:10,versao:1}))
    expect(db.get).not.toHaveBeenCalled()
  })
})
