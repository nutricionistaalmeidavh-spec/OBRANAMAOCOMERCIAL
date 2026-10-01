import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)

describe('DataAccessService optimistic delete contract', () => {
  it('forwards the observed revision to central delete', async () => {
    const { DataAccessService } = require('./data-access-service.cjs')
    const db = { list: vi.fn(), get: vi.fn(), save: vi.fn(), remove: vi.fn() }
    const storage = { state: () => ({ mode:'server', operationalMode:'lan-client', baseUrl:'http://server:4732' }) }
    const remote = { list: vi.fn(), get: vi.fn(), save: vi.fn(), remove: vi.fn(async () => true) }
    const service = new DataAccessService({ db, storage, remote })

    await expect(service.remove('obras', 17, 6)).resolves.toBe(true)
    expect(remote.remove).toHaveBeenCalledWith('obras', 17, 6)
    expect(db.remove).not.toHaveBeenCalled()
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
