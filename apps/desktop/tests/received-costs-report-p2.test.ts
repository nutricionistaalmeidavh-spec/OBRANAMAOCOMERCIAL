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
  const dir=mkdtempSync(join(tmpdir(),'obranamao-relatorio-'))
  const db=new DatabaseService({dataDir:dir,migrationsDir})
  db.open()
  const company=db.save('empresas',{razao_social:'Empresa QA fictícia'})
  const work=db.save('obras',{empresa_id:company.id,nome:'Obra principal'})
  const other=db.save('obras',{empresa_id:company.id,nome:'Obra não autorizada para este relatório'})
  const supplier=db.save('fornecedores',{empresa_id:company.id,nome:'Fornecedor A'})
  const otherSupplier=db.save('fornecedores',{empresa_id:company.id,nome:'Fornecedor B'})
  const front=db.save('frentes_obra',{obra_id:work.id,nome:'Hidráulica'})
  const sub=db.save('subfrentes_obra',{obra_id:work.id,frente_id:front.id,nome:'Prumadas'})
  const second=db.save('frentes_obra',{obra_id:work.id,nome:'Elétrica'})
  const foreign=db.save('frentes_obra',{obra_id:other.id,nome:'Etapa externa'})
  const budget=(frente_id,quantidade,unit)=>db.save('itens_orcamentarios',{
    obra_id:work.id,frente_id,descricao:'Serviço previsto',unidade:'un',quantidade,
    valor_unitario_centavos:unit,tipo:'material'
  })
  budget(front.id,8,1000) // 8000 centavos
  budget(second.id,2,1500) // 3000 centavos
  budget(null,2,1000) // 2000 sem etapa
  const service=createReceivedNotesService(db.db)
  const create=(numero,emissao,items,supplierId=supplier.id,workId=work.id)=>service.create({
    empresa_id:company.id,obra_id:workId,fornecedor_id:supplierId,numero,emissao,
    itens:items.map(([value,frontId,subId])=>({
      descricao:'Material '+value,quantidade:1,unidade:'un',
      valor_unitario_centavos:value,frente_id:frontId,subfrente_id:subId
    }))
  })
  const first=create('A001','2026-10-15',[[2000,front.id,sub.id],[1500,front.id,null],[1200,second.id,null],[300,null,null]])
  const secondNote=create('B002','2026-11-03',[[6000,front.id,sub.id],[500,second.id,null]],otherSupplier.id)
  // A separate work contains the same stage type and must never leak into the report.
  create('C003','2026-11-05',[[9999,foreign.id,null]],supplier.id,other.id)
  return {db,service,company,work,other,supplier,otherSupplier,front,sub,second,first,secondNote,close(){db.close();rmSync(dir,{recursive:true,force:true})}}
}

describe('P2: relatórios gerenciais com fonte canônica de notas recebidas',()=>{
  it('compara orçamento total de cada etapa com valor documentado acumulado, sem misturar pagamentos ou estoque',()=>{
    const f=fixture()
    try {
      const order=f.db.save('pedidos_compra',{obra_id:f.work.id,fornecedor_id:f.supplier.id,descricao:'Pedido que não pode ser somado novamente',valor_centavos:5000})
      f.db.save('contas',{empresa_id:f.company.id,obra_id:f.work.id,fornecedor_id:f.supplier.id,pedido_compra_id:order.id,tipo:'pagar',descricao:'Conta que não pode ser duplicada',competencia:'2026-10',vencimento:'2026-10-31',valor_centavos:5000})
      const r=f.service.report({obra_id:f.work.id,data_inicio:'2026-11-01',data_fim:'2026-11-30'})
      expect(r.indicadores).toMatchObject({
        orcamento_total_centavos:13000,documentado_ate_fim_centavos:11500,documentado_periodo_centavos:6500,
        comparavel:true
      })
      expect(r.etapas.find(x=>x.frente_id===f.front.id)).toMatchObject({
        orcamento_centavos:8000,documentado_ate_fim_centavos:9500,
        documentado_periodo_centavos:6000,desvio_centavos:1500,
        alerta:'acima_do_orcamento'
      })
      expect(r.etapas.find(x=>x.frente_id===f.second.id).documentado_ate_fim_centavos).toBe(1700)
      expect(r.etapas.find(x=>x.frente_id===null).documentado_ate_fim_centavos).toBe(300)
      expect(r.subetapas.find(x=>x.subfrente_id===f.sub.id)).toMatchObject({
        documentado_ate_fim_centavos:8000,documentado_periodo_centavos:6000,
        orcamento_centavos:null
      })
      expect(r.historico_total).toBe(2)
      expect(r.historico.every(x=>x.emissao.startsWith('2026-11'))).toBe(true)
      expect(f.db.db.prepare('SELECT COUNT(*) quantidade FROM pagamentos_conta').get().quantidade).toBe(0)
      expect(f.db.db.prepare('SELECT COUNT(*) quantidade FROM movimentacoes_estoque').get().quantidade).toBe(0)
    } finally { f.close() }
  })
  it('aplica filtros de fornecedor, etapa e subetapa sem atribuir orçamento geral à subetapa',()=>{
    const f=fixture()
    try {
      const bySupplier=f.service.report({obra_id:f.work.id,fornecedor_id:f.otherSupplier.id})
      expect(bySupplier.indicadores.documentado_periodo_centavos).toBe(6500)
      expect(bySupplier.indicadores.comparavel).toBe(false)
      expect(bySupplier.etapas.every(x=>x.desvio_centavos===null)).toBe(true)
      const bySub=f.service.report({obra_id:f.work.id,frente_id:f.front.id,subfrente_id:f.sub.id})
      expect(bySub.indicadores.documentado_periodo_centavos).toBe(8000)
      expect(bySub.indicadores.comparavel).toBe(false)
      expect(bySub.subetapas).toHaveLength(1)
      expect(bySub.subetapas[0].orcamento_centavos).toBeNull()
      expect(bySub.historico.every(x=>x.subfrente_id===f.sub.id)).toBe(true)
    } finally { f.close() }
  })
  it('oferece histórico paginado e ordenado, incluindo origem da nota e total exato sem duplicar itens',()=>{
    const f=fixture()
    try {
      const first=f.service.report({obra_id:f.work.id,limit:2,offset:0})
      const second=f.service.report({obra_id:f.work.id,limit:2,offset:2})
      expect(first.historico_total).toBe(6)
      expect(first.historico).toHaveLength(2)
      expect(first.paginacao).toMatchObject({limit:2,offset:0,has_more:true})
      expect(second.historico).toHaveLength(2)
      expect(new Set([...first.historico,...second.historico].map(x=>x.item_id)).size).toBe(4)
      expect(first.historico[0].numero).toBe('B002')
      expect(first.historico[0].fornecedor_nome).toBe('Fornecedor B')
    } finally { f.close() }
  })
  it('bloqueia períodos inválidos, referências de outra obra e paginação abusiva',()=>{
    const f=fixture()
    try {
      expect(()=>f.service.report({obra_id:f.work.id,data_inicio:'2026-11-30',data_fim:'2026-11-01'})).toThrow(/período/i)
      expect(()=>f.service.report({obra_id:f.work.id,data_inicio:'2026-02-30'})).toThrow(/data/i)
      expect(()=>f.service.report({obra_id:f.work.id,frente_id:999})).toThrow(/etapa/i)
      expect(()=>f.service.report({obra_id:f.work.id,frente_id:f.second.id,subfrente_id:f.sub.id})).toThrow(/subetapa/i)
      expect(()=>f.service.report({obra_id:f.work.id,limit:1000})).toThrow(/limit/i)
      expect(()=>f.service.report({obra_id:f.other.id}).historico_total).toBe(1)
    } finally { f.close() }
  })
  it('compara a subetapa somente quando o item orçamentário tiver vínculo explícito com ela',()=>{
    const f=fixture()
    try {
      f.db.save('itens_orcamentarios',{
        obra_id:f.work.id,frente_id:f.front.id,subfrente_id:f.sub.id,
        descricao:'Orçamento específico da prumada',unidade:'un',
        quantidade:2,valor_unitario_centavos:1000,tipo:'material'
      })
      const bySub=f.service.report({obra_id:f.work.id,frente_id:f.front.id,subfrente_id:f.sub.id})
      expect(bySub.indicadores).toMatchObject({
        comparavel:true,orcamento_total_centavos:2000,
        documentado_ate_fim_centavos:8000
      })
      expect(bySub.subetapas[0]).toMatchObject({
        orcamento_centavos:2000,desvio_centavos:6000,alerta:'acima_do_orcamento'
      })
      const stage=f.service.report({obra_id:f.work.id,frente_id:f.front.id})
      expect(stage.indicadores.orcamento_total_centavos).toBe(10000)
      expect(stage.etapas[0].desvio_centavos).toBe(-500)
    }finally{f.close()}
  })

})
