import { describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { BankFinanceSourceService } = require('./bank-finance-source.cjs')

describe('B0-B2 roteamento canônico de contas bancárias', () => {
  const data={empresaId:5,contaBancariaId:2}
  function fixture(state:string) {
    const local={ listAccounts:vi.fn().mockReturnValue([{id:1}]),confirmImport:vi.fn().mockReturnValue({imported:1}),assignPlannedBank:vi.fn().mockReturnValue({conta_id:5,conta_bancaria_id:2}),cashFlow:vi.fn().mockReturnValue({realizedCents:100}),closePeriod:vi.fn().mockReturnValue({status:'closed'}),simulateCashFlow:vi.fn().mockReturnValue({projectedEndCents:150}) }
    const remote={ bankList:vi.fn().mockResolvedValue([{id:2}]),bankConfirm:vi.fn().mockResolvedValue({imported:2}),bankPlanAssignment:vi.fn().mockResolvedValue({conta_id:5,conta_bancaria_id:2}),bankCashFlow:vi.fn().mockResolvedValue({realizedCents:200}),bankPeriodClose:vi.fn().mockResolvedValue({status:'closed'}),bankSimulateCash:vi.fn().mockResolvedValue({projectedEndCents:250}) }
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
  it('atribui banco previsto e calcula fluxo usando fonte local autorizada', () => {
    const f=fixture('local')
    const payload={empresaId:1,contaId:5,contaBancariaId:2}
    expect(f.service.assignPlannedBank(payload)).toEqual({conta_id:5,conta_bancaria_id:2})
    expect(f.service.cashFlow({empresaId:1})).toEqual({realizedCents:100})
    expect(f.remote.bankPlanAssignment).not.toHaveBeenCalled()
    expect(f.remote.bankCashFlow).not.toHaveBeenCalled()
  })
  it('atribui banco e calcula fluxo exclusivamente via servidor quando central ativo', async () => {
    const f=fixture('central-active')
    const payload={empresaId:1,contaId:5,contaBancariaId:2}
    expect(await f.service.assignPlannedBank(payload)).toEqual({conta_id:5,conta_bancaria_id:2})
    expect(await f.service.cashFlow({empresaId:1})).toEqual({realizedCents:200})
    expect(f.local.assignPlannedBank).not.toHaveBeenCalled()
    expect(f.local.cashFlow).not.toHaveBeenCalled()
  })
  it('não permite aplicar a previsão no SQLite local se a fonte central estiver indisponível',()=>{
    const f=fixture('central-unavailable')
    expect(()=>f.service.assignPlannedBank({empresaId:1,contaId:5,contaBancariaId:2})).toThrow(/Nenhum dado foi gravado localmente/)
    expect(f.local.assignPlannedBank).not.toHaveBeenCalled()
  })
  it('P2 usa servidor central para fechamento e simulação, sem fallback local', async()=>{
    const f=fixture('central-active')
    const close={empresaId:1,period:'2026-11',acknowledgePending:true}
    expect(await f.service.closePeriod(close)).toEqual({status:'closed'})
    expect(await f.service.simulateCashFlow({empresaId:1})).toEqual({projectedEndCents:250})
    expect(f.local.closePeriod).not.toHaveBeenCalled()
    expect(f.local.simulateCashFlow).not.toHaveBeenCalled()
    const blocked=fixture('central-unavailable')
    expect(()=>blocked.service.closePeriod(close)).toThrow(/Nenhum dado foi gravado localmente/)
    expect(blocked.local.closePeriod).not.toHaveBeenCalled()
  })
  it('não usa fallback local quando o servidor está bloqueado', () => {
    const f=fixture('central-unavailable')
    expect(()=>f.service.confirmImport(data)).toThrow(/Nenhum dado foi gravado localmente/)
    expect(f.local.confirmImport).not.toHaveBeenCalled()
    expect(f.remote.bankConfirm).not.toHaveBeenCalled()
  })
})