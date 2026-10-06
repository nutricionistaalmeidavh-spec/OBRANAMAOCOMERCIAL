import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('QA visual RH → Financeiro → DRE → PWA',()=>{
  it('captures the canonical parity flow in the desktop renderer QA',()=>{
    const script=fs.readFileSync(path.resolve(import.meta.dirname,'../scripts/qa-desktop-renderer-transactional.mjs'),'utf8')
    for(const screenshot of [
      '03-electron-rh-payroll.png',
      '04-electron-finance-competence.png',
      '05-electron-dre-competence-realized.png'
    ])expect(script).toContain(screenshot)
  })

  it('PWA labels the financial scope and separates competência from caixa realizado',()=>{
    const source=fs.readFileSync(path.resolve(import.meta.dirname,'mobile-dashboard.ts'),'utf8')
    expect(source).toContain('Competência')
    expect(source).toContain('Caixa realizado')
    expect(source).toContain('Histórico da obra')
  })
})
