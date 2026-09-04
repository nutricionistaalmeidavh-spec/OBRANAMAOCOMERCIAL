import { describe, expect, it } from 'vitest'
import { buildAiAnalysisPayload, inferAiDomains } from './ai-context'

describe('commercial Gemini deterministic context', () => {
  it('routes financial questions to finance and costs without losing executive context', () => {
    expect(inferAiDomains('Quais contas vencidas e custos precisam de atenção?')).toEqual(
      expect.arrayContaining(['finance', 'costs', 'executive']),
    )
  })

  it('builds compact structured facts and alerts instead of forwarding raw records', () => {
    const payload = buildAiAnalysisPayload({
      question: 'O que devo priorizar?',
      competence: '2026-09',
      dashboard: {
        receitas: 1000000,
        despesas: 1250000,
        resultado: -250000,
        a_pagar: 500000,
        a_receber: 200000,
      },
      works: [{ id: 1, nome: 'Obra A', status: 'ativa', confidential_note: 'nao enviar' }],
      accounts: [
        { id: 7, descricao: 'Fornecedor hidráulica', status: 'vencido', vencimento: '2026-08-30', valor_centavos: 150000, cpf: '00000000000' },
        { id: 8, descricao: 'Conta quitada', status: 'pago', vencimento: '2026-08-20', valor_centavos: 50000 },
      ],
      people: [{ id: 3, nome: 'Pessoa', status: 'ativo', cpf: '11111111111' }],
      tasks: [{ id: 9, titulo: 'Teste', status: 'pendente' }],
      today: '2026-09-04',
    })

    expect(payload.facts.length).toBeLessThanOrEqual(10)
    expect(payload.alerts.some((item) => item.key === 'finance.negative_result')).toBe(true)
    expect(payload.alerts.some((item) => item.key === 'finance.overdue_accounts')).toBe(true)
    expect(payload.ranking[0]).toMatchObject({ label: 'Fornecedor hidráulica', value: 150000 })

    const serialized = JSON.stringify(payload)
    expect(serialized).not.toContain('00000000000')
    expect(serialized).not.toContain('11111111111')
    expect(serialized).not.toContain('confidential_note')
  })
})
