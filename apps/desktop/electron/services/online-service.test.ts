import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { afterEach, describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const { OnlineService } = require('./online-service.cjs')
const dirs: string[] = []

function response(status: number, body: any) {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

afterEach(() => {
  vi.restoreAllMocks()
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

describe('OnlineService', () => {
  it('vincula o Desktop, guarda o token e valida a sessão', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluxo-online-'))
    dirs.push(dir)
    const opened: string[] = []
    let requestId = ''
    let secret = ''
    const fetchImpl = vi.fn(async (url: string, init: any) => {
      const route = new URL(url).pathname
      const body = JSON.parse(init.body)
      if (route === '/api/desktop/start') {
        requestId = body.requestId
        secret = body.secret
        return response(200, { ok: true, expiresAt: '2099-01-01T00:00:00.000Z' })
      }
      if (route === '/api/desktop/status') {
        expect(body).toMatchObject({ requestId, secret })
        return response(200, { status: 'approved', deviceToken: 'device-token-test', deviceId: 'd1' })
      }
      if (route === '/api/desktop/session') {
        expect(body.deviceToken).toBe('device-token-test')
        return response(200, { authorized: true, company: { name: 'Empresa Teste' } })
      }
      return response(404, { error: 'rota inesperada' })
    })
    const service = new OnlineService({
      dataDir: dir,
      fetchImpl,
      baseUrl: 'https://example.test',
      shell: { openExternal: async (url: string) => { opened.push(url) } },
      safeStorage: { isEncryptionAvailable: () => false }
    })

    const started = await service.start()
    expect(opened[0]).toContain('#desktop-auth=')
    expect(started.expiresAt).toBeTruthy()

    const status = await service.status()
    expect(status).toMatchObject({ status: 'approved', linked: true })

    const session = await service.session()
    expect(session).toMatchObject({ authorized: true })
    expect(service.state().linked).toBe(true)
  })

  it('não envia chamadas protegidas antes do vínculo', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluxo-online-'))
    dirs.push(dir)
    const service = new OnlineService({ dataDir: dir, fetchImpl: vi.fn(), baseUrl: 'https://example.test' })
    await expect(service.financeRead('dashboard')).rejects.toThrow(/vinculado/i)
  })
})
