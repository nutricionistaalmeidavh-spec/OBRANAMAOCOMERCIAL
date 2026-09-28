import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const here=dirname(fileURLToPath(import.meta.url))
const read=(relative:string)=>readFileSync(resolve(here,relative),'utf8')

describe('cadastro rapido no fluxo de obras',()=>{
  it('permite criar empresa e cliente sem sair do formulario de nova obra',()=>{
    const works=read('../src/pages/WorksPage.tsx')
    expect(works).toContain("openQuickRegistry('empresa')")
    expect(works).toContain("openQuickRegistry('cliente')")
    expect(works).toContain('window.fluxoDre.empresas.save')
    expect(works).toContain('window.fluxoDre.clientes.save')
    expect(works).toContain("empresa_id: String(saved.id)")
    expect(works).toContain("cliente_id: String(saved.id)")
  })

  it('mantem cadastros visiveis na navegacao principal do command center',()=>{
    const shell=read('../src/modules/command-center/CommandCenterShell.tsx')
    expect(shell).toContain("to: '/cadastros'")
    expect(shell).toContain("label: 'Clientes e empresas'")
  })
})
