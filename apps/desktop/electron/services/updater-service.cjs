const { autoUpdater } = require('electron-updater')

class UpdaterService {
  constructor({ app, getWindow, logger = console }) {
    this.app = app
    this.getWindow = getWindow
    this.logger = logger
    this.stateValue = {
      status: 'idle',
      currentVersion: app.getVersion(),
      availableVersion: null,
      progress: null,
      error: null,
      supported: app.isPackaged && process.platform === 'win32'
    }

    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.allowPrerelease = false

    autoUpdater.on('checking-for-update', () => this.patch({ status: 'checking', error: null }))
    autoUpdater.on('update-available', (info) => this.patch({ status: 'available', availableVersion: info.version, progress: null, error: null }))
    autoUpdater.on('update-not-available', () => this.patch({ status: 'current', availableVersion: null, progress: null, error: null }))
    autoUpdater.on('download-progress', (progress) => this.patch({ status: 'downloading', progress: Math.max(0, Math.min(100, Math.round(progress.percent || 0))), error: null }))
    autoUpdater.on('update-downloaded', (info) => this.patch({ status: 'downloaded', availableVersion: info.version, progress: 100, error: null }))
    autoUpdater.on('error', (error) => {
      this.logger.error('Desktop updater error', error)
      this.patch({ status: 'error', error: error?.message || 'Não foi possível verificar a atualização.' })
    })
  }

  snapshot() {
    return { ...this.stateValue }
  }

  patch(next) {
    this.stateValue = { ...this.stateValue, ...next }
    const window = this.getWindow?.()
    if (window && !window.isDestroyed()) window.webContents.send('updater:state-changed', this.snapshot())
    return this.snapshot()
  }

  state() {
    return this.snapshot()
  }

  async check() {
    if (!this.stateValue.supported) return this.patch({ status: 'unsupported', error: null })
    await autoUpdater.checkForUpdates()
    return this.snapshot()
  }

  async download() {
    if (!this.stateValue.supported) return this.patch({ status: 'unsupported', error: null })
    if (!['available', 'downloading'].includes(this.stateValue.status)) throw new Error('Nenhuma atualização disponível para download.')
    this.patch({ status: 'downloading', progress: this.stateValue.progress || 0, error: null })
    await autoUpdater.downloadUpdate()
    return this.snapshot()
  }

  install() {
    if (this.stateValue.status !== 'downloaded') throw new Error('A atualização ainda não terminou de baixar.')
    autoUpdater.quitAndInstall(false, true)
    return true
  }

  start() {
    if (!this.stateValue.supported) return this.patch({ status: 'unsupported' })
    const timer = setTimeout(() => this.check().catch((error) => this.logger.error('Automatic update check failed', error)), 8000)
    if (typeof timer.unref === 'function') timer.unref()
    return this.snapshot()
  }
}

module.exports = { UpdaterService }
