import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const webRoot=process.cwd()
const field=readFileSync(resolve(webRoot,'public/field.js'),'utf8')
const main=readFileSync(resolve(webRoot,'src/main.ts'),'utf8')
const governance=readFileSync(resolve(webRoot,'src/admin-governance.ts'),'utf8')
const obraHtml=readFileSync(resolve(webRoot,'obra.html'),'utf8')
const sistemaHtml=readFileSync(resolve(webRoot,'sistema.html'),'utf8')
const desktopLogin=readFileSync(resolve(webRoot,'../desktop/src/components/DesktopLogin.tsx'),'utf8')
const desktopSync=readFileSync(resolve(webRoot,'../desktop/src/components/SyncSettings.tsx'),'utf8')
const desktopTeam=readFileSync(resolve(webRoot,'../desktop/src/components/TeamAccessSettings.tsx'),'utf8')

describe('Obra360 continuity UX contract',()=>{
  it('treats Desktop-originated records as obra objects instead of a separate silo',()=>{
    expect(field).not.toContain('<h2>Do Desktop</h2>')
    expect(field).not.toContain('itens do Desktop')
    expect(field).toContain('Operação da obra')
    expect(field).toContain('Origem: computador')
    expect(field).toContain('Tarefas')
    expect(field).toContain('Frentes')
    expect(field).toContain('RDOs')
  })

  it('uses user-facing save states instead of transport language',()=>{
    expect(main).toContain('Salvo na obra')
    expect(main).toContain('aguardando conexão para enviar')
    expect(main).not.toContain('Alterações enviadas ao servidor. Aguardam sincronização do Desktop.')
    expect(field).toContain('Alteração salva na obra')
    expect(field).not.toContain('Alteração enviada ao servidor. Aguardando sincronização do Desktop.')
  })

  it('uses Obra as the tab label and one vocabulary for production and RDO completion',()=>{
    for(const html of [obraHtml,sistemaHtml])expect(html).toContain('data-screen="obra360">Obra</button>')
    expect(field).toContain('Iniciar apontamento')
    expect(field).not.toContain('Iniciar atividade')
    expect(field).toContain('Revisar e fechar RDO')
    expect(field).not.toContain('Concluir RDO')
    expect(field).not.toContain('Revisar fechamento')
  })

  it('keeps manual LAN addressing behind recovery instead of the normal path',()=>{
    expect(desktopLogin).toContain('Informar endereço manualmente')
    expect(desktopLogin).toContain('Não encontrou o computador principal?')
    expect(desktopLogin).toContain('setManualAddress')
    expect(desktopLogin).not.toContain("label={remote?'Endereço HTTPS do servidor':'Endereço do servidor (opcional)'}")
  })

  it('separates member list from member editor and makes role defaults the normal permission path',()=>{
    expect(governance).toContain('Adicionar colaborador')
    expect(governance).toContain('Personalizar permissões')
    expect(governance).toContain('Usar permissões recomendadas para')
    expect(desktopTeam).toContain('Personalizar permissões')
    expect(desktopTeam).toContain('Permissões recomendadas para')
  })

  it('shows operational sync health before technical counters',()=>{
    expect(governance).toContain('Sincronização da obra')
    expect(governance).toContain('Detalhes técnicos')
    expect(governance).not.toContain('Saúde da sincronização')
    expect(governance).toContain('alteração aguardando o computador')
  })

  it('renders human conflict choices on both PWA and Desktop',()=>{
    expect(field).toContain('Manter versão do Obra360')
    expect(field).toContain('Usar versão do computador')
    expect(field).not.toContain('Manter Mobile')
    expect(desktopSync).toContain('Versão deste computador')
    expect(desktopSync).toContain('Versão do Obra360')
    expect(desktopSync).toContain('Manter versão deste computador')
    expect(desktopSync).toContain('Usar versão do Obra360')
    expect(desktopSync).not.toContain('Manter dados locais')
    expect(desktopSync).not.toContain('Usar dados online')
  })
})
