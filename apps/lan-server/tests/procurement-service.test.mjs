import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { LanRepository } from '../src/repository.mjs'
import { ProcurementService } from '../src/procurement-service.mjs'

const migrationsDir = path.resolve(import.meta.dirname, '../migrations')

function fixture(){
  const repository=new LanRepository({filename:':memory:'})
  repository.applyMigrations(migrationsDir)
  const company=repository.save('empresas',{razao_social:'Empresa Compras'})
  const work=repository.save('obras',{empresa_id:company.id,nome:'Obra Compras'})
  const front=repository.save('frentes_obra',{obra_id:work.id,nome:'Hidráulica'})
  const supplier=repository.save('fornecedores',{empresa_id:company.id,nome:'Fornecedor'})
  const request=repository.save('solicitacoes_compra',{obra_id:work.id,frente_id:front.id,solicitante:'Victor',descricao:'Tubos',status:'solicitada'})
  const quote=repository.save('cotacoes_compra',{solicitacao_id:request.id,fornecedor_id:supplier.id,valor_centavos:10000,status:'recebida'})
  return {repository,company,work,front,supplier,request,quote,service:new ProcurementService({repository})}
}

function orderPayload(f){
  return {requestId:'order-1',obra_id:f.work.id,frente_id:f.front.id,solicitacao_id:f.request.id,cotacao_id:f.quote.id,fornecedor_id:f.supplier.id,descricao:'Tubos',valor_centavos:10000,status:'emitido',itens:[{descricao:'Tubo',unidade:'m',quantidade_pedida:10,valor_centavos:10000}],conta:{empresa_id:f.company.id,competencia:'2026-10',vencimento:'2026-10-20'}}
}

test('pedido é atômico e replay idempotente não duplica conta nem itens',()=>{
  const f=fixture()
  try{
    const first=f.service.createOrder(orderPayload(f))
    const replay=f.service.createOrder(orderPayload(f))
    assert.equal(replay.id,first.id)
    assert.equal(f.repository.connection().prepare('SELECT COUNT(*) n FROM pedidos_compra').get().n,1)
    assert.equal(f.repository.connection().prepare('SELECT COUNT(*) n FROM pedido_compra_itens').get().n,1)
    assert.equal(f.repository.connection().prepare("SELECT COUNT(*) n FROM contas WHERE origem_tipo='pedido_compra'").get().n,1)
  }finally{f.repository.close()}
})

test('recebimento idempotente gera uma única entrada e rejeita excesso',()=>{
  const f=fixture()
  try{
    const order=f.service.createOrder(orderPayload(f))
    const item=f.repository.list('pedido_compra_itens',{pedido_compra_id:order.id})[0]
    const payload={requestId:'receive-1',pedido_item_id:item.id,quantidade_recebida:4,data:'2026-10-05'}
    f.service.receiveMaterial(payload)
    f.service.receiveMaterial(payload)
    assert.equal(f.repository.connection().prepare('SELECT COUNT(*) n FROM recebimentos_materiais').get().n,1)
    assert.equal(f.repository.connection().prepare("SELECT COUNT(*) n FROM movimentacoes_estoque WHERE tipo='entrada'").get().n,1)
    assert.throws(()=>f.service.receiveMaterial({requestId:'receive-2',pedido_item_id:item.id,quantidade_recebida:7,data:'2026-10-06'}),/excede/i)
    assert.equal(f.repository.get('pedido_compra_itens',item.id).quantidade_recebida,4)
  }finally{f.repository.close()}
})

test('saída que deixaria estoque negativo é bloqueada antes da escrita',()=>{
  const f=fixture()
  try{
    assert.throws(()=>f.service.moveStock({requestId:'stock-1',obra_id:f.work.id,frente_id:f.front.id,tipo:'saida',descricao:'Tubo',unidade:'m',quantidade:1,data:'2026-10-05'}),/negativo/i)
    assert.equal(f.repository.connection().prepare('SELECT COUNT(*) n FROM movimentacoes_estoque').get().n,0)
  }finally{f.repository.close()}
})
