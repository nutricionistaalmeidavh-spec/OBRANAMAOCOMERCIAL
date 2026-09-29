const path = require('node:path')
const { spawn } = require('node:child_process')

class LanHostService {
  constructor({ storage, dataDir, cloudBaseUrl, spawnImpl = spawn, execPath = process.execPath, serverEntry, stopTimeoutMs = 5000 }) {
    if (!storage) throw new Error('Configuração de armazenamento não informada ao host LAN.')
    if (!dataDir) throw new Error('Diretório de dados não informado ao host LAN.')
    this.storage = storage
    this.dataDir = dataDir
    this.cloudBaseUrl = cloudBaseUrl
    this.spawnImpl = spawnImpl
    this.execPath = execPath
    this.serverEntry = serverEntry
    this.stopTimeoutMs = stopTimeoutMs
    this.child = null
    this.startedAt = null
    this.lastError = null
    this.stopping = false
  }

  resolveCloudBaseUrl() {
    return typeof this.cloudBaseUrl === 'function' ? String(this.cloudBaseUrl() || '') : String(this.cloudBaseUrl || '')
  }

  state() {
    return {
      running: !!this.child,
      pid: this.child?.pid || null,
      startedAt: this.startedAt,
      lastError: this.lastError
    }
  }

  async start() {
    const state = this.storage.state()
    if (state.operationalMode !== 'lan-host') return this.state()
    if (this.child) return this.state()
    if (!this.serverEntry) throw new Error('Executável do servidor LAN não localizado.')

    const serverDataDir = path.join(this.dataDir, 'lan-server')
    const env = {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      OBRA_NA_MAO_LAN_DATA_DIR: serverDataDir,
      OBRA_NA_MAO_LAN_HOST: '0.0.0.0',
      OBRA_NA_MAO_LAN_PORT: String(state.port || 4732),
      OBRA_NA_MAO_PLATFORM_URL: this.resolveCloudBaseUrl()
    }
    const child = this.spawnImpl(this.execPath, [this.serverEntry], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    })
    this.child = child
    this.startedAt = new Date().toISOString()
    this.lastError = null
    this.stopping = false

    child.once?.('error', error => {
      this.lastError = error instanceof Error ? error.message : 'Falha ao iniciar servidor LAN.'
      if (this.child === child) this.child = null
    })
    child.once?.('exit', (code, signal) => {
      const expected = this.stopping
      if (this.child === child) this.child = null
      if (!expected && (code !== 0 || signal)) {
        this.lastError = `Servidor LAN encerrou inesperadamente${code !== null ? ` (código ${code})` : ''}${signal ? ` (${signal})` : ''}.`
      }
      this.stopping = false
    })
    return this.state()
  }

  async stop() {
    const child = this.child
    if (!child) return this.state()
    this.stopping = true
    await new Promise(resolve => {
      let settled = false
      const finish = () => { if (settled) return; settled = true; clearTimeout(timer); resolve() }
      child.once?.('exit', finish)
      const timer = setTimeout(() => {
        try { child.kill?.('SIGKILL') } catch {}
        finish()
      }, this.stopTimeoutMs)
      timer.unref?.()
      try {
        const signalled = child.kill?.('SIGTERM')
        if (signalled === false) finish()
      } catch {
        finish()
      }
    })
    if (this.child === child) this.child = null
    return this.state()
  }

  async restart() {
    await this.stop()
    return this.start()
  }
}

module.exports = { LanHostService }
