import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const settings = fs.readFileSync(path.resolve(process.cwd(), 'src/components/SyncSettings.tsx'), 'utf8')
const contract = fs.readFileSync(path.resolve(process.cwd(), '../../packages/contracts/src/desktop-sync.ts'), 'utf8')

describe('propriedade da sincronizacao central', () => {
  it('explica que lan-client nao coordena a Cloud e aponta para o PC principal', () => {
    expect(settings).toContain("state?.source === 'lan-client'")
    expect(settings).toContain('A sincronização central é responsabilidade do PC principal')
    expect(settings).toContain('Este computador continua usando os dados do servidor da empresa')
  })

  it('mantem Web/PWA como parte incluida e independente da fonte operacional', () => {
    expect(settings).toContain('Web/PWA continua incluído')
    expect(settings).toContain('não depende de este computador ser o coordenador')
  })

  it('tipa source e pauseReason sem remover o contrato existente', () => {
    expect(contract).toContain("source: 'local' | 'lan-host' | 'lan-client' | 'remote'")
    expect(contract).toContain('pauseReason: string | null')
    expect(contract).toContain('configured: boolean; paused: boolean; running: boolean')
  })
})
