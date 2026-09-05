import { describe, expect, it } from 'vitest'
import {
  BILLING_TRANSITIONS,
  canApplyProviderTransition,
  normalizeAsaasEvent,
  validatePaidOrder
} from '../backend/billing-policy'

describe('billing security policy', () => {
  it('never trusts a client supplied amount', () => {
    expect(validatePaidOrder({ orderAmountCents: 19900, providerAmountCents: 9900, providerPaymentId: 'pay_1', expectedPaymentId: 'pay_1' })).toEqual({ ok: false, reason: 'amount_mismatch' })
  })

  it('rejects a provider payment not bound to the persisted order', () => {
    expect(validatePaidOrder({ orderAmountCents: 19900, providerAmountCents: 19900, providerPaymentId: 'pay_other', expectedPaymentId: 'pay_1' })).toEqual({ ok: false, reason: 'payment_mismatch' })
  })

  it('does not regress a paid subscription on a late pending event', () => {
    expect(canApplyProviderTransition('paid', 'pending')).toBe(false)
    expect(BILLING_TRANSITIONS.paid).not.toContain('pending')
  })

  it('maps paid, refund and overdue Asaas events to explicit financial states', () => {
    expect(normalizeAsaasEvent('PAYMENT_CONFIRMED')).toBe('paid')
    expect(normalizeAsaasEvent('PAYMENT_REFUNDED')).toBe('refunded')
    expect(normalizeAsaasEvent('PAYMENT_OVERDUE')).toBe('overdue')
  })
})
