import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DatabaseService } from './database.cjs'
import { ManagedDirectoryService } from './managed-directory-service.cjs'
import { DocumentExplorerContextService } from './document-explorer-context-service.cjs'

const created: Array<{dir:string;db:any}> = []
function setup() {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fluxo-doc-context-')), docsRoot=path.join(dir,'documentos'); fs.mkdirSync(docsRoot,{recursive:true})
  const db=new DatabaseService({dataDir:dir,migrationsDir:path.resolve(import.meta.dirname,'../../database/migrations')}); db.open(); created.push({dir,db})
  const company=db.save('empresas',{razao_social:'Empresa Teste LTDA',nome_fantasia:'Empresa Teste',cnpj:'50733669000160',status:'ativa'})
  const first=db.save('funcionarios',{empresa_id:company.id,nome:'Maicon da Silva',cpf:'111.222.333-44',status:'ativo'})
  const second=db.save('funcionarios',{empresa_id:company.id,nome:'Maicon Souza',cpf:'555.666.777-88',status:'ativo'})
  const explorer=new ManagedDirectoryService({roots:{documents:()=>docsRoot},shell:{openPath:async()=>''}})
  const context=new DocumentExplorerContextService({db,explorer,rootId:'documents'})
  return {dir,docsRoot,db,company,first,second,explorer,context}
}
function monthlyPath(root:string,employeeName:string,cpf:string,status:'Não assinados'|'Assinados',file:string){return path.join(root,'Empresa Teste','Funcionários',`${employeeName} - ${cpf}`,'Recibos','2026','09 - setembro',status,file)}
function register(db:any,employee:any,absolutePath:string,category='folha_ponto'){fs.mkdirSync(path.dirname(absolutePath),{recursive:true});fs.writeFileSync(absolutePath,'%PDF-1.4','utf8');const arquivo=db.save('arquivos',{nome_original:path.basename(absolutePath),nome_armazenado:path.basename(absolutePath),caminho:absolutePath,tamanho:fs.statSync(absolutePath).size,extensao:'.pdf',mime_type:'application/pdf',origem:'gerado'});const document=db.save('documentos',{arquivo_id:arquivo.id,empresa_id:employee.empresa_id,funcionario_id:employee.id,categoria:category,titulo:path.basename(absolutePath),status_assinatura:'nao_assinado',versao:1});return{arquivo,document}}
afterEach(()=>{vi.restoreAllMocks();for(const item of created.splice(0)){item.db.close();fs.rmSync(item.dir,{recursive:true,force:true})}})

describe('DocumentExplorerContextService',()=>{
  it('resolve funcionários homônimos por CPF/ID e nunca apenas pelo primeiro nome',()=>{
    const {docsRoot,first,second,context}=setup();const firstPath=monthlyPath(docsRoot,first.nome,first.cpf,'Não assinados','ficha-a.pdf'),secondPath=monthlyPath(docsRoot,second.nome,second.cpf,'Não assinados','ficha-b.pdf');fs.mkdirSync(path.dirname(firstPath),{recursive:true});fs.writeFileSync(firstPath,'a');fs.mkdirSync(path.dirname(secondPath),{recursive:true});fs.writeFileSync(secondPath,'b')
    const a=context.context({relativePath:path.relative(docsRoot,firstPath)}),b=context.context({relativePath:path.relative(docsRoot,secondPath)});expect(a.employee).toMatchObject({id:first.id,nome:first.nome,cpf:first.cpf});expect(b.employee).toMatchObject({id:second.id,nome:second.nome,cpf:second.cpf});expect(a.employee.id).not.toBe(b.employee.id);expect(a.competencia).toBe('2026-09');expect(a.status).toBe('nao_assinado')
  })
  it('prioriza vínculo exato arquivo/documento do banco e expõe IDs para o scanner',()=>{
    const {docsRoot,db,first,context}=setup();const absolute=monthlyPath(docsRoot,first.nome,first.cpf,'Não assinados','ficha.pdf'),{arquivo,document}=register(db,first,absolute);const result=context.context({relativePath:path.relative(docsRoot,absolute)});expect(result).toMatchObject({arquivoId:arquivo.id,documentId:document.id,categoria:'folha_ponto',competencia:'2026-09',status:'nao_assinado'});expect(result.employee.id).toBe(first.id)
  })
  it('move versão não assinada para Assinados, atualiza banco, preserva nome_original e versiona conflito',()=>{
    const {docsRoot,db,first,context}=setup();const source=monthlyPath(docsRoot,first.nome,first.cpf,'Não assinados','Ficha.pdf'),{arquivo,document}=register(db,first,source),signedFolder=path.dirname(monthlyPath(docsRoot,first.nome,first.cpf,'Assinados','Ficha.pdf'));fs.mkdirSync(signedFolder,{recursive:true});fs.writeFileSync(path.join(signedFolder,'Ficha.pdf'),'já existe','utf8');const moved=context.moveToSigned({relativePath:path.relative(docsRoot,source)});expect(moved.status).toBe('assinado');expect(moved.relativePath).toContain('Assinados');expect(path.basename(moved.relativePath)).toBe('Ficha (2).pdf');expect(fs.existsSync(source)).toBe(false);const arquivoAtual=db.get('arquivos',arquivo.id),documentoAtual=db.get('documentos',document.id);expect(arquivoAtual.caminho).toBe(path.join(signedFolder,'Ficha (2).pdf'));expect(arquivoAtual.nome_armazenado).toBe('Ficha (2).pdf');expect(arquivoAtual.nome_original).toBe('Ficha.pdf');expect(documentoAtual.status_assinatura).toBe('assinado')
  })
  it('gera índice organizável de forma assíncrona sem usar readdirSync',async()=>{
    const {docsRoot,db,first,second,context}=setup();register(db,first,monthlyPath(docsRoot,first.nome,first.cpf,'Não assinados','Ficha.pdf'),'folha_ponto');register(db,second,monthlyPath(docsRoot,second.nome,second.cpf,'Assinados','Recibos.pdf'),'recibos_beneficios');const syncWalk=vi.spyOn(fs,'readdirSync').mockImplementation(()=>{throw new Error('readdirSync não deve ser usado no índice')});const pending=context.index();expect(pending).toBeInstanceOf(Promise);const index=await pending;expect(syncWalk).not.toHaveBeenCalled();expect(index.items).toHaveLength(2);expect(index.items.map((item:any)=>item.employee?.id).sort()).toEqual([first.id,second.id].sort());expect(index.facets.competencias).toEqual(['2026-09']);expect(index.facets.statuses.sort()).toEqual(['assinado','nao_assinado']);expect(index.facets.categorias.sort()).toEqual(['folha_ponto','recibos_beneficios']);expect(index.facets.employees).toHaveLength(2)
  })
})
