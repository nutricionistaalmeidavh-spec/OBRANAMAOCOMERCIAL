import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { afterEach, describe, expect, it } from 'vitest'
import { LanRepository } from '../../lan-server/src/repository.mjs'
import { PayrollService as LanPayrollService } from '../../lan-server/src/payroll-service.mjs'

const require = createRequire(import.meta.url)
const { DatabaseService } = require('../electron/services/database.cjs')
const { PayrollService: LocalPayrollService } = require('../electron/services/payroll-service.cjs')
const { CatalogService } = require('../electron/services/catalog-service.cjs')
const localFixtures:any[] = []
const lanFixtures:any[] = []

function localFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'domain-parity-local-'))
  const db = new DatabaseService({ dataDir: dir, migrationsDir: path.resolve(import.meta.dirname, '../database/migrations') })
  db.open(); localFixtures.push({ dir, db })
  const catalog = new CatalogService({ db })
  const company = db.save('empresas', { razao_social: 'Paridade', status: 'ativa' })
  const cargo = catalog.saveCargo({ nome: 'Encanador Paridade', cbo: '724110', salario_base_centavos: 250000 })
  const benefit = catalog.saveBenefit({ nome: 'Café Paridade', tipo: 'alimentacao', valor_padrao_centavos: 18000 })
  catalog.saveLink({ cargo_id: cargo.id, beneficio_id: benefit.id, valor_centavos: 18000, quinzena: 1, natureza: 'credito', ativo: 1 })
  const employee = db.save('funcionarios', { empresa_id: company.id, cargo_id: cargo.id, nome: 'Funcionário', status: 'ativo', salario_centavos: 250000 })
  return { payroll: new LocalPayrollService({ db }), employee }
}

function lanFixture() {
  const repository = new LanRepository({ filename: ':memory:' })
  repository.applyMigrations(path.resolve(import.meta.dirname, '../../lan-server/migrations'))
  lanFixtures.push(repository)
  const company = repository.save('empresas', { razao_social: 'Paridade' })
  const cargo = repository.save('cargos', { empresa_id: company.id, nome: 'Encanador Paridade', salario_base_centavos: 250000, ativo: 1 })
  const benefit = repository.save('beneficios', { empresa_id: company.id, nome: 'Café Paridade', tipo: 'alimentacao', valor_padrao_centavos: 18000, ativo: 1 })
  repository.save('cargo_beneficios', { empresa_id: company.id, cargo_id: cargo.id, beneficio_id: benefit.id, valor_centavos: 18000, quinzena: 1, natureza: 'credito', ativo: 1 })
  const employee = repository.save('funcionarios', { empresa_id: company.id, cargo_id: cargo.id, nome: 'Funcionário', status: 'ativo', salario_centavos: 250000 })
  return { payroll: new LanPayrollService({ repository }), employee }
}

afterEach(() => {
  for (const f of localFixtures.splice(0)) { f.db.close(); fs.rmSync(f.dir, { recursive: true, force: true }) }
  for (const repository of lanFixtures.splice(0)) repository.close()
})

describe('Local × LAN canonical domain equivalence', () => {
  it('folha produz o mesmo líquido e as mesmas pendências de negócio', () => {
    const local = localFixture()
    const lan = lanFixture()
    const competencia = '2026-10'

    local.payroll.getEmployee({ funcionario_id: local.employee.id, competencia })
    const lanState = lan.payroll.getEmployee({ funcionario_id: lan.employee.id, competencia })
    local.payroll.saveVariable({ funcionario_id: local.employee.id, competencia, tipo: 'diaria', descricao: 'Diária', natureza: 'credito', quinzena: 1, valor_centavos: 10000 })
    lan.payroll.saveVariable({ funcionario_id: lan.employee.id, competencia, tipo: 'diaria', descricao: 'Diária', natureza: 'credito', quinzena: 1, valor_centavos: 10000 })

    const localPayment = local.payroll.confirm({ funcionario_id: local.employee.id, competencia, quinzena: 1, data: '2026-10-15', forma_pagamento: 'PIX' })
    const lanPayment = lan.payroll.confirm({ funcionario_id: lan.employee.id, competencia, quinzena: 1, data: '2026-10-15', forma_pagamento: 'PIX', expectedRevision: lanState.sheet.revision })

    expect(localPayment.valor_centavos).toBe(278000)
    expect(lanPayment.valor_centavos).toBe(localPayment.valor_centavos)
    expect(local.payroll.pending(competencia).map((x:any) => [x.quinzena, x.valor_centavos]))
      .toEqual(lan.payroll.pending(competencia).map((x:any) => [x.quinzena, x.valor_centavos]))
  })
})
