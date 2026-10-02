const fs = require('node:fs')
const path = require('node:path')

const CONFIG_FILE = 'lan-credentials.json'

class LanCredentialService {
  constructor({ dataDir, safeStorage }) {
    if (!dataDir) throw new Error('Diretório de dados não informado para credenciais LAN.')
    this.dataDir = dataDir
    this.safeStorage = safeStorage
    this.configPath = path.join(dataDir, CONFIG_FILE)
    fs.mkdirSync(dataDir, { recursive: true })
  }

  readAll() {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.configPath, 'utf8'))
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch {
      return {}
    }
  }

  writeAll(value) {
    fs.writeFileSync(this.configPath, JSON.stringify(value, null, 2), { mode: 0o600 })
  }

  normalizeServerKey(serverKey) {
    const value = String(serverKey || '').trim()
    if (!value) throw new Error('Servidor LAN não identificado.')
    return value
  }

  encodeToken(token) {
    const value = String(token || '')
    if (!value) throw new Error('Credencial LAN vazia.')
    if (this.safeStorage?.isEncryptionAvailable?.()) {
      return { tokenValue: this.safeStorage.encryptString(value).toString('base64'), tokenEncoding: 'safeStorage' }
    }
    return { tokenValue: Buffer.from(value, 'utf8').toString('base64'), tokenEncoding: 'base64' }
  }

  decodeToken(entry) {
    if (!entry?.tokenValue) return ''
    try {
      const data = Buffer.from(String(entry.tokenValue), 'base64')
      if (entry.tokenEncoding === 'safeStorage') {
        if (!this.safeStorage?.isEncryptionAvailable?.()) return ''
        return this.safeStorage.decryptString(data)
      }
      return data.toString('utf8')
    } catch {
      return ''
    }
  }

  state(serverKey) {
    const key = this.normalizeServerKey(serverKey)
    const entry = this.readAll()[key]
    if (!entry || !this.decodeToken(entry)) return { paired: false, serverKey: key, deviceId: null, member: null, pairedAt: null }
    return {
      paired: true,
      serverKey: key,
      deviceId: entry.deviceId || null,
      member: entry.member || null,
      pairedAt: entry.pairedAt || null
    }
  }

  store({ serverKey, deviceId, member, token }) {
    const key = this.normalizeServerKey(serverKey)
    if (!deviceId) throw new Error('Dispositivo LAN não identificado.')
    const encoded = this.encodeToken(token)
    const all = this.readAll()
    all[key] = {
      deviceId: String(deviceId),
      member: member && typeof member === 'object' ? member : null,
      ...encoded,
      pairedAt: new Date().toISOString()
    }
    this.writeAll(all)
    return this.state(key)
  }

  token(serverKey) {
    const key = this.normalizeServerKey(serverKey)
    return this.decodeToken(this.readAll()[key])
  }

  rekey(fromServerKey, toServerKey) {
    const fromKey = this.normalizeServerKey(fromServerKey)
    const toKey = this.normalizeServerKey(toServerKey)
    if (fromKey === toKey) return this.state(toKey)
    const all = this.readAll()
    if (!all[fromKey]) return this.state(toKey)
    if (!all[toKey]) all[toKey] = all[fromKey]
    delete all[fromKey]
    this.writeAll(all)
    return this.state(toKey)
  }

  clear(serverKey) {
    const key = this.normalizeServerKey(serverKey)
    const all = this.readAll()
    delete all[key]
    this.writeAll(all)
    return { paired: false, serverKey: key, deviceId: null, member: null, pairedAt: null }
  }
}

module.exports = { LanCredentialService }
