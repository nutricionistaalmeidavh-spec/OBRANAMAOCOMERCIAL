const fs = require('node:fs')
const path = require('node:path')
const { createHash, randomBytes } = require('node:crypto')
const { DatabaseSync } = require('node:sqlite')

const REQUIRED_TABLES = ['empresas', 'obras', 'configuracoes']

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function fingerprint(file) {
  const hash = createHash('sha256')
  hash.update(fs.readFileSync(file))
  return hash.digest('hex')
}

function validateCandidate(file) {
  let candidate
  try {
    candidate = new DatabaseSync(file, { readOnly: true })
    const integrity = candidate.prepare('PRAGMA integrity_check').all()
    if (!integrity.length || integrity.some(row => String(row.integrity_check || '').toLowerCase() !== 'ok')) {
      throw new Error('Falha no teste de integridade do SQLite.')
    }
    const rows = candidate.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()
    const names = new Set(rows.map(row => String(row.name)))
    const missing = REQUIRED_TABLES.filter(name => !names.has(name))
    if (missing.length) throw new Error(`Banco não pertence ao Obra na Mão ou está com schema incompleto: ${missing.join(', ')}.`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Banco de restauração inválido: ${message}`)
  } finally {
    try { candidate?.close() } catch {}
  }
}

class BackupService {
  constructor({ db, dataDir, documentsDir, dialog = null, shell = null }) {
    this.db = db
    this.dataDir = dataDir
    this.documentsDir = documentsDir
    const electron = (!dialog || !shell) ? require('electron') : null
    this.dialog = dialog || electron.dialog
    this.shell = shell || electron.shell
  }

  async snapshotTo(root, context = {}) {
    const folder = path.join(root, `Obra-na-Mao-Backup-${stamp()}-${randomBytes(3).toString('hex')}`)
    fs.mkdirSync(folder, { recursive: true })
    const database = path.join(folder, 'obra-na-mao.sqlite')
    await this.db.db.backup(database)
    const digest = fingerprint(database)
    const manifest = path.join(folder, 'manifest.json')
    const payload = {
      product: 'Obra na Mão',
      createdAt: new Date().toISOString(),
      database: path.basename(database),
      fingerprint: digest,
      schema: { requiredTables: REQUIRED_TABLES },
      ...(context.reason ? { reason: String(context.reason) } : {}),
      ...(context.module ? { module: String(context.module) } : {}),
      ...(context.migrationId ? { migrationId: String(context.migrationId) } : {})
    }
    fs.writeFileSync(manifest, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
    return { folder, database, manifest, fingerprint: digest }
  }

  async create(options = {}) {
    const picked = await this.dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'], title: 'Escolher pasta do backup' })
    if (picked.canceled) return null
    return this.snapshotTo(picked.filePaths[0], options)
  }

  async createSafetySnapshot(context = {}) {
    const root = path.join(this.dataDir, 'backups')
    fs.mkdirSync(root, { recursive: true })
    return this.snapshotTo(root, context)
  }

  async restore() {
    const picked = await this.dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'SQLite', extensions: ['sqlite','db'] }], title: 'Selecionar banco para restaurar' })
    if (picked.canceled) return null
    const source = picked.filePaths[0]
    validateCandidate(source)
    const safety = await this.createSafetySnapshot({ reason: 'before-restore' })

    this.db.close()
    try {
      fs.copyFileSync(source, this.db.dbPath)
      this.db.open()
      return { restored: true, safety: safety.database, manifest: safety.manifest }
    } catch (error) {
      try { this.db.close() } catch {}
      try {
        fs.copyFileSync(safety.database, this.db.dbPath)
        this.db.open()
      } catch (recoveryError) {
        const original = error instanceof Error ? error.message : String(error)
        const recovery = recoveryError instanceof Error ? recoveryError.message : String(recoveryError)
        throw new Error(`A restauração falhou e o banco anterior também não pôde ser reaberto: ${original}; recuperação: ${recovery}`)
      }
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`A restauração falhou; o banco anterior foi recuperado. ${message}`)
    }
  }

  openDataFolder() { return this.shell.openPath(this.dataDir) }
}

module.exports = { BackupService, validateCandidate, REQUIRED_TABLES }
