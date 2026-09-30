import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const main = fs.readFileSync(path.resolve(process.cwd(), 'electron/main.cjs'), 'utf8')

describe('wiring da fonte operacional RDO', () => {
  it('injeta o estado do módulo no DataAccessService e usa FieldSourceService no IPC existente', () => {
    expect(main).toContain("require('./services/field-source-service.cjs')")
    expect(main).toContain('dataAccess.moduleStorage = moduleStorage')
    expect(main).toMatch(/const localField = new FieldService\(\{ db \}\)/)
    expect(main).toMatch(/const field = new FieldSourceService\(\{ local: localField, lanClient: dataAccess\.remote, moduleStorage \}\)/)
    expect(main).toContain("ipcMain.handle('field:save-rdo', envelope((payload) => services.field.saveDailyReport(payload)))")
  })
})
