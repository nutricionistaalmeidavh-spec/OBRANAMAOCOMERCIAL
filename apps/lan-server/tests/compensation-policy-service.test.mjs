import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { LanRepository } from '../src/repository.mjs'
import { CompensationPolicyService } from '../src/compensation-policy-service.mjs'

const migrationsDir=path.resolve(import.meta.dirname,'../migrations')

function fixture(){
  const repository=new LanRepository({filename:':memory:'})
  repository.applyMigrations(migrationsDir)
  const company=repository.save('empresas',{razao_social:'Empresa Remuneração'})
  const cafe=repository.save('beneficios',{empresa_id:company.id,nome:'Café',tipo:'alimentacao',valor_padrao_centavos:0,ativo:1})
  const transporte=repository.save('beneficios',{empresa_id:company.id,nome:'Vale-transporte',tipo:'transporte',valor_padrao_centavos:0,ativo:1})
  return{repository,company,cafe,transporte,service:new CompensationPolicyService({repository})}
}

test('política de remuneração central salva cargo e vínculos em uma transação versionada',()=>{
  const f=fixture()
  try{
    const result=f.service.save({
      cargo:{empresa_id:f.company.id,nome:'Encanador',cbo:'724110',salario_base_centavos:300000},
      links:[
        {beneficio_id:f.cafe.id,valor_centavos:9000,quinzena:1,natureza:'credito',ativo:1},
        {beneficio_id:f.transporte.id,valor_centavos:25000,quinzena:1,natureza:'credito',ativo:1},
      ],
    })
    assert.equal(result.cargo.nome,'Encanador')
    assert.equal(result.cargo.revision,1)
    assert.equal(result.links.length,2)
    assert.ok(result.links.every(item=>item.revision===1))
    assert.deepEqual(f.repository.list('cargo_beneficios',{cargo_id:result.cargo.id}).map(item=>item.valor_centavos),[9000,25000])
  }finally{f.repository.close()}
})

test('falha em um benefício faz rollback integral da política central',()=>{
  const f=fixture()
  try{
    assert.throws(()=>f.service.save({
      cargo:{empresa_id:f.company.id,nome:'Cargo rollback',salario_base_centavos:200000},
      links:[
        {beneficio_id:f.cafe.id,valor_centavos:10000,ativo:1},
        {beneficio_id:999999,valor_centavos:5000,ativo:1},
      ],
    }))
    assert.equal(f.repository.list('cargos',{empresa_id:f.company.id}).filter(item=>item.nome==='Cargo rollback').length,0)
    assert.equal(f.repository.list('cargo_beneficios',{empresa_id:f.company.id}).length,0)
  }finally{f.repository.close()}
})

test('edição usa revisão do cargo e rejeita gravação obsoleta',()=>{
  const f=fixture()
  try{
    const first=f.service.save({
      cargo:{empresa_id:f.company.id,nome:'Mestre',salario_base_centavos:250000},
      links:[{beneficio_id:f.cafe.id,valor_centavos:8000,ativo:1}],
    })
    const updated=f.service.save({
      cargo:{...first.cargo,salario_base_centavos:270000},
      links:first.links.map(link=>({...link,valor_centavos:9000})),
    })
    assert.equal(updated.cargo.revision,2)
    assert.throws(()=>f.service.save({
      cargo:{...first.cargo,salario_base_centavos:280000},
      links:first.links,
    }),/alterado em outro computador|revision/i)
  }finally{f.repository.close()}
})
