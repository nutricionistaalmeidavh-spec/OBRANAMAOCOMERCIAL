import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const settings=fs.readFileSync(path.resolve(process.cwd(),'src/pages/SettingsPage.tsx'),'utf8')
const team=fs.readFileSync(path.resolve(process.cwd(),'src/components/TeamAccessSettings.tsx'),'utf8')
const preload=fs.readFileSync(path.resolve(process.cwd(),'electron/preload.cjs'),'utf8')
const online=fs.readFileSync(path.resolve(process.cwd(),'electron/services/online-service.cjs'),'utf8')

describe('Equipe e acessos canônica no Desktop',()=>{
  it('apresenta a gestão de colaboradores nas Configurações do Desktop',()=>{
    expect(settings).toContain('TeamAccessSettings')
    expect(settings).toContain('Equipe e acessos')
    expect(team).toContain('Adicionar colaborador')
    expect(team).toContain('Aguardando primeiro acesso')
    expect(team).toContain('Código de convite')
    expect(team).toContain('Web / celular')
    expect(team).toContain('Desktop')
    expect(team).toContain('Revogar acesso')
    expect(team).toContain('Reativar acesso')
  })

  it('usa os mesmos contratos Cloud de membros em vez de cadastro local paralelo',()=>{
    expect(online).toContain("'/api/desktop/members/list'")
    expect(online).toContain("'/api/desktop/members/save'")
    expect(preload).toContain('membersList')
    expect(preload).toContain('memberSave')
    expect(preload).toContain('memberStatus')
    expect(team).toContain('window.fluxoDre.online.membersList()')
    expect(team).toContain('window.fluxoDre.online.memberSave')
    expect(team).not.toContain('localStorage')
  })

  it('explica e bloqueia Desktop secundário quando a empresa usa somente este computador',()=>{
    expect(team).toContain("storageTopology.mode==='local-single'")
    expect(team).toContain('Desktop adicional indisponível')
    expect(team).toContain('Vários computadores')
    expect(team).toContain('desktopDisabled')
  })

  it('mostra que o acesso Desktop herda o servidor da empresa',()=>{
    expect(team).toContain('Desktop vinculado ao servidor da empresa')
    expect(team).toContain('desktopStorage')
    expect(team).toContain('serverId')
  })
})
