import { createRequire } from 'node:module'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { describe, expect, it } from 'vitest'

const require=createRequire(import.meta.url)
const { DatabaseService }=require('../electron/services/database.cjs')
const { createReceivedNotesService }=require('../../../packages/domain-core/index.cjs')
const migrationsDir=resolve(import.meta.dirname,'../database/migrations')

function fixture(){
  const dir=mkdtempSync(join(tmpdir(),'obranamao-notas-test-'))
  const adapter=new DatabaseService({ dataDir:dir,migrationsDir })
  adapter.open()
  const empresa=adapter.save('empresas',{razao_social:'Construtora Fictícia'})
  const obra=adapter.save('obras',{empresa_id:empresa.id,nome:'Obra Fictícia'})
  const outra=adapter.save('obras',{empresa_id:empresa.id,nome:'Outra Obra'})
  const fornecedor=adapter.save('fornecedores',{empresa_id:empresa.id,nome:'Fornecedor Fictício'})
  const etapa=adapter.save('frentes_obra',{obra_id:obra.id,nome:'Hidráulica'})
  const subetapa=adapter.save('subfrentes_obra',{obra_id:obra.id,frente_id:etapa.id,nome:'Louças e metais'})
  const outraEtapa=adapter.save('frentes_obra',{obra_id:outra.id,nome:'Elétrica'})
  const service=createReceivedNotesService(adapter.db)
  const input={empresa_id:empresa.id,obra_id:obra.id,fornecedor_id:fornecedor.id,numero:'000123',serie:'1',emissao:'2026-11-16',itens:[
    { descricao:'Tubo PVC fictício',quantidade:2,unidade:'un',valor_unitario_centavos:1500,frente_id:etapa.id,subfrente_id:subetapa.id },
    { descricao:'Registro fictício',quantidade:1,unidade:'un',valor_unitario_centavos:2500,frente_id:etapa.id }
  ]}
  return {adapter,empresa,obra,outra,fornecedor,etapa,subetapa,outraEtapa,service,input,close(){ adapter.close();rmSync(dir,{recursive:true,force:true}) }}
}
describe('P0/P1 notas recebidas: dados e vínculos canônicos',()=>{
  it('salva nota com dois itens em transação, sem gerar contas ou estoque',()=>{
    const f=fixture()
    try{
      const result=f.service.create({...f.input,requestId:'fake-request-1'})
      expect(result.valor_total_centavos).toBe(5500)
      expect(result.itens).toHaveLength(2)
      expect(f.service.list(f.obra.id)).toHaveLength(1)
      expect(f.service.summary(f.obra.id).etapas[0]).toMatchObject({frente_id:f.etapa.id,valor_centavos:5500})
      expect(f.adapter.db.prepare('SELECT COUNT(*) n FROM contas').get().n).toBe(0)
      expect(f.adapter.db.prepare('SELECT COUNT(*) n FROM movimentacoes_estoque').get().n).toBe(0)
      expect(f.adapter.db.prepare('PRAGMA foreign_key_check').all()).toEqual([])
    }finally{f.close()}
  })
  it('impede duplicatas, replay da mesma requisição e vínculo entre obras diferentes',()=>{
    const f=fixture()
    try{
      const first=f.service.create({...f.input,requestId:'req-111'})
      expect(f.service.create({...f.input,requestId:'req-111'}).id).toBe(first.id)
      expect(()=>f.service.create({...f.input,requestId:'req-112'})).toThrow(/cadastrad|duplicad/i)
      expect(()=>f.service.create({...f.input,numero:'000124',itens:[{...f.input.itens[0],frente_id:f.outraEtapa.id,subfrente_id:null}]})).toThrow(/mesma obra/i)
      expect(()=>f.service.create({...f.input,numero:'000125',itens:[{...f.input.itens[0],frente_id:f.etapa.id,subfrente_id:999}]})).toThrow(/Subetapa/i)
      expect(f.service.list(f.obra.id)).toHaveLength(1)
    }finally{f.close()}
  })
  it('vincula pedido, conta e documento já existentes sem produzir registros duplicados',()=>{
    const f=fixture()
    try{
      const pedido=f.adapter.save('pedidos_compra',{obra_id:f.obra.id,fornecedor_id:f.fornecedor.id,descricao:'Material',valor_centavos:5500})
      const conta=f.adapter.save('contas',{empresa_id:f.empresa.id,obra_id:f.obra.id,fornecedor_id:f.fornecedor.id,pedido_compra_id:pedido.id,tipo:'pagar',descricao:'Compra',competencia:'2026-11',vencimento:'2026-11-20',valor_centavos:5500})
      const note=f.service.create({...f.input,pedido_compra_id:pedido.id,conta_id:conta.id})
      const doc=f.adapter.save('documentos',{empresa_id:f.empresa.id,obra_id:f.obra.id,categoria:'nota_fiscal',titulo:'Nota fictícia'})
      const attached=f.service.attach(note.id,doc.id)
      expect(attached.documento_id).toBe(doc.id)
      expect(attached.conta_id).toBe(conta.id)
      expect(attached.pedido_compra_id).toBe(pedido.id)
      expect(f.adapter.db.prepare('SELECT COUNT(*) n FROM contas').get().n).toBe(1)
      expect(f.adapter.db.prepare('SELECT COUNT(*) n FROM pedidos_compra').get().n).toBe(1)
    }finally{f.close()}
  })
  it('falha com total divergente e reverte completamente os itens',()=>{
    const f=fixture()
    try{
      expect(()=>f.service.create({...f.input,valor_total_centavos:5501})).toThrow(/total/i)
      expect(f.adapter.db.prepare('SELECT COUNT(*) n FROM notas_recebidas').get().n).toBe(0)
      expect(f.adapter.db.prepare('SELECT COUNT(*) n FROM nota_recebida_itens').get().n).toBe(0)
    }finally{f.close()}
  })
})

describe('custos operacionais por etapa sem confundir documento e pagamento',()=>{
 it('separa compromisso atual, pagamentos do período e consumo físico do RDO',()=>{
  const f=fixture()
  try{
   f.service.create(f.input)
   const c=f.adapter.save('contas',{empresa_id:f.empresa.id,obra_id:f.obra.id,frente_id:f.etapa.id,fornecedor_id:f.fornecedor.id,tipo:'pagar',descricao:'Obrigação fictícia',competencia:'2026-11',vencimento:'2026-11-20',valor_centavos:8000})
   f.adapter.save('pagamentos_conta',{conta_id:c.id,data:'2026-11-17',valor_centavos:3000})
   f.adapter.save('pagamentos_conta',{conta_id:c.id,data:'2026-12-01',valor_centavos:1000})
   const rdo=f.adapter.save('rdos',{obra_id:f.obra.id,data:'2026-11-18'})
   f.adapter.db.prepare('INSERT INTO rdo_material_linhas(rdo_id,linha_id,frente_id,descricao,unidade,quantidade) VALUES (?,?,?,?,?,?)').run(rdo.id,'item',f.etapa.id,'Tubo fictício','m',2.5)
   const report=f.service.report({obra_id:f.obra.id,data_inicio:'2026-11-01',data_fim:'2026-11-30'})
   expect(report.indicadores.documentado_periodo_centavos).toBe(5500)
   expect(report.financeiro_por_destino).toEqual([expect.objectContaining({frente_id:f.etapa.id,subfrente_id:null,comprometido_atual_centavos:8000,pago_periodo_centavos:3000})])
   expect(report.consumo_rdo).toEqual([expect.objectContaining({frente_id:f.etapa.id,descricao:'Tubo fictício',unidade:'m',quantidade:2.5})])
   const selected=f.service.report({obra_id:f.obra.id,frente_id:f.etapa.id,subfrente_id:f.subetapa.id,data_inicio:'2026-11-01',data_fim:'2026-11-30'})
   expect(selected.financeiro_por_destino).toEqual([])
   expect(selected.consumo_rdo).toBeNull()
  }finally{f.close()}
 })
})
