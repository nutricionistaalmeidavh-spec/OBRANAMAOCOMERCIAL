import { once } from 'node:events'
import { describe, expect, it } from 'vitest'

describe('Obra na Mao LAN server', () => {
  it('expoe health e version e rejeita rotas/metodos fora do contrato', async () => {
    const { createLanServer } = await import('../../lan-server/src/server.mjs')
    const server = createLanServer({ serverVersion: '0.1.0' })
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Servidor de teste sem porta TCP.')
    const baseUrl = `http://127.0.0.1:${address.port}`

    try {
      const health = await fetch(`${baseUrl}/health`)
      expect(health.status).toBe(200)
      expect(await health.json()).toEqual({ status: 'ok', product: 'Obra na Mão', apiVersion: '1' })

      const version = await fetch(`${baseUrl}/version`)
      expect(version.status).toBe(200)
      expect(await version.json()).toEqual({ product: 'Obra na Mão', apiVersion: '1', serverVersion: '0.1.0' })

      const missing = await fetch(`${baseUrl}/missing`)
      expect(missing.status).toBe(404)

      const method = await fetch(`${baseUrl}/health`, { method: 'POST' })
      expect(method.status).toBe(405)
    } finally {
      server.close()
      await once(server, 'close')
    }
  })
})
