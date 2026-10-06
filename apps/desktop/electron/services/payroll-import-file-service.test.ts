import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require=createRequire(import.meta.url)
const { detectMapping, money, TEMPLATE_HEADERS }=require('./payroll-import-file-service.cjs')

describe('payroll import spreadsheet parser',()=>{
  it('recognizes the Obra na Mão template headers',()=>{
    const map=detectMapping(TEMPLATE_HEADERS)
    expect(map.funcionario).toBe('Funcionário / despesa')
    expect(map.salario).toBe('Salário')
    expect(map.vale_adiantamento).toBe('Vale / adiantamento')
    expect(map.valor_despesa).toBe('Valor despesa')
  })

  it('recognizes common custom spreadsheet aliases',()=>{
    const map=detectMapping(['Colaborador','Remuneração','Vale salário','Vale transporte','Falta','FGTS'])
    expect(map.funcionario).toBe('Colaborador')
    expect(map.salario).toBe('Remuneração')
    expect(map.vale_adiantamento).toBe('Vale salário')
    expect(map.transporte).toBe('Vale transporte')
    expect(map.faltas).toBe('Falta')
    expect(map.fgts).toBe('FGTS')
  })

  it('normalizes Brazilian monetary values without silent rounding drift',()=>{
    expect(money('R$ 2.800,50')).toBe(280050)
    expect(money(350.25)).toBe(35025)
    expect(money('')).toBe(0)
  })
})
