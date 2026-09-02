import { describe, expect, it } from 'vitest'
import { brl, brDate, competenceLabel, toCents } from './format'

describe('formatação financeira e datas', () => {
  it('converte entradas brasileiras para centavos sem ponto flutuante', () => {
    expect(toCents('1.234,56')).toBe(123456)
    expect(toCents('0,01')).toBe(1)
  })

  it('formata centavos como real brasileiro', () => {
    expect(brl(123456)).toContain('1.234,56')
  })

  it('formata datas e competências ISO', () => {
    expect(brDate('2026-08-04')).toBe('04/08/2026')
    expect(competenceLabel('2026-08').toLowerCase()).toContain('2026')
  })
})
