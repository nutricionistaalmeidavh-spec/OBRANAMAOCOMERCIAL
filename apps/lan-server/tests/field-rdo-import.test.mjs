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
  assert.throws(()=>f.importer.apply({scope:scope(f),report:report()}),/RDO digitado no escritório/)
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
  assert.throws(()=>f.importer.apply(delivery),/equipe desta obra/)
  assert.equal(balance(f),28)
 }finally{f.repository.close()}
})

test('RDO de ontem mantém as horas de quem saiu da obra ou foi desligado depois do apontamento',async()=>{
 const {FieldRdoCatalog}=await import('../src/field-rdo-catalog.mjs')
 const f=fixture()
 try{
  const other=f.repository.save('obras',{empresa_id:f.company.id,nome:'Obra B'})
  const maria=f.repository.save('funcionarios',{empresa_id:f.company.id,obra_atual_id:f.work.id,nome:'Maria',status:'ativo'})
  const person=new FieldRdoCatalog({repository:f.repository}).list(scope(f)).employees[0].id
  // After the phone recorded the day, Maria was moved to another work and deactivated.
  f.repository.save('funcionarios',{id:maria.id,obra_atual_id:other.id,status:'inativo'})
  const input=report()
  input.report.sessions=[{service:'afaq',floor:0,result:'completed',segments:[{start:'07:00',end:'11:00'}],crewEvents:[{time:'07:00',employeeIds:[person]}]}]
  const receipt=f.importer.apply({scope:scope(f),report:input})
  const team=f.repository.connection().prepare('SELECT funcionario_id,horas FROM rdo_equipe WHERE rdo_id=?').all(receipt.localRdoId)
  assert.deepEqual(team.map(row=>[row.funcionario_id,row.horas]),[[maria.id,4]])
  // The canonical RDO text is readable, not transport keys.
  const rdo=f.repository.get('rdos',receipt.localRdoId)
  assert.match(rdo.atividades,/AF\/AQ · Térreo · concluído/)
  assert.doesNotMatch(rdo.atividades,/afaq|completed/)
 }finally{f.repository.close()}
})

test('apontamento em etapa canônica grava o nome da etapa no RDO',()=>{
 const f=fixture()
 try{
  const front=f.repository.save('frentes_obra',{obra_id:f.work.id,nome:'Hidráulica'})
  const stage=f.repository.save('etapas_obra',{obra_id:f.work.id,frente_id:front.id,nome:'Prumadas de água fria'})
  const input=report()
  input.report.sessions=[{service:'etapa:'+stage.id,floor:2,result:'in_progress'}]
  const receipt=f.importer.apply({scope:scope(f),report:input})
  assert.match(f.repository.get('rdos',receipt.localRdoId).atividades,/Prumadas de água fria · 2º pavimento · continua em execução/)
 }finally{f.repository.close()}
})

test('saldo insuficiente não bloqueia o diário: equipe e texto entram e o consumo aguarda o escritório',()=>{
 const f=fixture()
 try{
  const first=f.importer.apply({scope:scope(f),report:report(55)})
  assert.match(first.materialPending,/Saldo insuficiente para Tubo PVC 25 mm/)
  assert.equal(balance(f),40)
  assert.equal(f.repository.get('rdos',first.localRdoId).atividades.length>0,true)
  const pending=f.importer.materials.list(first.localRdoId).pending
  assert.equal(pending.items[0].quantidade,55)
  // Replay keeps reporting the pending consumption without creating anything.
  assert.match(f.importer.apply({scope:scope(f),report:report(55)}).materialPending,/Saldo insuficiente/)
  assert.throws(()=>f.importer.materials.save({rdoId:first.localRdoId,applyPending:true}),/Saldo insuficiente/)
  f.repository.save('movimentacoes_estoque',{obra_id:f.work.id,frente_id:null,tipo:'entrada',descricao:'Tubo PVC 25 mm',unidade:'m',quantidade:20,data:'2026-11-16',request_id:'reposicao'})
  const applied=f.importer.materials.save({rdoId:first.localRdoId,applyPending:true})
  assert.equal(applied.pending,null)
  assert.equal(balance(f),5)
  // The phone may still revise the same diary afterwards.
  const revised=f.importer.apply({scope:scope(f),report:report(50,'fingerprint-2')})
  assert.equal(revised.materialPending,null)
  assert.equal(balance(f),10)
 }finally{f.repository.close()}
})

test('diário do celular junta-se ao RDO digitado no escritório sem perder texto nem materiais',()=>{
 const f=fixture()
 try{
  const manual=f.repository.save('rdos',{obra_id:f.work.id,data:'2026-11-15',status:'rascunho',atividades:'Concretagem da laje',observacoes:'Chuva à tarde'})
  f.importer.materials.save({rdoId:manual.id,requestId:'manual-1',expectedRevision:0,items:[{id:'manual-line',descricao:'Tubo PVC 25 mm',unidade:'m',quantidade:5}]})
  assert.equal(balance(f),35)
  assert.throws(()=>f.importer.apply({scope:scope(f),report:report(12)}),error=>error.code==='MANUAL_RDO_EXISTS'&&/RDO digitado no escritório em 15\/11\/2026/.test(error.message))
  const linked=f.importer.linkManual({scope:scope(f),date:'2026-11-15'})
  assert.equal(linked.rdoId,manual.id)
  assert.throws(()=>f.importer.linkManual({scope:scope(f),date:'2026-11-15'}),/já está ligado/)
  const imported=f.importer.apply({scope:scope(f),report:report(12)})
  assert.equal(imported.localRdoId,manual.id)
  const rdo=f.repository.get('rdos',manual.id)
  assert.match(rdo.atividades,/^Concretagem da laje\n\n— Registro do celular —\n/)
  assert.match(rdo.observacoes,/^Chuva à tarde/)
  const lines=f.importer.materials.list(manual.id).items.map(row=>[row.id,row.quantidade]).sort()
  assert.deepEqual(lines,[['campo:item-1',12],['manual-line',5]])
  assert.equal(balance(f),23)
  // A revised phone diary only changes the phone lines.
  f.importer.apply({scope:scope(f),report:report(10,'fingerprint-2')})
  assert.equal(balance(f),25)
 }finally{f.repository.close()}
})
