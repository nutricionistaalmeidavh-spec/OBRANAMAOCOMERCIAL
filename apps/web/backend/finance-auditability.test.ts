import { describe, expect, it } from 'vitest'
import {
  obligationReconciliationState,
  transactionReconciliationState,
  buildReconciliationAudit
} from './finance-auditability'

describe('finance auditability', () => {
  // P1 contract: auditability must exist before UI confirmation.
  it('prioritizes semantic bank states before generic matching states', () => {
    expect(transactionReconciliationState({ amountCents:10000, matchedCents:0, internalTransfer:true })).toBe('transfer')
    expect(transactionReconciliationState({ amountCents:10000, matchedCents:0, relatedWithdrawal:true })).toBe('withdrawal')
    expect(transactionReconciliationState({ amountCents:10000, matchedCents:4000 })).toBe('partial')
    expect(transactionReconciliationState({ amountCents:10000, matchedCents:10000 })).toBe('reconciled')
    expect(transactionReconciliationState({ amountCents:10000, matchedCents:0, hasSuggestion:true })).toBe('suggestion')
    expect(transactionReconciliationState({ amountCents:10000, matchedCents:0 })).toBe('unreconciled')
  })

  it('standardizes obligation states and preserves explicit divergence/ignored flags', () => {
    expect(obligationReconciliationState({ amountCents:10000, matchedCents:0, hasSuggestion:true })).toBe('suggestion')
    expect(obligationReconciliationState({ amountCents:10000, matchedCents:5000 })).toBe('partial')
    expect(obligationReconciliationState({ amountCents:10000, matchedCents:10000 })).toBe('reconciled')
    expect(obligationReconciliationState({ amountCents:10000, matchedCents:0, divergence:true })).toBe('divergence')
    expect(obligationReconciliationState({ amountCents:10000, matchedCents:0, ignored:true })).toBe('ignored')
  })

  it('explains a suggestion from both bank and system sides before confirmation', () => {
    const audit=buildReconciliationAudit({
      transaction:{id:'tx-1',date:'2026-10-05',description:'PIX JOAO SILVA',amountCents:280000,category:'Equipe',accountLabel:'Banco A'},
      obligations:[
        {id:'ob-1',beneficiaryName:'João Silva',description:'Salário',amountCents:230000,dueDate:'2026-10-05',category:'Equipe',originLabel:'Folha outubro/2026'},
        {id:'ob-2',beneficiaryName:'João Silva',description:'Vale',amountCents:50000,dueDate:'2026-10-05',category:'Equipe',originLabel:'Folha outubro/2026'}
      ],
      allocations:[{obligationId:'ob-1',amountCents:230000},{obligationId:'ob-2',amountCents:50000}]
    })
    expect(audit.bank.amountCents).toBe(280000)
    expect(audit.system.allocatedCents).toBe(280000)
    expect(audit.system.obligations).toHaveLength(2)
    expect(audit.evidence.find(x=>x.key==='amount')?.state).toBe('match')
    expect(audit.evidence.find(x=>x.key==='beneficiary')?.state).toBe('match')
    expect(audit.evidence.find(x=>x.key==='date')?.state).toBe('match')
    expect(audit.evidence.find(x=>x.key==='category')?.state).toBe('match')
  })
})
