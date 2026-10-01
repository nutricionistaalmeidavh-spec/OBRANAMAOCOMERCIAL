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
  it('mantém módulos locais quando a fonte operacional é local', async () => {
    const f = fixture({ operationalMode: 'local' })
    expect(f.service.state('core')).toEqual(expect.objectContaining({ module: 'core', state: 'local' }))
    expect(f.service.state('operation')).toEqual(expect.objectContaining({ module: 'operation', state: 'local' }))
    expect(f.service.state('planning')).toEqual(expect.objectContaining({ module: 'planning', state: 'local' }))
    expect(f.service.state('finance')).toEqual(expect.objectContaining({ module: 'finance', state: 'local' }))
    expect(await f.service.refreshCapabilities()).toEqual(expect.objectContaining({
      core: expect.objectContaining({ state: 'local' }),
      operation: expect.objectContaining({ state: 'local' }),
      planning: expect.objectContaining({ state: 'local' }),
      finance: expect.objectContaining({ state: 'local' })
    }))
    expect(f.lanClient.syncSourceCapabilities).not.toHaveBeenCalled()
  })

  it('cadastros-base locais exigem migração e permanecem sticky', async () => {
    const f = fixture()
    const { company, work } = seedWork(f)
    expect(f.service.state('core')).toEqual(expect.objectContaining({ state: 'migration-required', localRecords: 2 }))
    f.database.remove('obras', work.id)
    f.database.remove('empresas', company.id)
    expect((await f.service.refreshCapabilities()).core.state).toBe('migration-required')
  })

  it('instalação LAN nova ativa core antes dos módulos dependentes na mesma atualização', async () => {
    const f = fixture()
    expect(f.service.state('core').state).toBe('central-ready')
    expect(f.service.state('operation').state).toBe('central-ready')
    const refreshed = await f.service.refreshCapabilities()
    expect(refreshed.core.state).toBe('central-active')
    expect(refreshed.operation.state).toBe('central-active')
    expect(f.lanClient.syncSourceCapabilities).toHaveBeenCalledTimes(1)
  })

  it('módulo dependente permanece bloqueado enquanto core não estiver central-active', async () => {
    const f = fixture()
    seedWork(f)
    const refreshed = await f.service.refreshCapabilities()
    expect(refreshed.core.state).toBe('migration-required')
    expect(refreshed.operation).toEqual(expect.objectContaining({ state: 'central-ready', coreDependencyBlocked: true }))
  })

  it('activateAfterMigration mantém core central mesmo preservando a origem local', () => {
    const f = fixture()
    seedWork(f)
    expect(f.service.state('core').state).toBe('migration-required')
    expect(f.service.activateAfterMigration('core').state).toBe('central-active')
    expect(f.service.state('core').state).toBe('central-active')
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

  it('instalação nova ativa planning quando capability existe', async () => {
    const f = fixture({ capabilities: { version: 1, modules: ['core', 'operation', 'planning'], bridgeEntities: ['frentes_obra', 'tarefas_obra', 'rdos', 'cronograma_etapas'] } })
    expect(f.service.state('planning').state).toBe('central-ready')
    const refreshed = await f.service.refreshCapabilities()
    expect(refreshed.planning).toEqual(expect.objectContaining({ state: 'central-active', capabilityAvailable: true }))
    expect(f.service.state('planning').state).toBe('central-active')
  })

  it('planejamento pode ser central antes do financeiro após a migração explícita de core', async () => {
    const f = fixture({ capabilities: { version: 1, modules: ['core', 'operation', 'planning', 'finance'], bridgeEntities: ['frentes_obra', 'tarefas_obra', 'rdos', 'cronograma_etapas'] } })
    const { company, work } = seedWork(f)
    f.database.save('contas', { empresa_id: company.id, obra_id: work.id, tipo: 'pagar', descricao: 'Conta local', competencia: '2026-10', vencimento: '2026-10-10', valor_centavos: 10000, status: 'pendente' })
    expect(f.service.state('core').state).toBe('migration-required')
    f.service.activateAfterMigration('core')
    const refreshed = await f.service.refreshCapabilities()
    expect(refreshed.planning).toEqual(expect.objectContaining({ state: 'central-active', capabilityAvailable: true }))
    expect(refreshed.finance.state).toBe('migration-required')
  })

  it('financeiro local existente força finance migration-required sem copiar ou apagar contas', async () => {
    const f = fixture({ capabilities: { version: 1, modules: ['core', 'operation', 'planning', 'finance'], bridgeEntities: ['frentes_obra', 'tarefas_obra', 'rdos', 'cronograma_etapas'] } })
    const { company, work } = seedWork(f)
    const account = f.database.save('contas', { empresa_id: company.id, obra_id: work.id, tipo: 'pagar', descricao: 'Conta antiga', competencia: '2026-10', vencimento: '2026-10-10', valor_centavos: 5000, status: 'pendente' })
    expect(f.service.state('finance')).toEqual(expect.objectContaining({ state: 'migration-required', localRecords: 1 }))
    const refreshed = await f.service.refreshCapabilities()
    expect(refreshed.finance.state).toBe('migration-required')
    expect(f.database.get('contas', account.id)?.descricao).toBe('Conta antiga')
  })

  it('instalação nova ativa finance somente quando o servidor anuncia capability finance', async () => {
    const f = fixture({ capabilities: { version: 1, modules: ['core', 'operation', 'planning', 'finance'], bridgeEntities: ['frentes_obra', 'tarefas_obra', 'rdos', 'cronograma_etapas'] } })
    expect(f.service.state('finance').state).toBe('central-ready')
    const refreshed = await f.service.refreshCapabilities()
    expect(refreshed.finance).toEqual(expect.objectContaining({ state: 'central-active', capabilityAvailable: true }))
    expect(f.service.state('finance').state).toBe('central-active')
  })

  it('finance migration-required permanece sticky mesmo após remoção local', async () => {
    const f = fixture({ capabilities: { version: 1, modules: ['core', 'finance'], bridgeEntities: [] } })
    const { company, work } = seedWork(f)
    const account = f.database.save('contas', { empresa_id: company.id, obra_id: work.id, tipo: 'pagar', descricao: 'Conta antiga', competencia: '2026-10', vencimento: '2026-10-10', valor_centavos: 5000, status: 'pendente' })
    expect(f.service.state('finance').state).toBe('migration-required')
    f.database.remove('contas', account.id)
    const refreshed = await f.service.refreshCapabilities()
    expect(refreshed.finance.state).toBe('migration-required')
  })
})
