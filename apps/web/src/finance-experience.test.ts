import { describe, expect, it } from 'vitest'
import {
  coveragePercent,
  provenanceTrail,
  reconciliationLabel,
  reconciliationTone
} from './finance-experience'

describe('finance experience helpers', () => {
  it('uses the same human status vocabulary across obligations and bank entries', () => {
    expect(reconciliationLabel('unreconciled')).toBe('Não conciliado')
    expect(reconciliationLabel('suggestion')).toBe('Sugestão')
    expect(reconciliationLabel('partial')).toBe('Parcial')
    expect(reconciliationLabel('reconciled')).toBe('Conciliado')
    expect(reconciliationLabel('divergence')).toBe('Divergência')
    expect(reconciliationLabel('ignored')).toBe('Ignorado')
    expect(reconciliationLabel('transfer')).toBe('Transferência')
    expect(reconciliationLabel('withdrawal')).toBe('Retirada')
    expect(reconciliationTone('divergence')).toBe('bad')
    expect(reconciliationTone('suggestion')).toBe('warn')
    expect(reconciliationTone('reconciled')).toBe('ok')
  })

  it('shows a complete provenance trail for payroll without leaving Financeiro', () => {
    expect(provenanceTrail({
      originModule: 'rh',
      originEntity: 'folhas_pagamento',
      originLabel: 'Folha outubro/2026'
    })).toEqual([
      'RH',
      'Folha outubro/2026',
      'Conta a pagar',
      'Financeiro'
    ])
  })

  it('uses a safe generic trail when the source is only the canonical account', () => {
    expect(provenanceTrail({
      originModule: 'finance',
      originEntity: 'contas',
      originLabel: 'INSS outubro'
    })).toEqual(['Financeiro', 'INSS outubro'])
  })

  it('calculates deterministic reconciliation coverage', () => {
    expect(coveragePercent(10000, 7500)).toBe(75)
    expect(coveragePercent(0, 0)).toBe(0)
    expect(coveragePercent(10000, 12000)).toBe(100)
  })
})
