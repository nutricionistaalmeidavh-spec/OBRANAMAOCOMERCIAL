import { createRequire } from 'node:module'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
const require=createRequire(import.meta.url)
const { DatabaseService }=require('../electron/services/database.cjs')
const { createReceivedNotesService }=require('../../../packages/domain-core/index.cjs')
const migrationsDir=resolve(import.meta.dirname,'../database/migrations')
function fixture(){
  const dataDir=mkdtempSync(join(tmpdir(),'obra-finance-integrity-'))
  const db=new DatabaseService({dataDir,migrationsDir});db.open()
  const company=db.save('empresas',{razao_social:'Construtora teste'})
  const work=db.save('obras',{empresa_id:company.id,nome:'Obra A'})
  const other=db.save('obras',{empresa_id:company.id,nome:'Obra B'})
  const supplier=db.save('fornecedores',{empresa_id:company.id,nome:'Fornecedor'})
  const stage=db.save('frentes_obra',{obra_id:work.id,nome:'Hidráulica'})
  const sub=db.save('subfrentes_obra',{obra_id:work.id,frente_id:stage.id,nome:'Prumadas'})
  const foreignStage=db.save('frentes_obra',{obra_id:other.id,nome:'Elétrica'})
  const service=createReceivedNotesService(db.db)
  return {db,company,work,other,supplier,stage,sub,foreignStage,service,account:(extras={})=>db.save('contas',{
    empresa_id:company.id,obra_id:work.id,tipo:'pagar',descricao:'Despesa importada',competencia:'2026-11',vencimento:'2026-11-19',valor_centavos:12000,status:'pendente',...extras
  }),close(){db.close();rmSync(dataDir,{recursive:true,force:true})}}
}
describe('Integridade dos custos e das notas recebidas',()=>{
  it('bloqueia etapa de outra obra, mesmo sem preencher subetapa',()=>{
    const f=fixture()
    try {
      const acc=f.account()
      expect(()=>f.db.save('contas',{id:acc.id,frente_id:f.foreignStage.id,subfrente_id:null})).toThrow(/Etapa|obra/i)
      expect(f.db.get('contas',acc.id).frente_id).toBeNull()
      expect(()=>f.account({frente_id:f.foreignStage.id})).toThrow(/Etapa|obra/i)
    }finally{f.close()}
  })
  it('não perde valor ou pagamentos ao classificar uma conta importada',()=>{
    const f=fixture()
    try {
      const acc=f.account()
      f.db.save('pagamentos_conta',{conta_id:acc.id,valor_centavos:3000,data:'2026-11-17',forma_pagamento:'PIX'})
      f.service.assignAccounts({obra_id:f.work.id,conta_ids:[acc.id],frente_id:f.stage.id,subfrente_id:f.sub.id})
      expect(f.db.get('contas',acc.id)).toMatchObject({id:acc.id,valor_centavos:12000,frente_id:f.stage.id,subfrente_id:f.sub.id})
      expect(f.db.db.prepare('SELECT SUM(valor_centavos) AS paid FROM pagamentos_conta WHERE conta_id=?').get(acc.id).paid).toBe(3000)
      expect(f.service.costsOverview({obra_id:f.work.id}).totais.custos_registrados_centavos).toBe(12000)
    }finally{f.close()}
  })
  it('não conta duas vezes uma nota vinculada à conta financeira',()=>{
    const f=fixture()
    try {
      const acc=f.account({frente_id:f.stage.id,subfrente_id:f.sub.id,fornecedor_id:f.supplier.id})
      const note=f.service.create({empresa_id:f.company.id,obra_id:f.work.id,fornecedor_id:f.supplier.id,conta_id:acc.id,numero:'NF-100',emissao:'2026-11-17',
        itens:[{descricao:'Peças',quantidade:2,unidade:'un',valor_unitario_centavos:6000,frente_id:f.stage.id,subfrente_id:f.sub.id}]})
      expect(note.valor_total_centavos).toBe(12000)
      const result=f.service.costsOverview({obra_id:f.work.id})
      expect(result.totais).toMatchObject({contas_centavos:12000,notas_centavos:12000,custos_registrados_centavos:12000})
      expect(result.conciliacoes).toHaveLength(0)
    }finally{f.close()}
  })
})
