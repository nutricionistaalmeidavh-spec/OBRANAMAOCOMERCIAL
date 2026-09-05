import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const here=dirname(fileURLToPath(import.meta.url))
const read=(relative:string)=>readFileSync(resolve(here,relative),'utf8')

describe('global AI assistant',()=>{
  it('moves the AI entry out of the sidebar and into the global topbar',()=>{
    const shell=read('../src/modules/command-center/CommandCenterShell.tsx')
    expect(shell).toContain('GlobalAiAssistant')
    expect(shell).not.toContain("label: 'Assistente IA'")
    expect(shell).not.toContain("{ to: '/assistente-ia'")
  })

  it('keeps the full assistant route for deep analysis and compatibility',()=>{
    const app=read('../src/App.tsx')
    expect(app).toContain('path="/assistente-ia"')
    const global=read('../src/components/GlobalAiAssistant.tsx')
    expect(global).toContain('Abrir assistente completo')
    expect(global).toContain("to='/assistente-ia'")
  })

  it('opens a drawer without navigation and keeps conversation state inside the shell',()=>{
    const global=read('../src/components/GlobalAiAssistant.tsx')
    expect(global).toContain('global-ai-drawer')
    expect(global).toContain('global-ai-trigger')
    expect(global).toContain('setOpen')
    expect(global).toContain('messages')
  })

  it('adds current screen and work context to the AI payload',()=>{
    const global=read('../src/components/GlobalAiAssistant.tsx')
    const context=read('../src/utils/ai-context.ts')
    for(const token of ['location.pathname','empresaId','obraId','screenLabel'])expect(global).toContain(token)
    for(const token of ['screen?: string','pathname?: string','empresaId?: string','obraId?: string'])expect(context).toContain(token)
  })
})
