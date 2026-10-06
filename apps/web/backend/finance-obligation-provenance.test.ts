import { describe, expect, it } from 'vitest'
import {
  financeCanonicalKey,
  matchFinanceObligation,
  mergeFinanceObligationIdentity,
  normalizeFinanceProvenance
} from './finance-obligation-provenance'

describe('finance obligation provenance', () => {
  it('uses the canonical account identity across different publishing sources', () => {
    const current = [{
      id: 'ob-1',
      sourceKey: 'fluxodre-desktop|payable|device-a:conta:42',
      canonicalEntity: 'conta',
      canonicalId: '42'
    }]
    const incoming = {
      sourceKey: 'summary.rh.payroll|salary|payroll-item-9',
      canonicalEntity: 'conta',
      canonicalId: '42'
    }

    expect(financeCanonicalKey(current[0])).toBe('conta|42')
    expect(financeCanonicalKey(incoming)).toBe('conta|42')
    expect(matchFinanceObligation(current, incoming)?.id).toBe('ob-1')
  })

  it('keeps provenance separate from the canonical financial obligation', () => {
    expect(normalizeFinanceProvenance({
      canonicalEntity: 'conta',
      canonicalId: '1842',
      originModule: 'rh',
      originEntity: 'folhas_pagamento',
      originId: '97',
      originLabel: 'Folha outubro/2026',
      originReason: 'Gerado pelo fechamento da folha'
    })).toEqual({
      canonicalEntity: 'conta',
      canonicalId: '1842',
      originModule: 'rh',
      originEntity: 'folhas_pagamento',
      originId: '97',
      originLabel: 'Folha outubro/2026',
      originReason: 'Gerado pelo fechamento da folha'
    })
  })


  it('preserves the legacy source key when a canonical match arrives from another source', () => {
    const existing = {
      sourceKey: 'fluxodre-desktop|payable|device-a:conta:42',
      source: 'fluxodre-desktop',
      canonicalEntity: 'conta',
      canonicalId: '42'
    }
    const incoming = {
      sourceKey: 'summary.rh.payroll|salary|payroll-item-9',
      source: 'summary.rh.payroll',
      canonicalEntity: 'conta',
      canonicalId: '42'
    }

    expect(mergeFinanceObligationIdentity(existing, incoming)).toMatchObject({
      sourceKey: 'fluxodre-desktop|payable|device-a:conta:42',
      canonicalEntity: 'conta',
      canonicalId: '42'
    })
  })

  it('does not invent provenance when legacy data has none', () => {
    expect(normalizeFinanceProvenance({ canonicalEntity: 'conta', canonicalId: '7' })).toEqual({
      canonicalEntity: 'conta',
      canonicalId: '7'
    })
  })
})
