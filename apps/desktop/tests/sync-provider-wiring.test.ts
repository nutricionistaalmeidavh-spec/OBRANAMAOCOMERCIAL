import fs from 'node:fs'
import path from 'node:path'
import { expect, it } from 'vitest'

const main = fs.readFileSync(path.resolve(import.meta.dirname, '../electron/main.cjs'), 'utf8')

it('processo principal injeta o provider operacional no SyncCoordinator', () => {
  expect(main).toContain("require('./services/lan-sync-data-provider.cjs')")
  expect(main).toMatch(/new OperationalSyncDataProvider\(\{[\s\S]*storage[\s\S]*lanClient[\s\S]*database:\s*db/)
  expect(main).toMatch(/new SyncCoordinator\(\{[\s\S]*dataProvider/)
})
