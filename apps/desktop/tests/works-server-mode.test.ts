import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const source = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/WorksPage.tsx'), 'utf8')

describe('obras no modo servidor', () => {
  it('usa estado canônico por módulo em vez de bloquear tudo por serverMode', () => {
    expect(source).toContain('window.fluxoDre.storage.state()')
    expect(source).toContain("window.fluxoDre.storage.moduleState('core')")
    expect(source).toContain("window.fluxoDre.storage.moduleState('operation')")
    expect(source).toContain("window.fluxoDre.storage.moduleState('planning')")
    expect(source).toContain("moduleStates.data?.[module]?.state === 'central-active'")
    expect(source).not.toMatch(/disabled=\{!selectedId\|\|serverMode\}/)
  })

  it('abre overview pela fonte canônica e bloqueia somente o módulo que ainda não está ativo', () => {
    expect(source).toContain("selectedId ? window.fluxoDre.obras.overview(Number(selectedId))")
    expect(source).toContain("disabled={!selectedId||!moduleActive('operation')}")
    expect(source).toContain("disabled={!selectedId||!moduleActive('planning')}")
    expect(source).toContain("disabled={!selectedId||!moduleActive('core')}")
    expect(source).toContain('Uso compartilhado ativo')
  })

  it('mantém importação de planilhas local bloqueada no modo servidor', () => {
    expect(source).toMatch(/disabled=\{importing\|\|serverMode\}/)
  })
})
