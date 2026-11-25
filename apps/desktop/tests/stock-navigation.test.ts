import { describe, expect, it } from 'vitest'
import { ROUTES, COMMAND_NAVIGATION_GROUPS, CLASSIC_NAVIGATION_GROUPS, routeMeta } from '../src/routes/registry'
import { groupStockMovements } from '../src/utils/operational-sheet'
import { readFileSync } from 'node:fs'
describe('Estoque: descoberta e saldos canônicos',()=>{
  it('oferece acesso explícito nos dois layouts',()=>{
    expect(ROUTES.stock).toBe('/estoque')
    for(const groups of [COMMAND_NAVIGATION_GROUPS,CLASSIC_NAVIGATION_GROUPS]){
      expect(groups.flatMap(group=>group.items).filter(item=>item.to===ROUTES.stock)).toHaveLength(1)
      expect(groups.flatMap(group=>group.items).find(item=>item.to===ROUTES.stock)?.label).toBe('Estoque')
    }
    expect(routeMeta('/estoque').label).toBe('Estoque')
  })
  it('agrupa Estoque e Compras em Suprimentos, fora do Financeiro',()=>{
    for(const groups of [COMMAND_NAVIGATION_GROUPS,CLASSIC_NAVIGATION_GROUPS]){
      const supplies=groups.find(group=>group.label==='Suprimentos')
      expect(supplies?.items[0]?.to).toBe(ROUTES.stock)
      expect(groups.find(group=>group.label==='Financeiro')?.items.some(item=>item.to===ROUTES.stock)??false).toBe(false)
    }
    expect(routeMeta('/estoque').section).toBe('Suprimentos')
  })
  it('oferece a importação integrada da NF-e (XML) dentro da tela de Estoque',()=>{
    const page=readFileSync(new URL('../src/pages/StockPage.tsx',import.meta.url),'utf8')
    expect(page).toContain('NfePreviewSection')
    expect(page).toContain('Importar nota fiscal (XML)')
    const nfe=readFileSync(new URL('../src/components/NfePreviewSection.tsx',import.meta.url),'utf8')
    expect(nfe).not.toContain('Nenhum lançamento será criado')
  })
  it('preserva saldo, unidade e etapa ao reutilizar o ledger',()=>{
    const rows=groupStockMovements([{descricao:'Tubo',unidade:'m',frente_id:1,tipo:'entrada',quantidade:10},{descricao:'Tubo',unidade:'m',frente_id:1,tipo:'saida',quantidade:2},{descricao:'Tubo',unidade:'un',frente_id:1,tipo:'entrada',quantidade:3}])
    expect(rows.find(row=>row.unidade==='m')?.saldo).toBe(8)
    expect(rows.find(row=>row.unidade==='un')?.saldo).toBe(3)
  })
})
