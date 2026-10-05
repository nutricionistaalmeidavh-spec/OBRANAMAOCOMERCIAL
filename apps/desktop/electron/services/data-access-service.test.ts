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

  it.each(['empresas', 'clientes', 'obras'])('roteia %s para o servidor somente com core central-active', async (table) => {
    const { DataAccessService } = require('./data-access-service.cjs')
    const db = { list: vi.fn(), get: vi.fn(), save: vi.fn(), remove: vi.fn() }
    const storage = { state: vi.fn(() => ({ mode: 'server', operationalMode: 'lan-client', baseUrl: 'http://192.168.0.10:4732' })) }
    const remote = { list: vi.fn(async () => [{ id: 10 }]), get: vi.fn(async () => ({ id: 11 })), save: vi.fn(async () => ({ id: 12 })), remove: vi.fn(async () => true) }
    const moduleStorage = { state: vi.fn((module:string) => ({ module, state: module === 'core' ? 'central-active' : 'migration-required' })) }
    const service = new DataAccessService({ db, storage, remote, moduleStorage })

    expect(await service.list(table, { empresa_id: 7 })).toEqual([{ id: 10 }])
    expect(await service.get(table, 11)).toEqual({ id: 11 })
    expect(await service.save(table, { id: 12, nome: 'Registro' })).toEqual({ id: 12 })
    expect(await service.remove(table, 13)).toBe(true)
    expect(db.list).not.toHaveBeenCalled()
  })

  it.each(['lan-client', 'lan-host'])('roteia core central-active via %s para o servidor LAN', async (operationalMode) => {
    const { DataAccessService } = require('./data-access-service.cjs')
    const db = { list: vi.fn(), get: vi.fn(), save: vi.fn(), remove: vi.fn() }
    const storage = { state: vi.fn(() => ({ mode: 'server', operationalMode, baseUrl: operationalMode === 'lan-host' ? 'http://127.0.0.1:4732' : 'http://192.168.0.10:4732' })) }
    const remote = { list: vi.fn(async () => [{ id: 31 }]), get: vi.fn(), save: vi.fn(), remove: vi.fn() }
    const moduleStorage = { state: vi.fn((module:string) => ({ module, state: module === 'core' ? 'central-active' : 'migration-required' })) }
    const service = new DataAccessService({ db, storage, remote, moduleStorage })

    expect(await service.list('empresas', {})).toEqual([{ id: 31 }])
    expect(remote.list).toHaveBeenCalledWith('empresas', {})
    expect(db.list).not.toHaveBeenCalled()
  })

  it('core migration-required bloqueia CRUD e não faz fallback para SQLite', async () => {
    const { DataAccessService } = require('./data-access-service.cjs')
    const db = { list: vi.fn(), get: vi.fn(), save: vi.fn(), remove: vi.fn() }
    const storage = { state: vi.fn(() => ({ mode: 'server', operationalMode: 'lan-client', baseUrl: 'http://server:4732' })) }
    const remote = { list: vi.fn(), get: vi.fn(), save: vi.fn(), remove: vi.fn() }
    const moduleStorage = { state: vi.fn((module:string) => ({ module, state: module === 'core' ? 'migration-required' : 'central-ready' })) }
    const service = new DataAccessService({ db, storage, remote, moduleStorage })

    await expect(service.list('empresas', {})).rejects.toThrow(/cadastros-base|central|ativo/i)
    expect(db.list).not.toHaveBeenCalled()
    expect(remote.list).not.toHaveBeenCalled()
  })

  it('core central-ready bloqueia CRUD sem fallback local', async () => {
    const { DataAccessService } = require('./data-access-service.cjs')
    const db = { list: vi.fn(), get: vi.fn(), save: vi.fn(), remove: vi.fn() }
    const storage = { state: vi.fn(() => ({ mode: 'server', operationalMode: 'lan-client', baseUrl: 'http://server:4732' })) }
    const remote = { list: vi.fn(), get: vi.fn(), save: vi.fn(), remove: vi.fn() }
    const moduleStorage = { state: vi.fn((module:string) => ({ module, state: module === 'core' ? 'central-ready' : 'migration-required' })) }
    const service = new DataAccessService({ db, storage, remote, moduleStorage })

    await expect(service.save('empresas', { razao_social: 'Não salvar localmente' })).rejects.toThrow(/cadastros-base|central|ativo/i)
    expect(db.save).not.toHaveBeenCalled()
    expect(remote.save).not.toHaveBeenCalled()
  })

  it('roteia entidades operacionais ao servidor somente quando operation está central-active', async () => {
    const { DataAccessService } = require('./data-access-service.cjs')
    const db = { list: vi.fn(() => [{ id: 1, nome: 'local' }]), get: vi.fn(), save: vi.fn(), remove: vi.fn() }
    const storage = { state: vi.fn(() => ({ mode: 'server', operationalMode: 'lan-host', baseUrl: 'http://127.0.0.1:4732' })) }
    const remote = { list: vi.fn(async () => [{ id: 2, nome: 'central' }]), get: vi.fn(), save: vi.fn(), remove: vi.fn() }
    const moduleStorage = { state: vi.fn((module:string) => ({ module, state: module === 'operation' ? 'central-active' : 'migration-required', localRecords: 0 })) }
    const service = new DataAccessService({ db, storage, remote, moduleStorage })

    await expect(service.list('frentes_obra', { obra_id: 7 })).resolves.toEqual([{ id: 2, nome: 'central' }])
    expect(remote.list).toHaveBeenCalledWith('frentes_obra', { obra_id: 7 })
    expect(db.list).not.toHaveBeenCalled()
  })

  it('migration-required bloqueia entidades operacionais sem fallback SQLite', async () => {
    const { DataAccessService } = require('./data-access-service.cjs')
    const db = { list: vi.fn(), get: vi.fn(), save: vi.fn(), remove: vi.fn() }
    const storage = { state: vi.fn(() => ({ mode: 'server', operationalMode: 'lan-host', baseUrl: 'http://127.0.0.1:4732' })) }
    const remote = { list: vi.fn(), get: vi.fn(), save: vi.fn(), remove: vi.fn() }
    const moduleStorage = { state: vi.fn((module:string) => ({ module, state: module === 'operation' ? 'migration-required' : 'central-active', localRecords: 3 })) }
    const service = new DataAccessService({ db, storage, remote, moduleStorage })

    await expect(service.list('rdos', { obra_id: 7 })).rejects.toThrow(/RDO|operação|central|ativo/i)
    expect(db.list).not.toHaveBeenCalled()
    expect(remote.list).not.toHaveBeenCalled()
  })

  it('central-ready bloqueia CRUD operacional em vez de cair silenciosamente no SQLite', async () => {
    const { DataAccessService } = require('./data-access-service.cjs')
    const db = { list: vi.fn(), get: vi.fn(), save: vi.fn(), remove: vi.fn() }
    const storage = { state: vi.fn(() => ({ mode: 'server', operationalMode: 'lan-client', baseUrl: 'http://server:4732' })) }
    const remote = { list: vi.fn(), get: vi.fn(), save: vi.fn(), remove: vi.fn() }
    const moduleStorage = { state: vi.fn((module:string) => ({ module, state: module === 'operation' ? 'central-ready' : 'central-active', localRecords: 0 })) }
    const service = new DataAccessService({ db, storage, remote, moduleStorage })

    await expect(service.save('tarefas_obra', { obra_id: 7, titulo: 'Não salvar localmente' })).rejects.toThrow(/central|ativo|servidor/i)
    expect(db.save).not.toHaveBeenCalled()
    expect(remote.save).not.toHaveBeenCalled()
  })

  it('roteia CRUD de etapas, cronograma e orçamento pelo estado planning sem fallback', async () => {
    const { DataAccessService } = require('./data-access-service.cjs')
    const db = { list: vi.fn(() => [{ id: 1, nome: 'local' }]), get: vi.fn(), save: vi.fn(), remove: vi.fn() }
    const storage = { state: vi.fn(() => ({ mode: 'server', operationalMode: 'lan-host', baseUrl: 'http://127.0.0.1:4732' })) }
    const remote = { list: vi.fn(async () => [{ id: 20, nome: 'central' }]), get: vi.fn(), save: vi.fn(async (_table:any,data:any) => data), remove: vi.fn() }
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

  it('bloqueia finance migration-required em modo servidor sem fallback', async () => {
    const { DataAccessService } = require('./data-access-service.cjs')
    const db = { list: vi.fn(), get: vi.fn(), save: vi.fn(), remove: vi.fn() }
    const storage = { state: vi.fn(() => ({ mode: 'server', operationalMode: 'lan-host', baseUrl: 'http://127.0.0.1:4732' })) }
    const remote = { list: vi.fn(), get: vi.fn(), save: vi.fn(), remove: vi.fn() }
    const moduleStorage = { state: vi.fn((module:string) => ({ module, state: module === 'finance' ? 'migration-required' : 'central-active' })) }
    const service = new DataAccessService({ db, storage, remote, moduleStorage })

    await expect(service.list('fornecedores', {})).rejects.toThrow(/financeiro|central|ativo/i)
    expect(db.list).not.toHaveBeenCalled()
    expect(remote.list).not.toHaveBeenCalled()
  })

  it('Documentos central-active usa somente o Server e migration-required nunca cai no SQLite', async () => {
    const { DataAccessService } = require('./data-access-service.cjs')
    const db = { list: vi.fn(), get: vi.fn(), save: vi.fn(), remove: vi.fn() }
    const storage = { state: vi.fn(() => ({ mode: 'server', operationalMode: 'lan-client', baseUrl: 'http://server:4732' })) }
    const remote = { list: vi.fn(async()=>[{id:81,titulo:'Central'}]), get: vi.fn(), save: vi.fn(), remove: vi.fn() }
    let state='central-active'
    const moduleStorage = { state: vi.fn((module:string) => ({ module, state: module === 'documents' ? state : 'central-active' })) }
    const service = new DataAccessService({ db, storage, remote, moduleStorage })

    await expect(service.list('documentos', { obra_id:7 })).resolves.toEqual([{id:81,titulo:'Central'}])
    expect(db.list).not.toHaveBeenCalled()
    state='migration-required'
    await expect(service.list('documentos', { obra_id:7 })).rejects.toThrow(/documentos|central|ativo/i)
    expect(db.list).not.toHaveBeenCalled()
  })
})
