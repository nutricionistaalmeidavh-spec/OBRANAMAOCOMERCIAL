import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root=path.resolve(import.meta.dirname,'../../..')
const read=(relative:string)=>fs.readFileSync(path.join(root,relative),'utf8')

describe('phases 9-11 final release contract',()=>{
  it('proves Sync/PWA regression in the F31 gate',()=>{
    const workflow=read('.github/workflows/f31-multiplatform-qa.yml')
    expect(workflow).toContain('storage-online-compatibility.test.ts')
    expect(workflow).toContain('sync-coordinator.test.ts')
    expect(workflow).toContain('central-planning-sync.test.ts')
    expect(workflow).toContain('backend/p3-workflows.test.ts')
  })

  it('keeps explicit multi-PC scale coverage in the final gate',()=>{
    const workflow=read('.github/workflows/f31-multiplatform-qa.yml')
    expect(workflow).toContain('f31-multiclient-scale.test.mjs')
    expect(workflow).toContain('f8-f12-multi-client.test.mjs')
    expect(workflow).toContain('matrix:')
    expect(workflow).toContain('ubuntu-latest')
    expect(workflow).toContain('windows-latest')
  })

  it('builds a commercial 2.1.x installer without silently enabling auto-publication',()=>{
    const pkg=JSON.parse(read('apps/desktop/package.json'))
    const ci=read('.github/workflows/commercial-desktop-ci.yml')
    const parts=String(pkg.version).split('.').map(Number)
    expect(parts.slice(0,2)).toEqual([2,1])
    expect(parts[2]).toBeGreaterThanOrEqual(7)
    expect(pkg.scripts.dist).toContain('--publish never')
    expect(ci).toContain("DESKTOP_AUTO_RELEASE_ENABLED: 'false'")
    expect(ci).toContain("env.DESKTOP_AUTO_RELEASE_ENABLED == 'true'")
  })
})
