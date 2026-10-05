import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source=readFileSync(resolve(process.cwd(),'src/main.ts'),'utf8')
const premium=readFileSync(resolve(process.cwd(),'public/field-premium-access.js'),'utf8')

describe('primeiro acesso Web/PWA por intenção',()=>{
  it('separa ativação comercial de convite de colaborador',()=>{
    expect(source).toContain('Ativar uma nova empresa')
    expect(source).toContain('Entrar em uma empresa existente')
    expect(source).toContain('Código recebido na compra')
    expect(source).toContain('Código de convite')
  })

  it('não tenta mais reinterpretar automaticamente convite como licença',()=>{
    const start=source.indexOf('function renderClaim')
    const end=source.indexOf('function apiError',start)
    const claim=source.slice(start,end)
    expect(claim).toContain("api.post('/api/access/claim',{code})")
    expect(claim).toContain("api.post('/api/license/claim',{code})")
    expect(claim).not.toContain("try{await api.post('/api/access/claim',{code})}catch{await api.post('/api/license/claim',{code})}")
  })

  it('explica que convite entra em empresa existente e não ativa nova licença',()=>{
    expect(source).toContain('Este convite não ativa uma nova licença')
    expect(source).toContain('empresa existente')
  })


  it('mantém a camada premium reconhecendo a nova tela de primeiro acesso',()=>{
    expect(premium).toContain('como você deseja começar')
    expect(premium).toContain("return 'claim'")
  })
})
