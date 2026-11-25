import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { LanRepository } from '../src/repository.mjs'
import { RdoMaterialConsumption } from '../src/rdo-material-consumption.mjs'
import { FieldRdoCatalog } from '../src/field-rdo-catalog.mjs'

const migrationsDir = path.resolve(import.meta.dirname, '../migrations')
function fixture() {
  const repository = new LanRepository({ filename: ':memory:' })
  repository.applyMigrations(migrationsDir)
  const company = repository.save('empresas', { razao_social: 'Empresa Teste' })
  const work = repository.save('obras', { empresa_id: company.id, nome: 'Obra Teste' })
  const front = repository.save('frentes_obra', { obra_id: work.id, nome: 'Hidráulica' })
  const rdo = repository.save('rdos', { obra_id: work.id, frente_id: front.id, data: '2026-11-15', status: 'rascunho' })
  repository.save('movimentacoes_estoque', { obra_id: work.id, frente_id: null, tipo: 'entrada', descricao: 'Tubo PVC 25 mm', unidade: 'm', quantidade: 40, data: '2026-11-15', request_id: 'entrada-1' })
  return { repository, company, work, front, rdo, service: new RdoMaterialConsumption({ repository }) }
}
const item = (front, quantity) => ({ id: 'tubo-25', descricao: 'Tubo PVC 25 mm', unidade: 'm', frente_id: front.id, quantidade: quantity })
const payload = (f, quantity, requestId, expectedRevision) => ({ rdoId: f.rdo.id, requestId, expectedRevision, items: [item(f.front, quantity)] })
const balance = f => f.repository.connection().prepare("SELECT COALESCE(SUM(CASE WHEN tipo='saida' THEN -quantidade ELSE quantidade END),0) saldo FROM movimentacoes_estoque WHERE obra_id=?").get(f.work.id).saldo

test('RDO baixa estoque somente uma vez em chamadas repetidas com a mesma chave', () => {
  const f = fixture()
  try {
    const first = f.service.save(payload(f, 12, 'rdo-material-1', 0))
    const again = f.service.save(payload(f, 12, 'rdo-material-1', 0))
    assert.equal(first.revision, 1)
    assert.equal(again.replayed, true)
    assert.equal(balance(f), 28)
    assert.equal(f.repository.connection().prepare("SELECT COUNT(*) n FROM movimentacoes_estoque WHERE tipo='saida'").get().n, 1)
  } finally { f.repository.close() }
})

test('correção de 12 para 10 repõe 2 sem outra saída de 10', () => {
  const f = fixture()
  try {
    f.service.save(payload(f, 12, 'rdo-material-1', 0))
    const corrected = f.service.save(payload(f, 10, 'rdo-material-2', 1))
    assert.equal(corrected.revision, 2)
    assert.equal(balance(f), 30)
    assert.equal(f.repository.connection().prepare("SELECT COUNT(*) n FROM movimentacoes_estoque WHERE tipo='saida'").get().n, 1)
    assert.equal(f.repository.connection().prepare("SELECT COUNT(*) n FROM movimentacoes_estoque WHERE tipo='entrada'").get().n, 2)
  } finally { f.repository.close() }
})

test('falha por saldo insuficiente não deixa consumos parciais', () => {
  const f = fixture()
  try {
    assert.throws(() => f.service.save(payload(f, 45, 'rdo-material-1', 0)), /insuficiente|negativo/i)
    assert.equal(balance(f), 40)
    assert.equal(f.repository.connection().prepare('SELECT COUNT(*) n FROM rdo_material_linhas').get().n, 0)
  } finally { f.repository.close() }
})

test('revisão desatualizada ou repetição alterada são rejeitadas', () => {
  const f = fixture()
  try {
    f.service.save(payload(f, 12, 'rdo-material-1', 0))
    assert.throws(() => f.service.save(payload(f, 13, 'rdo-material-1', 0)), /idempotente|reutilizad/i)
    assert.throws(() => f.service.save(payload(f, 13, 'rdo-material-2', 0)), /revisão|revisao|conflito/i)
    assert.equal(balance(f), 28)
  } finally { f.repository.close() }
})

test('consumo precisa pertencer à mesma obra do RDO', () => {
  const f = fixture()
  try {
    const otherWork = f.repository.save('obras', { empresa_id: f.company.id, nome: 'Outra Obra' })
    const otherFront = f.repository.save('frentes_obra', { obra_id: otherWork.id, nome: 'Frente Externa' })
    assert.throws(() => f.service.save({ ...payload(f, 2, 'rdo-material-2', 0), items: [item(otherFront, 2)] }), /frente|obra/i)
    assert.equal(balance(f), 40)
  } finally { f.repository.close() }
})

test('catálogo vem do estoque canônico e usa ID determinístico por obra/material/unidade',()=>{
 const f=fixture()
 try{
  const catalog=new FieldRdoCatalog({repository:f.repository}).list({companyId:f.company.id,workId:f.work.id})
  assert.equal(catalog.materials.length,1)
  assert.equal(catalog.materials[0].saldo,40)
  assert.ok(catalog.materials[0].id.startsWith('mat_'))
  assert.deepEqual(new FieldRdoCatalog({repository:f.repository}).list({companyId:f.company.id,workId:f.work.id}).materials,catalog.materials)
 }finally{f.repository.close()}
})

test('rejeita material_id forjado e preserva saldo',()=>{
 const f=fixture()
 try{
  const values=payload(f,12,'catalog-forged',0)
  values.items[0].material_id='mat_fake'
  assert.throws(()=>f.service.save(values),/identificador.*material|catálogo/i)
  assert.equal(balance(f),40)
 }finally{f.repository.close()}
})

test('trocar consumo de frente não cria consumo líquido duplicado',()=>{
 const f=fixture()
 try{
  const front2=f.repository.save('frentes_obra',{obra_id:f.work.id,nome:'Esgoto'})
  f.service.save(payload(f,12,'front-1',0))
  const moved=payload(f,12,'front-2',1)
  moved.items[0].frente_id=front2.id
  moved.items[0].servico='esgoto'
  f.service.save(moved)
  assert.equal(balance(f),28)
  assert.equal(f.repository.connection().prepare("SELECT COALESCE(SUM(CASE WHEN tipo='saida' THEN -quantidade ELSE quantidade END),0) n FROM movimentacoes_estoque WHERE frente_id=?").get(f.front.id).n,0)
  assert.equal(f.repository.connection().prepare("SELECT COALESCE(SUM(CASE WHEN tipo='saida' THEN -quantidade ELSE quantidade END),0) n FROM movimentacoes_estoque WHERE frente_id=?").get(front2.id).n,-12)
  assert.equal(f.service.list(f.rdo.id).items[0].servico,'esgoto')
 }finally{f.repository.close()}
})


test('catálogo mantém todos os 1.501 materiais, sem prefixo truncado',()=>{
 const f=fixture()
 try{
  const db=f.repository.connection()
  db.exec('BEGIN IMMEDIATE')
  const insert=db.prepare("INSERT INTO movimentacoes_estoque(obra_id,descricao,unidade,tipo,quantidade,data) VALUES(?,?,'m','entrada',1,'2026-11-25')")
  for(let i=0;i<1500;i++)insert.run(f.work.id,'Material '+i)
  db.exec('COMMIT')
  const catalog=new FieldRdoCatalog({repository:f.repository}).list({companyId:f.company.id,workId:f.work.id})
  assert.equal(catalog.materials.length,1501)
  assert.equal(new Set(catalog.materials.map(m=>m.id)).size,1501)
 }finally{f.repository.close()}
})
test('RDO antigo usa identidade redirecionada sem duplicar consumo após reclassificação',()=>{
 const f=fixture()
 try{
  const db=f.repository.connection(),catalog=new FieldRdoCatalog({repository:f.repository})
  const old=catalog.list({companyId:f.company.id,workId:f.work.id}).materials[0]
  const before=payload(f,12,'old-consumption',0);before.items[0].material_id=old.id
  f.service.save(before)
  f.repository.save('movimentacoes_estoque',{obra_id:f.work.id,descricao:'Tubo canonical 25 mm',unidade:'m',tipo:'entrada',quantidade:5,data:'2026-11-25'})
  const a=db.prepare("SELECT id FROM materiais_estoque WHERE uid=?").get(old.id.slice(4)),b=db.prepare("SELECT id FROM materiais_estoque WHERE descricao='Tubo canonical 25 mm'").get()
  db.prepare("INSERT INTO material_reclassificacoes(empresa_id,origem_id,destino_id,operador,motivo,movimentacoes,pedidos) VALUES(?,?,?,'teste','Mesmo tubo',2,0)").run(f.company.id,a.id,b.id)
  const corrected=payload(f,10,'old-consumption-correction',1);corrected.items[0].material_id=old.id
  f.service.save(corrected)
  assert.equal(balance(f),35)
  assert.equal(catalog.list({companyId:f.company.id,workId:f.work.id}).materials.length,1)
  assert.equal(db.prepare('SELECT COUNT(*) n FROM movimentacoes_estoque WHERE material_id=?').get(a.id).n,0)
 }finally{f.repository.close()}
})
