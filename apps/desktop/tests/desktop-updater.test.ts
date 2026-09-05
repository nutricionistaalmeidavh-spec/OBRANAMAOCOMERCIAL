import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const read = (relative:string) => readFileSync(resolve(here, relative), 'utf8')

describe('commercial desktop auto-updater contract', () => {
  it('ships electron-updater with a GitHub release provider', () => {
    const pkg = JSON.parse(read('../package.json'))
    expect(pkg.main).toBe('electron/updater-main.cjs')
    expect(pkg.dependencies['electron-updater']).toBeTruthy()
    expect(pkg.build.publish).toEqual(expect.arrayContaining([
      expect.objectContaining({ provider: 'github', owner: 'nutricionistaalmeidavh-spec', repo: 'OBRANAMAOCOMERCIAL' })
    ]))
  })

  it('wraps the existing Electron main process without replacing its behavior', () => {
    const wrapper = read('../electron/updater-main.cjs')
    expect(wrapper).toContain("require('./main.cjs')")
    expect(wrapper).toContain("require('./services/updater-service.cjs')")
    for (const channel of ['updater:state', 'updater:check', 'updater:download', 'updater:install']) {
      expect(wrapper).toContain(channel)
    }
  })

  it('exposes updater commands safely through preload', () => {
    const preload = read('../electron/preload.cjs')
    for (const channel of ['updater:state', 'updater:check', 'updater:download', 'updater:install']) {
      expect(preload).toContain(channel)
    }
    expect(preload).toContain('updater:state-changed')
  })

  it('publishes updater metadata alongside the Windows installer', () => {
    const workflow = read('../../../.github/workflows/commercial-desktop-ci.yml')
    expect(workflow).toContain('*.blockmap')
    expect(workflow).toContain('latest.yml')
  })

  it('surfaces updater status and actions in Settings', () => {
    const syncSettings = read('../src/components/SyncSettings.tsx')
    const updaterCard = read('../src/components/UpdaterSettingsCard.tsx')
    const types = read('../src/vite-env.d.ts')
    expect(syncSettings).toContain('<UpdaterSettingsCard/>')
    expect(updaterCard).toContain('Atualizações do aplicativo')
    expect(updaterCard).toContain('window.fluxoDre.updater.check()')
    expect(updaterCard).toContain('window.fluxoDre.updater.download()')
    expect(updaterCard).toContain('window.fluxoDre.updater.install()')
    expect(types).toContain('updater:')
    expect(types).toContain('onStateChanged')
  })
})
