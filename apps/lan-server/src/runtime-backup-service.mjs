import path from 'node:path'
import { CentralBackupService } from './central-backup-service.mjs'

export class RuntimeBackupService extends CentralBackupService {
  constructor({ backupDir = null, ...options } = {}) {
    super(options)
    this.runtimeBackupDir = backupDir ? path.resolve(backupDir) : path.join(this.dataDir, 'backups')
  }

  backupsRoot() {
    return path.join(this.runtimeBackupDir, 'central')
  }
}
