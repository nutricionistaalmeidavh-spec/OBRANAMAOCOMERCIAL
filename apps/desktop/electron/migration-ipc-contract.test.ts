import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('module migration IPC contract',()=>{
  it('main process owns migration orchestration and stops sync during migration',()=>{
    const source=fs.readFileSync(path.resolve(import.meta.dirname,'main.cjs'),'utf8')
    expect(source).toContain("ModuleMigrationService")
    expect(source).toContain("ipcMain.handle('storage:migration-preflight'")
    expect(source).toContain("ipcMain.handle('storage:migration-status'")
    expect(source).toContain("ipcMain.handle('storage:migrate-module'")
    expect(source).toMatch(/storage:migrate-module[\s\S]{0,220}withSyncStopped/)
  })

  it('preload exposes only explicit migration operations to renderer',()=>{
    const source=fs.readFileSync(path.resolve(import.meta.dirname,'preload.cjs'),'utf8')
    expect(source).toContain("migrationPreflight")
    expect(source).toContain("migrationStatus")
    expect(source).toContain("migrateModule")
    expect(source).not.toContain('migrationStart:')
    expect(source).not.toContain('migrationRecord:')
  })
})
