import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { afterEach, describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const tempDirs: string[] = []

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

function onlineFixture() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'obra-storage-online-'))
  tempDirs.push(dataDir)
  const configPath = path.join(dataDir, 'online-connection.json')
  const config = {
    baseUrl: 'https://obra-na-mao-comercial.nutricionistaalmeidavh.workers.dev',
    installationId: 'install-compat-001',
    tokenValue: Buffer.from('device-token-compat', 'utf8').toString('base64'),
    tokenEncoding: 'base64',
    linkedAt: '2026-09-29T12:00:00.000Z',
    tenant: {
      companyId: 'company-42',
      companyName: 'Empresa Compatibilidade',
      baseUrl: 'https://obra-na-mao-comercial.nutricionistaalmeidavh.workers.dev'
    }
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
  const { OnlineService } = require('./online-service.cjs')
  const online = new OnlineService({ dataDir, shell: {}, safeStorage: null, fetchImpl: vi.fn() })
  return { online, configPath, config }
}

afterEach(() => {
  while (tempDirs.length) fs.rmSync(tempDirs.pop()!, { recursive: true, force: true })
})

describe('storage x online compatibility', () => {
  it('does not change online connection state when storage configuration changes', () => {
    const { StorageConnectionService } = require('./storage-connection-service.cjs')
    const { online, configPath } = onlineFixture()
    const storage = new StorageConnectionService({ db: fakeDb(), fetchImpl: vi.fn() })
    const beforeState = online.state()
    const beforeFile = fs.readFileSync(configPath, 'utf8')

    storage.configure({ mode: 'server', host: '192.168.1.20', port: 4732 })

    expect(online.state()).toEqual(beforeState)
    expect(fs.readFileSync(configPath, 'utf8')).toBe(beforeFile)
  })

  it('keeps a linked online tenant/token when switching legacy local to server storage', () => {
    const { StorageConnectionService } = require('./storage-connection-service.cjs')
    const { online, configPath, config } = onlineFixture()
    const db = fakeDb({ storage_mode: 'local' })
    const storage = new StorageConnectionService({ db, fetchImpl: vi.fn() })

    expect(online.state().linked).toBe(true)
    storage.configure({ mode: 'server', host: 'servidor.local', port: 4810 })

    const persisted = JSON.parse(fs.readFileSync(configPath, 'utf8'))
    expect(online.state().linked).toBe(true)
    expect(persisted.tokenValue).toBe(config.tokenValue)
    expect(persisted.tenant).toEqual(config.tenant)
    expect(db.values.get('storage_mode')).toBe('server')
  })

  it('keeps Cloudflare base URL independent from LAN host and port', () => {
    const { StorageConnectionService } = require('./storage-connection-service.cjs')
    const { online } = onlineFixture()
    const storage = new StorageConnectionService({ db: fakeDb(), fetchImpl: vi.fn() })

    storage.configure({ mode: 'server', host: '10.10.20.30', port: 4999 })

    expect(storage.state().baseUrl).toBe('http://10.10.20.30:4999')
    expect(online.state().baseUrl).toBe('https://obra-na-mao-comercial.nutricionistaalmeidavh.workers.dev')
  })
})
