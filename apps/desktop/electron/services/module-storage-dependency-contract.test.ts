import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('module storage dependency order',()=>{
  const source=fs.readFileSync(path.resolve(import.meta.dirname,'module-storage-state-service.cjs'),'utf8')
  it('preserva a ordem core -> operation -> planning -> finance -> rh -> documents',()=>{
    expect(source).toMatch(/operation:\s*\['core'\]/)
    expect(source).toMatch(/planning:\s*\['core',\s*'operation'\]/)
    expect(source).toMatch(/finance:\s*\['core',\s*'operation',\s*'planning'\]/)
    expect(source).toMatch(/rh:\s*\['core',\s*'operation',\s*'planning',\s*'finance'\]/)
    expect(source).toContain('dependencyBlockedBy')
  })
})
