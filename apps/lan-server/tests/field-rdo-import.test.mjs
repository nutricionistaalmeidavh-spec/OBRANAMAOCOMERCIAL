import assert from 'node:assert/strict'
import path from 'node:path'
import { createHash } from 'node:crypto'
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
 return {date:'2026-11-15',fingerprint,report:{date:'2026-11-15',note:'Instaladas prumadas',sessions:[{service:'AF/AQ',floor:4,result:'completed'}],events:[],materialsReviewed:true,materials:[{id:'item-1',descricao:'Tubo PVC 25 mm',unidade:'m',quantidade:quantity}]}}
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

test('evidências fotográficas ficam vinculadas ao RDO operacional e não dependem do R2 para leitura',()=>{
 const f=fixture()
 try{
  const bytes=Buffer.from([0xff,0xd8,0xff,0xe0,0x00,0x10,0x4a,0x46,0x49,0x46])
  const sha256=createHash('sha256').update(bytes).digest('hex')
  const input=report()
  input.report.photos=[{id:'11111111-1111-4111-8111-111111111111',contentType:'image/jpeg',sha256,uploadedAt:'2026-11-15T15:00:00Z',data:bytes.toString('base64')}]
  const first=f.importer.apply({scope:scope(f),report:input})
  const db=f.repository.connection()
  const row=db.prepare('SELECT photo_id,mime_type,sha256,bytes FROM field_rdo_evidencias WHERE rdo_id=?').get(first.localRdoId)
  assert.equal(row.photo_id,input.report.photos[0].id)
  assert.equal(row.sha256,sha256)
  assert.deepEqual(Buffer.from(row.bytes),bytes)
  const repeated=f.importer.apply({scope:scope(f),report:input})
  assert.equal(repeated.replayed,true)
  assert.equal(db.prepare('SELECT COUNT(*) n FROM field_rdo_evidencias WHERE rdo_id=?').get(first.localRdoId).n,1)
 }finally{f.repository.close()}
})

test('RDO não recebe confirmação operacional com evidência adulterada ou ausente',()=>{
 const f=fixture()
 try{
  const input=report()
  input.report.photos=[{id:'22222222-2222-4222-8222-222222222222',contentType:'image/jpeg',sha256:'0'.repeat(64),uploadedAt:'2026-11-15T15:00:00Z',data:Buffer.from([0xff,0xd8,0xff]).toString('base64')}]
  assert.throws(()=>f.importer.apply({scope:scope(f),report:input}),/hash|evidência|foto/i)
  const count=f.repository.connection().prepare('SELECT COUNT(*) n FROM field_rdo_evidencias').get().n
  assert.equal(count,0)
  const link=f.repository.connection().prepare('SELECT last_fingerprint FROM field_rdo_links WHERE remote_project_id=?').get('project-qa')
  assert.ok(!link||!link.last_fingerprint)
 }finally{f.repository.close()}
})

test('equipe por obra: identidade, horas por intervalo, isolamento e reenvio',async()=>{
 const {FieldRdoCatalog}=await import('../src/field-rdo-catalog.mjs')
 const f=fixture()
 try{
  const another=f.repository.save('obras',{empresa_id:f.company.id,nome:'Obra B'})
  const employee=(nome,obra)=>f.repository.save('funcionarios',{empresa_id:f.company.id,obra_atual_id:obra,nome,status:'ativo'})
  const a=employee('Maria',f.work.id),b=employee('João',another.id)
  const catalog=new FieldRdoCatalog({repository:f.repository}), options=catalog.list(scope(f)).employees
  assert.equal(options.length,1);assert.equal(options[0].name,'Maria')
  const input=report(),person=options[0].id
  input.report.sessions=[{segments:[{start:'08:00',end:'10:00'}],crewEvents:[{time:'08:30',employeeIds:[person]}]}]
  const delivery={scope:scope(f),report:input}
  const receipt=f.importer.apply(delivery)
  f.importer.apply(delivery)
  const team=f.repository.connection().prepare('SELECT funcionario_id,horas FROM rdo_equipe WHERE rdo_id=?').all(receipt.localRdoId)
  assert.equal(team.length,1);assert.equal(team[0].funcionario_id,a.id);assert.equal(team[0].horas,1.5)
  input.fingerprint='other';input.report.sessions[0].crewEvents[0].employeeIds=[catalog.crew(f.company.id,another.id)[0].id]
  assert.throws(()=>f.importer.apply(delivery),/equipe ativa/)
  assert.equal(balance(f),28)
 }finally{f.repository.close()}
})
