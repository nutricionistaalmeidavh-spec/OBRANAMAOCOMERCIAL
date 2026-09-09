import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root=path.resolve(import.meta.dirname)
const main=fs.readFileSync(path.join(root,'main.cjs'),'utf8')
const preload=fs.readFileSync(path.join(root,'preload.cjs'),'utf8')
const types=fs.readFileSync(path.join(root,'../src/vite-env.d.ts'),'utf8')

const channels=[
  'scanner:capabilities',
  'scanner:start',
  'scanner:add-page',
  'scanner:redo-page',
  'scanner:discard',
  'scanner:save-signed'
]

describe('contrato IPC do scanner comercial',()=>{
  it('mantém o ScannerService somente no processo principal',()=>{
    expect(main).toContain("require('./services/scanner-service.cjs')")
    expect(preload).not.toContain("require('./services/scanner-service.cjs')")
  })

  it.each(channels)('registra e expõe o canal %s',(channel)=>{
    expect(main).toContain(`'${channel}'`)
    expect(preload).toContain(`'${channel}'`)
  })

  it('expõe API tipada sem caminhos arbitrários de destino',()=>{
    expect(preload).toContain('scanner: {')
    expect(types).toContain("type ScannerMode = 'grayscale'|'color'")
    expect(types).toContain('scanner: ScannerApi')
    expect(preload).not.toContain('destination:')
  })
})
