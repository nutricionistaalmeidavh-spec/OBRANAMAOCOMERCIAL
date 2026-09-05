import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const read = (relative:string) => readFileSync(resolve(here, relative), 'utf8')

describe('commercial desktop auto-updater contract', () => {
  it('ships electron-updater with a GitHub release provider', () => {
    const pkg = JSON.parse(read('../package.json'))
    expect(pkg.dependencies['electron-updater']).toBeTruthy()
    expect(pkg.build.publish).toEqual(expect.arrayContaining([
      expect.objectContaining({ provider: 'github', owner: 'nutricionistaalmeidavh-spec', repo: 'OBRANAMAOCOMERCIAL' })
    ]))
  })

  it('registers updater lifecycle and IPC in the Electron main process', () => {
    const main = read('../electron/main.cjs')
    expect(main).toContain("require('./services/updater-service.cjs')")
    for (const channel of ['updater:state', 'updater:check', 'updater:download', 'updater:install']) {
      expect(main).toContain(channel)
    }
  })

  it('exposes updater commands safely through preload', () => {
    const preload = read('../electron/preload.cjs')
    for (const channel of ['updater:state', 'updater:check', 'updater:download', 'updater:install']) {
      expect(preload).toContain(channel)
    }
  })

  it('publishes updater metadata alongside the Windows installer', () => {
    const workflow = read('../../../.github/workflows/commercial-desktop-ci.yml')
    expect(workflow).toContain('*.blockmap')
    expect(workflow).toContain('latest.yml')
  })
})
