import { createRequire } from 'node:module'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const require=createRequire(import.meta.url)
const { DatabaseService }=require('../electron/services/database.cjs')
const { createReceivedNotesService }=require('../../../packages/domain-core/index.cjs')
const migrationsDir=resolve(import.meta.dirname,'../database/migrations')

function fixture() {
  const dir=mkdtempSync(join(tmpdir(),'obra-custos-integrados-'))
  const db=new DatabaseService({dataDir:dir,migrationsDir})
  db.open()
  const company=db.save('empresas',{razao_social:'Empresa fictícia'})
  const work=db.save('obras',{empresa_id:company.id,nome:'Obra das despesas importadas'})
  const another=db.save('obras',{empresa_id:company.id,nome:'Outra obra'})
  const supplier=db.save('fornecedores',{empresa_id:company.id,nome:'Fornecedor exemplo'})
  const stage=db.save('frentes_obra',{obra_id:work.id,nome:'Acabamento'})
  const sub=db.save('subfrentes_obra',{obra_id:work.id,frente_id:stage.id,nome:'Forro de gesso'})
  const otherStage=db.save('frentes_obra',{obra_id:another.id,nome:'Etapa de outra obra'})
  const account=(obra_id,value,extra={})=>db.save('contas',{empresa_id:company.id,obra_id,tipo:'pagar',fornecedor_id:supplier.id,descricao:'Despesa importada',competencia:'2026-11',vencimento:'2026-11-30',valor_centavos:value,status:'pendente',...extra})
  const service=createReceivedNotesService(db.db)
  const note=(value,extra={})=>service.create({
    empresa_id:company.id,obra_id:work.id,fornecedor_id:supplier.id,numero:'NF-'+value,emissao:'2026-11-16',itens:[
      {descricao:'Material fictício',quantidade:1,valor_unitario_centavos:value,frente_id:stage.id,subfrente_id:sub.id}
    ],...extra
  })
  return {dir,db,company,work,another,supplier,stage,sub,otherStage,account,service,note,close(){db.close();rmSync(dir,{recursive:true,force:true})}}
}

describe('Pós P2: despesas importadas, classificação e consolidação sem duplicação',()=>{
  it('classifica uma conta importada sem recriar o lançamento nem seus pagamentos',()=>{
    const f=fixture()
    try {
      const imported=f.account(f.work.id,4000)
      const result=f.service.assignAccounts({obra_id:f.work.id,conta_ids:[imported.id],frente_id:f.stage.id,subfrente_id:f.sub.id})
      expect(result.updated).toBe(1)
      expect(f.db.get('contas',imported.id)).toMatchObject({frente_id:f.stage.id,subfrente_id:f.sub.id,valor_centavos:4000})
      expect(f.db.db.prepare('SELECT COUNT(*) n FROM contas').get().n).toBe(1)
      expect(f.db.db.prepare('SELECT COUNT(*) n FROM custos_classificacoes_historico').get().n).toBe(1)
    } finally {f.close()}
  })
  it('impede classificação cruzada entre obras e não sobrescreve despesas já classificadas em lote',()=>{
    const f=fixture()
    try{
      const one=f.account(f.work.id,2500)
      const foreign=f.account(f.another.id,100)
      expect(()=>f.service.assignAccounts({obra_id:f.work.id,conta_ids:[one.id,foreign.id],frente_id:f.stage.id,subfrente_id:f.sub.id})).toThrow(/mesma obra/i)
      expect(f.db.get('contas',one.id).frente_id).toBeNull()
      expect(()=>f.service.assignAccounts({obra_id:f.work.id,conta_ids:[one.id],frente_id:f.otherStage.id})).toThrow(/mesma obra/i)
      f.service.assignAccounts({obra_id:f.work.id,conta_ids:[one.id],frente_id:f.stage.id,subfrente_id:f.sub.id})
      expect(()=>f.service.assignAccounts({obra_id:f.work.id,conta_ids:[one.id],frente_id:f.stage.id,subfrente_id:null})).toThrow(/classificad/i)
    }finally{f.close()}
  })
  it('soma contas sem notas mais notas sem contas e não conta duas vezes a mesma despesa',()=>{
    const f=fixture()
    try {
      const noNote=f.account(f.work.id,3000,{frente_id:f.stage.id,subfrente_id:f.sub.id})
      const linked=f.account(f.work.id,5000,{frente_id:f.stage.id,subfrente_id:f.sub.id})
      f.note(4500,{numero:'NF-linked',conta_id:linked.id})
      f.note(1200,{numero:'NF-avulsa'})
      f.account(f.another.id,99000)
      f.db.save('contas',{empresa_id:f.company.id,obra_id:f.work.id,tipo:'receber',descricao:'Receita',competencia:'2026-11',vencimento:'2026-11-30',valor_centavos:50000})
      const result=f.service.costsOverview({obra_id:f.work.id})
      expect(result.totais).toMatchObject({contas_centavos:8000,notas_centavos:5700,custos_registrados_centavos:9200})
      expect(result.etapas.find(x=>x.frente_id===f.stage.id).custos_registrados_centavos).toBe(9200)
      expect(result.subetapas.find(x=>x.subfrente_id===f.sub.id).custos_registrados_centavos).toBe(9200)
      expect(result.totais.contas_sem_etapa).toBe(0)
      expect(f.db.db.prepare('SELECT COUNT(*) n FROM contas WHERE tipo=?').get('pagar').n).toBe(3)
      expect(f.db.db.prepare('SELECT COUNT(*) n FROM movimentacoes_estoque').get().n).toBe(0)
      expect(noNote.id).toBeGreaterThan(0)
    } finally {f.close()}
  })
  it('identifica diferenças e não mascara a ausência de subetapa em contas importadas',()=>{
    const f=fixture()
    try{
      const account=f.account(f.work.id,2000)
      f.note(3500,{conta_id:account.id})
      const report=f.service.costsOverview({obra_id:f.work.id})
      expect(report.totais.custos_registrados_centavos).toBe(3500)
      expect(report.totais.contas_sem_etapa).toBe(1)
      expect(report.conciliacoes).toHaveLength(1)
      expect(report.conciliacoes[0].diferenca_centavos).toBe(-1500)
      expect(report.etapas.find(x=>x.frente_id===f.stage.id).custos_registrados_centavos).toBe(3500)
    } finally {f.close()}
  })
  it('edita uma nota mantendo histórico completo e bloqueando revisão desatualizada',()=>{
    const f=fixture()
    try{
      const original=f.note(2000)
      expect(original.revision).toBe(1)
      const input={...original,numero:'NF-2000',revision:1,valor_total_centavos:2400,itens:[
        {descricao:'Material retificado',quantidade:2,unidade:'un',valor_unitario_centavos:1200,frente_id:f.stage.id,subfrente_id:f.sub.id}
      ]}
      const updated=f.service.update(original.id,input)
      expect(updated).toMatchObject({revision:2,valor_total_centavos:2400})
      expect(updated.itens).toHaveLength(1)
      expect(f.service.history(original.id)).toHaveLength(1)
      const old=JSON.parse(f.service.history(original.id)[0].anterior_json)
      expect(old.valor_total_centavos).toBe(2000)
      expect(old.itens[0].descricao).toBe('Material fictício')
      expect(()=>f.service.update(original.id,input)).toThrow(/revisão|revisao|atualiz/i)
      expect(f.service.read(original.id).valor_total_centavos).toBe(2400)
    }finally{f.close()}
  })
})
