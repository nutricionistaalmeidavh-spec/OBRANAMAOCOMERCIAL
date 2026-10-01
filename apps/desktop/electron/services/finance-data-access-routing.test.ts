import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const { DataAccessService } = require('./data-access-service.cjs')

function fixture(financeState:string) {
  const db = { list: vi.fn(() => [{ id: 1, source: 'local' }]), get: vi.fn(), save: vi.fn(async data => ({ ...data, source: 'local' })), remove: vi.fn(() => true) }
  const storage = { state: vi.fn(() => ({ mode: 'server', operationalMode: 'lan-host', baseUrl: 'http://127.0.0.1:4732' })) }
  const remote = { list: vi.fn(async () => [{ id: 2, source: 'central' }]), get: vi.fn(), save: vi.fn(async data => ({ ...data, source: 'central' })), remove: vi.fn(async () => true) }
  const moduleStorage = { state: vi.fn((module:string) => ({ module, state: module === 'finance' ? financeState : 'central-active', localRecords: 0 })) }
  return { service: new DataAccessService({ db, storage, remote, moduleStorage }), db, remote, moduleStorage }
}

describe('DataAccessService finance routing', () => {
  it.each(['fornecedores','categorias_financeiras','contas','pagamentos_conta'])('roteia %s ao servidor somente quando finance está central-active', async table => {
    const f = fixture('central-active')
    await expect(f.service.list(table, { empresa_id: 7 })).resolves.toEqual([{ id: 2, source: 'central' }])
    expect(f.remote.list).toHaveBeenCalledWith(table, { empresa_id: 7 })
    expect(f.db.list).not.toHaveBeenCalled()
  })

  it('migration-required mantém financeiro legado no SQLite local', async () => {
    const f = fixture('migration-required')
    await expect(f.service.list('contas', { empresa_id: 7 })).resolves.toEqual([{ id: 1, source: 'local' }])
    expect(f.db.list).toHaveBeenCalledWith('contas', { empresa_id: 7 })
    expect(f.remote.list).not.toHaveBeenCalled()
  })

  it('central-ready bloqueia CRUD financeiro em vez de cair no SQLite', async () => {
    const f = fixture('central-ready')
    await expect(f.service.save('contas', { empresa_id: 7, descricao: 'Não salvar local' })).rejects.toThrow(/Financeiro|central|fallback/i)
    expect(f.db.save).not.toHaveBeenCalled()
    expect(f.remote.save).not.toHaveBeenCalled()
  })
})
