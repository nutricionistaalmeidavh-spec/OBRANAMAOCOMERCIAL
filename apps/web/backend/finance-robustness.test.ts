import { describe, expect, it } from 'vitest'
import {
  applyLegacyObligationCompatibility,
  buildFinanceChangeAudit,
  buildMatchAuditSnapshot,
  dedupeFinanceTransactions
} from './finance-robustness'

describe('finance robustness P4', () => {
  // RED contract: F13/F14 must not pass before the robustness helpers exist.
  it('F13 snapshots confirmer, bank transaction, allocations, confidence and obligation origins', () => {
    const snapshot=buildMatchAuditSnapshot({
      actorUserId:'user-7',
      matchId:'match-1',
      source:'suggestion',
      confidence:96,
      transaction:{id:'tx-1',accountId:'bank-1',date:'2026-10-05',description:'PIX JOAO SILVA',amountCents:280000,category:'Equipe'},
      allocations:[{obligationId:'ob-1',amountCents:280000}],
      obligations:[{
        id:'ob-1',
        beneficiaryName:'João Silva',
        description:'Folha outubro',
        amountCents:280000,
        canonicalEntity:'conta',
        canonicalId:'42',
        originModule:'rh',
        originEntity:'folhas_pagamento',
        originId:'9',
        originLabel:'Folha 2026-10'
      }]
    })
    expect(snapshot).toMatchObject({
      actorUserId:'user-7',
      matchId:'match-1',
      transaction:{id:'tx-1',date:'2026-10-05',amountCents:280000},
      confirmedCents:280000,
      confidence:96,
      source:'suggestion'
    })
    expect(snapshot.allocations[0]).toMatchObject({
      obligationId:'ob-1',
      amountCents:280000,
      beneficiaryName:'João Silva',
      canonicalEntity:'conta',
      canonicalId:'42',
      originModule:'rh',
      originEntity:'folhas_pagamento',
      originId:'9'
    })
  })

  it('F13 records before/after values for financial alterations', () => {
    expect(buildFinanceChangeAudit('category',{
      category:'A conciliar',
      source:'import'
    },{
      category:'Materiais',
      source:'manual'
    })).toEqual({
      field:'category',
      before:{category:'A conciliar',source:'import'},
      after:{category:'Materiais',source:'manual'}
    })
  })

  it('F14 gives legacy obligations safe explicit defaults without inventing provenance', () => {
    expect(applyLegacyObligationCompatibility({
      id:'legacy-1',
      sourceId:'old-1',
      beneficiaryName:'Fornecedor Antigo',
      description:'Folha que não deve ser inferida pelo texto',
      amountCents:10000
    })).toMatchObject({
      sourceType:'payable',
      canonicalEntity:'conta',
      originModule:'unknown'
    })
  })

  it('F14 preserves proven provenance and never replaces it from description text', () => {
    expect(applyLegacyObligationCompatibility({
      id:'legacy-2',
      sourceType:'purchase',
      canonicalEntity:'conta',
      canonicalId:'88',
      originModule:'procurement',
      originEntity:'pedidos_compra',
      originId:'7',
      description:'Salário escrito no texto'
    })).toMatchObject({
      sourceType:'purchase',
      canonicalEntity:'conta',
      canonicalId:'88',
      originModule:'procurement',
      originEntity:'pedidos_compra',
      originId:'7'
    })
  })

  it('F15 reimportation keeps only transactions whose fingerprint is not already persisted', () => {
    const existing=[{hash:'same'}]
    const incoming=[{hash:'same',description:'já importado'},{hash:'new',description:'novo'}]
    expect(dedupeFinanceTransactions(existing,incoming)).toEqual([{hash:'new',description:'novo'}])
  })
})
