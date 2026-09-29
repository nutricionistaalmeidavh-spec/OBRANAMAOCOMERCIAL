import { createHash } from 'node:crypto'

const digest = value => createHash('sha256').update(String(value)).digest('hex')

export class LanAuthorizationError extends Error {
  constructor(message, status = 403, code = 'forbidden') {
    super(message)
    this.name = 'LanAuthorizationError'
    this.status = status
    this.code = code
  }
}

function authorizationHeader(request) {
  if (request?.headers?.get) return String(request.headers.get('authorization') || '')
  return String(request?.headers?.authorization || request?.headers?.Authorization || '')
}

function bearerToken(request) {
  const header = authorizationHeader(request).trim()
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : ''
}

export async function authenticateLanRequest(request, security) {
  if (!security?.deviceByTokenHash || !security?.member) {
    throw new LanAuthorizationError('Autorização LAN indisponível.', 503, 'authorization_unavailable')
  }
  const state = security.serverState?.()
  if (state && !state.claimed) {
    throw new LanAuthorizationError('Servidor LAN ainda não foi configurado.', 403, 'server_unclaimed')
  }

  const token = bearerToken(request)
  if (!token) throw new LanAuthorizationError('Credencial do dispositivo não informada.', 401, 'missing_device_token')

  const device = security.deviceByTokenHash(digest(token))
  if (!device) throw new LanAuthorizationError('Dispositivo LAN não autorizado.', 401, 'invalid_device_token')
  if (device.status !== 'active') throw new LanAuthorizationError('Dispositivo LAN revogado.', 403, 'device_revoked')

  const member = security.member(device.memberId)
  if (!member || member.status !== 'active') {
    throw new LanAuthorizationError('Usuário não autorizado no snapshot atual.', 403, 'member_not_authorized')
  }
  if (!Array.isArray(member.channels) || !member.channels.includes('desktop')) {
    throw new LanAuthorizationError('Acesso Desktop não autorizado para este usuário.', 403, 'desktop_channel_required')
  }

  security.touchDevice?.(device.id)
  return {
    companyId: state?.companyId || null,
    device,
    member
  }
}

export function authorizeBusinessRoute(context, { table, method } = {}) {
  if (!context?.member) throw new LanAuthorizationError('Contexto de autorização ausente.', 403, 'forbidden')
  if (!['empresas', 'clientes', 'obras'].includes(String(table || ''))) {
    throw new LanAuthorizationError('Entidade não autorizada no servidor LAN.', 403, 'forbidden')
  }
  const role = String(context.member.role || '')
  const modules = Array.isArray(context.member.modules) ? context.member.modules : []
  if (role === 'admin') return { ok: true }
  if (modules.includes('obra360')) return { ok: true }
  throw new LanAuthorizationError(`Operação ${String(method || 'GET')} não autorizada para este perfil.`, 403, 'forbidden')
}
