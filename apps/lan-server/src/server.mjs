import http from 'node:http'
import { createHash, randomBytes } from 'node:crypto'
import { authenticateLanRequest, authorizeBusinessRoute, LanAuthorizationError } from './authorization.mjs'
import { PairingError } from './pairing-service.mjs'

export const LAN_API_VERSION = '1'
export const LAN_SERVER_VERSION = '0.3.0'

const MAX_BODY_BYTES = 1024 * 1024
const DEFAULT_IDENTITY_STALE_MS = 15 * 60 * 1000
const ENTITY_ROUTE = /^\/api\/v1\/(empresas|clientes|obras)(?:\/(\d+))?\/?$/
const ADMIN_DEVICE_ROUTE = /^\/api\/v1\/admin\/devices\/([^/]+)\/?$/

const digest = value => createHash('sha256').update(String(value)).digest('hex')
const randomDeviceToken = () => randomBytes(32).toString('hex')

function sendJson(response, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body)
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
    ...extraHeaders
  })
  response.end(payload)
}

function methodNotAllowed(response, allow) {
  return sendJson(response, 405, { error: 'method_not_allowed' }, { allow: allow.join(', ') })
}

function requireAdminContext(context) {
  if (context?.member?.role !== 'admin') throw new LanAuthorizationError('Apenas Admin pode executar esta operação.', 403, 'admin_required')
}

async function readJson(request) {
  const chunks = []
  let total = 0
  for await (const chunk of request) {
    total += chunk.length
    if (total > MAX_BODY_BYTES) {
      const error = new Error('Corpo da requisição excede 1 MB.')
      error.code = 'payload_too_large'
      throw error
    }
    chunks.push(chunk)
  }
  if (!chunks.length) return {}
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('JSON deve ser um objeto.')
    return parsed
  } catch (cause) {
    const error = new Error('Corpo JSON inválido.')
    error.code = 'invalid_json'
    error.cause = cause
    throw error
  }
}

async function handleEntityRequest(request, response, url, repository, match, context) {
  if (!repository) return sendJson(response, 503, { error: 'repository_unavailable', message: 'Banco central do servidor indisponível.' })

  const table = match[1]
  const id = match[2] ? Number(match[2]) : null
  authorizeBusinessRoute(context, { table, method: request.method })

  if (id === null) {
    if (request.method === 'GET') {
      const filters = Object.fromEntries(url.searchParams.entries())
      return sendJson(response, 200, repository.list(table, filters))
    }
    if (request.method === 'POST') {
      const data = await readJson(request)
      const saved = repository.save(table, data)
      return sendJson(response, 201, saved)
    }
    return methodNotAllowed(response, ['GET', 'POST'])
  }

  if (request.method === 'GET') {
    const item = repository.get(table, id)
    return item ? sendJson(response, 200, item) : sendJson(response, 404, { error: 'not_found' })
  }
  if (request.method === 'PUT') {
    const data = await readJson(request)
    const saved = repository.save(table, { ...data, id })
    return saved ? sendJson(response, 200, saved) : sendJson(response, 404, { error: 'not_found' })
  }
  if (request.method === 'DELETE') {
    const removed = repository.remove(table, id)
    return removed ? sendJson(response, 200, { ok: true }) : sendJson(response, 404, { error: 'not_found' })
  }
  return methodNotAllowed(response, ['GET', 'PUT', 'DELETE'])
}

function adminFromRedeem(redeemed) {
  if (redeemed?.claimingAdmin) return redeemed.claimingAdmin
  if (!redeemed?.claimingMemberId) return null
  return redeemed?.snapshot?.members?.find(member => String(member.memberId) === String(redeemed.claimingMemberId)) || null
}

function validClaimAdmin(member) {
  return !!member && member.role === 'admin' && member.status === 'active' && Array.isArray(member.channels) && member.channels.includes('desktop')
}

export async function refreshIdentitySnapshot({ security, cloudAuthority }) {
  const state = security?.serverState?.()
  if (!state?.claimed || !state.serverToken) throw new Error('Servidor LAN ainda não foi vinculado à Cloud.')
  if (!cloudAuthority?.snapshot) throw new Error('Autoridade Cloud indisponível.')
  const result = await cloudAuthority.snapshot({ serverToken: state.serverToken })
  const snapshot = result?.snapshot || result
  if (!snapshot || String(snapshot.companyId || '') !== String(state.companyId || '')) throw new Error('Snapshot Cloud pertence a outra empresa.')
  security.replaceSnapshot(snapshot)
  return security.serverState()
}

async function handleSetupClaim(request, response, { security, identity, cloudAuthority, cloudBaseUrl }) {
  const current = identity?.state?.() || security?.serverState?.()
  if (!current?.serverId) return sendJson(response, 503, { error: 'setup_unavailable', message: 'Identidade do servidor LAN indisponível.' })
  if (current.claimed || security?.serverState?.()?.claimed) return sendJson(response, 409, { error: 'already_claimed', message: 'Este servidor LAN já está vinculado a uma empresa.' })
  if (!identity?.verifySetupCode || !cloudAuthority?.redeemClaim || !security?.claimServerWithDevice) {
    return sendJson(response, 503, { error: 'setup_unavailable', message: 'Configuração segura do servidor LAN indisponível.' })
  }

  const body = await readJson(request)
  const setupCode = String(body.setupCode || '').trim().toUpperCase()
  const claimToken = String(body.claimToken || '').trim()
  const installationId = String(body.installationId || '').trim()
  const deviceName = String(body.deviceName || '').trim()
  if (!setupCode || claimToken.length < 8 || !installationId || !deviceName) {
    return sendJson(response, 400, { error: 'invalid_setup', message: 'Informe código, claim e identificação do computador.' })
  }
  if (!(await identity.verifySetupCode(setupCode))) {
    return sendJson(response, 403, { error: 'invalid_setup_code', message: 'Código de configuração LAN inválido.' })
  }

  let redeemed
  try {
    redeemed = await cloudAuthority.redeemClaim({ serverId: current.serverId, claimToken })
  } catch (error) {
    return sendJson(response, 403, { error: 'cloud_claim_rejected', message: error instanceof Error ? error.message : 'Claim Cloud rejeitado.' })
  }

  const company = redeemed?.company || (redeemed?.companyId ? { id: redeemed.companyId, name: '' } : null)
  const snapshot = redeemed?.snapshot
  const admin = adminFromRedeem(redeemed)
  const requestingDevice = redeemed?.requestingDevice || null
  if (!company?.id || !redeemed?.serverToken || !snapshot || String(snapshot.companyId || '') !== String(company.id) || !validClaimAdmin(admin)) {
    return sendJson(response, 403, { error: 'claim_identity_mismatch', message: 'O administrador do claim não está autorizado para este servidor.' })
  }
  if (requestingDevice?.installationId && String(requestingDevice.installationId) !== installationId) {
    return sendJson(response, 403, { error: 'claim_device_mismatch', message: 'O claim foi iniciado por outro computador.' })
  }

  const memberInSnapshot = snapshot.members?.find(member => String(member.memberId) === String(admin.memberId))
  if (!validClaimAdmin(memberInSnapshot)) {
    return sendJson(response, 403, { error: 'claim_identity_mismatch', message: 'O administrador não consta no snapshot autorizado.' })
  }

  const deviceToken = randomDeviceToken()
  const stored = security.claimServerWithDevice({
    company,
    cloudBaseUrl: String(cloudBaseUrl || ''),
    serverToken: String(redeemed.serverToken),
    snapshot,
    device: {
      memberId: String(admin.memberId),
      installationId,
      deviceName,
      tokenHash: digest(deviceToken)
    }
  })
  identity.invalidateSetupCode?.()
  return sendJson(response, 201, {
    claimed: true,
    serverId: current.serverId,
    company: { id: String(company.id), name: String(company.name || '') },
    device: { id: stored.device.id, member: memberInSnapshot },
    deviceToken
  })
}

export function createLanServer({ serverVersion = LAN_SERVER_VERSION, repository = null, security = null, identity = null, cloudAuthority = null, cloudBaseUrl = '', pairingService = null, nowMs = Date.now, identityStaleMs = DEFAULT_IDENTITY_STALE_MS } = {}) {
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://localhost')

      if (url.pathname === '/health') {
        if (request.method !== 'GET') return methodNotAllowed(response, ['GET'])
        return sendJson(response, 200, { status: 'ok', product: 'Obra na Mão', apiVersion: LAN_API_VERSION })
      }

      if (url.pathname === '/version') {
        if (request.method !== 'GET') return methodNotAllowed(response, ['GET'])
        return sendJson(response, 200, { product: 'Obra na Mão', apiVersion: LAN_API_VERSION, serverVersion })
      }

      if (url.pathname === '/api/v1/setup/status') {
        if (request.method !== 'GET') return methodNotAllowed(response, ['GET'])
        const state = identity?.state?.() || security?.serverState?.()
        if (!state?.serverId) return sendJson(response, 503, { error: 'setup_unavailable' })
        return sendJson(response, 200, { claimed: !!state.claimed, serverId: state.serverId })
      }

      if (url.pathname === '/api/v1/setup/claim') {
        if (request.method !== 'POST') return methodNotAllowed(response, ['POST'])
        return await handleSetupClaim(request, response, { security, identity, cloudAuthority, cloudBaseUrl })
      }

      if (url.pathname === '/api/v1/pair/claim') {
        if (request.method !== 'POST') return methodNotAllowed(response, ['POST'])
        if (!pairingService?.claim) return sendJson(response, 503, { error: 'pairing_unavailable' })
        const body = await readJson(request)
        const result = pairingService.claim({
          code: body.code,
          installationId: body.installationId,
          deviceName: body.deviceName,
          clientKey: request.socket?.remoteAddress || 'unknown'
        })
        return sendJson(response, 201, result)
      }

      if (url.pathname === '/api/v1/admin/status') {
        if (request.method !== 'GET') return methodNotAllowed(response, ['GET'])
        const actor = await authenticateLanRequest(request, security)
        requireAdminContext(actor)
        const state = security?.serverState?.() || {}
        const lastRefreshMs = state.lastCloudRefreshAt ? Date.parse(state.lastCloudRefreshAt) : NaN
        const stale = !Number.isFinite(lastRefreshMs) || nowMs() - lastRefreshMs > identityStaleMs
        return sendJson(response, 200, {
          company: { id: state.companyId || null, name: state.companyName || null },
          revision: state.identityRevision || null,
          lastCloudRefreshAt: state.lastCloudRefreshAt || null,
          deviceCount: security?.listDevices?.().length || 0,
          stale
        })
      }

      if (url.pathname === '/api/v1/admin/identity/refresh') {
        if (request.method !== 'POST') return methodNotAllowed(response, ['POST'])
        const actor = await authenticateLanRequest(request, security)
        requireAdminContext(actor)
        try {
          const state = await refreshIdentitySnapshot({ security, cloudAuthority })
          return sendJson(response, 200, { ok: true, revision: state.identityRevision || null, lastCloudRefreshAt: state.lastCloudRefreshAt || null })
        } catch {
          return sendJson(response, 503, { error: 'identity_refresh_failed', message: 'Não foi possível atualizar as permissões pela Cloud. O último snapshot válido foi preservado.' })
        }
      }

      if (url.pathname === '/api/v1/admin/pairing') {
        if (request.method !== 'POST') return methodNotAllowed(response, ['POST'])
        if (!pairingService?.createInvitation) return sendJson(response, 503, { error: 'pairing_unavailable' })
        const actor = await authenticateLanRequest(request, security)
        const body = await readJson(request)
        return sendJson(response, 201, pairingService.createInvitation({ actor, targetMemberId: body.targetMemberId }))
      }

      if (url.pathname === '/api/v1/admin/devices') {
        if (request.method !== 'GET') return methodNotAllowed(response, ['GET'])
        if (!pairingService?.listDevices) return sendJson(response, 503, { error: 'pairing_unavailable' })
        const actor = await authenticateLanRequest(request, security)
        return sendJson(response, 200, { devices: pairingService.listDevices(actor) })
      }

      const adminDeviceMatch = url.pathname.match(ADMIN_DEVICE_ROUTE)
      if (adminDeviceMatch) {
        if (request.method !== 'PUT') return methodNotAllowed(response, ['PUT'])
        if (!pairingService?.setDeviceStatus) return sendJson(response, 503, { error: 'pairing_unavailable' })
        const actor = await authenticateLanRequest(request, security)
        const body = await readJson(request)
        const device = pairingService.setDeviceStatus({ actor, deviceId: decodeURIComponent(adminDeviceMatch[1]), status: body.status })
        return sendJson(response, 200, { device })
      }

      const entityMatch = url.pathname.match(ENTITY_ROUTE)
      if (entityMatch) {
        const context = await authenticateLanRequest(request, security)
        return await handleEntityRequest(request, response, url, repository, entityMatch, context)
      }

      return sendJson(response, 404, { error: 'not_found' })
    } catch (error) {
      if (error instanceof LanAuthorizationError || error instanceof PairingError) return sendJson(response, error.status, { error: error.code, message: error.message })
      if (error?.code === 'invalid_json') return sendJson(response, 400, { error: 'invalid_json', message: error.message })
      if (error?.code === 'payload_too_large') return sendJson(response, 413, { error: 'payload_too_large', message: error.message })
      const message = error instanceof Error ? error.message : String(error)
      return sendJson(response, 400, { error: 'validation_error', message })
    }
  })
}
