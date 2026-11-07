import { describe, expect, it } from 'vitest'
import { analyzeDre } from './DrePage'
describe('Análise da DRE',()=>{
  it('agrupa os meses sem misturar anos e separa competência e realizado',()=>{
    const analysis=analyzeDre([
      {competencia:'2026-01',tipo:'pagar',categoria:'Pessoal',valor:10000,valor_realizado:4000},
      {competencia:'2026-01',tipo:'receber',categoria:'Serviços',valor:30000,valor_realizado:20000},
      {competencia:'2026-02',tipo:'pagar',categoria:'Pessoal',valor:5000,valor_realizado:2000},
    ],'2026')
    expect(analysis.months).toHaveLength(12)
    expect(analysis.months[0]).toMatchObject({receitas:30000,despesas:10000,receitasRealizadas:20000,despesasRealizadas:4000})
    expect(analysis.months[1].despesas).toBe(5000)
    expect(analysis.months[2].items).toEqual([])
    expect(analysis.categories).toEqual([{name:'Pessoal',competencia:15000,realizado:6000}])
  })
  it('mantém categorias distintas e aceita períodos vazios',()=>{
    expect(analyzeDre([],'2026').categories).toEqual([])
    expect(analyzeDre([{competencia:'2025-12',tipo:'pagar',categoria:'Tarifas',valor:12000}],'2026').months.every(month=>month.despesas===0)).toBe(true)
  })
})
