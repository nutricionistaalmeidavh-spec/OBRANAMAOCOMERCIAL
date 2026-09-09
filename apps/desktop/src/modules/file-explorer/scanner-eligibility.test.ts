import { describe, expect, it } from 'vitest'
import { canScanDocument } from './scanner-eligibility'

describe('canScanDocument', () => {
  const available = { supported: true, available: true }
  it('permite digitalização somente para documento de funcionário ainda não assinado com scanner disponível', () => {
    expect(canScanDocument({ funcionario_id: 12, status_assinatura: 'nao_assinado' }, available)).toBe(true)
    expect(canScanDocument({ funcionario_id: 12, status_assinatura: 'geral' }, available)).toBe(true)
    expect(canScanDocument({ funcionario_id: 12, status_assinatura: 'assinado' }, available)).toBe(false)
    expect(canScanDocument({ funcionario_id: null, status_assinatura: 'nao_assinado' }, available)).toBe(false)
    expect(canScanDocument({ funcionario_id: 12, status_assinatura: 'nao_assinado' }, { supported: true, available: false })).toBe(false)
    expect(canScanDocument({ funcionario_id: 12, status_assinatura: 'nao_assinado' }, { supported: false, available: false })).toBe(false)
    expect(canScanDocument({ funcionario_id: 12, status_assinatura: 'nao_assinado' }, null)).toBe(false)
  })
})
