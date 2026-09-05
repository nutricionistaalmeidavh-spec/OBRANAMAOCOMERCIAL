import { describe, expect, it } from 'vitest'
import { financialMargin, matchesAccountStatus, matchesNavigation, statusTone } from './ux'
import { normalizeWorkContext } from '../hooks/useWorkContext'

describe('financial indicators and account drill-down', () => {
  it('preserves negative and greater-than-100% financial margins', () => {
    expect(financialMargin(-200, 1000)).toBe(-20)
    expect(financialMargin(1500, 1000)).toBe(150)
    expect(financialMargin(0, 0)).toBeNull()
  })
  it('does not mark inactive and partially paid records as successful', () => {
    expect(statusTone('inativo')).toBe('danger')
    expect(statusTone('ATIVO')).toBe('success')
    expect(statusTone('parcialmente_pago')).toBe('warning')
    expect(statusTone('não identificado')).toBe('neutral')
  })
  it('includes outstanding partial payments but excludes settled accounts', () => {
    expect(matchesAccountStatus('parcialmente_pago', 'pendente')).toBe(true)
    expect(matchesAccountStatus('vencido', 'pendente')).toBe(true)
    expect(matchesAccountStatus('pago', 'pendente')).toBe(false)
    expect(matchesAccountStatus('pendente', 'vencido')).toBe(false)
  })
})
describe('navigation and context', () => {
  it('searches without accents or case sensitivity', () => {
    expect(matchesNavigation('Operacao Medicoes', '  MEDIÇÕES ')).toBe(true)
    expect(matchesNavigation('RH Funcionários', 'funcionarios')).toBe(true)
    expect(matchesNavigation('Financeiro Contas', 'folha')).toBe(false)
  })
  it('restores only valid stored context', () => {
    expect(normalizeWorkContext({competencia:'2026-09', empresaId:'2', obraId:'14'})).toEqual({competencia:'2026-09',empresaId:'2',obraId:'14'})
    const invalid = normalizeWorkContext({competencia:'2026-99',empresaId:'undefined',obraId:'-1'})
    expect(invalid.competencia).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/)
    expect(invalid.empresaId).toBe('')
    expect(invalid.obraId).toBe('')
  })
})
