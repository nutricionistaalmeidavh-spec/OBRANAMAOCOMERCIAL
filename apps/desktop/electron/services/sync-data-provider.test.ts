import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { afterEach, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { DatabaseService } = require('./database.cjs')
const { SyncCoordinator } = require('./sync-coordinator.cjs')
const { LocalSyncDataProvider } = require('./sync-data-provider.cjs')

const fixtures: Array<{ dataDir: string; database: any }> = []

function fixture() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commercial-sync-provider-'))
  const database = new DatabaseService({
    dataDir,
    migrationsDir: path.resolve(import.meta.dirname, '../../database/migrations')
  })
  database.open()

  const company = database.save('empresas', { razao_social: 'Local', status: 'ativa' })
  const work = database.save('obras', { empresa_id: company.id, nome: 'Obra A', percentual_fisico: 42 })
  const front = database.save('frentes_obra', { obra_id: work.id, nome: 'Térreo', status: 'ativa' })
  const task = database.save('tarefas_obra', { obra_id: work.id, frente_id: front.id, titulo: 'Instalar tubo', status: 'aberta' })
  database.save('rdos', { obra_id: work.id, frente_id: front.id, data: '2026-09-05', status: 'rascunho', atividades: 'Instalação' })
  database.save('cronograma_etapas', { obra_id: work.id, frente_id: front.id, nome: 'Instalação', previsto_inicio: '2026-09-01', previsto_fim: '2026-09-30', percentual_realizado: 30 })
  const supplier = database.save('fornecedores', { empresa_id: company.id, nome: 'Fornecedor A' })
  const payable = database.save('contas', {
    empresa_id: company.id,
    obra_id: work.id,
    fornecedor_id: supplier.id,
    tipo: 'pagar',
    descricao: 'Tubos',
    valor_centavos: 10000,
    competencia: '2026-09',
    vencimento: '2026-09-01'
  })
  database.accountPayment(payable.id, { valor_centavos: 4000, data: '2026-09-01' })

  const scope = {
    companyId: company.id,
    workId: work.id,
    companyName: 'Local',
    workName: work.nome,
    baseUrl: 'https://test.example',
    deviceId: 'device-a',
    remoteCompanyId: 'company-a',
    remoteProjectId: 'project-a'
  }
  const online = { state: () => ({ linked: true, baseUrl: scope.baseUrl }) }
  const coordinator = new SyncCoordinator({ database, online, now: () => Date.parse('2026-09-05T12:00:00Z') })
  const provider = new LocalSyncDataProvider({ database, now: () => Date.parse('2026-09-05T12:00:00Z') })

  fixtures.push({ dataDir, database })
  return { database, company, work, front, task, scope, coordinator, provider }
}

afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    fixture.database.close()
    fs.rmSync(fixture.dataDir, { recursive: true, force: true })
  }
})

it('produces the same bridge rows, summary and obligations as the current coordinator', () => {
  const f = fixture()
  const modules = ['obra360', 'finance', 'dre', 'rdo', 'documents']

  for (const entity of ['frentes_obra', 'tarefas_obra', 'rdos', 'cronograma_etapas']) {
    expect(f.provider.listBridge(entity, f.scope)).toEqual(f.coordinator.rows(entity, f.scope))
    const row = f.coordinator.rows(entity, f.scope)[0]
    expect(f.provider.getBridge(entity, row.id, f.scope)).toEqual(row)
  }

  expect(f.provider.summary(f.scope, modules)).toEqual(f.coordinator.summary(f.scope, modules))
  expect(f.provider.obligations(f.scope)).toEqual(f.coordinator.obligations(f.scope))
})

it('applies the same editable remote patch semantics without changing row ownership', () => {
  const f = fixture()
  const original = f.database.get('tarefas_obra', f.task.id)

  expect(f.provider.applyRemote('tarefas_obra', f.task.id, {
    titulo: 'Título remoto',
    status: 'em_andamento',
    descricao: 'Atualizado pela PWA',
    obra_id: 9999
  }, f.scope)).toBe(true)

  const updated = f.database.get('tarefas_obra', f.task.id)
  expect(updated.titulo).toBe('Título remoto')
  expect(updated.status).toBe('em_andamento')
  expect(updated.descricao).toBe('Atualizado pela PWA')
  expect(updated.obra_id).toBe(original.obra_id)
  expect(() => f.provider.applyRemote('tarefas_obra', f.task.id, { deleted: true }, f.scope)).toThrow(/Exclusão remota exige revisão manual/)
})
