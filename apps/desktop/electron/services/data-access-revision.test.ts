import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)

describe('DataAccessService optimistic delete contract', () => {
  it('reuses the revision observed in the central list when the UI deletes that record', async () => {
    const { DataAccessService } = require('./data-access-service.cjs')
    const db = { list: vi.fn(), get: vi.fn(), save: vi.fn(), remove: vi.fn() }
    const storage = { state: () => ({ mode:'server', operationalMode:'lan-client', baseUrl:'http://server:4732' }) }
    const remote = {
      list: vi.fn(async () => [{ id:17, nome:'Obra A', revision:6 }]),
      get: vi.fn(),
      save: vi.fn(),
      remove: vi.fn(async () => true)
    }
    const service = new DataAccessService({ db, storage, remote })

    await expect(service.list('obras', {})).resolves.toEqual([{ id:17, nome:'Obra A', revision:6 }])
    await expect(service.remove('obras', 17)).resolves.toBe(true)
    expect(remote.remove).toHaveBeenCalledWith('obras', 17, 6)
    expect(db.remove).not.toHaveBeenCalled()
  })

  it('updates the remembered revision after get or save and allows an explicit observed revision override', async () => {
    const { DataAccessService } = require('./data-access-service.cjs')
    const db = { list: vi.fn(), get: vi.fn(), save: vi.fn(), remove: vi.fn() }
    const storage = { state: () => ({ mode:'server', operationalMode:'lan-client', baseUrl:'http://server:4732' }) }
    const remote = {
      list: vi.fn(),
      get: vi.fn(async () => ({ id:17, revision:7 })),
      save: vi.fn(async () => ({ id:17, revision:8 })),
      remove: vi.fn(async () => true)
    }
    const service = new DataAccessService({ db, storage, remote })

    await service.get('obras', 17)
    await service.save('obras', { id:17, revision:7, nome:'Nova' })
    await service.remove('obras', 17)
    expect(remote.remove).toHaveBeenLastCalledWith('obras', 17, 8)

    await service.remove('obras', 17, 9)
    expect(remote.remove).toHaveBeenLastCalledWith('obras', 17, 9)
  })

  it('keeps local delete behavior unchanged even when caller carries revision metadata', async () => {
    const { DataAccessService } = require('./data-access-service.cjs')
    const db = { list: vi.fn(), get: vi.fn(), save: vi.fn(), remove: vi.fn(() => true) }
    const storage = { state: () => ({ mode:'local', operationalMode:'local', baseUrl:null }) }
    const remote = { list: vi.fn(), get: vi.fn(), save: vi.fn(), remove: vi.fn() }
    const service = new DataAccessService({ db, storage, remote })

    await expect(service.remove('obras', 17, 6)).resolves.toBe(true)
    expect(db.remove).toHaveBeenCalledWith('obras', 17)
    expect(remote.remove).not.toHaveBeenCalled()
  })
})
