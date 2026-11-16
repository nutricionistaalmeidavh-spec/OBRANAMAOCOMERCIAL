import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const { DataAccessService } = require('./data-access-service.cjs')

describe('remote server canonical CRUD isolation', () => {
  it('reads the canonical remote core database instead of a local SQLite copy', async () => {
    const db = {
      list: vi.fn(() => [{ id: 1, razao_social: 'LOCAL STALE' }]),
      get: vi.fn(), save: vi.fn(), remove: vi.fn()
    }
    const remote = {
      list: vi.fn(async () => [{ id: 8, razao_social: 'SERVER CANONICAL' }]),
      get: vi.fn(), save: vi.fn(), remove: vi.fn()
    }
    const storage = { state: () => ({ mode: 'server', operationalMode: 'remote', baseUrl: 'https://obras.exemplo.com' }) }
    const moduleStorage = { state: () => ({ state: 'central-active' }) }
    const service = new DataAccessService({ db, storage, remote, moduleStorage })

    await expect(service.list('empresas', {})).resolves.toEqual([{ id: 8, razao_social: 'SERVER CANONICAL' }])
    expect(remote.list).toHaveBeenCalledWith('empresas', {})
    expect(db.list).not.toHaveBeenCalled()
  })

  it('never writes local data when a remote module is not yet migrated', async () => {
    const db = { list: vi.fn(), get: vi.fn(), save: vi.fn(), remove: vi.fn() }
    const remote = { list: vi.fn(), get: vi.fn(), save: vi.fn(), remove: vi.fn() }
    const storage = { state: () => ({ mode: 'server', operationalMode: 'remote', baseUrl: 'https://obras.exemplo.com' }) }
    const moduleStorage = { state: () => ({ state: 'migration-required' }) }
    const service = new DataAccessService({ db, storage, remote, moduleStorage })

    await expect(service.save('funcionarios', { id: 25, nome: 'Não duplicar' })).rejects.toThrow(/RH central|não está ativo|servidor/i)
    expect(db.save).not.toHaveBeenCalled()
    expect(remote.save).not.toHaveBeenCalled()
  })

  it('does not fall back locally after a remote write fails', async () => {
    const db = { list: vi.fn(), get: vi.fn(), save: vi.fn(), remove: vi.fn() }
    const remote = { list: vi.fn(), get: vi.fn(), save: vi.fn(async () => { throw new Error('servidor indisponível') }), remove: vi.fn() }
    const storage = { state: () => ({ mode: 'server', operationalMode: 'remote', baseUrl: 'https://obras.exemplo.com' }) }
    const moduleStorage = { state: () => ({ state: 'central-active' }) }
    const service = new DataAccessService({ db, storage, remote, moduleStorage })

    await expect(service.save('obras', { id: 10, nome: 'Obra Remota' })).rejects.toThrow('servidor indisponível')
    expect(db.save).not.toHaveBeenCalled()
    expect(remote.save).toHaveBeenCalledTimes(1)
  })
})
