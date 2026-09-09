import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { afterEach, describe, expect, it, vi } from 'vitest'

const require=createRequire(import.meta.url)
const {PDFDocument}=require('pdf-lib')
const {DatabaseService}=require('./database.cjs')
const {FileService}=require('./file-service.cjs')
const {ScannerService,signedDestinationFor,signedArchivePath}=require('./scanner-service.cjs')

const JPEG_1PX='/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAACAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD9U6KKKAP/2Q=='
const created:Array<{dir:string,db:any}>=[]

function setup(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fluxo-scanner-'))
  const docs=path.join(dir,'docs')
  const db=new DatabaseService({dataDir:dir,migrationsDir:path.resolve(import.meta.dirname,'../../database/migrations')})
  db.open();created.push({dir,db})
  const company=db.save('empresas',{razao_social:'Empresa Scanner LTDA',cnpj:'50.733.669/0001-60',status:'ativa'})
  const employee=db.save('funcionarios',{empresa_id:company.id,nome:'Pessoa Scanner',cpf:'123.456.789-01',status:'ativo'})
  const fileService=new FileService({documentsDir:docs,db})
  const unsigned=path.join(docs,'Empresa Scanner LTDA','Funcionários','Pessoa Scanner - 123.456.789-01','Recibos','2026','09 - setembro','Não assinados')
  fs.mkdirSync(unsigned,{recursive:true})
  const originalPath=path.join(unsigned,'Ficha de ponto - 2026-09.pdf')
  fs.writeFileSync(originalPath,'original preservado','utf8')
  const originalFile=db.save('arquivos',{nome_original:path.basename(originalPath),nome_armazenado:path.basename(originalPath),caminho:originalPath,tamanho:fs.statSync(originalPath).size,extensao:'.pdf',mime_type:'application/pdf',hash:'original',origem:'gerado_mensal'})
  const originalDoc=db.save('documentos',{arquivo_id:originalFile.id,empresa_id:company.id,funcionario_id:employee.id,categoria:'folha_ponto',titulo:'Ficha de ponto - 2026-09',status_assinatura:'nao_assinado',versao:1})
  let acquisitions=0
  const acquirePage=async({destination}:{destination:string})=>{acquisitions+=1;fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,Buffer.from(JPEG_1PX,'base64'))}
  const scanner=new ScannerService({db,fileService,dataDir:dir,platform:'win32',acquirePage})
  return {dir,docs,db,fileService,scanner,originalDoc,originalPath,getAcquisitions:()=>acquisitions}
}

async function assertReadablePdf(filePath:string){const pdf=await PDFDocument.load(fs.readFileSync(filePath));expect(pdf.getPageCount()).toBeGreaterThan(0)}
afterEach(()=>{vi.restoreAllMocks();for(const item of created.splice(0)){item.db.close();fs.rmSync(item.dir,{recursive:true,force:true})}})

describe('scanner de documentos assinados',()=>{
  it('calcula a pasta Assinados como irmã de Não assinados',()=>{const original=path.win32.join('C:\\docs','09 - setembro','Não assinados','Ficha.pdf');expect(signedDestinationFor(original,path.win32)).toBe(path.win32.join('C:\\docs','09 - setembro','Assinados','Ficha_ASSINADO.pdf'))})
  it('mantém compatibilidade com documento mensal legado diretamente na pasta da competência',()=>{const original=path.win32.join('C:\\docs','09 - setembro','Ficha.pdf');expect(signedDestinationFor(original,path.win32)).toBe(path.win32.join('C:\\docs','09 - setembro','Assinados','Ficha_ASSINADO.pdf'))})
  it('gera nome de arquivo histórico sem destruir a versão assinada anterior',()=>{const canonical=path.win32.join('C:\\docs','Assinados','Ficha_ASSINADO.pdf');expect(signedArchivePath(canonical,1,path.win32)).toBe(path.win32.join('C:\\docs','Assinados','Ficha_ASSINADO_v1.pdf'));expect(signedArchivePath(canonical,3,path.win32)).toBe(path.win32.join('C:\\docs','Assinados','Ficha_ASSINADO_v3.pdf'))})
  it('informa indisponibilidade fora do Windows',async()=>{const {db,fileService,dir}=setup();const scanner=new ScannerService({db,fileService,dataDir:dir,platform:'linux',acquirePage:async()=>{}});expect(await scanner.capabilities()).toEqual(expect.objectContaining({supported:false,available:false,platform:'linux'}))})
  it('não anuncia disponibilidade sem PowerShell',async()=>{const {db,fileService,dir}=setup();const scanner=new ScannerService({db,fileService,dataDir:dir,platform:'win32'});scanner.powershellPath=path.join(dir,'powershell-ausente.exe');expect(await scanner.capabilities()).toMatchObject({supported:true,available:false})})
  it('não anuncia disponibilidade quando WIA não encontra um scanner',async()=>{const {db,fileService,dir}=setup();const scanner=new ScannerService({db,fileService,dataDir:dir,platform:'win32'});scanner.powershellPath=process.execPath;scanner.probeWia=async()=>false;expect(await scanner.capabilities()).toMatchObject({supported:true,available:false});scanner.probeWia=async()=>true;expect(await scanner.capabilities()).toMatchObject({available:true})})

  it.each([false,true])('reverte arquivos e registros quando o banco falha (substituição=%s)',async(replace)=>{
    const {db,scanner,originalDoc}=setup();let previous:any
    if(replace){const session=await scanner.start({mode:'grayscale'});previous=await scanner.saveSigned({sessionId:session.sessionId,documentId:originalDoc.id})}
    const filesBefore=db.list('arquivos'),docsBefore=db.list('documentos'),previousBytes=previous?fs.readFileSync(previous.path):null,session=await scanner.start({mode:'color'}),save=db.save.bind(db)
    const spy=vi.spyOn(db,'save').mockImplementation((table:any,data:any)=>{if(table==='documentos')throw new Error('Falha de banco simulada');return save(table,data)})
    await expect(scanner.saveSigned({sessionId:session.sessionId,documentId:originalDoc.id,replace})).rejects.toThrow('Falha de banco simulada');spy.mockRestore();expect(db.list('arquivos')).toEqual(filesBefore);expect(db.list('documentos')).toEqual(docsBefore);if(previous)expect(fs.readFileSync(previous.path)).toEqual(previousBytes);const destination=signedDestinationFor(db.get('arquivos',originalDoc.arquivo_id).caminho);expect(fs.readdirSync(path.dirname(destination))).toEqual(previous?[path.basename(destination)]:[]);const retry=await scanner.saveSigned({sessionId:session.sessionId,documentId:originalDoc.id,replace});expect(retry.conflict).toBe(false)
  })

  it('bloqueia duas capturas e não deixa página órfã ao cancelar uma captura em andamento',async()=>{
    const {scanner}=setup();const session=await scanner.start({mode:'grayscale'});let finish!:()=>void;let capturedSignal:AbortSignal|undefined
    scanner.acquirePage=({destination,signal}:any)=>new Promise<void>(resolve=>{capturedSignal=signal;finish=()=>{fs.writeFileSync(destination,Buffer.from(JPEG_1PX,'base64'));resolve()}})
    const pending=scanner.addPage({sessionId:session.sessionId,mode:'color'}),rejected=expect(pending).rejects.toThrow(/cancelad/i);await expect(scanner.start({mode:'grayscale'})).rejects.toThrow(/andamento|ocupado/i);const discard=scanner.discard({sessionId:session.sessionId});expect(capturedSignal?.aborted).toBe(true);finish();await rejected;await discard;expect(fs.readdirSync(scanner.cacheDir).filter((name:string)=>name.endsWith('.jpg'))).toEqual([])
  })

  it('restaura a versão anterior se a publicação física do PDF falhar',async()=>{
    const {scanner,db,originalDoc}=setup();const first=await scanner.start({mode:'grayscale'}),saved=await scanner.saveSigned({sessionId:first.sessionId,documentId:originalDoc.id}),bytes=fs.readFileSync(saved.path),filesBefore=db.list('arquivos'),second=await scanner.start({mode:'color'}),copy=fs.copyFileSync.bind(fs)
    const spy=vi.spyOn(fs,'copyFileSync').mockImplementation((source:any,target:any,flags?:number)=>{if(String(source).includes('.part-'))throw new Error('Disco indisponível');copy(source,target,flags)})
    await expect(scanner.saveSigned({sessionId:second.sessionId,documentId:originalDoc.id,replace:true})).rejects.toThrow('Disco indisponível');spy.mockRestore();expect(fs.readFileSync(saved.path)).toEqual(bytes);expect(db.list('arquivos')).toEqual(filesBefore);expect(db.list('documentos')).toHaveLength(2);expect(fs.readdirSync(path.dirname(saved.path))).toEqual([path.basename(saved.path)])
  })

  it('não substitui arquivo que surgiu durante a geração do PDF sem confirmação',async()=>{
    const {scanner,db,originalDoc}=setup();const destination=signedDestinationFor(db.get('arquivos',originalDoc.arquivo_id).caminho),makePdf=scanner.makePdf.bind(scanner);scanner.makePdf=async(...args:any[])=>{await makePdf(...args);fs.writeFileSync(destination,'arquivo criado durante a geração')};const session=await scanner.start({mode:'grayscale'});expect(await scanner.saveSigned({sessionId:session.sessionId,documentId:originalDoc.id})).toMatchObject({conflict:true});expect(fs.readFileSync(destination,'utf8')).toBe('arquivo criado durante a geração');expect(db.list('documentos')).toHaveLength(1)
  })

  it('aguarda a captura terminar ao encerrar e remove os temporários',async()=>{
    const {scanner}=setup();const session=await scanner.start({mode:'grayscale'});let finish!:()=>void;scanner.acquirePage=({destination}:any)=>new Promise<void>(resolve=>{finish=()=>{fs.writeFileSync(destination,Buffer.from(JPEG_1PX,'base64'));resolve()}});const pending=scanner.addPage({sessionId:session.sessionId,mode:'color'}),rejected=expect(pending).rejects.toThrow(/cancelad/i),dispose=scanner.dispose();finish();await rejected;await dispose;expect(fs.existsSync(scanner.cacheDir)).toBe(false);expect(await scanner.capabilities()).toMatchObject({available:false});await expect(scanner.start()).rejects.toThrow(/encerrado/i)
  })

  it('bloqueia salvamentos simultâneos e permite cancelar antes de publicar o PDF',async()=>{
    const {scanner,db,originalDoc}=setup();const session=await scanner.start({mode:'grayscale'});let finish!:()=>void;const makePdf=scanner.makePdf.bind(scanner);scanner.makePdf=async(...args:any[])=>{await new Promise<void>(resolve=>{finish=resolve});await makePdf(...args)};const payload={sessionId:session.sessionId,documentId:originalDoc.id},pending=scanner.saveSigned(payload),rejected=expect(pending).rejects.toThrow(/cancelad/i);await expect(scanner.saveSigned(payload)).rejects.toThrow(/andamento|ocupado/i);const discard=scanner.discard({sessionId:session.sessionId});finish();await rejected;await discard;expect(db.list('documentos')).toHaveLength(1);const destination=signedDestinationFor(db.get('arquivos',originalDoc.arquivo_id).caminho);expect(fs.readdirSync(path.dirname(destination))).toEqual([])
  })

  it('mantém páginas somente no processo principal e permite adicionar, refazer e descartar',async()=>{
    const {scanner,getAcquisitions}=setup();const first=await scanner.start({mode:'grayscale'});expect(first.sessionId).toBeTruthy();expect(first.pages).toHaveLength(1);expect(first.pages[0].preview).toMatch(/^data:image\/jpeg;base64,/);expect(first.pages[0].mode).toBe('grayscale');const second=await scanner.addPage({sessionId:first.sessionId,mode:'color'});expect(second.pages).toHaveLength(2);expect(second.pages[1].mode).toBe('color');const redone=await scanner.redoPage({sessionId:first.sessionId,pageIndex:0,mode:'color'});expect(redone.pages).toHaveLength(2);expect(redone.pages[0].mode).toBe('color');expect(getAcquisitions()).toBe(3);expect(await scanner.discard({sessionId:first.sessionId})).toBe(true);await expect(scanner.addPage({sessionId:first.sessionId,mode:'grayscale'})).rejects.toThrow('Sessão de digitalização')
  })

  it('salva PDF assinado vinculado ao documento original sem apagar o original',async()=>{
    const {db,scanner,originalDoc,originalPath}=setup();const session=await scanner.start({mode:'grayscale'});await scanner.addPage({sessionId:session.sessionId,mode:'color'});const saved=await scanner.saveSigned({sessionId:session.sessionId,documentId:originalDoc.id,replace:false});expect(saved.conflict).toBe(false);expect(saved.path).toContain(path.join('09 - setembro','Assinados'));expect(path.basename(saved.path)).toBe('Ficha de ponto - 2026-09_ASSINADO.pdf');expect(fs.existsSync(originalPath)).toBe(true);expect(fs.readFileSync(originalPath,'utf8')).toBe('original preservado');expect(fs.existsSync(saved.path)).toBe(true);await assertReadablePdf(saved.path);const signed=db.get('documentos',saved.document.id);expect(signed.status_assinatura).toBe('assinado');expect(signed.documento_origem_id).toBe(originalDoc.id);expect(signed.versao).toBe(1);const signedFile=db.get('arquivos',signed.arquivo_id);expect(signedFile.caminho).toBe(saved.path)
  })

  it('detecta conflito e só substitui após confirmação, arquivando a versão anterior',async()=>{
    const {db,scanner,originalDoc}=setup();const firstSession=await scanner.start({mode:'grayscale'}),first=await scanner.saveSigned({sessionId:firstSession.sessionId,documentId:originalDoc.id,replace:false}),firstDocId=first.document.id,firstCanonical=first.path,secondSession=await scanner.start({mode:'color'}),conflict=await scanner.saveSigned({sessionId:secondSession.sessionId,documentId:originalDoc.id,replace:false});expect(conflict).toEqual(expect.objectContaining({conflict:true,path:firstCanonical}));expect(fs.existsSync(firstCanonical)).toBe(true);const replaced=await scanner.saveSigned({sessionId:secondSession.sessionId,documentId:originalDoc.id,replace:true});expect(replaced.conflict).toBe(false);expect(replaced.path).toBe(firstCanonical);const previous=db.get('documentos',firstDocId),previousFile=db.get('arquivos',previous.arquivo_id);expect(previousFile.caminho).toMatch(/_ASSINADO_v1\.pdf$/);expect(fs.existsSync(previousFile.caminho)).toBe(true);expect(replaced.document.versao).toBe(2);expect(replaced.document.documento_origem_id).toBe(originalDoc.id);await assertReadablePdf(replaced.path)
  })
})
