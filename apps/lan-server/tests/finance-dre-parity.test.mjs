import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { LanRepository } from '../src/repository.mjs'
import { FinanceService } from '../src/finance-service.mjs'

const migrationsDir=path.resolve(import.meta.dirname,'../migrations')

test('DRE central separa competência de realizado e contas expõem pago_centavos',()=>{
  const repository=new LanRepository({filename:':memory:'})
  try{
    repository.applyMigrations(migrationsDir)
    const company=repository.save('empresas',{razao_social:'Empresa DRE Central'})
    const category=repository.save('categorias_financeiras',{nome:'Equipe DRE Central',natureza:'despesa',grupo_dre:'pessoal',ativa:1})
    const account=repository.save('contas',{tipo:'pagar',empresa_id:company.id,categoria_id:category.id,descricao:'Folha outubro',competencia:'2026-10',vencimento:'2026-10-15',valor_centavos:100000,status:'pendente'})
    const finance=new FinanceService({repository})
    finance.accountPayment(account.id,{valor_centavos:40000,data:'2026-10-10',forma_pagamento:'PIX'},'qa-dre-partial')
    const [row]=finance.dre({competencia:'2026-10',empresa_id:company.id})
    assert.equal(row.valor,100000)
    assert.equal(row.valor_realizado,40000)
    assert.equal(repository.list('contas',{empresa_id:company.id})[0].pago_centavos,40000)
  }finally{repository.close()}
})
