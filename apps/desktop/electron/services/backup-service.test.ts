import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { BackupService } = require('./backup-service.cjs')
const roots: string[] = []

function createObraDb(file: string) {
  const db = new DatabaseSync(file)
  db.exec('CREATE TABLE empresas(id INTEGER PRIMARY KEY, razao_social TEXT); CREATE TABLE obras(id INTEGER PRIMARY KEY, empresa_id INTEGER, nome TEXT); CREATE TABLE configuracoes(chave TEXT PRIMARY KEY, valor TEXT);')
  db.close()
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'obra-backup-test-'))
  roots.push(root)
  const dataDir = path.join(root, 'data')
  const exportDir = path.join(root, 'export')
  fs.mkdirSync(dataDir, { recursive: true })
  fs.mkdirSync(exportDir, { recursive: true })
  const dbPath = path.join(dataDir, 'active.sqlite')
  createObraDb(dbPath)
  const calls: Array<[string, string?]> = []
  const db: any = {
    dbPath,
    db: { backup: async (dest: string) => { calls.push(['backup', dest]); fs.copyFileSync(dbPath, dest) } },
    close: () => calls.push(['close']),
    open: () => calls.push(['open'])
  }
  const dialog: any = { result: { canceled: true, filePaths: [] }, showOpenDialog: async () => dialog.result }
  const shell = { openPath: async () => '' }
  const service = new BackupService({ db, dataDir, documentsDir: path.join(dataDir, 'docs'), dialog, shell })
  return { root, dataDir, exportDir, dbPath, db, calls, dialog, service }
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true })
})

describe('BackupService', () => {
  it('usa nomenclatura Obra na Mão e grava manifesto com fingerprint', async () => {
    const f = fixture()
    f.dialog.result = { canceled: false, filePaths: [f.exportDir] }
    const result = await f.service.create()
    expect(path.basename(result.folder)).toMatch(/^Obra-na-Mao-Backup-/)
    expect(path.basename(result.database)).toBe('obra-na-mao.sqlite')
    expect(fs.existsSync(result.manifest)).toBe(true)
    const manifest = JSON.parse(fs.readFileSync(result.manifest, 'utf8'))
    expect(manifest.product).toBe('Obra na Mão')
    expect(manifest.fingerprint).toBe(result.fingerprint)
    expect(result.fingerprint).toMatch(/^[a-f0-9]{64}$/)
  })

  it('cria safety snapshot de migração sem abrir diálogo', async () => {
    const f = fixture()
    const result = await f.service.createSafetySnapshot({ reason: 'module-migration', module: 'core', migrationId: 'mig-1' })
    const manifest = JSON.parse(fs.readFileSync(result.manifest, 'utf8'))
    expect(manifest).toEqual(expect.objectContaining({ reason: 'module-migration', module: 'core', migrationId: 'mig-1' }))
    expect(result.folder).toContain(`${path.sep}backups${path.sep}`)
  })

  it.each(['corrupt', 'foreign'])('rejeita banco %s antes de fechar o banco ativo', async kind => {
    const f = fixture()
    const candidate = path.join(f.root, `${kind}.sqlite`)
    if (kind === 'corrupt') fs.writeFileSync(candidate, 'not sqlite')
    else {
      const foreign = new DatabaseSync(candidate)
      foreign.exec('CREATE TABLE unrelated(id INTEGER PRIMARY KEY)')
      foreign.close()
    }
    f.dialog.result = { canceled: false, filePaths: [candidate] }
    await expect(f.service.restore()).rejects.toThrow(/inválido|integridade|Obra na Mão|schema/i)
    expect(f.calls.some(([name]) => name === 'close')).toBe(false)
  })

  it('recupera o banco anterior quando a base restaurada não reabre', async () => {
    const f = fixture()
    const candidate = path.join(f.root, 'valid.sqlite')
    createObraDb(candidate)
    let openCount = 0
    f.db.open = () => {
      f.calls.push(['open'])
      openCount += 1
      if (openCount === 1) throw new Error('simulated open failure')
    }
    const before = fs.readFileSync(f.dbPath)
    f.dialog.result = { canceled: false, filePaths: [candidate] }
    await expect(f.service.restore()).rejects.toThrow(/restauração|restaurar|simulated/i)
    expect(fs.readFileSync(f.dbPath)).toEqual(before)
    expect(openCount).toBe(2)
  })
})
