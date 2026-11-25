import { describe, expect, it } from 'vitest'
import { ROUTES, COMMAND_NAVIGATION_GROUPS, CLASSIC_NAVIGATION_GROUPS, routeMeta } from '../src/routes/registry'
import { groupStockMovements } from '../src/utils/operational-sheet'
describe('Estoque: descoberta e saldos canônicos',()=>{
  it('oferece acesso explícito nos dois layouts',()=>{
    expect(ROUTES.stock).toBe('/estoque')
    for(const groups of [COMMAND_NAVIGATION_GROUPS,CLASSIC_NAVIGATION_GROUPS]){
      expect(groups.flatMap(group=>group.items).filter(item=>item.to===ROUTES.stock)).toHaveLength(1)
      expect(groups.flatMap(group=>group.items).find(item=>item.to===ROUTES.stock)?.label).toBe('Estoque')
    }
    expect(routeMeta('/estoque').label).toBe('Estoque')
  })
  it('preserva saldo, unidade e etapa ao reutilizar o ledger',()=>{
    const rows=groupStockMovements([{descricao:'Tubo',unidade:'m',frente_id:1,tipo:'entrada',quantidade:10},{descricao:'Tubo',unidade:'m',frente_id:1,tipo:'saida',quantidade:2},{descricao:'Tubo',unidade:'un',frente_id:1,tipo:'entrada',quantidade:3}])
    expect(rows.find(row=>row.unidade==='m')?.saldo).toBe(8)
    expect(rows.find(row=>row.unidade==='un')?.saldo).toBe(3)
  })
})
