import { createRequire } from 'node:module'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const require=createRequire(import.meta.url)
const { DatabaseService }=require('../electron/services/database.cjs')
const { createReceivedNotesService }=require('../../../packages/domain-core/index.cjs')
const migrationPath=resolve(import.meta.dirname,'../database/migrations')

function fixture(){
  const root=mkdtempSync(join(tmpdir(),'obra-custos-integrados-'))
  const db=new DatabaseService({dataDir:root,migrationsDir:migrationPath})
  db.open()
  const empresa=db.save('empresas',{razao_social:'Construtora QA'})
  const obra=db.save('obras',{empresa_id:empresa.id,nome:'Residencial Teste'})
  const outraObra=db.save('obras',{empresa_id:empresa.id,nome:'Obra secundária'})
  const fornecedor=db.save('fornecedores',{empresa_id:empresa.id,nome:'Fornecedor de teste'})
  const etapa=db.save('frentes_obra',{obra_id:obra.id,nome:'Acabamento'})
  const sub=db.save('subfrentes_obra',{obra_id:obra.id,frente_id:etapa.id,nome:'Louças e metais'})
  const extra=db.save('frentes_obra',{obra_id:outraObra.id,nome:'Etapa externa'})
  const service=createReceivedNotesService(db.db)
  const account=(name,amount,overrides={})=>db.save('contas',{
    empresa_id:empresa.id,obra_id:obra.id,tipo:'pagar',descricao:name,
    competencia:'2026-11',vencimento:'2026-11-20',valor_centavos:amount,status:'pendente',...overrides
  })
  return {root,db,empresa,obra,outraObra,fornecedor,etapa,sub,extra,service,account,close(){db.close();rmSync(root,{recursive:true,force:true})}}
}
describe('Classificação canônica dos gastos importados',()=>{
  it('permite classificar conta existente sem alterar valor, pagamento ou identificação',()=>{
    const f=fixture()
    try {
      const acc=f.account('Importada da planilha',12500)
      const saved=f.db.save('contas',{id:acc.id,frente_id:f.etapa.id,subfrente_id:f.sub.id})
      expect(saved).toMatchObject({id:acc.id,obra_id:f.obra.id,valor_centavos:12500,frente_id:f.etapa.id,subfrente_id:f.sub.id})
      expect(f.db.db.prepare('SELECT COUNT(*) AS n FROM contas WHERE id=?').get(acc.id).n).toBe(1)
      expect(f.db.db.prepare('PRAGMA foreign_key_check').all()).toEqual([])
    }finally{f.close()}
  })
  it('impede subetapas incompatíveis ou sem obra na atualização de contas',()=>{
    const f=fixture()
    try{
      const acc=f.account('Conta existente',3000)
      expect(()=>f.db.save('contas',{id:acc.id,frente_id:f.extra.id,subfrente_id:f.sub.id})).toThrow(/Etapa|Subetapa/i)
      expect(()=>f.db.save('contas',{id:acc.id,frente_id:f.etapa.id,subfrente_id:f.sub.id,obra_id:f.outraObra.id})).toThrow(/Etapa|Subetapa/i)
      expect(f.db.get('contas',acc.id).frente_id).toBeNull()
    }finally{f.close()}
  })
  it('relatório financeiro contabiliza conta vinculada a nota uma única vez, separando documentos e pagamentos',()=>{
    const f=fixture()
    try{
      f.db.save('itens_orcamentarios',{obra_id:f.obra.id,frente_id:f.etapa.id,subfrente_id:f.sub.id,descricao:'Previsão louças',unidade:'un',quantidade:1,valor_unitario_centavos:30000,tipo:'material'})
      const account=f.account('Conta importada',12500,{frente_id:f.etapa.id,subfrente_id:f.sub.id,fornecedor_id:f.fornecedor.id})
      f.db.save('pagamentos_conta',{conta_id:account.id,valor_centavos:5000,data:'2026-11-16',forma_pagamento:'PIX'})
      f.service.create({empresa_id:f.empresa.id,obra_id:f.obra.id,fornecedor_id:f.fornecedor.id,numero:'001',emissao:'2026-11-16',conta_id:account.id,
        itens:[{descricao:'Louças',quantidade:1,valor_unitario_centavos:12500,frente_id:f.etapa.id,subfrente_id:f.sub.id}]})
      f.service.create({empresa_id:f.empresa.id,obra_id:f.obra.id,fornecedor_id:f.fornecedor.id,numero:'002',emissao:'2026-11-17',
        itens:[{descricao:'Documento sem conta',quantidade:1,valor_unitario_centavos:8000,frente_id:f.etapa.id}]})
      const result=f.service.financialSummary({obra_id:f.obra.id,competencia_inicio:'2026-11',competencia_fim:'2026-11'})
      expect(result.totais).toMatchObject({orcado_centavos:30000,comprometido_centavos:12500,pago_centavos:5000,documentado_centavos:20500})
      expect(result.etapas.find(x=>x.frente_id===f.etapa.id).comprometido_centavos).toBe(12500)
      expect(result.subetapas.find(x=>x.subfrente_id===f.sub.id).pago_centavos).toBe(5000)
      expect(result.metrica_comprometido).toMatch(/contas/i)
      expect(result.avisos).toEqual(expect.arrayContaining([expect.stringMatching(/não somados/i)]))
    }finally{f.close()}
  })
  it('contas sem etapa continuam visíveis e contas canceladas não entram no comprometido',()=>{
    const f=fixture()
    try{
      f.account('Sem classificação',5000)
      f.account('Cancelada',9000,{status:'cancelado'})
      const summary=f.service.financialSummary({obra_id:f.obra.id})
      expect(summary.totais.comprometido_centavos).toBe(5000)
      expect(summary.sem_classificacao.quantidade).toBe(1)
      expect(summary.sem_classificacao.valor_centavos).toBe(5000)
      expect(summary.etapas.find(x=>x.frente_id===null).comprometido_centavos).toBe(5000)
    }finally{f.close()}
  })
})
describe('Edição de notas recebidas com histórico',()=>{
  it('atualiza itens em transação e registra uma revisão anterior sem mexer em contas ou estoque',()=>{
    const f=fixture()
    try{
      const n=f.service.create({empresa_id:f.empresa.id,obra_id:f.obra.id,fornecedor_id:f.fornecedor.id,numero:'N-001',emissao:'2026-11-15',
        itens:[{descricao:'Tubo',quantidade:1,valor_unitario_centavos:3000,frente_id:f.etapa.id}]})
      const revised=f.service.update(n.id,{...n,observacoes:'Conferida com o documento',itens:[
        {descricao:'Tubo PVC',quantidade:2,unidade:'un',valor_unitario_centavos:3000,frente_id:f.etapa.id,subfrente_id:f.sub.id}]})
      expect(revised.valor_total_centavos).toBe(6000)
      expect(revised.itens).toHaveLength(1)
      expect(revised.itens[0].subfrente_id).toBe(f.sub.id)
      expect(f.service.revisions(n.id)).toHaveLength(1)
      expect(f.service.revisions(n.id)[0].antes.valor_total_centavos).toBe(3000)
      expect(f.db.db.prepare('SELECT COUNT(*) n FROM contas').get().n).toBe(0)
      expect(f.db.db.prepare('SELECT COUNT(*) n FROM movimentacoes_estoque').get().n).toBe(0)
    }finally{f.close()}
  })
  it('reverte edição com vínculos de outra obra e mantém a nota original',()=>{
    const f=fixture()
    try{
      const n=f.service.create({empresa_id:f.empresa.id,obra_id:f.obra.id,fornecedor_id:f.fornecedor.id,numero:'N-002',emissao:'2026-11-15',itens:[{descricao:'Peça',quantidade:1,valor_unitario_centavos:5000}]})
      expect(()=>f.service.update(n.id,{...n,itens:[{descricao:'Peça',quantidade:1,valor_unitario_centavos:5000,frente_id:f.extra.id}]})).toThrow(/obra/i)
      expect(f.service.read(n.id).valor_total_centavos).toBe(5000)
      expect(f.service.revisions(n.id)).toHaveLength(0)
    }finally{f.close()}
  })
})
