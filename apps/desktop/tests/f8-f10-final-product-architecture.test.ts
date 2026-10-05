import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root=path.resolve(process.cwd())
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8')

describe('Fases 8–10 — fechamento do produto e arquitetura',()=>{
  it('F8 mantém Obra 360 como centro de decisão, não como espelho da topologia',()=>{
    const page=read('src/pages/WorkDetailPage.tsx')
    for(const section of ['Próximas ações','Resultado por frente','Pendências abertas','Documentos recentes','Contratos recentes','Compras recentes','RDOs recentes']) expect(page).toContain(section)
    for(const action of ['/tarefas?obra=','/planejamento?obra=','/documentos?obra=','/contratos?obra=','/compras?obra=','/rdo?obra=']) expect(page).toContain(action)
    expect(page).not.toContain('fonte canônica')
    expect(page).not.toContain('central-active')
  })

  it('F9 cobre as jornadas críticas local, principal, segundo PC, recovery e PWA no gate multiplataforma',()=>{
    const workflow=read('../../.github/workflows/f31-multiplatform-qa.yml')
    const phase=read('tests/f6-f7-unified-server-experience.test.ts')
    const final=read('tests/phase9-11-finalization.test.ts')
    expect(phase).toContain('Encontrar computador principal')
    expect(phase).toContain('Código de pareamento')
    expect(phase).toContain('Tentar reconectar')
    expect(phase).toContain('não oferece fallback local')
    expect(final).toContain('sync-coordinator.test.ts')
    expect(final).toContain('backend/p3-workflows.test.ts')
    expect(workflow).toContain('f31-multiclient-scale.test.mjs')
  })

  it('F10 preserva ownership único, migração atômica e ausência de fallback silencioso',()=>{
    const migration=read('electron/services/module-migration-service.cjs')
    const state=read('electron/services/module-storage-state-service.cjs')
    const settings=read('src/components/StorageServerSettings.tsx')
    const migrateBody=migration.slice(migration.indexOf('async migrate(moduleName)'),migration.indexOf('async rollback(moduleName)'))
    expect(migrateBody.indexOf('createSafetySnapshot')).toBeLessThan(migrateBody.indexOf('migrationStart'))
    const normalValidate=migrateBody.lastIndexOf('migrationValidate')
    const normalCommit=migrateBody.lastIndexOf('migrationCommit')
    const normalActivate=migrateBody.lastIndexOf('activateCommitted')
    expect(normalValidate).toBeGreaterThan(-1)
    expect(normalValidate).toBeLessThan(normalCommit)
    expect(normalCommit).toBeLessThan(normalActivate)
    expect(state).toContain("['local', 'central-ready', 'central-active', 'migration-required']")
    expect(settings).toContain('não troca de fonte de dados sozinho')
    expect(settings).not.toContain('Continuar localmente')
  })
})
