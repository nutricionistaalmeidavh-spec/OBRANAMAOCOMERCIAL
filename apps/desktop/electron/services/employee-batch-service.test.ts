import { createRequire } from 'node:module'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const ExcelJS = require('exceljs')
const { EmployeeBatchService, createAdmissionTemplate } = require('./employee-batch-service.cjs')

it('previews an Excel batch and saves valid rows through the active data source only once', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'admission-batch-'))
  const file = path.join(dir, 'admissoes.xlsx')
  try {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(await createAdmissionTemplate())
    const sheet = workbook.getWorksheet('Admissões')
    const headers = sheet.getRow(1).values
    const addEmployee = (values: Record<string, unknown>) => {
      const row = sheet.addRow([])
      for (const [label, value] of Object.entries(values)) row.getCell(headers.indexOf(label)).value = value
    }
    const identity = { 'Nome completo *':'Pessoa Teste', 'CPF *':'012.345.678-90', 'Data de nascimento *':'01/06/1990',
      'Cargo *':'Encanador', 'Data de admissão *':new Date('2026-11-09T00:00:00Z'), 'Data do ASO admissional':'06/11/2026', 'Data NR-35':'07/11/2026' }
    addEmployee(identity)
    addEmployee({ ...identity, 'CPF *':'111.222.333-44' })
    addEmployee({ ...identity, 'CPF *':'222.333.444-55', 'Data de admissão *':'31/11/2026' })
    await workbook.xlsx.writeFile(file)

    const employees = [{ cpf:'11122233344' }]
    const dataAccess = {
      get: vi.fn(async () => ({ id:7, status:'ativa' })),
      list: vi.fn(async (table: string) => table === 'funcionarios' ? employees : [{ id:3, nome:'Encanador', ativo:1, salario_base_centavos:250000 }]),
      save: vi.fn(async (_table: string, row: { cpf: string }) => { employees.push(row); return { id:8, ...row } })
    }
    const dialog = { showOpenDialog: vi.fn(async () => ({ filePaths:[file] })) }
    const service = new EmployeeBatchService({ dataAccess, dialog })
    const preview = await service.choose(undefined, 7)
    expect(preview.rows.map((row: { errors: string[] }) => row.errors.length)).toEqual([0, 1, 1])
    expect(dataAccess.save).not.toHaveBeenCalled()
    const result = await service.commit(preview.token)
    expect(result.created).toBe(1)
    expect(dataAccess.save).toHaveBeenCalledExactlyOnceWith('funcionarios', expect.objectContaining({
      empresa_id:7, cargo_id:3, cpf:'012.345.678-90', admissao:'2026-11-09', data_nascimento:'1990-06-01',
      observacoes:'Data do ASO admissional: 06/11/2026\nData NR-35: 07/11/2026', salario_centavos:250000
    }))
    await expect(service.commit(preview.token)).rejects.toThrow(/Abra novamente/)
    const repeated = await service.choose(undefined, 7)
    expect(repeated.rows[0].errors).toContain('CPF já cadastrado.')
  } finally {
    await rm(dir, { recursive:true, force:true })
  }
})
