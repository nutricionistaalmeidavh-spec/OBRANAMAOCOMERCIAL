import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)

describe('LanDataClient', () => {
  it('lista entidades suportadas com filtros na query string', async () => {
    const { LanDataClient } = require('./lan-data-client.cjs')
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [{ id: 1, razao_social: 'Empresa A' }]
    }))
    const storage = { state: () => ({ mode: 'server', baseUrl: 'http://192.168.0.10:4732' }) }
    const client = new LanDataClient({ storage, fetchImpl })

    await expect(client.list('empresas', { status: 'ativa', vazio: '' })).resolves.toEqual([{ id: 1, razao_social: 'Empresa A' }])
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, options] = fetchImpl.mock.calls[0]
    expect(url).toBe('http://192.168.0.10:4732/api/v1/empresas?status=ativa')
    expect(options.method).toBe('GET')
  })

  it('usa POST para criar e PUT para atualizar clientes e obras', async () => {
    const { LanDataClient } = require('./lan-data-client.cjs')
    const fetchImpl = vi.fn(async (_url: string, options: any) => ({
      ok: true,
      status: options.method === 'POST' ? 201 : 200,
      json: async () => JSON.parse(options.body)
    }))
    const storage = { state: () => ({ mode: 'server', baseUrl: 'http://servidor:4732' }) }
    const client = new LanDataClient({ storage, fetchImpl })

    await client.save('clientes', { nome: 'Cliente A', empresa_id: 1 })
    await client.save('obras', { id: 9, nome: 'Obra A', empresa_id: 1 })

    expect(fetchImpl.mock.calls[0][0]).toBe('http://servidor:4732/api/v1/clientes')
    expect(fetchImpl.mock.calls[0][1].method).toBe('POST')
    expect(fetchImpl.mock.calls[1][0]).toBe('http://servidor:4732/api/v1/obras/9')
    expect(fetchImpl.mock.calls[1][1].method).toBe('PUT')
  })

  it('propaga mensagem legivel do servidor e rejeita tabelas fora do escopo', async () => {
    const { LanDataClient } = require('./lan-data-client.cjs')
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: 'validation_error', message: 'Empresa obrigatória.' })
    }))
    const storage = { state: () => ({ mode: 'server', baseUrl: 'http://servidor:4732' }) }
    const client = new LanDataClient({ storage, fetchImpl })

    await expect(client.save('obras', { nome: 'Sem empresa' })).rejects.toThrow('Empresa obrigatória.')
    await expect(client.list('contas', {})).rejects.toThrow('Entidade ainda não disponível no servidor da empresa.')
  })
})
