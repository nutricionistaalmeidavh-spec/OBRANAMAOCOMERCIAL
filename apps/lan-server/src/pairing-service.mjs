import { createHash, randomBytes } from 'node:crypto'

const digest = value => createHash('sha256').update(String(value)).digest('hex')
const DEFAULT_TTL_MS = 10 * 60 * 1000
const DEFAULT_ATTEMPT_WINDOW_MS = 60 * 1000
const DEFAULT_MAX_ATTEMPTS = 8
const defaultCode = () => randomBytes(5).toString('hex').toUpperCase()
const defaultToken = () => randomBytes(32).toString('hex')
const publicDevice = device => {
  if (!device) return null
  const { tokenHash: _tokenHash, ...safe } = device
  return safe
}

export class PairingError extends Error {
  constructor(message, status = 400, code = 'pairing_error') {
    super(message)
    this.name = 'PairingError'
    this.status = status
    this.code = code
  }
}

export class PairingService {
  constructor({ security, nowMs = Date.now, codeFactory = defaultCode, tokenFactory = defaultToken, ttlMs = DEFAULT_TTL_MS, attemptWindowMs = DEFAULT_ATTEMPT_WINDOW_MS, maxAttempts = DEFAULT_MAX_ATTEMPTS } = {}) {
    if (!security) throw new Error('Repositório de segurança LAN não informado.')
    this.security = security
    this.nowMs = nowMs
    this.codeFactory = codeFactory
    this.tokenFactory = tokenFactory
    this.ttlMs = ttlMs
    this.attemptWindowMs = attemptWindowMs
    this.maxAttempts = maxAttempts
    this.attempts = new Map()
  }

  requireAdmin(actor) {
    if (!actor?.device?.id || actor?.member?.role !== 'admin') {
      throw new PairingError('Apenas Admin pode gerenciar dispositivos LAN.', 403, 'admin_required')
    }
  }

  validDesktopMember(member) {
    return !!member && member.status === 'active' && Array.isArray(member.channels) && member.channels.includes('desktop')
  }

  resolveTarget(value) {
    const target = String(value || '').trim()
    const byId = this.security.member?.(target)
    if (byId) return byId
    const normalized = target.toLowerCase()
    return (this.security.members?.() || []).find(member => String(member.email || '').trim().toLowerCase() === normalized) || null
  }

  createInvitation({ actor, targetMemberId }) {
    this.requireAdmin(actor)
    const member = this.resolveTarget(targetMemberId)
    if (!member) throw new PairingError('Usuário não encontrado no cache de autorização.', 404, 'member_not_found')
    if (!this.validDesktopMember(member)) throw new PairingError('Usuário não possui autorização Desktop ativa.', 403, 'member_not_authorized')

    const code = String(this.codeFactory())
    const expiresAt = new Date(this.nowMs() + this.ttlMs).toISOString()
    this.security.createPairingCode({ memberId: member.memberId, codeHash: digest(code), expiresAt, createdByDeviceId: actor.device.id })
    this.security.appendAudit?.({ actorMemberId: actor.member.memberId, actorDeviceId: actor.device.id, action: 'pairing_created', targetType: 'member', targetId: member.memberId, details: { expiresAt } })
    return { code, expiresAt, member }
  }

  attemptState(clientKey) {
    const key = String(clientKey || 'unknown')
    const now = this.nowMs()
    let state = this.attempts.get(key)
    if (!state || now - state.startedAt >= this.attemptWindowMs) { state = { startedAt: now, count: 0 }; this.attempts.set(key, state) }
    return { key, state }
  }

  claim({ code, installationId, deviceName, clientKey = 'unknown' }) {
    const attempt = this.attemptState(clientKey)
    if (attempt.state.count >= this.maxAttempts) throw new PairingError('Muitas tentativas de pareamento. Aguarde e tente novamente.', 429, 'pairing_rate_limited')
    const cleanCode = String(code || '').trim().toUpperCase()
    const cleanInstallationId = String(installationId || '').trim()
    const cleanDeviceName = String(deviceName || '').trim()
    if (!cleanCode || !cleanInstallationId || !cleanDeviceName) { attempt.state.count += 1; throw new PairingError('Dados de pareamento incompletos.', 400, 'invalid_pairing') }

    const invitation = this.security.consumePairingCode?.(digest(cleanCode))
    if (!invitation) { attempt.state.count += 1; throw new PairingError('Código de pareamento inválido, expirado ou já utilizado.', 404, 'pairing_not_found') }
    const member = this.security.member?.(invitation.memberId)
    if (!this.validDesktopMember(member)) { attempt.state.count += 1; throw new PairingError('Usuário não possui autorização Desktop ativa.', 403, 'member_not_authorized') }

    const deviceToken = String(this.tokenFactory())
    const device = this.security.createDevice({ memberId: member.memberId, installationId: cleanInstallationId, deviceName: cleanDeviceName, tokenHash: digest(deviceToken) })
    this.attempts.delete(attempt.key)
    this.security.appendAudit?.({ actorMemberId: member.memberId, actorDeviceId: device.id, action: 'device_paired', targetType: 'device', targetId: device.id, details: { installationId: cleanInstallationId } })
    return { device: publicDevice(device), member, deviceToken }
  }

  listDevices(actor) {
    this.requireAdmin(actor)
    return (this.security.listDevices?.() || []).map(publicDevice)
  }

  setDeviceStatus({ actor, deviceId, status }) {
    this.requireAdmin(actor)
    if (!['active', 'revoked'].includes(String(status))) throw new PairingError('Status do dispositivo inválido.', 400, 'invalid_device_status')
    const current = this.security.device?.(String(deviceId || ''))
    if (!current) throw new PairingError('Dispositivo LAN não encontrado.', 404, 'device_not_found')
    const next = this.security.setDeviceStatus(String(deviceId), String(status))
    this.security.appendAudit?.({ actorMemberId: actor.member.memberId, actorDeviceId: actor.device.id, action: status === 'revoked' ? 'device_revoked' : 'device_reactivated', targetType: 'device', targetId: String(deviceId), details: {} })
    return publicDevice(next)
  }
}
