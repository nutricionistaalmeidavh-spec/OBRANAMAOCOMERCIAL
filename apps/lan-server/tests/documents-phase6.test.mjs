import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import { createLanServer } from '../src/server.mjs'
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

test('rotas de pendência e recuperação exigem autenticação e permissão documental',async()=>{
  const f=fixture()
  const token='docs-test-token'
  let modules=['documents']
  let permissions={core:[],operation:[],planning:[],finance:[],rh:[]}
  const security={serverState:()=>({claimed:true,companyId:'company'}),deviceByTokenHash:hash=>hash===createHash('sha256').update(token).digest('hex')?{id:'device',memberId:'member',status:'active'}:null,member:()=>({memberId:'member',role:'user',modules,permissions,permissionsRevision:'perm-v1-legacy',channels:['desktop'],status:'active'}),touchDevice(){}}
  const server=createLanServer({security,documentStorageService:f.service})
  server.listen(0,'127.0.0.1');await once(server,'listening')
  const url=`http://127.0.0.1:${server.address().port}`
  try{
    const bytes=Buffer.from('historico')
    const file=f.service.storeMissingFileRecord({nome_original:'recibo.pdf',hash:createHash('sha256').update(bytes).digest('hex')})
    assert.equal((await fetch(url+'/api/v1/documents/pending-files')).status,401)
    const headers={authorization:`Bearer ${token}`,'content-type':'application/json'}
    assert.equal((await (await fetch(url+'/api/v1/documents/pending-files',{headers})).json()).length,1)
    modules=['finance']
    assert.equal((await fetch(url+`/api/v1/files/${file.id}/recover`,{method:'POST',headers,body:JSON.stringify({contentBase64:bytes.toString('base64')})})).status,403)
    assert.equal(f.service.pendingFiles().length,1)
    modules=['documents']
    assert.equal((await fetch(url+`/api/v1/files/${file.id}/recover`,{method:'POST',headers,body:JSON.stringify({contentBase64:bytes.toString('base64')})})).status,200)
    const response=await fetch(url+`/api/v1/files/${file.id}/content`,{headers})
    assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes)
  }finally{server.close();await once(server,'close');f.repository.close();fs.rmSync(f.root,{recursive:true,force:true})}
})

test('documentos ausentes preservam vínculos, permitem novos arquivos e recuperação exata sem sobrescrever',()=>{
  const f=fixture()
  try{
    const bytes=Buffer.from('%PDF-recibo-historico')
    const hash=createHash('sha256').update(bytes).digest('hex')
    const file=f.service.storeMissingFileRecord({nome_original:'recibo.pdf',hash,tamanho:bytes.length})
    const document=f.repository.save('documentos',{empresa_id:f.company.id,arquivo_id:file.id,categoria:'recibo',titulo:'Histórico',versao:3})
    assert.equal(f.service.pendingFiles().length,1)
    assert.throws(()=>f.service.read(file.id),/histórico pendente/)
    assert.throws(()=>f.service.recoverFile(file.id,Buffer.from('outro').toString('base64')),/não corresponde/)
    assert.equal(f.service.pendingFiles().length,1)
    const fresh=f.service.store({file:{name:'novo.pdf',contentBase64:Buffer.from('novo').toString('base64')},document:{empresa_id:f.company.id,categoria:'recibo',titulo:'Novo'}})
    assert.equal(f.service.read(fresh.file.id).bytes.toString(),'novo')
    f.service.recoverFile(file.id,bytes.toString('base64'))
    assert.equal(f.service.pendingFiles().length,0)
    assert.deepEqual(f.service.read(file.id).bytes,bytes)
    assert.equal(f.repository.get('documentos',document.id).arquivo_id,file.id)
    assert.equal(f.repository.get('documentos',document.id).versao,3)
    assert.throws(()=>f.service.recoverFile(file.id,bytes.toString('base64')),/Somente arquivos/)
  }finally{f.repository.close();fs.rmSync(f.root,{recursive:true,force:true})}
})

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
