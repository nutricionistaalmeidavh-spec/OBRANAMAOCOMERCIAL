import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const originalRequire = createRequire(import.meta.url)
function createService(rows: any[][], headers = ['descricao', 'valor']) {
  const source = readFileSync(resolve(here, '../electron/services/universal-import-service.cjs'), 'utf8')
  const mod = { exports: {} as any }
  const fakeRequire = (id: string): any => {
    if (id === 'electron') return { dialog: { showSaveDialog: vi.fn() } }
    if (id === './spreadsheet-guard.cjs') return { assertSpreadsheetInput: () => {} }
    if (id === './spreadsheet-reader.cjs') return {
      sheetRows: (s: any) => s.rows,
      rowsAsObjects: (all: any[][], headerIndex: number) => all.slice(headerIndex + 1).map(row => Object.fromEntries(all[headerIndex].map((header, index) => [header, row[index] ?? '']))),
      parseExcelDate: () => null,
    }
    return originalRequire(id)
  }
  new Function('require', 'module', 'exports', source)(fakeRequire, mod, mod.exports)
  const config = new Map<string, string>()
  const stmt = (sql: string) => ({
    get: (...args: any[]) => {
      if (sql.includes('FROM empresas')) return Number(args[0]) === 7 ? { id: 7, razao_social: 'Empresa 7', status: 'ativa' } : undefined
      if (sql.includes('FROM configuracoes')) return config.has(args[0]) ? { valor: config.get(args[0]) } : undefined
      return undefined
    },
    run: (...args: any[]) => {
      if (sql.includes('INTO configuracoes')) config.set(args[0], args[1])
      return { changes: 1 }
    },
  })
  const db: any = { db: { prepare: vi.fn(stmt), transaction: (fn: any) => fn }, save: vi.fn() }
  const service = new mod.exports.UniversalImportService({ db })
  service.pending.set('token', {
    hash: 'abc', filePath: 'teste.xlsx', workbook: { getWorksheet: () => ({ rows: [headers, ...rows] }) },
    sheets: [{ name: 'Dados', headerIndex: 0, headers, area: 'financeiro' }],
  })
  return { service, db, config }
}

describe('assistente universal P0 P1 P2', () => {
  it('detecta registros repetidos dentro do arquivo antes de permitir gravar', async () => {
    const { service, db } = createService([['Água', 27], ['Água', 27], ['Energia', 34]])
    const preview = await service.preview('token', { sheet: 'Dados', area: 'financeiro', companyId: 7 })
    expect(preview.duplicates).toBe(1)
    expect(preview.invalid).toBe(1)
    expect(preview.issues.some((x: any) => /repetid/i.test(x.errors.join(' ')))).toBe(true)
    await expect(service.commit('token', { sheet: 'Dados', area: 'financeiro', companyId: 7 })).rejects.toThrow()
    expect(db.save).not.toHaveBeenCalled()
  })

  it('salva e recupera perfis de colunas por empresa e estrutura, sem acesso cruzado', async () => {
    const { service } = createService([], ['Despesa', 'Montante'])
    await service.saveMapping({ companyId: 7, area: 'financeiro', headers: ['Despesa', 'Montante'], mapping: { descricao: 'Despesa', valor: 'Montante' } })
    const saved = await service.preview('token', { sheet: 'Dados', area: 'financeiro', companyId: 7, mappingOnly: true })
    expect(saved.mapping.descricao).toBe('Despesa')
    expect(saved.mapping.valor).toBe('Montante')
    expect(saved.mappingSource).toBe('saved')
    await expect(service.saveMapping({ companyId: 8, area: 'financeiro', headers: ['Despesa', 'Montante'], mapping: { descricao: 'Despesa', valor: 'Montante' } })).rejects.toThrow(/empresa/i)
    expect(service.getSavedMapping({ companyId: 7, area: 'financeiro', headers: ['Outra'] })).toBeNull()
  })

  it('exige que campos mapeados correspondam a colunas reais', async () => {
    const { service } = createService([['Entrada', 12]])
    await expect(service.saveMapping({ companyId: 7, area: 'financeiro', headers: ['descricao', 'valor'], mapping: { descricao: 'inexistente' } })).rejects.toThrow(/coluna/i)
    await expect(service.commit('token', { sheet: 'Dados', area: 'financeiro', companyId: 7, mapping: { descricao: 'inexistente', valor: 'valor' } })).rejects.toThrow()
  })

  it('retorna todas as divergências para o CSV, sem cortar após 20 linhas', async () => {
    const { service } = createService(Array.from({ length: 37 }, (_, index) => ['Conta ' + index, 0]))
    const partial = await service.preview('token', { sheet: 'Dados', area: 'financeiro', companyId: 7 })
    const complete = await service.preview('token', { sheet: 'Dados', area: 'financeiro', companyId: 7, allIssues: true })
    expect(partial.issues).toHaveLength(20)
    expect(complete.issues).toHaveLength(37)
    expect(complete.invalid).toBe(37)
  })

  it('reaproveita perfil quando as colunas são reordenadas sem alterar o escopo da empresa', async () => {
    const { service } = createService([], ['Despesa', 'Montante'])
    await service.saveMapping({ companyId: 7, area: 'financeiro', headers: ['Despesa', 'Montante'], mapping: { descricao: 'Despesa', valor: 'Montante' } })
    const profile = service.getSavedMapping({ companyId: 7, area: 'financeiro', headers: ['Montante', 'Despesa'] })
    expect(profile?.descricao).toBe('Despesa')
    expect(profile?.valor).toBe('Montante')
  })

  it('permite gerar modelo e relatório de erros pelo serviço do desktop', () => {
    const { service } = createService([['Despesa', 0]])
    expect(typeof service.saveTemplate).toBe('function')
    expect(typeof service.exportIssues).toBe('function')
    expect(typeof service.analyze).toBe('function')
  })
})
