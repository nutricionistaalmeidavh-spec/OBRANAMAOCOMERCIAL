import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const electronDir=path.resolve(import.meta.dirname,'..')
const desktopRoot=path.resolve(electronDir,'..')
const main=fs.readFileSync(path.join(electronDir,'main.cjs'),'utf8')
const preload=fs.readFileSync(path.join(electronDir,'preload.cjs'),'utf8')
const typings=fs.readFileSync(path.join(desktopRoot,'src','vite-env.d.ts'),'utf8')

describe('F17 migration runtime wiring',()=>{
  it('liga preflight status migrate e rollback no main process',()=>{
    for(const channel of [
      'storage:migration-preflight',
      'storage:migration-status',
      'storage:migrate-module',
      'storage:rollback-module-migration'
    ]) expect(main).toContain(`ipcMain.handle('${channel}'`)
    expect(main).toContain('services.migration.rollback(module)')
  })

  it('expõe as quatro operações pelo preload',()=>{
    expect(preload).toContain("migrationPreflight: (module) => call('storage:migration-preflight'")
    expect(preload).toContain("migrationStatus: (module) => call('storage:migration-status'")
    expect(preload).toContain("migrateModule: (module) => call('storage:migrate-module'")
    expect(preload).toContain("rollbackModuleMigration: (module) => call('storage:rollback-module-migration'")
  })

  it('tipa os cinco módulos e rollback explícito',()=>{
    for(const module of ['core','operation','planning','finance','rh']) expect(typings).toContain(`'${module}'`)
    expect(typings).toContain('migrationPreflight(module:ModuleStorageKey)')
    expect(typings).toContain('migrationStatus(module:ModuleStorageKey)')
    expect(typings).toContain('migrateModule(module:ModuleStorageKey)')
    expect(typings).toContain('rollbackModuleMigration(module:ModuleStorageKey)')
  })

  it('preserva o wiring F17 ao coexistir com a concorrência F14',()=>{
    expect(main).toContain('expectedRevision')
    expect(main).toContain("ipcMain.handle('entity:remove'")
    expect(preload).toContain('onRevisionConflict')
    expect(preload).toContain("call('storage:migrate-module'")
  })
})
