import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const localRequire = createRequire(import.meta.url)
const ExcelJS = localRequire('exceljs')
const Database = localRequire('better-sqlite3')

function loadService(fileName: string, exportName: string, db?: any) {
  const source = readFileSync(resolve(here, '../electron/services/', fileName), 'utf8')
  const mod = { exports: {} as any }
  const fakeRequire = (id: string): any => {
    if (id === 'electron') return { dialog: { showOpenDialog: vi.fn() } }
    if (id === './spreadsheet-reader.cjs' || id === './spreadsheet-guard.cjs' || id === './domain-core.cjs') {
      return localRequire(resolve(here, '../electron/services/', id))
    }
    return localRequire(id)
  }
  new Function('require', 'module', 'exports', source)(fakeRequire, mod, mod.exports)
  return new mod.exports[exportName](db === undefined ? undefined : { db })
}

function fixtureDatabase() {
  const sqlite = new Database(':memory:')
  sqlite.exec([
    'CREATE TABLE empresas(id INTEGER PRIMARY KEY, razao_social TEXT, nome_fantasia TEXT, status TEXT, deleted_at TEXT);',
    "INSERT INTO empresas(id,razao_social,status) VALUES(7,'Construtora de teste','ativa');",
    'CREATE TABLE configuracoes(chave TEXT PRIMARY KEY, valor TEXT);',
    'CREATE TABLE importacoes(id INTEGER PRIMARY KEY, arquivo TEXT, hash TEXT, aba TEXT, status TEXT, resumo TEXT, concluida_em TEXT);',
    'CREATE TABLE importacao_linhas(importacao_id INTEGER, competencia TEXT, celula TEXT, tipo TEXT, nome_origem TEXT, valor_centavos INTEGER, dados_brutos TEXT, entidade_tipo TEXT, entidade_id INTEGER, status TEXT);',
    'CREATE TABLE categorias_financeiras(id INTEGER PRIMARY KEY, nome TEXT, natureza TEXT, grupo_dre TEXT, ativa INTEGER);',
    'CREATE TABLE contas(id INTEGER PRIMARY KEY, tipo TEXT, empresa_id INTEGER, obra_id INTEGER, fornecedor_id INTEGER, cliente_id INTEGER, categoria_id INTEGER, descricao TEXT, competencia TEXT, vencimento TEXT, valor_bruto_centavos INTEGER, valor_centavos INTEGER, status TEXT, origem_tipo TEXT, origem_id INTEGER);',
  ].join('\n'))
  const save = vi.fn((table: string, data: Record<string, any>) => {
    const keys = Object.keys(data)
    const sql = 'INSERT INTO ' + table + '(' + keys.join(',') + ') VALUES (' + keys.map(() => '?').join(',') + ')'
    const result = sqlite.prepare(sql).run(...keys.map(key => data[key]))
    return { id: Number(result.lastInsertRowid), ...data }
  })
  return { sqlite, adapter: { db: sqlite, save } }
}

async function writeFile(dir: string, extension: string) {
  const file = join(dir, 'cliente.' + extension)
  const book = new ExcelJS.Workbook()
  if (extension !== 'csv') book.addWorksheet('Aba vazia')
  const sheet = book.addWorksheet('Dados')
  sheet.addRow(['descricao', 'valor'])
  sheet.addRow(['Cimento para obra', 125.5])
  if (extension === 'csv') await book.csv.writeFile(file)
  else await book.xlsx.writeFile(file)
  return file
}

describe('regressão da leitura ExcelJS no importador', () => {
  it.each(['xlsx', 'xlsm', 'csv'])('analisa %s, mapeia, prevê e confirma apenas após revisão em SQLite', async extension => {
    const dir = mkdtempSync(join(tmpdir(), 'importador-real-'))
    const { sqlite, adapter } = fixtureDatabase()
    try {
      const file = await writeFile(dir, extension)
      const importer = loadService('universal-import-service.cjs', 'UniversalImportService', adapter)
      const analyzed = await importer.analyze(file)
      expect(analyzed.sheets).toHaveLength(1)
      const expectedSheet = extension === 'csv' ? 'sheet1' : 'Dados'
      expect(analyzed.sheets[0].name).toBe(expectedSheet)
      expect(analyzed.sheets[0].headers).toEqual(['descricao', 'valor'])
      const options = { sheet: expectedSheet, area: 'financeiro', companyId: 7 }
      const onlyMapping = await importer.preview(analyzed.token, { ...options, mappingOnly: true })
      expect(onlyMapping.mapping.descricao).toBe('descricao')
      expect(onlyMapping.mapping.valor).toBe('valor')
      const preview = await importer.preview(analyzed.token, options)
      expect(preview.total).toBe(1)
      expect(preview.invalid).toBe(0)
      expect(preview.importable).toBe(1)
      expect(adapter.save).not.toHaveBeenCalled()
      const result = await importer.commit(analyzed.token, options)
      expect(result.imported).toBe(1)
      expect(sqlite.prepare('SELECT COUNT(*) AS n FROM contas').get().n).toBe(1)
      const account = sqlite.prepare('SELECT empresa_id, descricao, valor_centavos FROM contas').get()
      expect(account).toMatchObject({ empresa_id: 7, descricao: 'Cimento para obra', valor_centavos: 12550 })
      expect(sqlite.prepare('SELECT COUNT(*) AS n FROM importacao_linhas').get().n).toBe(1)
      await expect(importer.commit(analyzed.token, options)).rejects.toThrow(/expirou|novamente/i)
    } finally {
      sqlite.close()
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('ignora abas vazias e rejeita arquivo sem cabeçalhos com erro legível', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'importador-vazio-'))
    const { sqlite, adapter } = fixtureDatabase()
    try {
      const file = join(dir, 'sem-dados.xlsx')
      const workbook = new ExcelJS.Workbook()
      workbook.addWorksheet('Somente vazia')
      await workbook.xlsx.writeFile(file)
      const importer = loadService('universal-import-service.cjs', 'UniversalImportService', adapter)
      await expect(importer.analyze(file)).rejects.toThrow(/aba|dados|cabeçalhos|vazia|planilha/i)
      expect(adapter.save).not.toHaveBeenCalled()
    } finally {
      sqlite.close()
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('importador de folha reconhece as worksheets do ExcelJS e ignora abas vazias', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'import-folha-real-'))
    try {
      const file = join(dir, 'folha.xlsx')
      const workbook = new ExcelJS.Workbook()
      workbook.addWorksheet('Vazia')
      const sheet = workbook.addWorksheet('Folha')
      sheet.addRow(['Tipo', 'Funcionário / despesa', 'Salário'])
      sheet.addRow(['Funcionário', 'Ana de teste', 2000])
      await workbook.xlsx.writeFile(file)
      const importer = loadService('payroll-import-file-service.cjs', 'PayrollImportFileService')
      const analyzed = await importer.analyze(file)
      expect(analyzed.sheets).toHaveLength(1)
      expect(analyzed.sheets[0].name).toBe('Folha')
      const preview = await importer.preview(analyzed.token, { sheet: 'Folha' })
      expect(preview.rows).toHaveLength(1)
      expect(preview.rows[0].funcionario).toBe('Ana de teste')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
