import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { LanRepository } from '../src/repository.mjs'
import { ContractsService } from '../src/contracts-service.mjs'

const migrationsDir = path.resolve(import.meta.dirname, '../migrations')

function fixture(){
  const repository=new LanRepository({filename:':memory:'})
  repository.applyMigrations(migrationsDir)
  const company=repository.save('empresas',{razao_social:'Empresa Contratos'})
  const client=repository.save('clientes',{empresa_id:company.id,nome:'Cliente'})
  const work=repository.save('obras',{empresa_id:company.id,cliente_id:client.id,nome:'Obra Contratos'})
  return {repository,company,client,work,service:new ContractsService({repository})}
}

function contractPayload(f){
  return {requestId:'contract-1',edition:'empreiteira',obra_id:f.work.id,cliente_id:f.client.id,descricao:'Contrato principal',valor_centavos:100000,status:'ativo',conta:{empresa_id:f.company.id,competencia:'2026-10',vencimento:'2026-10-30'}}
}

test('contrato e conta a receber são atômicos e idempotentes',()=>{
  const f=fixture()
  try{
    const first=f.service.create(contractPayload(f))
    const replay=f.service.create(contractPayload(f))
    assert.equal(replay.id,first.id)
    assert.equal(f.repository.connection().prepare('SELECT COUNT(*) n FROM contratos_obra').get().n,1)
    assert.equal(f.repository.connection().prepare("SELECT COUNT(*) n FROM contas WHERE origem_tipo='contrato'").get().n,1)
  }finally{f.repository.close()}
})

test('aditivo contratado altera contrato e conta uma única vez',()=>{
  const f=fixture()
  try{
    const contract=f.service.create(contractPayload(f))
    const payload={requestId:'add-1',contrato_id:contract.id,descricao:'Aditivo',valor_centavos:25000,status:'contratado',expectedContractRevision:contract.revision}
    const first=f.service.addendum(payload)
    const replay=f.service.addendum(payload)
    assert.equal(replay.id,first.id)
    assert.equal(f.repository.get('contratos_obra',contract.id).valor_centavos,125000)
    const account=f.repository.connection().prepare("SELECT * FROM contas WHERE origem_tipo='contrato' AND origem_id=?").get(contract.id)
    assert.equal(account.valor_centavos,125000)
    assert.equal(f.repository.connection().prepare('SELECT COUNT(*) n FROM contrato_aditivos').get().n,1)
  }finally{f.repository.close()}
})

test('revision stale impede aplicar novo aditivo financeiro',()=>{
  const f=fixture()
  try{
    const contract=f.service.create(contractPayload(f))
    f.service.addendum({requestId:'add-a',contrato_id:contract.id,descricao:'A',valor_centavos:1000,status:'contratado',expectedContractRevision:contract.revision})
    assert.throws(()=>f.service.addendum({requestId:'add-b',contrato_id:contract.id,descricao:'B',valor_centavos:1000,status:'contratado',expectedContractRevision:contract.revision}),/revis|conflit/i)
    assert.equal(f.repository.connection().prepare('SELECT COUNT(*) n FROM contrato_aditivos').get().n,1)
  }finally{f.repository.close()}
})
