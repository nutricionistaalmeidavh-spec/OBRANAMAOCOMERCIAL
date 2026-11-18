import { describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { BankFinanceSourceService } = require('./bank-finance-source.cjs')

describe('B0-B2 roteamento canônico de contas bancárias', () => {
  const data={empresaId:5,contaBancariaId:2}
  function fixture(state:string) {
    const local={ listAccounts:vi.fn().mockReturnValue([{id:1}]),confirmImport:vi.fn().mockReturnValue({imported:1}) }
    const remote={ bankList:vi.fn().mockResolvedValue([{id:2}]),bankConfirm:vi.fn().mockResolvedValue({imported:2}) }
    const moduleStorage={state:vi.fn().mockReturnValue({state})}
    const service=new BankFinanceSourceService({local,lanClient:remote,moduleStorage})
    return {service,local,remote}
  }
  it('usa banco local somente quando Financeiro é local', () => {
    const f=fixture('local')
    expect(f.service.listAccounts(data)).toEqual([{id:1}])
    expect(f.local.listAccounts).toHaveBeenCalledWith(data)
    expect(f.remote.bankList).not.toHaveBeenCalled()
  })
  it('usa LAN exclusivamente quando a fonte financeira é central', async () => {
    const f=fixture('central-active')
    expect(await f.service.confirmImport(data)).toEqual({imported:2})
    expect(f.remote.bankConfirm).toHaveBeenCalledWith(data)
    expect(f.local.confirmImport).not.toHaveBeenCalled()
  })
  it('não usa fallback local quando o servidor está bloqueado', () => {
    const f=fixture('central-unavailable')
    expect(()=>f.service.confirmImport(data)).toThrow(/Nenhum dado foi gravado localmente/)
    expect(f.local.confirmImport).not.toHaveBeenCalled()
    expect(f.remote.bankConfirm).not.toHaveBeenCalled()
  })
})