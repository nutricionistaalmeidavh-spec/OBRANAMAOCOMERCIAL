import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const read = (relative:string) => readFileSync(resolve(here, relative), 'utf8')

describe('F14 Desktop conflict UX contract', () => {
  it('preserves structured revision metadata through IPC instead of flattening it to message only', () => {
    const main = read('../electron/main.cjs')
    const preload = read('../electron/preload.cjs')
    expect(main).toContain("code: error?.code")
    expect(main).toContain('currentRevision: error?.currentRevision')
    expect(main).toContain('expectedRevision: error?.expectedRevision')
    expect(main).toContain('current: error?.current')
    expect(preload).toContain("response?.error?.code === 'revision_conflict'")
    expect(preload).toContain('error.currentRevision = response?.error?.currentRevision')
    expect(preload).toContain('error.current = response?.error?.current')
  })

  it('exposes one generic conflict subscription and explicit reload action in the renderer', () => {
    const preload = read('../electron/preload.cjs')
    const app = read('../src/App.tsx')
    const types = read('../src/vite-env.d.ts')
    expect(preload).toContain('revisionConflictListeners')
    expect(preload).toContain('onRevisionConflict')
    expect(app).toContain('onRevisionConflict')
    expect(app).toContain('Este registro foi alterado em outro computador.')
    expect(app).toContain('Recarregar versão atual')
    expect(app).toContain('window.location.reload()')
    expect(types).toContain('RevisionConflictDetails')
    expect(types).toContain('onRevisionConflict')
  })

  it('carries revision on entity delete instead of silently deleting a newer central record', () => {
    const preload = read('../electron/preload.cjs')
    const main = read('../electron/main.cjs')
    const types = read('../src/vite-env.d.ts')
    expect(preload).toContain("remove: (id, revision) => call('entity:remove', { table, id, revision })")
    expect(main).toContain('services.dataAccess.remove(table, id, revision)')
    expect(types).toContain('remove(id: number, revision?: number)')
  })
})
