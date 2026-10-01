import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const { RhSourceService } = require('./rh-source-service.cjs')

function fixture(state='local') {
  const localPayroll={
    getEmployee:vi.fn((payload:any)=>({source:'local-payroll',...payload})),
    saveVariable:vi.fn((payload:any)=>({source:'local-variable',...payload})),
    removeVariable:vi.fn((id:number)=>({source:'local-remove',id})),
    confirm:vi.fn((payload:any)=>({source:'local-confirm',...payload})),
    pending:vi.fn((competencia:string)=>[{source:'local-pending',competencia}])
  }
  const localTime={
    get:vi.fn((payload:any)=>({source:'local-time',...payload})),
    autoFill:vi.fn((payload:any)=>({source:'local-autofill',...payload})),
    save:vi.fn((payload:any)=>({source:'local-save',...payload})),
    documentContext:vi.fn((payload:any)=>({source:'local-document',...payload}))
  }
  const lanClient={
    payrollEmployee:vi.fn(async(payload:any)=>({source:'central-payroll',...payload,sheet:{id:21,revision:3}})),
    payrollSaveVariable:vi.fn(async(payload:any)=>({source:'central-variable',...payload})),
    payrollRemoveVariable:vi.fn(async(id:number)=>({source:'central-remove',id})),
    payrollConfirm:vi.fn(async(payload:any)=>({source:'central-confirm',...payload,sheetRevision:Number(payload.expectedRevision||0)+1})),
    payrollPending:vi.fn(async(competencia:string)=>[{source:'central-pending',competencia}]),
    timeGet:vi.fn(async(payload:any)=>({source:'central-time',...payload,point:{id:31,revision:5},marks:[]})),
    timeAutoFill:vi.fn(async(payload:any)=>({source:'central-autofill',...payload,point:{id:31,revision:Number(payload.expectedRevision||0)+1},marks:[]})),
    timeSave:vi.fn(async(payload:any)=>({source:'central-save',...payload,point:{id:31,revision:Number(payload.expectedRevision||0)+1},marks:[]})),
    timeDocumentContext:vi.fn(async(payload:any)=>({source:'central-document',...payload}))
  }
  const moduleStorage={state:vi.fn(()=>({state}))}
  return {service:new RhSourceService({localPayroll,localTime,lanClient,moduleStorage}),localPayroll,localTime,lanClient,moduleStorage}
}

describe('RhSourceService',()=>{
  it('preserva folha e ponto locais em modo local ou migration-required', async()=>{
    for(const state of ['local','migration-required']){
      const f=fixture(state)
      await expect(f.service.getEmployee({funcionario_id:1,competencia:'2026-10'})).resolves.toMatchObject({source:'local-payroll'})
      await expect(f.service.timeGet({funcionario_id:1,competencia:'2026-10'})).resolves.toMatchObject({source:'local-time'})
      expect(f.lanClient.payrollEmployee).not.toHaveBeenCalled()
      expect(f.lanClient.timeGet).not.toHaveBeenCalled()
    }
  })

  it('usa somente a fonte LAN quando RH está central-active', async()=>{
    const f=fixture('central-active')
    await expect(f.service.getEmployee({funcionario_id:2,competencia:'2026-10'})).resolves.toMatchObject({source:'central-payroll'})
    await expect(f.service.confirm({funcionario_id:2,competencia:'2026-10',quinzena:1})).resolves.toMatchObject({source:'central-confirm'})
    await expect(f.service.timeGet({funcionario_id:2,competencia:'2026-10'})).resolves.toMatchObject({source:'central-time'})
    await expect(f.service.timeSave({funcionario_id:2,competencia:'2026-10',marks:[]})).resolves.toMatchObject({source:'central-save'})
    await expect(f.service.timeDocumentContext({funcionario_id:2,competencia:'2026-10'})).resolves.toMatchObject({source:'central-document'})
    expect(f.localPayroll.getEmployee).not.toHaveBeenCalled()
    expect(f.localPayroll.confirm).not.toHaveBeenCalled()
    expect(f.localTime.save).not.toHaveBeenCalled()
  })

  it('confirma folha usando a revisão da ficha observada e avança o cache após sucesso', async()=>{
    const f=fixture('central-active')
    await f.service.getEmployee({funcionario_id:2,competencia:'2026-10'})
    await f.service.confirm({funcionario_id:2,competencia:'2026-10',quinzena:1})
    expect(f.lanClient.payrollConfirm).toHaveBeenLastCalledWith(expect.objectContaining({expectedRevision:3}))
    await f.service.confirm({funcionario_id:2,competencia:'2026-10',quinzena:2})
    expect(f.lanClient.payrollConfirm).toHaveBeenLastCalledWith(expect.objectContaining({expectedRevision:4}))
  })

  it('autofill e save de ponto reutilizam e avançam a revisão mensal observada', async()=>{
    const f=fixture('central-active')
    await f.service.timeGet({funcionario_id:2,competencia:'2026-10'})
    await f.service.timeAutoFill({funcionario_id:2,competencia:'2026-10'})
    expect(f.lanClient.timeAutoFill).toHaveBeenLastCalledWith(expect.objectContaining({expectedRevision:5}))
    await f.service.timeSave({funcionario_id:2,competencia:'2026-10',marks:[]})
    expect(f.lanClient.timeSave).toHaveBeenLastCalledWith(expect.objectContaining({expectedRevision:6}))
  })

  it('central-ready bloqueia qualquer fallback local silencioso', async()=>{
    const f=fixture('central-ready')
    await expect(f.service.saveVariable({funcionario_id:3,competencia:'2026-10'})).rejects.toThrow(/nenhum dado será salvo localmente/i)
    await expect(f.service.timeAutoFill({funcionario_id:3,competencia:'2026-10'})).rejects.toThrow(/nenhum dado será salvo localmente/i)
    expect(f.localPayroll.saveVariable).not.toHaveBeenCalled()
    expect(f.localTime.autoFill).not.toHaveBeenCalled()
    expect(f.lanClient.payrollSaveVariable).not.toHaveBeenCalled()
    expect(f.lanClient.timeAutoFill).not.toHaveBeenCalled()
  })
})
