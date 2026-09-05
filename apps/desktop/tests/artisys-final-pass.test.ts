import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const here=dirname(fileURLToPath(import.meta.url))
const read=(relative:string)=>readFileSync(resolve(here,relative),'utf8')

describe('ArtiSys desktop final visual pass',()=>{
  it('loads the utilities skin after the shared, RH and operations layers',()=>{
    const app=read('../src/App.tsx')
    expect(app).toContain("./modules/command-center/artisys-desktop.css")
    expect(app).toContain("./modules/command-center/artisys-rh.css")
    expect(app).toContain("./modules/command-center/artisys-operations.css")
    expect(app).toContain("./modules/command-center/artisys-utilities.css")
  })

  it('scopes the final visual layer to the four utility routes',()=>{
    const shell=read('../src/modules/command-center/CommandCenterShell.tsx')
    const css=read('../src/modules/command-center/artisys-utilities.css')
    expect(shell).toContain('routeClass')
    expect(shell).toContain('location.pathname')
    for(const route of ['documentos','cadastros','importacao','configuracoes'])expect(css).toContain(`.route-${route}`)
    for(const selector of ['.settings-grid','.setting-card','.import-months','.locked-value','.benefit-config'])expect(css).toContain(selector)
  })

  it('preserves document file operations and filters',()=>{
    const page=read('../src/pages/DocumentsPage.tsx')
    for(const contract of ['documentos.list','arquivos.list','documentos.importForEmployee','documentos.importForWork','documentos.openFolder','documentos.open','documentos.reveal','documentos.copyPath'])expect(page).toContain(contract)
  })

  it('preserves base registries and universal import flows',()=>{
    const registries=read('../src/pages/RegistriesPage.tsx')
    const importer=read('../src/pages/ImportPage.tsx')
    for(const contract of ['fluxoDre.empresas','fluxoDre.clientes','fluxoDre.fornecedores'])expect(registries).toContain(contract)
    for(const contract of ['importadorUniversal.choose','importadorUniversal.preview','importadorUniversal.commit','importacoes.preview','importacoes.commit'])expect(importer).toContain(contract)
  })

  it('preserves settings maintenance, online connection and layout fallback',()=>{
    const settings=read('../src/pages/SettingsPage.tsx')
    for(const contract of ['backup.create','backup.restore','online.setBaseUrl','online.start','online.status','online.session','online.disconnect','catalogo.saveCargo','catalogo.saveBenefit',"changeLayout('command-center')","changeLayout('classic')"])expect(settings).toContain(contract)
  })

  it('keeps every desktop destination in the route map',()=>{
    const app=read('../src/App.tsx')
    const routes=['/','/assistente-ia','/dre','/financeiro','/folha','/obras','/obras/:id','/frentes','/orcamento','/planejamento','/rdo','/compras','/contratos','/tarefas','/medicoes','/rh','/funcionarios','/registro-funcionario','/ponto','/rh/modelos','/documentos','/cadastros','/importacao','/configuracoes']
    for(const route of routes)expect(app).toContain(`path="${route}"`)
  })
})
