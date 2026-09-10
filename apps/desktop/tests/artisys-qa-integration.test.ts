import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(__dirname, '../../..')
const qaDir = path.join(repoRoot, 'qa')

function readJson(relativePath: string) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'))
}

describe('ArtiSys QA / Demo Flows integration', () => {
  it('pins ArtiSys QA 1.2.0 and launches Electron from the real app root', () => {
    const lock = readJson('qa/artisys-qa.lock.json')
    const config = readJson('qa/artisys-qa.config.json')
    const desktopPackage = readJson('apps/desktop/package.json')

    expect(lock.module).toBe('@artisys/qa')
    expect(lock.version).toBe('1.2.0')
    expect(lock.sourceCommit).toBe('2af6556937c7a4074f641069a2e1a6bb02bf942f')
    expect(config.systemId).toBe('obra-na-mao-comercial-desktop')
    expect(config.mode).toBe('electron')
    expect(config.defaultDemo).toBe('quick-30s')
    expect(config.electron.entry).toBe('../apps/desktop')
    expect(desktopPackage.main).toBe('electron/updater-main.cjs')
  })

  it('vendors the 1.2 demo-platform runtime and reusable flow library', () => {
    for (const relativePath of [
      'qa/runtime/src/adapters.js',
      'qa/runtime/src/demo-profile.js',
      'qa/runtime/src/fixture-registry.js',
      'qa/runtime/src/flow-library.js',
      'qa/runtime/src/redaction.js',
      'qa/runtime/flows/common/login.json',
      'qa/runtime/flows/common/dashboard-tour.json',
    ]) {
      expect(fs.existsSync(path.join(repoRoot, relativePath)), relativePath).toBe(true)
    }

    const runtimePackage = readJson('qa/runtime/package.json')
    expect(runtimePackage.version).toBe('1.2.0')
  })

  it('ships reusable 30s Reels and 60s overview demo flows', () => {
    const config = readJson('qa/artisys-qa.config.json')
    const quick = config.demos['quick-30s']
    const overview = config.demos['overview-60s']

    expect(quick.preset).toBe('reels-9x16')
    expect(quick.durationTargetSec).toBe(30)
    expect(overview.durationTargetSec).toBe(60)

    for (const demo of [quick, overview]) {
      const absolute = path.resolve(qaDir, demo.file)
      expect(fs.existsSync(absolute)).toBe(true)
      const flow = JSON.parse(fs.readFileSync(absolute, 'utf8'))
      expect(Array.isArray(flow.steps)).toBe(true)
      expect(flow.steps.length).toBeGreaterThan(0)
      expect(flow.steps.some((step: { action?: string }) => step.action === 'screenshot')).toBe(true)
    }
  })

  it('keeps demo data isolated from real desktop data', () => {
    const workflow = fs.readFileSync(path.join(repoRoot, '.github/workflows/artisys-qa-demo.yml'), 'utf8')
    expect(workflow).toContain('OBRA_NA_MAO_DATA_DIR')
    expect(workflow).toContain('runner.temp')
    expect(workflow).toContain('qa/runtime/artisys-qa.mjs')
  })
})
