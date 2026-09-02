const fs = require('node:fs')
const path = require('node:path')
const { dialog, shell } = require('electron')

class BackupService {
  constructor({ db, dataDir, documentsDir }) { this.db = db; this.dataDir = dataDir; this.documentsDir = documentsDir }
  async create() {
    const picked = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'], title: 'Escolher pasta do backup' })
    if (picked.canceled) return null
    const folder = path.join(picked.filePaths[0], `Fluxo-DRE-Backup-${new Date().toISOString().replace(/[:.]/g, '-')}`)
    fs.mkdirSync(folder, { recursive: true })
    const database = path.join(folder, 'fluxo-dre.sqlite')
    await this.db.db.backup(database)
    return { folder, database }
  }
  async restore() {
    const picked = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'SQLite', extensions: ['sqlite','db'] }], title: 'Selecionar banco para restaurar' })
    if (picked.canceled) return null
    const source = picked.filePaths[0]
    const safety = path.join(this.dataDir, 'backups', `antes-restauracao-${Date.now()}.sqlite`)
    fs.mkdirSync(path.dirname(safety), { recursive: true })
    await this.db.db.backup(safety)
    this.db.close()
    fs.copyFileSync(source, this.db.dbPath)
    this.db.open()
    return { restored: true, safety }
  }
  openDataFolder() { return shell.openPath(this.dataDir) }
}

module.exports = { BackupService }
