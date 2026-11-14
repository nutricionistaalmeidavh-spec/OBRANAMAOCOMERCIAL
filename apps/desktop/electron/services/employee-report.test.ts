import { createRequire } from 'node:module'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const { exportEmployeeReport } = require('./employee-report.cjs')
const { Workbook } = require('exceljs')
const { PDFDocument } = require('pdf-lib')
const JSZip = require('jszip')

it('exports selected employees and fields across all report formats', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'employee-report-'))
  const employee = { id: 1, nome: 'Pessoa & Cia', cpf: '01234567890', empresa_id: 7, data_nascimento: '1980-06-13' }
  const tables: Record<string, object[]> = {
    empresas: [{ id: 7, nome_fantasia: 'Empresa de teste' }],
    funcionarios: [{ ...employee, cargo_id: 4 }, { id: 2, nome: 'Pessoa excluída', empresa_id: 7 }],
    beneficios: [{ id: 3, nome: 'Café', ativo: 1 }],
    cargo_beneficios: [{ cargo_id: 4, beneficio_id: 3, ativo: 1, valor_centavos: 1100 }],
    funcionario_beneficios: [
      { funcionario_id: 1, beneficio_id: 3, valor_centavos: 1525, inicio: '2026-11-05' },
      { funcionario_id: 1, beneficio_id: 3, valor_centavos: 2000, inicio: '2026-12-01' }
    ]
  }
  const dataAccess = { list: vi.fn(async (table: string) => tables[table]) }
  const selection = { ids: [1], empresaId: 7, competencia: '2026-11', campos: ['nome', 'cpf', 'data_nascimento', 'beneficios'] }
  const dialog = { showSaveDialog: vi.fn() }
  try {
    for (const formato of ['xlsx', 'csv', 'pdf', 'docx']) {
      const filename = 'relatorio.' + formato
      dialog.showSaveDialog.mockResolvedValue({ filePath: path.join(dir, filename) })
      await expect(exportEmployeeReport({ dataAccess, dialog }, { ...selection, formato })).resolves.toBe(filename)
    }

    const workbook = new Workbook()
    await workbook.xlsx.readFile(path.join(dir, 'relatorio.xlsx'))
    const sheet = workbook.getWorksheet(1)
    expect(sheet.getRow(2).values.slice(1)).toEqual(['Nome completo', 'CPF', 'Data de nascimento', 'Café'])
    expect(sheet.getRow(3).values.slice(1)).toEqual(['Pessoa & Cia', '012.345.678-90', '13/06/1980', 15.25])
    expect(sheet.actualRowCount).toBe(3)
    const csv = await readFile(path.join(dir, 'relatorio.csv'), 'utf8')
    expect(csv).toContain('"Pessoa & Cia";"012.345.678-90";"13/06/1980";15,25')
    expect(csv).not.toContain('Pessoa excluída')
    const pdf = await PDFDocument.load(await readFile(path.join(dir, 'relatorio.pdf')))
    expect(pdf.getPageCount()).toBe(1)
    const word = await JSZip.loadAsync(await readFile(path.join(dir, 'relatorio.docx')))
    const document = await word.file('word/document.xml').async('string')
    expect(document).toContain('Pessoa &amp; Cia')
    expect(document).not.toContain('Pessoa excluída')
    expect(dataAccess.list).toHaveBeenCalledWith('funcionarios', { empresa_id: 7 })
    dialog.showSaveDialog.mockResolvedValue({ canceled: true })
    await expect(exportEmployeeReport({ dataAccess, dialog }, { ...selection, formato: 'xlsx' })).resolves.toBeNull()
    await expect(exportEmployeeReport({ dataAccess, dialog }, { ...selection, ids: [], formato: 'xlsx' })).rejects.toThrow(/Confira/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
