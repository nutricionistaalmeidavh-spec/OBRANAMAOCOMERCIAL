import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { LanRepository } from '../src/repository.mjs'
import { FieldRdoImport } from '../src/field-rdo-import.mjs'

const dir=path.resolve(import.meta.dirname,'../migrations')
function fixture(){
 const repository=new LanRepository({filename:':memory:'})
 repository.applyMigrations(dir)
 const company=repository.save('empresas',{razao_social:'Empresa QA'})
 const work=repository.save('obras',{empresa_id:company.id,nome:'Residencial A'})
 repository.save('movimentacoes_estoque',{obra_id:work.id,frente_id:null,tipo:'entrada',descricao:'Tubo PVC 25 mm',unidade:'m',quantidade:40,data:'2026-11-15',request_id:'recebimento-original'})
 return {repository,company,work,importer:new FieldRdoImport({repository})}
}
function report(quantity=12,fingerprint='fingerprint-1'){
 return {date:'2026-11-15',fingerprint,report:{date:'2026-11-15',note:'Instaladas prumadas',sessions:[{service:'AF/AQ',floor:4,result:'completed'}],events:[],materialsReviewed:true,materials:[{id:'item-1',descricao:'Tubo PVC 25 mm',unidade:'m',quantidade}]}}
}
const scope=f=>({companyId:f.company.id,workId:f.work.id,remoteProjectId:'project-qa'})
function balance(f){return Number(f.repository.connection().prepare("SELECT SUM(CASE WHEN tipo='saida' THEN -quantidade ELSE quantidade END) AS balance FROM movimentacoes_estoque WHERE obra_id=?").get(f.work.id).balance)}

test('PWA importa RDO canônico, debita estoque e confirma recebimento apenas depois',()=>{
 const f=fixture()
 try{
  const once=f.importer.apply({scope:scope(f),report:report()})
  assert.equal(once.replayed,false)
  assert.equal(balance(f),28)
  assert.equal(f.repository.get('rdos',once.localRdoId).data,'2026-11-15')
  const twice=f.importer.apply({scope:scope(f),report:report()})
  assert.equal(twice.replayed,true)
  assert.equal(twice.localRdoId,once.localRdoId)
  assert.equal(balance(f),28)
 }finally{f.repository.close()}
})

test('alterar o RDO no PWA corrige consumo sem criar um segundo RDO',()=>{
 const f=fixture()
 try{
  const first=f.importer.apply({scope:scope(f),report:report()})
  const second=f.importer.apply({scope:scope(f),report:report(10,'fingerprint-2')})
  assert.equal(second.localRdoId,first.localRdoId)
  assert.equal(balance(f),30)
  assert.equal(f.repository.connection().prepare('SELECT COUNT(*) AS total FROM rdos WHERE obra_id=?').get(f.work.id).total,1)
 }finally{f.repository.close()}
})

test('RDO manual pré-existente não é sobrescrito pela importação mobile',()=>{
 const f=fixture()
 try{
  f.repository.save('rdos',{obra_id:f.work.id,data:'2026-11-15',atividades:'Serviço lançado manualmente',status:'rascunho'})
  assert.throws(()=>f.importer.apply({scope:scope(f),report:report()}),/já existe RDO manual/i)
  assert.equal(balance(f),40)
 }finally{f.repository.close()}
})

test('edições Desktop posteriores geram conflito, sem duplicar débito de estoque',()=>{
 const f=fixture()
 try{
  const first=f.importer.apply({scope:scope(f),report:report()})
  f.repository.save('rdos',{id:first.localRdoId,observacoes:'Alteração realizada no Desktop'})
  assert.throws(()=>f.importer.apply({scope:scope(f),report:report(10,'fingerprint-2')}),/alterado no Desktop/)
  assert.equal(balance(f),28)
 }finally{f.repository.close()}
})
