import fs from 'node:fs'
import path from 'node:path'
import { CentralBackupService } from './central-backup-service.mjs'

function publicManifest(manifest = {}) {
  const allowed = ['backupId','createdAt','fingerprint','schemaVersion','serverId','companyId','serverVersion','sizeBytes','filesCount','filesSizeBytes','filesFingerprint','reason']
  return Object.fromEntries(allowed.filter(key => manifest?.[key] !== undefined).map(key => [key,manifest[key]]))
}

export class RuntimeBackupService extends CentralBackupService {
  constructor({ backupDir = null, ...options } = {}) {
    super(options)
    this.runtimeBackupDir = backupDir ? path.resolve(backupDir) : path.join(this.dataDir, 'backups')
  }

  backupsRoot() {
    return path.join(this.runtimeBackupDir, 'central')
  }

  listManagedBackups() {
    if (!fs.existsSync(this.backupsRoot())) return []
    const items = []
    for (const entry of fs.readdirSync(this.backupsRoot(), { withFileTypes:true })) {
      if (!entry.isDirectory()) continue
      try {
        const { manifest } = this.readManifest(entry.name)
        items.push(publicManifest(manifest))
      } catch {}
    }
    items.sort((a,b)=>String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    return items
  }

  pruneManaged(retain = 7) {
    const count = Number(retain)
    if (!Number.isInteger(count) || count < 1) throw new Error('Retenção de backup deve ser um inteiro maior ou igual a 1.')
    const items = this.listManagedBackups()
    const removed = []
    for (const item of items.slice(count)) {
      const id = String(item.backupId || '')
      if (!id) continue
      fs.rmSync(path.join(this.backupsRoot(), id), { recursive:true, force:true })
      removed.push(id)
    }
    return { retained:Math.min(items.length,count), removed }
  }

  testRestoreManaged(backupId, { actor = null } = {}) {
    const candidate = this.verifyManagedBackup(backupId, { enforceCurrentIdentity:true, actor })
    fs.mkdirSync(this.runtimeBackupDir, { recursive:true })
    const tempDir = fs.mkdtempSync(path.join(this.runtimeBackupDir, '.restore-test-'))
    const testFile = path.join(tempDir, 'obra-na-mao-lan.sqlite')
    try {
      fs.copyFileSync(candidate.database, testFile)
      const inspected = this.inspectFile(testFile, { enforceCurrentIdentity:true, requireSanitized:true })
      return {
        restorable:true,
        backupId:String(backupId),
        integrity:inspected.integrity,
        schemaVersion:inspected.schemaVersion,
        serverId:inspected.identity.serverId,
        companyId:inspected.identity.companyId,
        fingerprint:candidate.fingerprint,
        sizeBytes:candidate.sizeBytes
      }
    } finally {
      fs.rmSync(tempDir, { recursive:true, force:true })
    }
  }
}
