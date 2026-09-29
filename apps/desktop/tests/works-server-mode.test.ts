import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const source = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/WorksPage.tsx'), 'utf8')

describe('obras no modo servidor', () => {
  it('consulta o modo de armazenamento e nao abre overview local para uma obra remota', () => {
    expect(source).toContain('window.fluxoDre.storage.state()')
    expect(source).toContain("storage.data?.mode === 'server'")
    expect(source).toMatch(/selectedId\s*&&\s*!serverMode/)
  })

  it('mantem CRUD de obras disponivel e bloqueia modulos ainda locais com mensagem explicita', () => {
    expect(source).toContain('Empresas, clientes e obras estão usando o servidor da empresa.')
    expect(source).toContain('Obra 360 e módulos operacionais continuam locais nesta etapa.')
    expect(source).toMatch(/disabled=\{importing\|\|serverMode\}/)
    expect(source).toMatch(/disabled=\{!selectedId\|\|serverMode\}/)
  })
})
