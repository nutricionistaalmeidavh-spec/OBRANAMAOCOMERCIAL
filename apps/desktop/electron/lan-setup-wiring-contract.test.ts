import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('LAN host setup code wiring',()=>{
  it('feeds the embedded LAN host setup code into LanSetupService',()=>{
    const source=fs.readFileSync(path.resolve(import.meta.dirname,'main.cjs'),'utf8')
    expect(source).toContain('setupCodeProvider: () => lanHost.setupCode()')
  })
})
