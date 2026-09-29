import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'

const digest = value => createHash('sha256').update(String(value)).digest('hex')
const safeEqual = (a, b) => {
  const left = Buffer.from(String(a || ''), 'utf8')
  const right = Buffer.from(String(b || ''), 'utf8')
  return left.length === right.length && timingSafeEqual(left, right)
}
const defaultSetupCode = () => {
  const value = randomBytes(5).toString('hex').toUpperCase()
  return `${value.slice(0, 5)}-${value.slice(5, 10)}`
}

export class ServerIdentity {
  constructor({ security, serverIdFactory = randomUUID, setupCodeFactory = defaultSetupCode } = {}) {
    if (!security) throw new Error('Repositório de segurança LAN não informado.')
    this.security = security
    this.setupCode = null

    const existing = this.security.serverState()
    if (existing?.claimed) return

    this.setupCode = String(setupCodeFactory())
    const serverId = existing?.serverId || String(serverIdFactory())
    this.security.initializeServer({ serverId, setupCodeHash: digest(this.setupCode) })
  }

  state() {
    const current = this.security.serverState()
    if (!current) return null
    return {
      serverId: current.serverId,
      claimed: !!current.claimed,
      companyId: current.companyId || null,
      setupCode: current.claimed ? null : this.setupCode
    }
  }

  async verifySetupCode(code) {
    const current = this.security.serverState()
    if (!current || current.claimed || !current.setupCodeHash) return false
    return safeEqual(digest(String(code || '')), current.setupCodeHash)
  }

  invalidateSetupCode() {
    this.setupCode = null
    if (typeof this.security.clearSetupCode === 'function') this.security.clearSetupCode()
  }
}
