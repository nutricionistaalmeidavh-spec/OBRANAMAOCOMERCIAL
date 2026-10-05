import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { LanRepository } from '../src/repository.mjs'
import { DocumentStorageService } from '../src/document-storage-service.mjs'

function fixture(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'obra-docs-phase6-'))
  const repository=new LanRepository({filename:path.join(root,'central.sqlite')})
  repository.applyMigrations(path.resolve(import.meta.dirname,'../migrations'))
  const service=new DocumentStorageService({repository,filesDir:path.join(root,'files')})
  const company=repository.save('empresas',{razao_social:'Empresa A',status:'ativa'})
  const work=repository.save('obras',{empresa_id:company.id,nome:'Obra A'})
  return{root,repository,service,company,work}
}

test('Fase 6 grava bytes no storage self-hosted e metadados no SQLite central',()=>{
  const f=fixture()
  try{
    const payload=Buffer.from('conteudo compartilhado da obra','utf8')
    const result=f.service.store({
      file:{name:'memorial.txt',mimeType:'text/plain',contentBase64:payload.toString('base64')},
      document:{empresa_id:f.company.id,obra_id:f.work.id,categoria:'documento_obra',titulo:'Memorial'}
    })
    assert.equal(result.document.obra_id,f.work.id)
    assert.equal(result.file.tamanho,payload.length)
    assert.match(result.file.caminho,/^server:\/\/file\//)
    assert.deepEqual(f.service.read(result.file.id).bytes,payload)
    assert.ok(fs.existsSync(path.join(f.root,'files',result.file.nome_armazenado)))
  }finally{f.repository.close();fs.rmSync(f.root,{recursive:true,force:true})}
})

test('Fase 6 cria vínculos canônicos de RDO, medição, contrato e pedido no servidor',()=>{
  const f=fixture()
  try{
    const front=f.repository.save('frentes_obra',{obra_id:f.work.id,nome:'Hidráulica'})
    const rdo=f.repository.save('rdos',{obra_id:f.work.id,frente_id:front.id,data:'2026-10-05',status:'concluido',atividades:'Teste'})
    const measurement=f.repository.save('medicoes',{obra_id:f.work.id,frente_id:front.id,numero:'M-1',competencia:'2026-10',data:'2026-10-05'})
    const order=f.repository.save('pedidos_compra',{obra_id:f.work.id,frente_id:front.id,descricao:'Tubos',valor_centavos:1000,status:'emitido'})
    const contract=f.repository.save('contratos_obra',{obra_id:f.work.id,frente_id:front.id,descricao:'Contrato',valor_centavos:5000,status:'ativo'})
    const base={empresa_id:f.company.id,obra_id:f.work.id,frente_id:front.id,categoria:'anexo',titulo:'Anexo'}
    const file={name:'anexo.pdf',mimeType:'application/pdf',contentBase64:Buffer.from('%PDF-fase6').toString('base64')}
    const a=f.service.store({file,document:{...base,rdo_id:rdo.id}})
    const b=f.service.store({file,document:{...base,medicao_id:measurement.id}})
    const c=f.service.store({file,document:{...base,contrato_id:contract.id}})
    const d=f.service.store({file,document:{...base,pedido_compra_id:order.id}})
    assert.equal(f.repository.list('rdo_anexos',{rdo_id:rdo.id}).at(-1)?.documento_id,a.document.id)
    assert.equal(f.repository.list('medicao_anexos',{medicao_id:measurement.id}).at(-1)?.documento_id,b.document.id)
    assert.equal(f.repository.list('contrato_anexos',{contrato_id:contract.id}).at(-1)?.documento_id,c.document.id)
    assert.equal(f.repository.list('pedido_compra_anexos',{pedido_compra_id:order.id}).at(-1)?.documento_id,d.document.id)
  }finally{f.repository.close();fs.rmSync(f.root,{recursive:true,force:true})}
})
