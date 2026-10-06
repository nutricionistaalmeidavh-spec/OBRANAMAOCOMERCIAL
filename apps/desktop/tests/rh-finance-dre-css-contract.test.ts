import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('DRE layout contract',()=>{
  it('keeps label, competência and realizado in three stable grid columns',()=>{
    const css=fs.readFileSync(path.resolve(import.meta.dirname,'../src/modules/command-center/command-center.css'),'utf8')
    expect(css).toContain('.dre-command-body .dre-row { grid-template-columns: 1fr 180px 180px;')
    expect(css).toContain('.dre-command-subtotal { display: grid; grid-template-columns: 1fr 180px 180px;')
    expect(css).toContain('.dre-command-result { display: grid; grid-template-columns: 1fr 180px 180px;')
  })
})
