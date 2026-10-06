import { describe, expect, it } from 'vitest'
import { buildReconciliationAudit, obligationReconciliationState, transactionReconciliationState } from './finance-auditability'
import { detectFinanceDivergences } from './finance-intelligence'
import { dedupeFinanceTransactions } from './finance-robustness'

describe('F15 finance functional QA — 12 critical flows', () => {
  it('01 folha → conta → PIX keeps value, beneficiary and date evidence visible', () => {
    const audit=buildReconciliationAudit({
      transaction:{id:'tx-payroll',date:'2026-10-05',description:'PIX JOAO SILVA',amountCents:280000,category:'Equipe'},
      obligations:[{id:'ob-payroll',beneficiaryName:'João Silva',description:'Folha outubro',amountCents:280000,dueDate:'2026-10-05',category:'Equipe',originModule:'rh',originEntity:'folhas_pagamento'}],
      allocations:[{obligationId:'ob-payroll',amountCents:280000}]
    })
    expect(audit.system.allocatedCents).toBe(280000)
    expect(audit.evidence.filter(x=>x.state==='match').map(x=>x.key)).toEqual(expect.arrayContaining(['amount','beneficiary','date','category']))
  })

  it('02 fornecedor → conta → PIX keeps supplier evidence visible', () => {
    const audit=buildReconciliationAudit({
      transaction:{id:'tx-supplier',date:'2026-10-10',description:'PIX FORNECEDOR ALFA LTDA',amountCents:45000,category:'Materiais'},
      obligations:[{id:'ob-supplier',beneficiaryName:'Fornecedor Alfa',description:'Pedido PC-42',amountCents:45000,dueDate:'2026-10-10',category:'Materiais',originModule:'procurement',originEntity:'pedidos_compra'}],
      allocations:[{obligationId:'ob-supplier',amountCents:45000}]
    })
    expect(audit.evidence.find(x=>x.key==='beneficiary')?.state).toBe('match')
    expect(audit.system.obligations[0].originModule).toBe('procurement')
  })

  it('03 pagamento parcial remains partial', () => {
    expect(obligationReconciliationState({amountCents:100000,matchedCents:40000})).toBe('partial')
    expect(transactionReconciliationState({amountCents:100000,matchedCents:40000})).toBe('partial')
  })

  it('04 pagamento agrupado is surfaced for review', () => {
    const rows=detectFinanceDivergences({
      today:'2026-10-05',
      transactions:[{id:'tx',direction:'debit',amountCents:80000,matchedCents:0,date:'2026-10-05',description:'PIX JOAO',accountId:'bank',accountOwnership:'business'}],
      obligations:[],
      suggestions:[{transaction:{id:'tx'},suggestion:{kind:'bundle',allocations:[{obligationId:'a',amountCents:30000},{obligationId:'b',amountCents:50000}],audit:{evidence:[]}}}]
    })
    expect(rows.some(x=>x.type==='grouped_payment')).toBe(true)
  })

  it('05 pagamento dividido is surfaced for review', () => {
    const rows=detectFinanceDivergences({
      today:'2026-10-05',
      transactions:[{id:'tx',direction:'debit',amountCents:30000,matchedCents:0,date:'2026-10-05',description:'PIX JOAO',accountId:'bank',accountOwnership:'business'}],
      obligations:[],
      suggestions:[{transaction:{id:'tx'},suggestion:{kind:'partial',allocations:[{obligationId:'a',amountCents:30000}],audit:{evidence:[]}}}]
    })
    expect(rows.some(x=>x.type==='possible_split_payment')).toBe(true)
  })

  it('06 transferência interna never becomes ordinary unreconciled expense', () => {
    expect(transactionReconciliationState({amountCents:50000,matchedCents:0,internalTransfer:true})).toBe('transfer')
  })

  it('07 retirada never becomes ordinary unreconciled expense', () => {
    expect(transactionReconciliationState({amountCents:50000,matchedCents:0,relatedWithdrawal:true})).toBe('withdrawal')
  })

  it('08 saída bancária sem obrigação is explicit', () => {
    const rows=detectFinanceDivergences({
      today:'2026-10-05',
      transactions:[{id:'tx',direction:'debit',amountCents:10000,matchedCents:0,date:'2026-10-05',description:'PIX SEM ORIGEM',accountId:'bank',accountOwnership:'business'}],
      obligations:[],
      suggestions:[]
    })
    expect(rows.some(x=>x.type==='bank_without_obligation')).toBe(true)
  })

  it('09 obrigação vencida sem pagamento is explicit', () => {
    const rows=detectFinanceDivergences({
      today:'2026-10-05',
      transactions:[],
      obligations:[{id:'ob',amountCents:10000,matchedCents:0,remainingCents:10000,beneficiaryName:'Fornecedor',description:'NF 1',dueDate:'2026-10-01'}],
      suggestions:[]
    })
    expect(rows.some(x=>x.type==='obligation_without_payment')).toBe(true)
  })

  it('10 duplicata bancária potencial is explicit', () => {
    const rows=detectFinanceDivergences({
      today:'2026-10-05',
      transactions:[
        {id:'a',direction:'debit',amountCents:10000,matchedCents:0,date:'2026-10-05',description:'PIX A',normalized:'PIX A',accountId:'bank',accountOwnership:'business'},
        {id:'b',direction:'debit',amountCents:10000,matchedCents:0,date:'2026-10-05',description:'PIX A',normalized:'PIX A',accountId:'bank',accountOwnership:'business'}
      ],
      obligations:[],
      suggestions:[]
    })
    expect(rows.find(x=>x.type==='potential_duplicate_bank')?.transactionIds).toEqual(['a','b'])
  })

  it('11 reimportação idêntica is idempotent', () => {
    expect(dedupeFinanceTransactions([{hash:'same'}],[{hash:'same'},{hash:'new'}])).toEqual([{hash:'new'}])
  })

  it('12 alteração após conciliação becomes divergence instead of silently rewriting history', () => {
    expect(obligationReconciliationState({amountCents:40000,matchedCents:50000})).toBe('divergence')
    const rows=detectFinanceDivergences({
      today:'2026-10-05',
      transactions:[],
      obligations:[{id:'ob',amountCents:40000,matchedCents:50000,remainingCents:0,beneficiaryName:'Fornecedor',description:'Conta alterada',dueDate:'2026-10-01'}],
      suggestions:[]
    })
    expect(rows.some(x=>x.type==='obligation_overallocated')).toBe(true)
  })
})
