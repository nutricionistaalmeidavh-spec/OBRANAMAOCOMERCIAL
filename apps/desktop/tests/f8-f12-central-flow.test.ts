import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const { DataAccessService } = require('../electron/services/data-access-service.cjs')
const { FieldSourceService } = require('../electron/services/field-source-service.cjs')
const { PlanningSourceService } = require('../electron/services/planning-source-service.cjs')
const { FinanceSourceService } = require('../electron/services/finance-source-service.cjs')
const { RhSourceService } = require('../electron/services/rh-source-service.cjs')

function centralFixture() {
  const storage = { state: vi.fn(() => ({ mode: 'server', operationalMode: 'lan-client', baseUrl: 'http://127.0.0.1:8765' })) }
  const moduleStorage = { state: vi.fn((module: string) => ({ module, state: 'central-active', localRecords: 0 })) }
  const db = {
    list: vi.fn(() => [{ source: 'local' }]),
    get: vi.fn(() => ({ source: 'local' })),
    save: vi.fn(() => ({ source: 'local' })),
    remove: vi.fn(() => true),
    accountPayment: vi.fn(() => ({ source: 'local' })),
    dre: vi.fn(() => [{ source: 'local' }]),
    dashboard: vi.fn(() => ({ source: 'local' }))
  }
  const remote = {
    list: vi.fn(async (table: string) => [{ table, source: 'lan' }]),
    get: vi.fn(async (table: string, id: number) => ({ table, id, source: 'lan' })),
    save: vi.fn(async (table: string, data: any) => ({ table, ...data, source: 'lan' })),
    remove: vi.fn(async () => true),
    saveDailyReport: vi.fn(async (payload: any) => ({ ...payload, source: 'lan-rdo' })),
    planningOverview: vi.fn(async (obraId: number) => ({ obraId, source: 'lan-planning' })),
    accountPayment: vi.fn(async (id: number, payment: any, requestId: string) => ({ id, ...payment, requestId, source: 'lan-finance' })),
    financeDre: vi.fn(async () => [{ source: 'lan-finance' }]),
    financeDashboard: vi.fn(async () => ({ source: 'lan-finance' })),
    payrollEmployee: vi.fn(async (payload: any) => ({ ...payload, source: 'lan-rh' })),
    payrollSaveVariable: vi.fn(async (payload: any) => ({ ...payload, source: 'lan-rh' })),
    payrollRemoveVariable: vi.fn(async (id: number) => ({ id, source: 'lan-rh' })),
    payrollConfirm: vi.fn(async (payload: any) => ({ ...payload, source: 'lan-rh' })),
    payrollPending: vi.fn(async (competencia: string) => [{ competencia, source: 'lan-rh' }]),
    timeGet: vi.fn(async (payload: any) => ({ ...payload, source: 'lan-rh-time' })),
    timeAutoFill: vi.fn(async (payload: any) => ({ ...payload, source: 'lan-rh-time' })),
    timeSave: vi.fn(async (payload: any) => ({ ...payload, source: 'lan-rh-time' })),
    timeDocumentContext: vi.fn(async (payload: any) => ({ ...payload, source: 'lan-rh-document' }))
  }
  const dataAccess = new DataAccessService({ db, storage, remote, moduleStorage })
  const localField = { saveDailyReport: vi.fn(() => ({ source: 'local-rdo' })) }
  const localPlanning = { overview: vi.fn(() => ({ source: 'local-planning' })) }
  const localPayroll = {
    getEmployee: vi.fn(() => ({ source: 'local-rh' })), saveVariable: vi.fn(), removeVariable: vi.fn(), confirm: vi.fn(), pending: vi.fn()
  }
  const localTime = { get: vi.fn(() => ({ source: 'local-time' })), autoFill: vi.fn(), save: vi.fn(), documentContext: vi.fn() }
  const field = new FieldSourceService({ local: localField, lanClient: remote, moduleStorage })
  const planning = new PlanningSourceService({ local: localPlanning, lanClient: remote, moduleStorage })
  const finance = new FinanceSourceService({ local: db, lanClient: remote, moduleStorage, randomUUID: () => 'integrated-payment-id' })
  const rh = new RhSourceService({ localPayroll, localTime, lanClient: remote, moduleStorage })
  return { db, remote, dataAccess, field, planning, finance, rh, localField, localPlanning, localPayroll, localTime, moduleStorage }
}

describe('F8-F12 central Desktop flow', () => {
  it('central-active roteia core/operação/planejamento/financeiro/RH ao servidor sem escrever no SQLite local', async () => {
    const f = centralFixture()
    await expect(f.dataAccess.list('obras', { empresa_id: 1 })).resolves.toEqual([{ table: 'obras', source: 'lan' }])
    await expect(f.dataAccess.save('rdos', { obra_id: 10, atividades: 'QA' })).resolves.toMatchObject({ table: 'rdos', source: 'lan' })
    await expect(f.dataAccess.save('cronograma_etapas', { obra_id: 10, nome: 'Etapa QA' })).resolves.toMatchObject({ table: 'cronograma_etapas', source: 'lan' })
    await expect(f.dataAccess.save('contas', { empresa_id: 1, descricao: 'Conta QA' })).resolves.toMatchObject({ table: 'contas', source: 'lan' })
    await expect(f.dataAccess.save('funcionarios', { empresa_id: 1, nome: 'Funcionário QA' })).resolves.toMatchObject({ table: 'funcionarios', source: 'lan' })

    await expect(f.field.saveDailyReport({ obra_id: 10 })).resolves.toMatchObject({ source: 'lan-rdo' })
    await expect(f.planning.overview(10)).resolves.toMatchObject({ source: 'lan-planning' })
    await expect(f.finance.dashboard({ empresa_id: 1 })).resolves.toMatchObject({ source: 'lan-finance' })
    await expect(f.rh.getEmployee({ funcionario_id: 7, competencia: '2026-10' })).resolves.toMatchObject({ source: 'lan-rh' })
    await expect(f.rh.timeGet({ funcionario_id: 7, competencia: '2026-10' })).resolves.toMatchObject({ source: 'lan-rh-time' })

    expect(f.db.list).not.toHaveBeenCalled()
    expect(f.db.save).not.toHaveBeenCalled()
    expect(f.localField.saveDailyReport).not.toHaveBeenCalled()
    expect(f.localPlanning.overview).not.toHaveBeenCalled()
    expect(f.localPayroll.getEmployee).not.toHaveBeenCalled()
    expect(f.localTime.get).not.toHaveBeenCalled()
  })

  it('central-ready bloqueia módulos antes de qualquer fallback local', async () => {
    const f = centralFixture()
    f.moduleStorage.state.mockImplementation((module: string) => ({ module, state: module === 'operation' ? 'central-active' : 'central-ready', localRecords: 0 }))
    await expect(f.dataAccess.save('funcionarios', { nome: 'Não salvar' })).rejects.toThrow(/RH central.*não está ativo|nenhum dado.*fallback/i)
    await expect(f.planning.overview(10)).rejects.toThrow(/Planejamento central.*não está ativo|fallback/i)
    await expect(f.finance.dashboard({ empresa_id: 1 })).rejects.toThrow(/Financeiro central.*não está ativo|fallback/i)
    await expect(f.rh.timeSave({ funcionario_id: 7, competencia: '2026-10', marks: [] })).rejects.toThrow(/RH central.*não está ativo|fallback/i)
    expect(f.db.save).not.toHaveBeenCalled()
    expect(f.localPlanning.overview).not.toHaveBeenCalled()
    expect(f.localTime.save).not.toHaveBeenCalled()
  })

  it('runtime principal usa RH central para folha/ponto e mantém documentos como saída local derivada', () => {
    const main = fs.readFileSync(path.resolve(import.meta.dirname, '../electron/main.cjs'), 'utf8')
    const documents = fs.readFileSync(path.resolve(import.meta.dirname, '../electron/services/rh-document-service.cjs'), 'utf8')
    expect(main).toContain("const { RhSourceService } = require('./services/rh-source-service.cjs')")
    expect(main).toContain("const { RhDocumentService } = require('./services/rh-document-service.cjs')")
    expect(main).toContain('payroll: rh')
    expect(main).toContain('generateDocuments: payload => rhDocuments.generateDocuments(payload)')
    expect(documents).toContain("storage: 'local-derived'")
    expect(documents).toContain('registeredInLocalDatabase: false')
  })

  it('mantém a publicação automática de release Desktop congelada no gate final', () => {
    const workflow = fs.readFileSync(path.resolve(import.meta.dirname, '../../../.github/workflows/commercial-desktop-ci.yml'), 'utf8')
    expect(workflow).toContain("DESKTOP_AUTO_RELEASE_ENABLED: 'false'")
    expect(workflow).toContain("env.DESKTOP_AUTO_RELEASE_ENABLED == 'true'")
  })
})
