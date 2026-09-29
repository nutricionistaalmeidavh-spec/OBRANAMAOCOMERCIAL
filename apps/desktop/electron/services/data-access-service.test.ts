import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)

describe('DataAccessService', () => {
  it('preserva o CRUD local existente por delegacao ao DatabaseService', () => {
    const { DataAccessService } = require('./data-access-service.cjs')
    const db = {
      list: vi.fn(() => [{ id: 1 }]),
      get: vi.fn(() => ({ id: 2 })),
      save: vi.fn(() => ({ id: 3 })),
      remove: vi.fn(() => true)
    }
    const service = new DataAccessService({ db })

    expect(service.list('empresas', { status: 'ativa' })).toEqual([{ id: 1 }])
    expect(service.get('clientes', 2)).toEqual({ id: 2 })
    expect(service.save('obras', { nome: 'Obra A' })).toEqual({ id: 3 })
    expect(service.remove('empresas', 4)).toBe(true)

    expect(db.list).toHaveBeenCalledWith('empresas', { status: 'ativa' })
    expect(db.get).toHaveBeenCalledWith('clientes', 2)
    expect(db.save).toHaveBeenCalledWith('obras', { nome: 'Obra A' })
    expect(db.remove).toHaveBeenCalledWith('empresas', 4)
  })
})
