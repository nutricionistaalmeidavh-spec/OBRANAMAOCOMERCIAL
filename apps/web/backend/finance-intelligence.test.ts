import { describe, expect, it } from 'vitest'
import { buildFinanceAnalysisBasis, detectFinanceDivergences } from './finance-intelligence'

describe('finance intelligence P2', () => {
  // RED contract for phases 9 and 10.
  it('returns deterministic internal evidence grouped by bank, system and reconciliation', () => {
    const basis=buildFinanceAnalysisBasis({
      accounts:[{name:'Itaú Empresa',ownership:'business'}],
      transactions:[{id:'tx-1',date:'2026-10-05',description:'PIX JOAO',amount:'R$ 2.800,00',category:'Equipe'}],
      openObligations:[{id:'ob-1',beneficiary:'João',description:'Folha outubro',expected:'R$ 2.800,00',remaining:'R$ 2.800,00'}],
      reconciliationSuggestions:[{transaction:{id:'tx-1'},suggestion:{allocations:[{obligationId:'ob-1',amountCents:280000}],confidence:96}}],
      confirmedMatches:[{id:'m-1',transactionId:'tx-0',allocations:[{obligationId:'ob-0',amountCents:10000}]}]
    })
    expect(basis.sections.map(x=>x.key)).toEqual(['bank','system','reconciliation'])
    expect(basis.sections[0].count).toBe(1)
    expect(basis.sections[0].references[0].id).toBe('tx-1')
    expect(basis.sections[1].references[0].id).toBe('ob-1')
    expect(basis.sections[2].count).toBe(2)
  })

  it('surfaces bank debits without obligation and obligations without bank evidence', () => {
    const result=detectFinanceDivergences({
      transactions:[
        {id:'tx-1',direction:'debit',amountCents:50000,matchedCents:0,description:'PIX SEM ORIGEM',date:'2026-10-05',accountId:'bank-1'},
        {id:'tx-2',direction:'debit',amountCents:30000,matchedCents:0,description:'TRANSF INTERNA',date:'2026-10-05',accountId:'bank-1',internalTransfer:true}
      ],
      obligations:[
        {id:'ob-1',amountCents:70000,matchedCents:0,remainingCents:70000,beneficiaryName:'Fornecedor',description:'NF 10',dueDate:'2026-10-05'}
      ],
      suggestions:[]
    })
    expect(result.map(x=>x.type)).toContain('bank_without_obligation')
    expect(result.map(x=>x.type)).toContain('obligation_without_payment')
    expect(result.some(x=>x.transactionId==='tx-2')).toBe(false)
  })


  it('does not flag personal-account debits or future obligations as current divergences', () => {
    const result=detectFinanceDivergences({
      today:'2026-10-05',
      transactions:[
        {id:'personal-1',direction:'debit',amountCents:90000,matchedCents:0,description:'COMPRA PESSOAL',date:'2026-10-05',accountId:'personal',accountOwnership:'personal'}
      ],
      obligations:[
        {id:'future-1',amountCents:80000,matchedCents:0,remainingCents:80000,beneficiaryName:'Fornecedor Futuro',description:'Conta novembro',dueDate:'2026-11-10'}
      ],
      suggestions:[]
    })
    expect(result).toEqual([])
  })

  it('surfaces partial, bundled and evidence-review cases without changing data', () => {
    const result=detectFinanceDivergences({
      transactions:[{id:'tx-1',direction:'debit',amountCents:100000,matchedCents:40000,description:'PIX JOAO',date:'2026-10-05',accountId:'bank-1'}],
      obligations:[{id:'ob-1',amountCents:100000,matchedCents:40000,remainingCents:60000,beneficiaryName:'João',description:'Folha',dueDate:'2026-10-05'}],
      suggestions:[{
        transaction:{id:'tx-1',amountCents:60000,remainingToMatchCents:60000},
        suggestion:{
          kind:'bundle',
          confidence:90,
          allocations:[{obligationId:'ob-1',amountCents:60000}],
          audit:{evidence:[
            {key:'beneficiary',state:'partial',detail:'Nome parcial'},
            {key:'date',state:'info',detail:'Data distante'}
          ]}
        }
      }]
    })
    expect(result.map(x=>x.type)).toContain('partial_reconciliation')
    expect(result.map(x=>x.type)).toContain('grouped_payment')
    expect(result.map(x=>x.type)).toContain('beneficiary_review')
    expect(result.map(x=>x.type)).toContain('date_review')
  })
})
