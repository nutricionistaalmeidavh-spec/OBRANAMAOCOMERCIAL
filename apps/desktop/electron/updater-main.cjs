const { app, BrowserWindow, ipcMain } = require('electron')
const { UpdaterService } = require('./services/updater-service.cjs')

// Preserve the existing application bootstrap and register the updater as an isolated layer.
require('./main.cjs')

let updater

function envelope(fn) {
  return async (_event, payload) => {
    try { return { ok: true, data: await fn(payload || {}) } }
    catch (error) { return { ok: false, error: { message: error?.message || 'Erro inesperado.' } } }
  }
}

function getMainWindow() {
  return BrowserWindow.getAllWindows().find((window) => !window.isDestroyed()) || null
}

app.whenReady().then(() => {
  updater = new UpdaterService({ app, getWindow: getMainWindow })
  ipcMain.handle('updater:state', envelope(() => updater.state()))
  ipcMain.handle('updater:check', envelope(() => updater.check()))
  ipcMain.handle('updater:download', envelope(() => updater.download()))
  ipcMain.handle('updater:install', envelope(() => updater.install()))
  updater.start()
})
