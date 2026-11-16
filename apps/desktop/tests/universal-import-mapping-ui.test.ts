import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const page = readFileSync(resolve(fileURLToPath(new URL('.', import.meta.url)), '../src/pages/ImportPage.tsx'), 'utf8')

describe('mapeamento manual do importador universal', () => {
  it('oferece seletores editáveis para relacionar cada campo da área às colunas do Excel', () => {
    expect(page).toContain('Coluna de origem')
    expect(page).toContain('Object.entries(mapping)')
    expect(page).toContain('setMapping({ ...mapping, [field]: event.target.value })')
  })

  it('lista as colunas da aba selecionada como opções do mapeamento', () => {
    expect(page).toContain('file.sheets.find')
    expect(page).toContain('selectedSheet.headers.map')
    expect(page).toContain('value={mapping[field] ||')
  })
})
