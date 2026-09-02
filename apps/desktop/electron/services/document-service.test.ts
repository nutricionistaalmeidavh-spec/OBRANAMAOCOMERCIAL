import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { afterEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { readLocalTemplate, renderCustom } = require('./document-service.cjs')
const folders: string[] = []

afterEach(() => folders.splice(0).forEach((folder) => fs.rmSync(folder, { recursive: true, force: true })))

describe('modelos locais de RH', () => {
  it('importa um HTML local como cópia editável e remove scripts', () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'fluxo-dre-template-'))
    folders.push(folder)
    const source = path.join(folder, 'contrato.html')
    fs.writeFileSync(source, '<h1>{{nome_funcionario}}</h1><script>alert(1)</script>')

    expect(readLocalTemplate(source)).toMatchObject({ nome: 'contrato', arquivo_origem: source, conteudo_html: '<h1>{{nome_funcionario}}</h1>' })
  })

  it('preenche os campos permitidos e não mantém código executável na geração', () => {
    const html = renderCustom('<p>{{nome_funcionario}}</p><script>alert(1)</script>', { nome: 'Ana & João' }, {}, 'Contrato')
    expect(html).toContain('Ana &amp; João')
    expect(html).not.toContain('<script')
  })

  it('mantém um marcador claro para campos definidos como manuais', () => {
    const html = renderCustom('<p>{{manual:assinatura do responsável}}</p>', {}, {}, 'Contrato')
    expect(html).toContain('PREENCHER: assinatura do responsável')
  })
})
