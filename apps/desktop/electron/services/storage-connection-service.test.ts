import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)

function fakeDb(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  return {
    values,
    db: {
      prepare(sql: string) {
        if (/SELECT valor FROM configuracoes/.test(sql)) {
          return { get: (key: string) => values.has(key) ? { valor: values.get(key) } : undefined }
        }
        if (/INSERT INTO configuracoes/.test(sql)) {
          return { run: (key: string, value: string) => { values.set(key, String(value)); return { changes: 1 } } }
        }
        throw new Error(`SQL inesperado no teste: ${sql}`)
      }
    }
  }
}

function response(status: number, body: any) {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

describe('StorageConnectionService', () => {
  it('mantem instalacoes existentes em modo local por padrao', () => {
    const { StorageConnectionService } = require('./storage-connection-service.cjs')
    const service = new StorageConnectionService({ db: fakeDb(), fetchImpl: vi.fn() })
    expect(service.state()).toEqual({ mode: 'local', operationalMode: 'local', host: '127.0.0.1', port: 4732, baseUrl: 'http://127.0.0.1:4732' })
  })

  it('expõe local como papel operacional de uma instalação nova', () => {
    const { StorageConnectionService } = require('./storage-connection-service.cjs')
    const service = new StorageConnectionService({ db: fakeDb(), fetchImpl: vi.fn() })
    expect(service.state().operationalMode).toBe('local')
  })

  it('mapeia storage_mode server legado para lan-client sem alterar host e porta', () => {
    const { StorageConnectionService } = require('./storage-connection-service.cjs')
    const service = new StorageConnectionService({
      db: fakeDb({ storage_mode: 'server', lan_server_host: '192.168.50.10', lan_server_port: '4810' }),
      fetchImpl: vi.fn()
    })
    expect(service.state()).toMatchObject({
      mode: 'server',
      operationalMode: 'lan-client',
      host: '192.168.50.10',
      port: 4810,
      baseUrl: 'http://192.168.50.10:4810'
    })
  })

  it('rejeita papel operacional desconhecido', () => {
    const { StorageConnectionService } = require('./storage-connection-service.cjs')
    const service = new StorageConnectionService({ db: fakeDb(), fetchImpl: vi.fn() })
    expect(() => service.validateOperationalMode('satellite')).toThrow(/operacional|armazenamento|inválido|invalido/i)
  })

  it('persiste modo, host e porta do servidor da empresa', () => {
    const { StorageConnectionService } = require('./storage-connection-service.cjs')
    const db = fakeDb()
    const service = new StorageConnectionService({ db, fetchImpl: vi.fn() })
    expect(service.configure({ mode: 'server', host: 'servidor-escritorio.local', port: 4810 })).toEqual({
      mode: 'server', operationalMode: 'lan-client', host: 'servidor-escritorio.local', port: 4810, baseUrl: 'http://servidor-escritorio.local:4810'
    })
    expect(db.values.get('storage_mode')).toBe('server')
    expect(db.values.get('lan_server_host')).toBe('servidor-escritorio.local')
    expect(db.values.get('lan_server_port')).toBe('4810')
  })

  it.each([
    'http://192.168.0.10',
    'https://servidor.local',
    'servidor.local/caminho',
    'usuario@servidor.local'
  ])('rejeita host fora do contrato antes da rede: %s', (host) => {
    const { StorageConnectionService } = require('./storage-connection-service.cjs')
    const fetchImpl = vi.fn()
    const service = new StorageConnectionService({ db: fakeDb(), fetchImpl })
    expect(() => service.configure({ mode: 'server', host, port: 4732 })).toThrow(/host|servidor|endereco/i)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it.each([0, -1, 65536, 12.5, Number.NaN])('rejeita porta invalida: %s', (port) => {
    const { StorageConnectionService } = require('./storage-connection-service.cjs')
    const service = new StorageConnectionService({ db: fakeDb(), fetchImpl: vi.fn() })
    expect(() => service.configure({ mode: 'server', host: '192.168.0.10', port })).toThrow(/porta/i)
  })

  it('reconhece apenas o health check do Obra na Mao API v1', async () => {
    const { StorageConnectionService } = require('./storage-connection-service.cjs')
    const fetchImpl = vi.fn(async (url: string) => {
      expect(url).toBe('http://192.168.0.10:4732/health')
      return response(200, { status: 'ok', product: 'Obra na Mão', apiVersion: '1' })
    })
    const service = new StorageConnectionService({ db: fakeDb({ storage_mode: 'server', lan_server_host: '192.168.0.10', lan_server_port: '4732' }), fetchImpl })
    await expect(service.testConnection()).resolves.toMatchObject({
      ok: true,
      baseUrl: 'http://192.168.0.10:4732',
      health: { status: 'ok', product: 'Obra na Mão', apiVersion: '1' }
    })
  })

  it('rejeita HTTP 200 de outro servico', async () => {
    const { StorageConnectionService } = require('./storage-connection-service.cjs')
    const fetchImpl = vi.fn(async () => response(200, { status: 'ok', product: 'Outro Sistema', apiVersion: '1' }))
    const service = new StorageConnectionService({ db: fakeDb({ storage_mode: 'server', lan_server_host: '192.168.0.10', lan_server_port: '4732' }), fetchImpl })
    await expect(service.testConnection()).rejects.toThrow(/Obra na Mão|compativel|compatível/i)
  })

  it('traduz falha de rede em erro legivel', async () => {
    const { StorageConnectionService } = require('./storage-connection-service.cjs')
    const fetchImpl = vi.fn(async () => { throw new TypeError('fetch failed') })
    const service = new StorageConnectionService({ db: fakeDb({ storage_mode: 'server', lan_server_host: '192.168.0.10', lan_server_port: '4732' }), fetchImpl })
    await expect(service.testConnection()).rejects.toThrow(/conectar|servidor/i)
  })
})
