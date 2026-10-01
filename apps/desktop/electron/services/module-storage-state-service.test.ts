import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { afterEach, describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const { DatabaseService } = require('./database.cjs')
const { ModuleStorageStateService } = require('./module-storage-state-service.cjs')
const fixtures: any[] = []

function fixture({ operationalMode = 'lan-host', capabilities = { version: 1, modules: ['core', 'operation'], bridgeEntities: ['frentes_obra', 'tarefas_obra', 'rdos'] } } = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'module-storage-state-'))
  const database = new DatabaseService({ dataDir, migrationsDir: path.resolve(import.meta.dirname, '../../database/migrations') })
  database.open()
  const storage = { state: vi.fn(() => ({ operationalMode, mode: operationalMode === 'local' ? 'local' : 'server' })) }
  const lanClient = { syncSourceCapabilities: vi.fn(async () => capabilities) }
  const service = new ModuleStorageStateService({ database, storage, lanClient })
  const value = { dataDir, database, storage, lanClient, service }
  fixtures.push(value)
  return value
}

function seedWork(f:any) {
  const company = f.database.save('empresas', { razao_social: 'Empresa local' })
  const work = f.database.save('obras', { empresa_id: company.id, nome: 'Obra local' })
  return { company, work }
}

afterEach(() => {
  for (const f of fixtures.splice(0)) {
    f.database.close()
    fs.rmSync(f.dataDir, { recursive: true, force: true })
  }
})

describe('ModuleStorageStateService', () => {
  it('mantém módulo local quando a fonte operacional é local', async () => {
    const f = fixture({ operationalMode: 'local' })
    expect(f.service.state('operation')).toEqual(expect.objectContaining({ module: 'operation', state: 'local' }))
    expect(f.service.state('planning')).toEqual(expect.objectContaining({ module: 'planning', state: 'local' }))
    expect(await f.service.refreshCapabilities()).toEqual(expect.objectContaining({ operation: expect.objectContaining({ state: 'local' }), planning: expect.objectContaining({ state: 'local' }) }))
    expect(f.lanClient.syncSourceCapabilities).not.toHaveBeenCalled()
  })

  it('instalação LAN nova fica central-ready até capability autenticada e então operation fica central-active', async () => {
    const f = fixture()
    expect(f.service.state('operation').state).toBe('central-ready')
    const refreshed = await f.service.refreshCapabilities()
    expect(refreshed.operation.state).toBe('central-active')
    expect(f.service.state('operation').state).toBe('central-active')
    expect(f.lanClient.syncSourceCapabilities).toHaveBeenCalledTimes(1)
  })

  it('dados operacionais locais existentes forçam migration-required sem copiar nem apagar', async () => {
    const f = fixture()
    const { work } = seedWork(f)
    const front = f.database.save('frentes_obra', { obra_id: work.id, nome: 'Frente antiga' })

    expect(f.service.state('operation')).toEqual(expect.objectContaining({ state: 'migration-required', localRecords: 1 }))
    const refreshed = await f.service.refreshCapabilities()
    expect(refreshed.operation.state).toBe('migration-required')
    expect(f.database.get('frentes_obra', front.id)?.nome).toBe('Frente antiga')
    expect(f.database.list('rdos', { obra_id: work.id })).toHaveLength(0)
  })

  it('migration-required é sticky e nunca vira central-active automaticamente mesmo se os dados locais forem removidos', async () => {
    const f = fixture()
    const { work } = seedWork(f)
    const front = f.database.save('frentes_obra', { obra_id: work.id, nome: 'Frente antiga' })
    expect(f.service.state('operation').state).toBe('migration-required')

    f.database.remove('frentes_obra', front.id)
    const refreshed = await f.service.refreshCapabilities()
    expect(refreshed.operation.state).toBe('migration-required')
  })

  it('servidor sem capability operation permanece central-ready', async () => {
    const f = fixture({ capabilities: { version: 1, modules: ['core'], bridgeEntities: [] } })
    const refreshed = await f.service.refreshCapabilities()
    expect(refreshed.operation.state).toBe('central-ready')
  })

  it('planejamento local existente força planning migration-required sem mover ou apagar registros', async () => {
    const f = fixture({ capabilities: { version: 1, modules: ['core', 'operation', 'planning'], bridgeEntities: ['frentes_obra', 'tarefas_obra', 'rdos', 'cronograma_etapas'] } })
    const { work } = seedWork(f)
    const stage = f.database.save('etapas_obra', { obra_id: work.id, nome: 'Etapa antiga' })
    f.database.save('cronograma_etapas', { obra_id: work.id, etapa_id: stage.id, nome: 'Cronograma antigo' })

    expect(f.service.state('planning')).toEqual(expect.objectContaining({ state: 'migration-required', localRecords: 2 }))
    const refreshed = await f.service.refreshCapabilities()
    expect(refreshed.planning.state).toBe('migration-required')
    expect(f.database.get('etapas_obra', stage.id)?.nome).toBe('Etapa antiga')
  })

  it('instalação nova ativa planning quando capability existe e não há dependência financeira local', async () => {
    const f = fixture({ capabilities: { version: 1, modules: ['core', 'operation', 'planning'], bridgeEntities: ['frentes_obra', 'tarefas_obra', 'rdos', 'cronograma_etapas'] } })
    expect(f.service.state('planning').state).toBe('central-ready')
    const refreshed = await f.service.refreshCapabilities()
    expect(refreshed.planning).toEqual(expect.objectContaining({ state: 'central-active', capabilityAvailable: true, financeDependencyBlocked: false }))
    expect(f.service.state('planning').state).toBe('central-active')
  })

  it('financeiro local impede planning central-active até F11/F17 sem marcar planejamento vazio como migration-required', async () => {
    const f = fixture({ capabilities: { version: 1, modules: ['core', 'operation', 'planning'], bridgeEntities: ['frentes_obra', 'tarefas_obra', 'rdos', 'cronograma_etapas'] } })
    const { company, work } = seedWork(f)
    f.database.save('contas', { empresa_id: company.id, obra_id: work.id, tipo: 'pagar', descricao: 'Conta local', competencia: '2026-10', vencimento: '2026-10-10', valor_centavos: 10000, status: 'pendente' })

    const refreshed = await f.service.refreshCapabilities()
    expect(refreshed.planning).toEqual(expect.objectContaining({ state: 'central-ready', capabilityAvailable: true, financeDependencyBlocked: true }))
    expect(f.service.state('planning')).toEqual(expect.objectContaining({ state: 'central-ready', localRecords: 0, financeLocalRecords: 1 }))
  })
})
