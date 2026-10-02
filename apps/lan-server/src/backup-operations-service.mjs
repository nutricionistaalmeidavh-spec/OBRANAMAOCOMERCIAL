export class BackupOperationsService {
  constructor({
    storage,
    enabled = true,
    intervalHours = 24,
    retentionCount = 7,
    now = () => new Date(),
    setIntervalFn = setInterval,
    clearIntervalFn = clearInterval
  } = {}) {
    if (!storage?.create || !storage?.verifyManagedBackup) throw new Error('Storage de backup operacional inválido.')
    this.storage = storage
    this.enabled = enabled === true
    this.intervalHours = Number(intervalHours)
    this.retentionCount = Number(retentionCount)
    if (!Number.isFinite(this.intervalHours) || this.intervalHours <= 0) throw new Error('Intervalo de backup deve ser maior que zero.')
    if (!Number.isInteger(this.retentionCount) || this.retentionCount < 1) throw new Error('Retenção de backup deve ser um inteiro maior ou igual a 1.')
    this.now = now
    this.setIntervalFn = setIntervalFn
    this.clearIntervalFn = clearIntervalFn
    this.timer = null
    this.lastRun = null
    this.nextRunAt = null
    this.inFlight = null
  }

  policy() {
    return {
      enabled:this.enabled,
      intervalHours:this.intervalHours,
      retentionCount:this.retentionCount
    }
  }

  status() {
    return {
      ...this.policy(),
      running:!!this.timer,
      lastRun:this.lastRun,
      nextRunAt:this.nextRunAt
    }
  }

  list() {
    return this.storage.listManagedBackups?.() || []
  }

  runNow({ reason = 'manual', actor = null } = {}) {
    if (this.inFlight) return this.inFlight
    const operation = (async()=>{
      try {
        const backup = await this.storage.create({ reason, actor })
        this.storage.verifyManagedBackup(backup.backupId, { enforceCurrentIdentity:true, actor })
        const retention = this.storage.pruneManaged?.(this.retentionCount) || { retained:null, removed:[] }
        const completedAt = this.now().toISOString()
        this.lastRun = { status:'success', reason:String(reason || 'manual'), at:completedAt, backupId:backup.backupId }
        return { backup, verified:true, retention }
      } catch (error) {
        this.lastRun = {
          status:'failed',
          reason:String(reason || 'manual'),
          at:this.now().toISOString(),
          error:error instanceof Error ? error.message : String(error)
        }
        throw error
      } finally {
        if (this.inFlight === operation) this.inFlight = null
      }
    })()
    this.inFlight = operation
    return operation
  }

  preUpgrade({ actor = null } = {}) {
    return this.runNow({ reason:'pre-upgrade', actor })
  }

  testRestore(backupId, { actor = null } = {}) {
    if (!this.storage.testRestoreManaged) throw new Error('Teste de restore indisponível.')
    return this.storage.testRestoreManaged(backupId, { actor })
  }

  start() {
    if (!this.enabled || this.timer) return this.status()
    const ms = this.intervalHours * 60 * 60 * 1000
    const scheduleNext = () => {
      this.nextRunAt = new Date(this.now().getTime() + ms).toISOString()
    }
    scheduleNext()
    this.timer = this.setIntervalFn(() => {
      scheduleNext()
      void this.runNow({ reason:'scheduled' }).catch(()=>{})
    }, ms)
    this.timer?.unref?.()
    return this.status()
  }

  stop() {
    if (this.timer) this.clearIntervalFn(this.timer)
    this.timer = null
    this.nextRunAt = null
    return this.status()
  }
}
