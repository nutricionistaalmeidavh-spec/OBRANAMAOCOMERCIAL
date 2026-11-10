import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DatabaseService } from './database.cjs'
import { FileService, sha256 } from './file-service.cjs'
import { DocumentRootService } from './document-root-service.cjs'

const created: Array<{ dir:string; db:any }> = []
function setup() {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fluxo-root-service-')),oldRoot=path.join(dir,'old-docs'),newRoot=path.join(dir,'new-docs');fs.mkdirSync(oldRoot,{recursive:true});fs.mkdirSync(newRoot,{recursive:true});const db=new DatabaseService({dataDir:dir,migrationsDir:path.resolve(import.meta.dirname,'../../database/migrations')});db.open();created.push({dir,db});const files=new FileService({documentsDir:oldRoot,db});return{dir,oldRoot,newRoot,db,files}
}
function registerFile(db:any,absolutePath:string){fs.mkdirSync(path.dirname(absolutePath),{recursive:true});fs.writeFileSync(absolutePath,'conteúdo registrado','utf8');return db.save('arquivos',{nome_original:'Nome recebido do cliente.pdf',nome_armazenado:path.basename(absolutePath),caminho:absolutePath,tamanho:fs.statSync(absolutePath).size,extensao:'.pdf',mime_type:'application/pdf',hash:sha256(absolutePath),origem:'importado'})}
afterEach(()=>{vi.restoreAllMocks();for(const item of created.splice(0)){item.db.close();fs.rmSync(item.dir,{recursive:true,force:true})}})

describe('DocumentRootService',()=>{
  function centralSetup() {
    const context=setup()
    const networkRoot=path.join(context.dir,'obsolete-share','DOCUMENTOS')
    context.db.db.prepare('INSERT INTO configuracoes(chave,valor) VALUES (?,?)').run('documentos_pasta_raiz',networkRoot)
    let mode='server', active=true, online=true
    context.files.storage={state:()=>({mode,baseUrl:'http://127.0.0.1:4732'})}
    context.files.moduleStorage={state:()=>({state:active?'central-active':'migration-required'})}
    context.files.lanClient={syncSourceCapabilities:async()=>{
      if(!online)throw new Error('Servidor desligado')
      return {modules:['documents']}
    },downloadFile:async()=>Buffer.from('PDF central de teste')}
    context.files.dataAccess={get:async()=>({nome_original:'teste.pdf'})}
    const originalMkdir=fs.mkdirSync
    const mkdir=vi.spyOn(fs,'mkdirSync').mockImplementation(((directory:any,options:any)=>{
      if(String(directory).startsWith(networkRoot))throw Object.assign(new Error('Share unavailable'),{code:'EACCES'})
      return originalMkdir(directory,options)
    }) as typeof fs.mkdirSync)
    const service=new DocumentRootService({db:context.db,files:context.files,defaultDir:context.oldRoot})
    return {...context,networkRoot,service,mkdir,setMode:(value:string)=>{mode=value},setActive:(value:boolean)=>{active=value},setOnline:(value:boolean)=>{online=value}}
  }

  it('checks the central source without touching the obsolete network root',async()=>{
    const {service,networkRoot,mkdir,db}=centralSetup()
    expect(await service.checkStatus()).toMatchObject({source:'server',ready:true,root:'http://127.0.0.1:4732'})
    expect(mkdir.mock.calls.some(([directory])=>String(directory).startsWith(networkRoot))).toBe(false)
    expect(service.getConfigured()).toBe(networkRoot)
    expect(db.list('arquivos')).toEqual([])
  })

  it('downloads central bytes into local cache instead of the obsolete share',async()=>{
    const {files,oldRoot,networkRoot,service}=centralSetup()
    const cached=await files.materializeCentral(7)
    expect(cached).toBe(path.join(oldRoot,'.server-cache','7-teste.pdf'))
    expect(fs.readFileSync(cached,'utf8')).toBe('PDF central de teste')
    expect(service.getConfigured()).toBe(networkRoot)
  })

  it('reports an outage and retries the server without local fallback',async()=>{
    const {service,setOnline,networkRoot,mkdir}=centralSetup()
    setOnline(false)
    expect(await service.checkStatus()).toMatchObject({source:'server',ready:false,code:'CENTRAL_UNAVAILABLE'})
    setOnline(true)
    expect(await service.retryRoot()).toMatchObject({source:'server',ready:true})
    expect(mkdir.mock.calls.some(([directory])=>String(directory).startsWith(networkRoot))).toBe(false)
  })

  it('does not report a server ready while document migration is incomplete',async()=>{
    const {service,setActive}=centralSetup()
    setActive(false)
    expect(await service.checkStatus()).toMatchObject({source:'server',ready:false,code:'CENTRAL_NOT_ACTIVE'})
  })

  it('keeps the original local root when switching back from the server',()=>{
    const {service,files,networkRoot,setMode}=centralSetup()
    setMode('local')
    expect(service.retryRoot()).toMatchObject({ready:false,root:networkRoot,code:'EACCES'})
    expect(files.documentsDir).toBe(networkRoot)
  })

  it('keeps the database and original network root when mkdir fails, then retries without migration',()=>{
    const {dir,oldRoot,db,files}=setup()
    const networkRoot=path.join(dir,'unavailable-share','DOCUMENTOS')
    db.db.prepare("INSERT INTO configuracoes(chave,valor) VALUES (?,?)").run('documentos_pasta_raiz',networkRoot)
    const originalMkdir=fs.mkdirSync
    let connected=false
    const mkdir=vi.spyOn(fs,'mkdirSync').mockImplementation(((directory:any,options:any)=>{
      if(String(directory)===networkRoot&&!connected){
        const error=Object.assign(new Error('Windows network share is not available'),{code:'UNKNOWN'})
        throw error
      }
      return originalMkdir(directory,options)
    }) as typeof fs.mkdirSync)
    const service=new DocumentRootService({db,files,defaultDir:oldRoot})
    expect(service.status()).toMatchObject({ready:false,configured:true,root:networkRoot,code:'UNKNOWN'})
    expect(files.documentsDir).toBe(networkRoot)
    expect(db.db.prepare("SELECT valor FROM configuracoes WHERE chave='documentos_pasta_raiz'").get()).toMatchObject({valor:networkRoot})
    expect(db.list('funcionarios')).toEqual([])
    connected=true
    expect(service.retryRoot()).toMatchObject({ready:true,root:networkRoot})
    expect(fs.existsSync(networkRoot)).toBe(true)
    expect(db.db.prepare("SELECT valor FROM configuracoes WHERE chave='documentos_pasta_raiz'").get()).toMatchObject({valor:networkRoot})
    mkdir.mockRestore()
  })

  it('does not silently fall back to a different root after a permission error',()=>{
    const {dir,oldRoot,db,files}=setup()
    const configuredRoot=path.join(dir,'protected-documents')
    db.db.prepare("INSERT INTO configuracoes(chave,valor) VALUES (?,?)").run('documentos_pasta_raiz',configuredRoot)
    const originalMkdir=fs.mkdirSync
    const mkdir=vi.spyOn(fs,'mkdirSync').mockImplementation(((directory:any,options:any)=>{
      if(String(directory)===configuredRoot)throw Object.assign(new Error('Access denied'),{code:'EACCES'})
      return originalMkdir(directory,options)
    }) as typeof fs.mkdirSync)
    const service=new DocumentRootService({db,files,defaultDir:oldRoot})
    expect(service.status()).toMatchObject({ready:false,root:configuredRoot,code:'EACCES'})
    expect(service.getRoot()).toBe(configuredRoot)
    mkdir.mockRestore()
  })

  it('copia documentos e remapeia caminhos registrados preservando nome_original',async()=>{
    const {oldRoot,newRoot,db,files}=setup(),oldPath=path.join(oldRoot,'Empresa','Funcionários','Pessoa','arquivo.pdf'),record=registerFile(db,oldPath),dialogApi={showOpenDialog:vi.fn(async()=>({canceled:false,filePaths:[newRoot]})),showMessageBox:vi.fn(async()=>({response:0}))},service=new DocumentRootService({db,files,defaultDir:oldRoot,dialogApi,shellApi:{openPath:vi.fn()}});const result=await service.chooseRoot(),expected=path.join(newRoot,'Empresa','Funcionários','Pessoa','arquivo.pdf');expect(result).toMatchObject({path:newRoot,previous:oldRoot,remapped:1});expect(fs.readFileSync(expected,'utf8')).toBe('conteúdo registrado');const updated=db.get('arquivos',record.id);expect(updated.caminho).toBe(expected);expect(updated.nome_original).toBe('Nome recebido do cliente.pdf');expect(files.documentsDir).toBe(newRoot)
  })
  it('permite usar sem copiar somente quando a nova raiz já contém o mesmo arquivo registrado',async()=>{
    const {oldRoot,newRoot,db,files}=setup(),oldPath=path.join(oldRoot,'Empresa','arquivo.pdf'),record=registerFile(db,oldPath),newPath=path.join(newRoot,'Empresa','arquivo.pdf');fs.mkdirSync(path.dirname(newPath),{recursive:true});fs.copyFileSync(oldPath,newPath);const dialogApi={showOpenDialog:vi.fn(async()=>({canceled:false,filePaths:[newRoot]})),showMessageBox:vi.fn(async()=>({response:1}))},service=new DocumentRootService({db,files,defaultDir:oldRoot,dialogApi,shellApi:{openPath:vi.fn()}});const result=await service.chooseRoot();expect(result).toMatchObject({path:newRoot,remapped:1});expect(db.get('arquivos',record.id).caminho).toBe(newPath);expect(files.documentsDir).toBe(newRoot)
  })
  it('cancela a troca de raiz quando faltam documentos registrados no destino',async()=>{
    const {oldRoot,newRoot,db,files}=setup(),oldPath=path.join(oldRoot,'Empresa','arquivo.pdf'),record=registerFile(db,oldPath),showMessageBox=vi.fn().mockResolvedValueOnce({response:1}).mockResolvedValueOnce({response:0}),dialogApi={showOpenDialog:vi.fn(async()=>({canceled:false,filePaths:[newRoot]})),showMessageBox},service=new DocumentRootService({db,files,defaultDir:oldRoot,dialogApi,shellApi:{openPath:vi.fn()}});const result=await service.chooseRoot();expect(result).toBeNull();expect(db.get('arquivos',record.id).caminho).toBe(oldPath);expect(files.documentsDir).toBe(oldRoot);expect(service.getConfigured()).toBeNull();expect(showMessageBox).toHaveBeenCalledTimes(2)
  })
})
