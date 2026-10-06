import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const source=fs.readFileSync(path.resolve(import.meta.dirname,'finance.ts'),'utf8')

describe('F16 finance product QA contract', () => {
  it('gives the admin a dedicated immutable history surface', () => {
    expect(source).toContain("['history','Histórico']")
    expect(source).toContain('Histórico financeiro')
    expect(source).toContain('Quem confirmou')
  })

  it('answers the four product traceability questions in the UI', () => {
    expect(source).toContain('De onde veio este valor?')
    expect(source).toContain('Saiu do banco?')
    expect(source).toContain('Por que correspondeu?')
    expect(source).toContain('O que falta comprovar?')
  })

  it('keeps human confirmation explicit and never presents suggestions as automatic settlement', () => {
    expect(source).toContain('Confirmar vínculo')
    expect(source).toContain('Revise antes de confirmar')
    expect(source).toContain('Nenhuma correção é feita sem sua confirmação')
  })
})
