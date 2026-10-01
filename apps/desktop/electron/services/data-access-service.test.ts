import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)

describe('DataAccessService', () => {
  it('preserva o CRUD local existente por delegacao ao DatabaseService', async () => {
    const { DataAccessService } = require('./data-access-service.cjs')
    const db = { list: vi.fn(() => [{ id: 1 }]), get: vi.fn(() => ({ id: 2 })), save: vi.fn(() => ({ id: 3 })), remove: vi.fn(() => true) }
    const storage = { state: vi.fn(() => ({ mode: 'local', operationalMode: 'local', baseUrl: null })) }
    const remote = { list: vi.fn(), get: vi.fn(), save: vi.fn(), remove: vi.fn() }
    const service = new DataAccessService({ db, storage, remote })

    expect(await service.list('empresas', { status: 'ativa' })).toEqual([{ id: 1 }])
    expect(await service.get('clientes', 2)).toEqual({ id: 2 })
    expect(await service.save('obras', { nome: 'Obra A' })).toEqual({ id: 3 })
    expect(await service.remove('empresas', 4)).toBe(true)
    expect(remote.list).not.toHaveBeenCalled()
  })

  it.each(['empresas', 'clientes', 'obras'])('mantem o modo server legado roteando %s para o servidor', async (table) => {
    const { DataAccessService } = require('./data-access-service.cjs')
    const db = { list: vi.fn(), get: vi.fn(), save: vi.fn(), remove: vi.fn() }
    const storage = { state: vi.fn(() => ({ mode: 'server', baseUrl: 'http://192.168.0.10:4732' })) }
    const remote = { list: vi.fn(async () => [{ id: 10 }]), get: vi.fn(async () => ({ id: 11 })), save: vi.fn(async () => ({ id: 12 })), remove: vi.fn(async () => true) }
    const service = new DataAccessService({ db, storage, remote })

    expect(await service.list(table, { empresa_id: 7 })).toEqual([{ id: 10 }])
    expect(await service.get(table, 11)).toEqual({ id: 11 })
    expect(await service.save(table, { id: 12, nome: 'Registro' })).toEqual({ id: 12 })
    expect(await service.remove(table, 13)).toBe(true)
    expect(db.list).not.toHaveBeenCalled()
  })

  it.each(['lan-client', 'lan-host'])('roteia %s para o servidor LAN', async (operationalMode) => {
    const { DataAccessService } = require('./data-access-service.cjs')
    const db = { list: vi.fn(), get: vi.fn(), save: vi.fn(), remove: vi.fn() }
    const storage = { state: vi.fn(() => ({ mode: 'server', operationalMode, baseUrl: operationalMode === 'lan-host' ? 'http://127.0.0.1:4732' : 'http://192.168.0.10:4732' })) }
    const remote = { list: vi.fn(async () => [{ id: 31 }]), get: vi.fn(), save: vi.fn(), remove: vi.fn() }
    const service = new DataAccessService({ db, storage, remote })

    expect(await service.list('empresas', {})).toEqual([{ id: 31 }])
    expect(remote.list).toHaveBeenCalledWith('empresas', {})
    expect(db.list).not.toHaveBeenCalled()
  })

  it('roteia entidades operacionais ao servidor somente quando operation está central-active', async () => {
    const { DataAccessService } = require('./data-access-service.cjs')
    const db = { list: vi.fn(() => [{ id: 1, nome: 'local' }]), get: vi.fn(), save: vi.fn(), remove: vi.fn() }
    const storage = { state: vi.fn(() => ({ mode: 'server', operationalMode: 'lan-host', baseUrl: 'http://127.0.0.1:4732' })) }
    const remote = { list: vi.fn(async () => [{ id: 2, nome: 'central' }]), get: vi.fn(), save: vi.fn(), remove: vi.fn() }
    const moduleStorage = { state: vi.fn(() => ({ module: 'operation', state: 'central-active', localRecords: 0 })) }
    const service = new DataAccessService({ db, storage, remote, moduleStorage })

    await expect(service.list('frentes_obra', { obra_id: 7 })).resolves.toEqual([{ id: 2, nome: 'central' }])
    expect(remote.list).toHaveBeenCalledWith('frentes_obra', { obra_id: 7 })
    expect(db.list).not.toHaveBeenCalled()
  })

  it('migration-required mantém entidades operacionais no SQLite local', async () => {
    const { DataAccessService } = require('./data-access-service.cjs')
    const db = { list: vi.fn(() => [{ id: 3, nome: 'legado local' }]), get: vi.fn(), save: vi.fn(), remove: vi.fn() }
    const storage = { state: vi.fn(() => ({ mode: 'server', operationalMode: 'lan-host', baseUrl: 'http://127.0.0.1:4732' })) }
    const remote = { list: vi.fn(), get: vi.fn(), save: vi.fn(), remove: vi.fn() }
    const moduleStorage = { state: vi.fn(() => ({ module: 'operation', state: 'migration-required', localRecords: 3 })) }
    const service = new DataAccessService({ db, storage, remote, moduleStorage })

    await expect(service.list('rdos', { obra_id: 7 })).resolves.toEqual([{ id: 3, nome: 'legado local' }])
    expect(db.list).toHaveBeenCalledWith('rdos', { obra_id: 7 })
    expect(remote.list).not.toHaveBeenCalled()
  })

  it('central-ready bloqueia CRUD operacional em vez de cair silenciosamente no SQLite', async () => {
    const { DataAccessService } = require('./data-access-service.cjs')
    const db = { list: vi.fn(), get: vi.fn(), save: vi.fn(), remove: vi.fn() }
    const storage = { state: vi.fn(() => ({ mode: 'server', operationalMode: 'lan-client', baseUrl: 'http://server:4732' })) }
    const remote = { list: vi.fn(), get: vi.fn(), save: vi.fn(), remove: vi.fn() }
    const moduleStorage = { state: vi.fn(() => ({ module: 'operation', state: 'central-ready', localRecords: 0 })) }
    const service = new DataAccessService({ db, storage, remote, moduleStorage })

    await expect(service.save('tarefas_obra', { obra_id: 7, titulo: 'Não salvar localmente' })).rejects.toThrow(/central|ativo|servidor/i)
    expect(db.save).not.toHaveBeenCalled()
    expect(remote.save).not.toHaveBeenCalled()
  })

  it('roteia CRUD de etapas, cronograma e orçamento pelo estado planning sem fallback', async () => {
    const { DataAccessService } = require('./data-access-service.cjs')
    const db = { list: vi.fn(() => [{ id: 1, nome: 'local' }]), get: vi.fn(), save: vi.fn(), remove: vi.fn() }
    const storage = { state: vi.fn(() => ({ mode: 'server', operationalMode: 'lan-host', baseUrl: 'http://127.0.0.1:4732' })) }
    const remote = { list: vi.fn(async () => [{ id: 20, nome: 'central' }]), get: vi.fn(), save: vi.fn(async data => data), remove: vi.fn() }
    const moduleStorage = { state: vi.fn((module:string) => ({ module, state: module === 'planning' ? 'central-active' : 'migration-required' })) }
    const service = new DataAccessService({ db, storage, remote, moduleStorage })

    await expect(service.list('cronograma_etapas', { obra_id: 7 })).resolves.toEqual([{ id: 20, nome: 'central' }])
    await service.save('itens_orcamentarios', { obra_id: 7, descricao: 'Item central' })
    expect(remote.list).toHaveBeenCalledWith('cronograma_etapas', { obra_id: 7 })
    expect(remote.save).toHaveBeenCalledWith('itens_orcamentarios', { obra_id: 7, descricao: 'Item central' })
    expect(db.list).not.toHaveBeenCalled()
    expect(db.save).not.toHaveBeenCalled()
  })

  it('planning central-ready bloqueia CRUD de planejamento em vez de escrever SQLite local', async () => {
    const { DataAccessService } = require('./data-access-service.cjs')
    const db = { list: vi.fn(), get: vi.fn(), save: vi.fn(), remove: vi.fn() }
    const storage = { state: vi.fn(() => ({ mode: 'server', operationalMode: 'lan-client', baseUrl: 'http://server:4732' })) }
    const remote = { list: vi.fn(), get: vi.fn(), save: vi.fn(), remove: vi.fn() }
    const moduleStorage = { state: vi.fn((module:string) => ({ module, state: module === 'planning' ? 'central-ready' : 'central-active' })) }
    const service = new DataAccessService({ db, storage, remote, moduleStorage })

    await expect(service.save('cronograma_etapas', { obra_id: 7, nome: 'Não salvar localmente' })).rejects.toThrow(/planejamento|central|ativo/i)
    expect(db.save).not.toHaveBeenCalled()
    expect(remote.save).not.toHaveBeenCalled()
  })

  it('remote continua modelado mas não é tratado como transporte pronto', async () => {
    const { DataAccessService } = require('./data-access-service.cjs')
    const db = { list: vi.fn(() => [{ id: 41 }]), get: vi.fn(), save: vi.fn(), remove: vi.fn() }
    const storage = { state: vi.fn(() => ({ mode: 'server', operationalMode: 'remote', baseUrl: 'https://server.example' })) }
    const remote = { list: vi.fn(async () => [{ id: 99 }]), get: vi.fn(), save: vi.fn(), remove: vi.fn() }
    const service = new DataAccessService({ db, storage, remote })

    expect(await service.list('empresas', {})).toEqual([{ id: 41 }])
    expect(remote.list).not.toHaveBeenCalled()
  })

  it('mantem entidades ainda nao migradas no SQLite mesmo em modo servidor', async () => {
    const { DataAccessService } = require('./data-access-service.cjs')
    const db = { list: vi.fn(() => [{ id: 21 }]), get: vi.fn(), save: vi.fn(), remove: vi.fn() }
    const storage = { state: vi.fn(() => ({ mode: 'server', operationalMode: 'lan-host', baseUrl: 'http://127.0.0.1:4732' })) }
    const remote = { list: vi.fn(), get: vi.fn(), save: vi.fn(), remove: vi.fn() }
    const service = new DataAccessService({ db, storage, remote })

    expect(await service.list('fornecedores', {})).toEqual([{ id: 21 }])
    expect(db.list).toHaveBeenCalledWith('fornecedores', {})
    expect(remote.list).not.toHaveBeenCalled()
  })
})
