import { describe,expect,it } from 'vitest'
import { createRequire } from 'node:module'
const require=createRequire(import.meta.url)
const { parseDecimal, safeSpreadsheetText, validateBatch, detectFormula, parseTsv } = require('../electron/services/operational-sheet-service.cjs')

describe('P0 planilhas operacionais',()=>{
  it('preserva números brasileiros e rejeita notação inválida',()=>{
    expect(parseDecimal('0,5')).toBe(.5)
    expect(parseDecimal('16,364')).toBe(16.364)
    expect(parseDecimal('1.234,50')).toBe(1234.5)
    expect(parseDecimal('1e3')).toBeNull()
    expect(parseDecimal('')).toBeNull()
  })
  it('neutraliza injeção de fórmulas exportadas para Excel e CSV',()=>{
    expect(safeSpreadsheetText('=HYPERLINK("x")')).toBe("'=HYPERLINK(\"x\")")
    expect(safeSpreadsheetText('  @SUM(A1)')).toBe("'  @SUM(A1)")
    expect(detectFormula('-4')).toBe(false)
  })
  it('impede lote de orçamento com quantidade negativa ou centavos inválidos',()=>{
    expect(()=>validateBatch('orcamento',[{id:7,quantidade:'-1',valor_unitario_centavos:100}])).toThrow(/quantidade/i)
    expect(()=>validateBatch('orcamento',[{id:7,quantidade:'1,5',valor_unitario_centavos:1290}])).not.toThrow()
  })
  it('não permite lote financeiro sem identificação ou com valor negativo',()=>{
    expect(()=>validateBatch('financeiro',[{id:0,descricao:'Conta',valor_centavos:200}])).toThrow(/id/i)
    expect(()=>validateBatch('financeiro',[{id:1,descricao:'Conta',valor_centavos:-1}])).toThrow(/valor/i)
  })
  it('cola tabulações em matriz sem executar HTML',()=>{
    expect(parseTsv('A\tB\nC\tD')).toEqual([['A','B'],['C','D']])
  })
})
