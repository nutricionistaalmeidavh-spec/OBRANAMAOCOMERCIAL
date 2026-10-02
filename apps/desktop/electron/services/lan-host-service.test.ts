import { EventEmitter } from 'node:events'
import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)

class FakeChild extends EventEmitter {
  pid = 321
  killed = false
  stdout = new EventEmitter()
  stderr = new EventEmitter()
  kill = vi.fn((_signal?: string) => { this.killed = true; queueMicrotask(() => this.emit('exit', 0, null)); return true })
}

function storage(mode: 'local'|'lan-host'|'lan-client' = 'local') {
  return { state: () => ({ mode: mode === 'local' ? 'local' : 'server', operationalMode: mode, host: '127.0.0.1', port: 4732, baseUrl: 'http://127.0.0.1:4732' }) }
}

describe('LanHostService', () => {
  it('não inicia processo em modo local ou lan-client', async () => {
    const { LanHostService } = require('./lan-host-service.cjs')
    const spawnImpl = vi.fn()
    await new LanHostService({ storage: storage('local'), dataDir: 'C:/data', cloudBaseUrl: 'https://cloud.example', spawnImpl, execPath: 'electron.exe', serverEntry: 'server.mjs' }).start()
    await new LanHostService({ storage: storage('lan-client'), dataDir: 'C:/data', cloudBaseUrl: 'https://cloud.example', spawnImpl, execPath: 'electron.exe', serverEntry: 'server.mjs' }).start()
    expect(spawnImpl).not.toHaveBeenCalled()
  })

  it('lan-host inicia exatamente um processo com ambiente explícito', async () => {
    const { LanHostService } = require('./lan-host-service.cjs')
    const child = new FakeChild(), spawnImpl = vi.fn(() => child)
    const service = new LanHostService({ storage: storage('lan-host'), dataDir: 'C:/obra-data', cloudBaseUrl: 'https://cloud.example', spawnImpl, execPath: 'electron.exe', serverEntry: 'C:/resources/lan-server/src/index.mjs' })
    const first = await service.start(), second = await service.start()
    expect(spawnImpl).toHaveBeenCalledTimes(1)
    expect(first.running).toBe(true); expect(second.running).toBe(true)
    const [command,args,options] = spawnImpl.mock.calls[0]
    expect(command).toBe('electron.exe')
    expect(args).toEqual(['C:/resources/lan-server/src/index.mjs'])
    expect(options.env).toMatchObject({ ELECTRON_RUN_AS_NODE:'1', OBRA_NA_MAO_LAN_HOST:'0.0.0.0', OBRA_NA_MAO_LAN_PORT:'4732', OBRA_NA_MAO_PLATFORM_URL:'https://cloud.example', OBRA_NA_MAO_SERVER_SHOW_SETUP_CODE:'true' })
    expect(options.env.OBRA_NA_MAO_LAN_DATA_DIR).toMatch(/lan-server/)
  })

  it('captura o setup code do runtime F18 sem gravá-lo no state enumerável', async () => {
    const { LanHostService } = require('./lan-host-service.cjs')
    const child = new FakeChild(), service = new LanHostService({ storage: storage('lan-host'), dataDir: 'C:/data', cloudBaseUrl: 'https://cloud.example', spawnImpl: () => child, execPath: 'electron.exe', serverEntry: 'server.mjs' })
    await service.start()
    child.stdout.emit('data', Buffer.from('Obra na Mão Server setup code (explicit opt-in): ABCDE-FGHIJ\n'))
    expect(service.state()).toMatchObject({ setupCodeAvailable:true })
    expect(service.state().setupCode).toBe('ABCDE-FGHIJ')
    expect(JSON.stringify(service.state())).not.toContain('ABCDE-FGHIJ')
  })

  it('saída inesperada fica visível no state e não causa fallback local', async () => {
    const { LanHostService } = require('./lan-host-service.cjs')
    const child = new FakeChild(), spawnImpl = vi.fn(() => child)
    const service = new LanHostService({ storage: storage('lan-host'), dataDir: 'C:/data', cloudBaseUrl: 'https://cloud.example', spawnImpl, execPath: 'electron.exe', serverEntry: 'server.mjs' })
    await service.start(); child.emit('exit', 17, null)
    expect(service.state()).toMatchObject({ running:false, lastError: expect.stringMatching(/17|encerrou|servidor/i) })
    expect(storage('lan-host').state().operationalMode).toBe('lan-host')
  })

  it('stop termina o processo e é idempotente', async () => {
    const { LanHostService } = require('./lan-host-service.cjs')
    const child = new FakeChild(), service = new LanHostService({ storage: storage('lan-host'), dataDir: 'C:/data', cloudBaseUrl: 'https://cloud.example', spawnImpl: () => child, execPath: 'electron.exe', serverEntry: 'server.mjs' })
    await service.start(); await service.stop(); await service.stop()
    expect(child.kill).toHaveBeenCalledTimes(1)
    expect(service.state().running).toBe(false)
  })
})
