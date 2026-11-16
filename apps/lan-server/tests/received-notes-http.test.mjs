import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import path from 'node:path'
import test from 'node:test'
import { LanRepository } from '../src/repository.mjs'
import { createLanServer } from '../src/server.mjs'

const TOKEN='test-received-notes-token'
const hash=value=>createHash('sha256').update(value).digest('hex')
const migrationsDir=path.resolve(import.meta.dirname,'../migrations')

function security(modules=['finance','obra360']){
  return {
    serverState(){return {claimed:true,companyId:'tenant-test'}},
    deviceByTokenHash(value){return value===hash(TOKEN)?{id:'device-test',memberId:'member-test',status:'active'}:null},
    member(id){return id==='member-test'?{memberId:id,role:'admin',modules,channels:['desktop'],status:'active'}:null},
    touchDevice(){}
  }
}
async function fixture(modules){
  const repository=new LanRepository({filename:':memory:'})
  repository.applyMigrations(migrationsDir)
  const company=repository.save('empresas',{razao_social:'Construtora Exemplo'})
  const work=repository.save('obras',{empresa_id:company.id,nome:'Obra de homologação'})
  const supplier=repository.save('fornecedores',{empresa_id:company.id,nome:'Fornecedor Teste'})
  const stage=repository.save('frentes_obra',{obra_id:work.id,nome:'Hidráulica'})
  const substage=repository.save('subfrentes_obra',{obra_id:work.id,frente_id:stage.id,nome:'Prumadas'})
  const server=createLanServer({repository,security:security(modules),serverVersion:'test'})
  server.listen(0,'127.0.0.1')
  await once(server,'listening')
  const base='http://127.0.0.1:'+server.address().port
  return {repository,server,base,company,work,supplier,stage,substage,async close(){server.close();await once(server,'close');repository.close()}}
}
function headers(){return {'authorization':'Bearer '+TOKEN,'content-type':'application/json'}}
function input(f){
  return {empresa_id:f.company.id,obra_id:f.work.id,fornecedor_id:f.supplier.id,numero:'REC-0001',serie:'1',emissao:'2026-11-16',requestId:'http-request-001',
    itens:[{descricao:'Tubo de teste',quantidade:2,unidade:'un',valor_unitario_centavos:1500,frente_id:f.stage.id,subfrente_id:f.substage.id},
      {descricao:'Registro teste',quantidade:1,unidade:'un',valor_unitario_centavos:2500,frente_id:f.stage.id}]}
}

test('servidor próprio: nota recebida com itens, classificação, resumo, idempotência e nenhuma conta/estoque automático',async()=>{
  const f=await fixture()
  try{
    const endpoint=f.base+'/api/v1/received-notes'
    const created=await fetch(endpoint,{method:'POST',headers:headers(),body:JSON.stringify(input(f))})
    assert.equal(created.status,201,await created.clone().text())
    const note=await created.json()
    assert.equal(note.valor_total_centavos,5500)
    assert.equal(note.itens.length,2)
    const replay=await fetch(endpoint,{method:'POST',headers:headers(),body:JSON.stringify(input(f))})
    assert.equal(replay.status,201)
    assert.equal((await replay.json()).id,note.id)
    const list=await fetch(endpoint+'?obra_id='+f.work.id,{headers:headers()})
    assert.equal(list.status,200)
    assert.equal((await list.json()).length,1)
    const detail=await fetch(endpoint+'/'+note.id,{headers:headers()})
    assert.equal(detail.status,200)
    assert.equal((await detail.json()).itens.length,2)
    const summary=await fetch(endpoint+'/summary?obra_id='+f.work.id,{headers:headers()})
    assert.equal(summary.status,200)
    assert.equal((await summary.json()).etapas[0].valor_centavos,5500)
    assert.equal(f.repository.connection().prepare('SELECT COUNT(*) n FROM contas').get().n,0)
    assert.equal(f.repository.connection().prepare('SELECT COUNT(*) n FROM movimentacoes_estoque').get().n,0)
    assert.deepEqual(f.repository.connection().prepare('PRAGMA foreign_key_check').all(),[])
  }finally{await f.close()}
})
test('servidor próprio: exige autenticação e módulo financeiro autorizado',async()=>{
  const f=await fixture(['obra360'])
  try{
    const url=f.base+'/api/v1/received-notes?obra_id='+f.work.id
    const without=await fetch(url)
    assert.equal(without.status,401)
    const denied=await fetch(url,{headers:headers()})
    assert.equal(denied.status,403)
    const rejected=await fetch(f.base+'/api/v1/received-notes',{method:'POST',headers:headers(),body:JSON.stringify(input(f))})
    assert.equal(rejected.status,403)
    assert.equal(f.repository.connection().prepare('SELECT COUNT(*) n FROM notas_recebidas').get().n,0)
  }finally{await f.close()}
})
