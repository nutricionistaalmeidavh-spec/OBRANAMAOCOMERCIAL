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

describe('assistente de importação P0-P2', () => {
  it('permite abrir arquivos arrastados e baixar modelos diretamente no Desktop', () => {
    expect(page).toContain('onDrop={dropFile}')
    expect(page).toContain('importadorUniversal.dropped(selected)')
    expect(page).toContain('importadorUniversal.template(area')
    expect(page).toContain('Baixar modelo de planilha')
  })

  it('solicita escolha explícita da área quando a detecção é ambígua', () => {
    expect(page).toContain('const unambiguous')
    expect(page).toContain("setArea(unambiguous ? first.area : '')")
    expect(page).toContain('Selecione o destino dos dados')
  })

  it('apresenta resultado de duplicidade e permite exportar todos os erros', () => {
    expect(page).toContain('preview.duplicates')
    expect(page).toContain('preview.alreadyImported')
    expect(page).toContain('importadorUniversal.exportIssues')
    expect(page).toContain('Baixar relatório completo de erros')
  })

  it('salva perfis na empresa e mostra quando foram restaurados', () => {
    expect(page).toContain('importadorUniversal.saveMapping')
    expect(page).toContain("mappingSource==='saved'")
  })
})
