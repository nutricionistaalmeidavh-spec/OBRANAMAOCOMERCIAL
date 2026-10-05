import { createHash } from 'node:crypto'
import {
  actionForCrudMethod,
  domainForTable,
  granularPermissionDecision
} from './business-permissions.mjs'

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
  if (state && !state.claimed) throw new LanAuthorizationError('Servidor LAN ainda não foi configurado.', 403, 'server_unclaimed')

  const token = bearerToken(request)
  if (!token) throw new LanAuthorizationError('Credencial do dispositivo não informada.', 401, 'missing_device_token')

  const device = security.deviceByTokenHash(digest(token))
  if (!device) throw new LanAuthorizationError('Dispositivo LAN não autorizado.', 401, 'invalid_device_token')
  if (device.status !== 'active') throw new LanAuthorizationError('Dispositivo LAN revogado.', 403, 'device_revoked')

  const member = security.member(device.memberId)
  if (!member || member.status !== 'active') throw new LanAuthorizationError('Usuário não autorizado no snapshot atual.', 403, 'member_not_authorized')
  if (!Array.isArray(member.channels) || !member.channels.includes('desktop')) throw new LanAuthorizationError('Acesso Desktop não autorizado para este usuário.', 403, 'desktop_channel_required')

  security.touchDevice?.(device.id)
  return { companyId: state?.companyId || null, device, member }
}

function legacyDomainAllowed(member, domain, action) {
  const role = String(member?.role || '')
  const modules = Array.isArray(member?.modules) ? member.modules.map(String) : []
  if (role === 'admin') return true
  if (domain === 'core') return modules.includes('obra360')
  if (domain === 'operation') return modules.some(module => ['obra360', 'rdo'].includes(module))
  if (domain === 'planning') return modules.includes('obra360')
  if (domain === 'finance') return modules.includes('finance') || (action === 'view' && modules.includes('dre'))
  if (domain === 'rh') return modules.includes('rh')
  if (domain === 'documents') return modules.includes('documents') || modules.includes('obra360') || modules.includes('rh')
  return false
}

export function authorizeAction(context, { domain, action } = {}) {
  if (!context?.member) throw new LanAuthorizationError('Contexto de autorização ausente.', 403, 'forbidden')
  const normalizedDomain = String(domain || '')
  const normalizedAction = String(action || '')
  const granular = granularPermissionDecision(context.member, normalizedDomain, normalizedAction)

  if (granular === true) return { ok: true }
  if (granular === false) {
    throw new LanAuthorizationError(`Ação ${normalizedAction || 'desconhecida'} não autorizada no domínio ${normalizedDomain || 'desconhecido'}.`, 403, 'forbidden')
  }
  if (legacyDomainAllowed(context.member, normalizedDomain, normalizedAction)) return { ok: true }
  throw new LanAuthorizationError(`Ação ${normalizedAction || 'desconhecida'} não autorizada para este perfil.`, 403, 'forbidden')
}

export function authorizeBusinessRoute(context, { table, method } = {}) {
  const domain = domainForTable(table)
  const action = actionForCrudMethod(method || 'GET')
  if (!domain || !action) throw new LanAuthorizationError('Entidade ou operação não autorizada no servidor LAN.', 403, 'forbidden')
  return authorizeAction(context, { domain, action })
}
