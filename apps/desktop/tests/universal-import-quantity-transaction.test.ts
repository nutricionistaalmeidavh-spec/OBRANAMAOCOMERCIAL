import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const localRequire = createRequire(import.meta.url)
const Database = localRequire('better-sqlite3')

function fixture(dataRows: any[][]) {
  const sqlite = new Database(':memory:')
  sqlite.exec([
    'PRAGMA foreign_keys = ON;',
    'CREATE TABLE empresas(id INTEGER PRIMARY KEY, razao_social TEXT, nome_fantasia TEXT, status TEXT, deleted_at TEXT);',
    "INSERT INTO empresas(id,razao_social,status) VALUES (7,'Morais Coutinho','ativa');",
    'CREATE TABLE configuracoes(chave TEXT PRIMARY KEY, valor TEXT);',
    'CREATE TABLE importacoes(id INTEGER PRIMARY KEY, arquivo TEXT, hash TEXT, aba TEXT, status TEXT, resumo TEXT, concluida_em TEXT);',
    'CREATE TABLE importacao_linhas(importacao_id INTEGER, competencia TEXT, celula TEXT, tipo TEXT, nome_origem TEXT, valor_centavos INTEGER, dados_brutos TEXT, entidade_tipo TEXT, entidade_id INTEGER, status TEXT);',
    'CREATE TABLE obras(id INTEGER PRIMARY KEY, empresa_id INTEGER, nome TEXT, status TEXT, deleted_at TEXT);',
    'CREATE TABLE fornecedores(id INTEGER PRIMARY KEY,empresa_id INTEGER,deleted_at TEXT);CREATE TABLE pedidos_compra(id INTEGER PRIMARY KEY,obra_id INTEGER);CREATE TABLE pedido_compra_itens(id INTEGER PRIMARY KEY,pedido_compra_id INTEGER,descricao TEXT,unidade TEXT);',
    'CREATE TABLE frentes_obra(id INTEGER PRIMARY KEY, obra_id INTEGER, nome TEXT, status TEXT, deleted_at TEXT);',
    "CREATE TABLE movimentacoes_estoque(id INTEGER PRIMARY KEY, obra_id INTEGER, frente_id INTEGER, descricao TEXT NOT NULL, unidade TEXT, quantidade REAL NOT NULL CHECK(quantidade > 0), tipo TEXT NOT NULL CHECK(tipo IN ('entrada','saida','ajuste')), data TEXT, observacoes TEXT);",
  ].join('\n'))

  for(const name of ['029_material_catalog.sql','030_stock_revision.sql','031_material_reclassification.sql'])sqlite.exec(readFileSync(resolve(here,'../database/migrations',name),'utf8'))
  const save = vi.fn((table: string, data: Record<string, any>) => {
    const keys = Object.keys(data)
    const sql = 'INSERT INTO ' + table + '(' + keys.join(',') + ') VALUES (' + keys.map(() => '?').join(',') + ')'
    const inserted = sqlite.prepare(sql).run(...keys.map(key => data[key]))
    return { id: Number(inserted.lastInsertRowid), ...data }
  })
  const source = readFileSync(resolve(here, '../electron/services/universal-import-service.cjs'), 'utf8')
  const mod = { exports: {} as any }
  const fakeRequire = (id: string): any => {
    if (id === './domain-core.cjs') return localRequire('../electron/services/domain-core.cjs')
    if (id === 'electron') return { dialog: {} }
    if (id === './spreadsheet-guard.cjs') return { assertSpreadsheetInput: () => {} }
    if (id === './spreadsheet-reader.cjs') return {
      sheetRows: (sheet: any) => sheet.rows,
      rowsAsObjects: (rows: any[][], headerIndex: number) => rows.slice(headerIndex + 1).map(row =>
        Object.fromEntries(rows[headerIndex].map((header: string, index: number) => [header, row[index] ?? '']))),
      parseExcelDate: () => null,
    }
    return localRequire(id)
  }
  new Function('require', 'module', 'exports', source)(fakeRequire, mod, mod.exports)
  const importer = new mod.exports.UniversalImportService({ db: { db: sqlite, save } })
  const headers = ['obra', 'frente', 'descricao', 'unidade', 'quantidade', 'tipo']
  importer.pending.set('token', {
    hash: 'hash-da-aba', filePath: 'estoque.xlsx',
    workbook: { getWorksheet: () => ({ rows: [headers, ...dataRows] }) },
    sheets: [{ name: 'Estoque', headerIndex: 0, headers, area: 'estoque' }],
  })
  const options = { sheet: 'Estoque', area: 'estoque', companyId: 7 }
  return { sqlite, importer, save, options, module: mod.exports }
}

function line(description: string, quantity: unknown) {
  return ['Vila Real', 'Obra Geral', description, 'UND', quantity, 'entrada']
}

describe('P0/P1 importador universal: quantidades e atomicidade do estoque', () => {
  it('reverte lote com saída superior ao saldo existente', async()=>{const {sqlite,importer,options}=fixture([line('Tubo',2),['Vila Real','Obra Geral','Tubo','UND',3,'saida']]);try{await expect(importer.commit('token',options)).rejects.toThrow(/estoque negativo/);expect(sqlite.prepare('SELECT COUNT(*) n FROM movimentacoes_estoque').get().n).toBe(0)}finally{sqlite.close()}})
  it('normaliza valores brasileiros e preserva decimais de células numéricas', () => {
    const { sqlite, module } = fixture([])
    try {
      expect(module.parseQuantity('16,364')).toBeCloseTo(16.364)
      expect(module.parseQuantity('1.234,56')).toBeCloseTo(1234.56)
      expect(module.parseQuantity('0,5')).toBe(0.5)
      expect(module.parseQuantity(0.125)).toBe(0.125)
      expect(Number.isNaN(module.parseQuantity('não numérico'))).toBe(true)
    } finally { sqlite.close() }
  })

  it('reprova antes de gravar a linha 147 com quantidade zero, mesmo após 145 linhas válidas', async () => {
    const rows = Array.from({ length: 145 }, (_, index) => line('Item ' + index, index % 2 ? 1 : '0,5'))
    rows.push(line('Item inválido', '0'))
    const { sqlite, importer, save, options } = fixture(rows)
    try {
      const preview = await importer.preview('token', options)
      expect(preview.total).toBe(146)
      expect(preview.importable).toBe(145)
      expect(preview.invalid).toBe(1)
      expect(preview.issues).toEqual([expect.objectContaining({ line: 147, errors: [expect.stringMatching(/quantidade/i)] })])
      await expect(importer.commit('token', options)).rejects.toThrow(/linha 147.*quantidade/i)
      expect(save).not.toHaveBeenCalled()
      expect(sqlite.prepare('SELECT COUNT(*) AS n FROM importacoes').get().n).toBe(0)
    } finally { sqlite.close() }
  })

  it('importa atomicamente 146 linhas válidas preservando frações e sem arredondamento para zero', async () => {
    const rows = Array.from({ length: 146 }, (_, index) =>
      line('Item ' + index, index === 0 ? '16,364' : index === 1 ? '0,5' : 1))
    const { sqlite, importer, options } = fixture(rows)
    try {
      const preview = await importer.preview('token', options)
      expect(preview.total).toBe(146)
      expect(preview.invalid).toBe(0)
      const result = await importer.commit('token', options)
      expect(result.imported).toBe(146)
      expect(sqlite.prepare('SELECT COUNT(*) AS n FROM movimentacoes_estoque').get().n).toBe(146)
      expect(sqlite.prepare("SELECT quantidade FROM movimentacoes_estoque WHERE descricao='Item 0'").get().quantidade).toBeCloseTo(16.364)
      expect(sqlite.prepare("SELECT quantidade FROM movimentacoes_estoque WHERE descricao='Item 1'").get().quantidade).toBe(0.5)
      expect(importer.pending.has('token')).toBe(false)
    } finally { sqlite.close() }
  })

  it.each(['', '-1', 'abc', '1e3', '0'])('não aprova quantidade inválida %j', async quantity => {
    const { sqlite, importer, options } = fixture([line('Item inválido', quantity)])
    try {
      const preview = await importer.preview('token', options)
      expect(preview.invalid).toBe(1)
      expect(preview.issues[0].line).toBe(2)
      expect(preview.issues[0].errors.join(' ')).toMatch(/quantidade/i)
    } finally { sqlite.close() }
  })

  it('reverte tudo quando o banco falha na segunda linha e mantém seleção para correção', async () => {
    const { sqlite, importer, options } = fixture([line('Primeiro', 2), line('Falha', 3)])
    sqlite.exec("CREATE TRIGGER rejeitar_falha BEFORE INSERT ON movimentacoes_estoque WHEN NEW.descricao='Falha' BEGIN SELECT RAISE(ABORT,'falha simulada de gravação'); END;")
    try {
      const preview = await importer.preview('token', options)
      expect(preview.invalid).toBe(0)
      await expect(importer.commit('token', options)).rejects.toThrow(/linha 3.*Falha.*falha simulada/i)
      for (const table of ['movimentacoes_estoque', 'importacoes', 'importacao_linhas', 'obras', 'frentes_obra']) {
        expect(sqlite.prepare('SELECT COUNT(*) AS n FROM ' + table).get().n).toBe(0)
      }
      expect(importer.pending.has('token')).toBe(true)
    } finally { sqlite.close() }
  })
})
