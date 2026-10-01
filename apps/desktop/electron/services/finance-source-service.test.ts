import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const { FinanceSourceService } = require('./finance-source-service.cjs')

function fixture(state = 'local') {
  const local = {
    accountPayment: vi.fn((id: number, payment: any) => ({ id, ...payment, source: 'local' })),
    dre: vi.fn((filters: any) => [{ ...filters, source: 'local' }]),
    dashboard: vi.fn((filters: any) => ({ ...filters, source: 'local' }))
  }
  const lanClient = {
    accountPayment: vi.fn(async (id: number, payment: any, requestId: string) => ({ id, ...payment, requestId, source: 'lan' })),
    financeDre: vi.fn(async (filters: any) => [{ ...filters, source: 'lan' }]),
    financeDashboard: vi.fn(async (filters: any) => ({ ...filters, source: 'lan' }))
  }
  const moduleStorage = { state: vi.fn(() => ({ module: 'finance', state, localRecords: 0 })) }
  const randomUUID = vi.fn(() => 'finance-request-uuid')
  const service = new FinanceSourceService({ local, lanClient, moduleStorage, randomUUID })
  return { service, local, lanClient, moduleStorage, randomUUID }
}

describe('FinanceSourceService', () => {
  it.each(['local', 'migration-required'])('mantém %s no serviço financeiro local', async state => {
    const f = fixture(state)
    await expect(f.service.accountPayment(10, { valor_centavos: 1000, data: '2026-10-01' })).resolves.toMatchObject({ source: 'local' })
    await expect(f.service.dre({ competencia: '2026-10' })).resolves.toEqual([{ competencia: '2026-10', source: 'local' }])
    await expect(f.service.dashboard({ empresa_id: 2 })).resolves.toMatchObject({ source: 'local' })
    expect(f.local.accountPayment).toHaveBeenCalledTimes(1)
    expect(f.lanClient.accountPayment).not.toHaveBeenCalled()
  })

  it('central-active usa exclusivamente a API LAN para pagamento, DRE e dashboard', async () => {
    const f = fixture('central-active')
    await expect(f.service.accountPayment(10, { valor_centavos: 1000, data: '2026-10-01' })).resolves.toMatchObject({ source: 'lan', requestId: 'finance-request-uuid' })
    await expect(f.service.dre({ competencia: '2026-10' })).resolves.toEqual([{ competencia: '2026-10', source: 'lan' }])
    await expect(f.service.dashboard({ empresa_id: 2 })).resolves.toMatchObject({ source: 'lan' })
    expect(f.local.accountPayment).not.toHaveBeenCalled()
    expect(f.local.dre).not.toHaveBeenCalled()
    expect(f.local.dashboard).not.toHaveBeenCalled()
  })

  it('central-ready bloqueia operações e nunca salva localmente como fallback', async () => {
    const f = fixture('central-ready')
    await expect(f.service.accountPayment(10, { valor_centavos: 1000, data: '2026-10-01' })).rejects.toThrow(/Financeiro central.*não está ativo|nenhum dado.*fallback/i)
    await expect(f.service.dre({ competencia: '2026-10' })).rejects.toThrow(/Financeiro central.*não está ativo|nenhum dado.*fallback/i)
    expect(f.local.accountPayment).not.toHaveBeenCalled()
    expect(f.lanClient.accountPayment).not.toHaveBeenCalled()
  })

  it('reutiliza o mesmo requestId ao repetir pagamento após falha de rede ambígua', async () => {
    const f = fixture('central-active')
    f.lanClient.accountPayment.mockRejectedValueOnce(new Error('rede caiu depois do commit'))
    const payment = { valor_centavos: 2500, data: '2026-10-02', forma_pagamento: 'pix' }
    await expect(f.service.accountPayment(15, payment)).rejects.toThrow('rede caiu depois do commit')
    await expect(f.service.accountPayment(15, payment)).resolves.toMatchObject({ requestId: 'finance-request-uuid' })
    expect(f.randomUUID).toHaveBeenCalledTimes(1)
    expect(f.lanClient.accountPayment.mock.calls[0][2]).toBe('finance-request-uuid')
    expect(f.lanClient.accountPayment.mock.calls[1][2]).toBe('finance-request-uuid')
  })

  it('gera novo requestId depois que uma operação foi confirmada', async () => {
    let sequence = 0
    const f = fixture('central-active')
    f.randomUUID.mockImplementation(() => `req-${++sequence}`)
    const payment = { valor_centavos: 1000, data: '2026-10-03' }
    await f.service.accountPayment(20, payment)
    await f.service.accountPayment(20, payment)
    expect(f.lanClient.accountPayment.mock.calls[0][2]).toBe('req-1')
    expect(f.lanClient.accountPayment.mock.calls[1][2]).toBe('req-2')
  })
})
