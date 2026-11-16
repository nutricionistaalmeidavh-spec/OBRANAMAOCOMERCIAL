import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const originalRequire = createRequire(import.meta.url)
const ExcelJS = originalRequire('exceljs')

function realService(path: string) {
  const servicePath = resolve(here, '../electron/services/', path)
  const serviceRequire = createRequire(servicePath)
  const source = readFileSync(servicePath, 'utf8')
  const module = { exports: {} as any }
  const fakeRequire = (name: string) => name === 'electron'
    ? { dialog: {} }
    : serviceRequire(name)
  new Function('require', 'module', 'exports', source)(fakeRequire, module, module.exports)
  return module.exports
}

describe('planilhas reais de clientes — ExcelJS', () => {
  it('abre XLSX real e reconhece todas as abas pelo contrato Workbook.worksheets', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'obra-real-xlsx-'))
    try {
      const file = join(folder, 'contas.xlsx')
      const wb = new ExcelJS.Workbook()
      const one = wb.addWorksheet('Financeiro')
      one.addRow(['descricao', 'valor'])
      one.addRow(['Cimento', 100])
      one.addRow(['Energia', 50])
      const other = wb.addWorksheet('Obras')
      other.addRow(['nome', 'endereco'])
      other.addRow(['Obra A', 'Rua B'])
      await wb.xlsx.writeFile(file)
      const { UniversalImportService } = realService('universal-import-service.cjs')
      const service = new UniversalImportService({ db: {} })
      const result = await service.analyze(file)
      expect(result.sheets.map((sheet: any) => sheet.name)).toEqual(['Financeiro', 'Obras'])
      expect(result.sheets[0].rows).toBe(2)
      expect(result.sheets[0].headers).toEqual(['descricao', 'valor'])
      expect(result.sheets[1].rows).toBe(1)
    } finally { rmSync(folder, { recursive: true, force: true }) }
  })

  it('abre CSV real e apresenta a aba para mapeamento, sem SheetNames legado', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'obra-real-csv-'))
    try {
      const file = join(folder, 'despesas.csv')
      writeFileSync(file, 'descricao,valor\nAgua,24\nLuz,33\n', 'utf8')
      const { UniversalImportService } = realService('universal-import-service.cjs')
      const result = await new UniversalImportService({ db: {} }).analyze(file)
      expect(result.sheets).toHaveLength(1)
      expect(result.sheets[0].headers).toEqual(['descricao', 'valor'])
      expect(result.sheets[0].rows).toBe(2)
    } finally { rmSync(folder, { recursive: true, force: true }) }
  })

  it('preserva reconhecimento de abas XLSX no importador de folha existente', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'obra-real-folha-'))
    try {
      const file = join(folder, 'folha.xlsx')
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('Folha')
      ws.addRow(['Funcionário', 'Nome'])
      ws.addRow(['Funcionário', 'João'])
      await wb.xlsx.writeFile(file)
      const { PayrollImportFileService } = realService('payroll-import-file-service.cjs')
      const result = await new PayrollImportFileService().analyze(file)
      expect(result.sheets).toHaveLength(1)
      expect(result.sheets[0].name).toBe('Folha')
    } finally { rmSync(folder, { recursive: true, force: true }) }
  })
})
