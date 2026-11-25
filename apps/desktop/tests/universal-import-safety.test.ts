import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const originalRequire = createRequire(import.meta.url)

// Execute the real CJS service without requiring Electron or accessing client data.
function serviceModule(): any {
  const source = readFileSync(resolve(here, '../electron/services/universal-import-service.cjs'), 'utf8')
  const mod = { exports: {} as any }
  const fakeRequire = (id: string): any => {
    if (id === './domain-core.cjs') return originalRequire('../electron/services/domain-core.cjs')
    if (id === 'electron') return { dialog: {} }
    if (id === './spreadsheet-guard.cjs') return { assertSpreadsheetInput: () => {} }
    if (id === './spreadsheet-reader.cjs') return {
      sheetRows: (sheet: any) => sheet.rows,
      rowsAsObjects: (rows: any[][], headerIndex: number) => {
        const headers = rows[headerIndex]
        return rows.slice(headerIndex + 1).map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])))
      },
      parseExcelDate: () => null,
    }
    return originalRequire(id)
  }
  new Function('require', 'module', 'exports', source)(fakeRequire, mod, mod.exports)
  return mod.exports
}

function fixture(rows: any[][], area = 'financeiro', foreignWork = false) {
  const records: Array<{ table: string; data: any }> = []
  const company = { id: 7, razao_social: 'Empresa correta', status: 'ativa' }
  const db: any = {
    save: vi.fn((table: string, data: any) => {
      const entity = { id: records.length + 10, ...data }
      records.push({ table, data: entity })
      return entity
    }),
    db: {
      prepare: (sql: string) => ({
        get: (...args: any[]) => {
          if (sql.includes('FROM empresas')) return Number(args[0]) === 7 ? company : undefined
          if (sql.includes('FROM obras') && foreignWork) {
            // A homonymous work belongs to another company; it must never be reused.
            if (!sql.includes('empresa_id=?')) return { id: 888, empresa_id: 99, nome: 'Obra repetida' }
            return undefined
          }
          return undefined
        },
        run: () => ({}),
      }),
      transaction: (handler: () => any) => handler,
    },
  }
  const headers = area === 'obras' ? ['nome'] : ['descricao', 'valor']
  const service = new (serviceModule().UniversalImportService)({ db })
  service.pending.set('arquivo', {
    hash: 'hash-fixture',
    filePath: 'arquivo.xlsx',
    workbook: { getWorksheet: () => ({ rows: [headers, ...rows] }) },
    sheets: [{ name: 'Dados', headerIndex: 0, headers, area }],
  })
  const options = { sheet: 'Dados', area, companyId: 7 }
  return { service, db, options, records }
}

describe('segurança da importação universal', () => {
  it('impede importação local de dados centrais sem fallback silencioso', () => {
    const { service, db }=fixture([['Conta',10]])
    service.moduleStorage={state:()=>({state:'central-active'})}
    expect(()=>service.assertLocalArea('financeiro')).toThrow(/servidor central/i)
    expect(db.save).not.toHaveBeenCalled()
    service.moduleStorage={state:()=>({state:'local'})}
    expect(()=>service.assertLocalArea('financeiro')).not.toThrow()
  })

  it('exige escolha explícita de empresa existente na prévia e no commit, sem criar empresa', async () => {
    const { service, db, options } = fixture([['Conta', 10]])
    await expect(service.preview('arquivo', { ...options, companyId: undefined })).rejects.toThrow(/empresa/i)
    await expect(service.commit('arquivo', { ...options, companyId: undefined })).rejects.toThrow(/empresa/i)
    await expect(service.preview('arquivo', { ...options, companyId: 999 })).rejects.toThrow(/empresa/i)
    await expect(service.commit('arquivo', { ...options, companyId: 999 })).rejects.toThrow(/empresa/i)
    expect(db.save).not.toHaveBeenCalled()
  })

  it('conta todas as 241 linhas da planilha e permite revisar a última página', async () => {
    const rows = Array.from({ length: 241 }, (_, i) => [`Despesa ${i + 1}`, i + 1])
    const { service, options } = fixture(rows)
    const first = await service.preview('arquivo', { ...options, page: 1, pageSize: 25 })
    expect(first.total).toBe(241)
    expect(first.importable).toBe(241)
    expect(first.invalid).toBe(0)
    expect(first.rows).toHaveLength(25)
    const last = await service.preview('arquivo', { ...options, page: 10, pageSize: 25 })
    expect(last.total).toBe(241)
    expect(last.rows).toHaveLength(16)
    expect(last.rows[15].descricao).toBe('Despesa 241')
  })

  it('bloqueia o commit se a linha final for inválida e não grava dados parciais', async () => {
    const rows = Array.from({ length: 220 }, (_, i) => [`Despesa ${i + 1}`, i === 219 ? 0 : 10])
    const { service, db, options } = fixture(rows)
    const preview = await service.preview('arquivo', options)
    expect(preview.total).toBe(220)
    expect(preview.invalid).toBe(1)
    await expect(service.commit('arquivo', options)).rejects.toThrow(/linha|corrij|inválid/i)
    expect(db.save).not.toHaveBeenCalled()
  })

  it('usa empresa selecionada e não associa obra homônima de outro cadastro', async () => {
    const { service, options, records } = fixture([['Obra repetida']], 'obras', true)
    const result = await service.commit('arquivo', options)
    expect(result.imported).toBe(1)
    expect(records.filter(r => r.table === 'empresas')).toHaveLength(0)
    const works = records.filter(r => r.table === 'obras')
    expect(works).toHaveLength(1)
    expect(works[0].data.empresa_id).toBe(7)
  })
})
