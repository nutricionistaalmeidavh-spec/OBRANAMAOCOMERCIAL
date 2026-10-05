import http from 'node:http'
import { createHash, randomBytes } from 'node:crypto'
import { authenticateLanRequest, authorizeAction, authorizeBusinessRoute, LanAuthorizationError } from './authorization.mjs'
import { PairingError } from './pairing-service.mjs'
import { FieldService } from './field-service.mjs'
import { PlanningService } from './planning-service.mjs'
import { FinanceService } from './finance-service.mjs'
import { PayrollService } from './payroll-service.mjs'
import { TimeService } from './time-service.mjs'
import { CompensationPolicyService } from './compensation-policy-service.mjs'
import { MigrationService } from './migration-service.mjs'
import { RevisionConflictError } from './concurrency-service.mjs'
import { createVersionedRepository } from './versioned-repository.mjs'

export const LAN_API_VERSION = '1'
export const LAN_SERVER_VERSION = '0.4.0'

const MAX_BODY_BYTES = 1024 * 1024
const DEFAULT_IDENTITY_STALE_MS = 15 * 60 * 1000
const ENTITY_ROUTE = /^\/api\/v1\/(empresas|clientes|obras|locais_obra|fontes_documentais|frentes_obra|subfrentes_obra|checklist_frente_itens|tarefas_obra|rdos|rdo_equipe|rdo_equipamentos|rdo_ocorrencias|rdo_anexos|etapas_obra|cronograma_etapas|itens_orcamentarios|medicoes|medicao_itens|medicao_mapa_itens|medicao_anexos|fornecedores|categorias_financeiras|contas|pagamentos_conta|solicitacoes_compra|cotacoes_compra|pedidos_compra|pedido_compra_itens|recebimentos_materiais|movimentacoes_estoque|contratos_obra|contrato_aditivos|contrato_anexos|pedido_compra_anexos|funcionarios|funcionario_obras|cargos|beneficios|cargo_beneficios|funcionario_beneficios|folhas_pagamento|folha_lancamentos|pagamentos_funcionario|pontos_mensais|ponto_marcacoes|epis|funcionario_epis|arquivos|documentos|documentos_editaveis|modelos_documento_rh)(?:\/(\d+))?\/?$/
const ADMIN_DEVICE_ROUTE = /^\/api\/v1\/admin\/devices\/([^/]+)\/?$/
const FINANCE_PAYMENT_ROUTE = /^\/api\/v1\/finance\/accounts\/(\d+)\/payment\/?$/
const MIGRATION_ROUTE = /^\/api\/v1\/migrations\/([^/]+)\/(record|status|validate|commit|rollback)\/?$/

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

function publicCentralBackup(result = {}) {
  const allowed = ['backupId','createdAt','fingerprint','schemaVersion','serverId','companyId','serverVersion','sizeBytes','reason','integrity','restored','safetyBackupId','maintenance','accessible','claimed','migrationsApplied','lastBackup','error']
  return Object.fromEntries(allowed.filter(key => result?.[key] !== undefined).map(key => [key, result[key]]))
}

const SERVER_CAPABILITIES = Object.freeze({
  version:1,
  modules:['core','operation','planning','finance','rh','summary'],
  bridgeEntities:['frentes_obra','tarefas_obra','rdos','cronograma_etapas'],
  features:['optimistic-concurrency-v1','full-local-parity-v1']
})

function publicServerCapabilities(versionedRepository) {
  return {
    version:SERVER_CAPABILITIES.version,
    modules:SERVER_CAPABILITIES.modules,
    bridgeEntities:SERVER_CAPABILITIES.bridgeEntities,
    ...(versionedRepository ? { features:SERVER_CAPABILITIES.features } : {})
  }
}

function publicBackupOperation(result = {}) {
  return {
    ...(result.backup ? { backup:publicCentralBackup(result.backup) } : {}),
    ...(result.verified !== undefined ? { verified:!!result.verified } : {}),
    ...(result.retention ? { retention:{ retained:result.retention.retained ?? null, removed:Array.isArray(result.retention.removed)?result.retention.removed:[] } } : {})
  }
}

function publicOperationalStorageHealth(health = {}) {
  const allowed = ['accessible','integrity','schemaVersion','serverId','companyId','sizeBytes','maintenance','claimed','migrationsApplied','lastBackup']
  return Object.fromEntries(allowed.filter(key => health?.[key] !== undefined).map(key => [key, key === 'lastBackup' ? publicCentralBackup(health[key]) : health[key]]))
}

function publicBackupPolicy(status = {}) {
  return {
    enabled:status.enabled === true,
    running:status.running === true,
    intervalHours:Number(status.intervalHours || 0),
    retentionCount:Number(status.retentionCount || 0),
    lastRun:status.lastRun ? {
      status:status.lastRun.status || null,
      reason:status.lastRun.reason || null,
      at:status.lastRun.at || null,
      backupId:status.lastRun.backupId || null
    } : null,
    nextRunAt:status.nextRunAt || null
  }
}

function syncSourceScope(url) {
  return {
    companyId: Number(url.searchParams.get('company_id')),
    workId: Number(url.searchParams.get('obra_id')),
    remoteCompanyId: url.searchParams.get('remote_company_id') || null,
    remoteProjectId: url.searchParams.get('remote_project_id') || null,
    deviceId: url.searchParams.get('device_id') || null,
    workName: url.searchParams.get('work_name') || null,
    modules: String(url.searchParams.get('modules') || '').split(',').map(value => value.trim()).filter(Boolean)
  }
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

async function handleEntityRequest(request, response, url, repository, versionedRepository, match, context) {
  if (!repository) return sendJson(response, 503, { error: 'repository_unavailable', message: 'Banco central do servidor indisponível.' })

  const table = match[1]
  const id = match[2] ? Number(match[2]) : null
  authorizeBusinessRoute(context, { table, method: request.method })

  if (id === null) {
    if (request.method === 'GET') {
      const filters = Object.fromEntries(url.searchParams.entries())
      return sendJson(response, 200, versionedRepository ? versionedRepository.list(table, filters) : repository.list(table, filters))
    }
    if (request.method === 'POST') {
      const data = await readJson(request)
      const saved = versionedRepository ? versionedRepository.create(table, data) : repository.save(table, data)
      return sendJson(response, 201, saved)
    }
    return methodNotAllowed(response, ['GET', 'POST'])
  }

  if (request.method === 'GET') {
    const item = versionedRepository ? versionedRepository.get(table, id) : repository.get(table, id)
    return item ? sendJson(response, 200, item) : sendJson(response, 404, { error: 'not_found' })
  }
  if (request.method === 'PUT') {
    const body = await readJson(request)
    const saved = versionedRepository
      ? versionedRepository.update(table, id, body.expectedRevision, body.data)
      : repository.save(table, { ...body, id })
    return saved ? sendJson(response, 200, saved) : sendJson(response, 404, { error: 'not_found' })
  }
  if (request.method === 'DELETE') {
    const removed = versionedRepository
      ? versionedRepository.remove(table, id, url.searchParams.get('expectedRevision'))
      : repository.remove(table, id)
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

async function authorizeRh(request, security, action = 'edit') {
  const context = await authenticateLanRequest(request, security)
  authorizeAction(context, { domain: 'rh', action })
  return context
}

export function createLanServer({ serverVersion = LAN_SERVER_VERSION, repository = null, security = null, identity = null, cloudAuthority = null, cloudBaseUrl = '', pairingService = null, fieldService = null, planningService = null, financeService = null, payrollService = null, timeService = null, compensationPolicyService = null, migrationService = null, centralBackupService = null, backupOperationsService = null, runtimeInfo = {}, nowMs = Date.now, identityStaleMs = DEFAULT_IDENTITY_STALE_MS } = {}) {
  const versionedRepository = createVersionedRepository(repository)
  const field = fieldService || (versionedRepository ? new FieldService({ repository }) : null)
  const planning = planningService || (repository ? new PlanningService({ repository }) : null)
  const finance = financeService || (repository ? new FinanceService({ repository, now: nowMs }) : null)
  const payroll = payrollService || (versionedRepository ? new PayrollService({ repository }) : null)
  const time = timeService || (versionedRepository ? new TimeService({ repository }) : null)
  const compensationPolicy = compensationPolicyService || (versionedRepository ? new CompensationPolicyService({ repository }) : null)
  const migration = migrationService || (repository ? new MigrationService({ repository, security }) : null)
  const centralStorage = centralBackupService
  const backupOperations = backupOperationsService
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

      if (url.pathname === '/api/v1/session') {
        if (request.method !== 'GET') return methodNotAllowed(response, ['GET'])
        const actor = await authenticateLanRequest(request, security)
        const state = security?.serverState?.() || {}
        const member = actor.member || {}
        return sendJson(response, 200, {
          serverId: state.serverId || null,
          companyId: actor.companyId || state.companyId || null,
          device: { id: actor.device.id, status: actor.device.status },
          member: {
            memberId: member.memberId,
            email: member.email,
            name: member.name,
            role: member.role,
            modules: Array.isArray(member.modules) ? member.modules : [],
            channels: Array.isArray(member.channels) ? member.channels : [],
            status: member.status
          }
        })
      }

      if (url.pathname === '/api/v1/admin/storage/health') {
        if (request.method !== 'GET') return methodNotAllowed(response, ['GET'])
        if (!centralStorage?.health) return sendJson(response, 503, { error:'storage_admin_unavailable', message:'Diagnóstico do storage central indisponível.' })
        const actor = await authenticateLanRequest(request, security)
        requireAdminContext(actor)
        return sendJson(response, 200, publicCentralBackup(centralStorage.health()))
      }

      if (url.pathname === '/api/v1/admin/operations') {
        if (request.method !== 'GET') return methodNotAllowed(response, ['GET'])
        const actor = await authenticateLanRequest(request, security)
        requireAdminContext(actor)
        const state = security?.serverState?.() || {}
        const lastRefreshMs = state.lastCloudRefreshAt ? Date.parse(state.lastCloudRefreshAt) : NaN
        const stale = !Number.isFinite(lastRefreshMs) || nowMs() - lastRefreshMs > identityStaleMs
        const health = centralStorage?.health?.() || { accessible:false, integrity:'unknown', maintenance:false }
        const backup = publicBackupPolicy(backupOperations?.status?.() || {})
        const devices = security?.listDevices?.() || []
        const authority = {
          company:{ id:state.companyId || null, name:state.companyName || null },
          revision:state.identityRevision || null,
          lastCloudRefreshAt:state.lastCloudRefreshAt || null,
          stale
        }
        const ready = health.accessible === true && health.integrity === 'ok' && health.maintenance !== true
        return sendJson(response, 200, {
          server:{
            version:serverVersion,
            apiVersion:LAN_API_VERSION,
            serverId:state.serverId || null,
            runtime:{ mode:runtimeInfo?.mode || null, transport:runtimeInfo?.transport || null }
          },
          readiness:{ ready, status:ready?'ready':'not_ready' },
          storage:publicOperationalStorageHealth(health),
          backup:{ policy:backup, lastBackup:health.lastBackup || null },
          devices:{
            total:devices.length,
            active:devices.filter(item=>item?.status === 'active').length,
            revoked:devices.filter(item=>item?.status === 'revoked').length
          },
          authority,
          sync:{ authorityRevision:authority.revision, lastCloudRefreshAt:authority.lastCloudRefreshAt, stale:authority.stale },
          capabilities:publicServerCapabilities(versionedRepository)
        })
      }

      if (url.pathname === '/api/v1/admin/storage/backups') {
        if (request.method !== 'GET') return methodNotAllowed(response, ['GET'])
        if (!backupOperations?.list) return sendJson(response, 503, { error:'backup_operations_unavailable', message:'Lista de backups operacionais indisponível.' })
        const actor = await authenticateLanRequest(request, security)
        requireAdminContext(actor)
        return sendJson(response, 200, { backups:backupOperations.list().map(publicCentralBackup) })
      }

      if (url.pathname === '/api/v1/admin/storage/restore-test') {
        if (request.method !== 'POST') return methodNotAllowed(response, ['POST'])
        if (!backupOperations?.testRestore) return sendJson(response, 503, { error:'backup_operations_unavailable', message:'Teste de restore indisponível.' })
        const actor = await authenticateLanRequest(request, security)
        requireAdminContext(actor)
        const body = await readJson(request)
        if (!body.backupId) throw new Error('Identificador do backup central não informado.')
        const result = await backupOperations.testRestore(body.backupId,{ actor })
        return sendJson(response, 200, { restorable:result.restorable === true, ...publicCentralBackup(result) })
      }

      if (url.pathname === '/api/v1/admin/storage/pre-upgrade') {
        if (request.method !== 'POST') return methodNotAllowed(response, ['POST'])
        if (!backupOperations?.preUpgrade) return sendJson(response, 503, { error:'backup_operations_unavailable', message:'Backup pré-upgrade indisponível.' })
        const actor = await authenticateLanRequest(request, security)
        requireAdminContext(actor)
        const result = await backupOperations.preUpgrade({ actor })
        return sendJson(response, 201, publicBackupOperation(result))
      }

      if (url.pathname === '/api/v1/admin/storage/backup') {
        if (request.method !== 'POST') return methodNotAllowed(response, ['POST'])
        if (!centralStorage?.create) return sendJson(response, 503, { error:'storage_admin_unavailable', message:'Backup do storage central indisponível.' })
        const actor = await authenticateLanRequest(request, security)
        requireAdminContext(actor)
        const body = await readJson(request)
        if (backupOperations?.runNow) {
          const result = await backupOperations.runNow({ reason:body.reason || 'manual', actor })
          return sendJson(response, 201, publicCentralBackup(result.backup))
        }
        const result = await centralStorage.create({ reason:body.reason || 'manual', actor })
        return sendJson(response, 201, publicCentralBackup(result))
      }

      if (url.pathname === '/api/v1/admin/storage/verify') {
        if (request.method !== 'POST') return methodNotAllowed(response, ['POST'])
        if (!centralStorage?.verifyManagedBackup) return sendJson(response, 503, { error:'storage_admin_unavailable', message:'Verificação do backup central indisponível.' })
        const actor = await authenticateLanRequest(request, security)
        requireAdminContext(actor)
        const body = await readJson(request)
        if (!body.backupId) throw new Error('Identificador do backup central não informado.')
        const result = centralStorage.verifyManagedBackup(body.backupId,{ enforceCurrentIdentity:true, actor })
        return sendJson(response, 200, publicCentralBackup({ ...result, ...result.manifest }))
      }

      if (url.pathname === '/api/v1/admin/storage/restore') {
        if (request.method !== 'POST') return methodNotAllowed(response, ['POST'])
        if (!centralStorage?.restoreManaged) return sendJson(response, 503, { error:'storage_admin_unavailable', message:'Restore do storage central indisponível.' })
        const actor = await authenticateLanRequest(request, security)
        requireAdminContext(actor)
        const body = await readJson(request)
        if (!body.backupId) throw new Error('Identificador do backup central não informado.')
        const result = await centralStorage.restoreManaged(body.backupId,{ actor })
        return sendJson(response, 200, publicCentralBackup(result))
      }

      if (centralStorage?.isMaintenanceActive?.()) {
        return sendJson(response, 503, { error:'storage_maintenance', message:'Banco central temporariamente indisponível durante manutenção segura.' })
      }

      if (url.pathname === '/api/v1/sync-source/capabilities') {
        if (request.method !== 'GET') return methodNotAllowed(response, ['GET'])
        await authenticateLanRequest(request, security)
        return sendJson(response, 200, publicServerCapabilities(versionedRepository))
      }

      if (url.pathname === '/api/v1/sync-source/summary') {
        if (request.method !== 'GET') return methodNotAllowed(response, ['GET'])
        if (!finance?.syncSummary) return sendJson(response, 503, { error: 'finance_unavailable', message: 'Resumo central indisponível.' })
        const context = await authenticateLanRequest(request, security)
        authorizeBusinessRoute(context, { table: 'contas', method: 'GET' })
        const scope = syncSourceScope(url)
        return sendJson(response, 200, finance.syncSummary(scope, scope.modules))
      }

      if (url.pathname === '/api/v1/sync-source/obligations') {
        if (request.method !== 'GET') return methodNotAllowed(response, ['GET'])
        if (!finance?.syncObligations) return sendJson(response, 503, { error: 'finance_unavailable', message: 'Obrigações financeiras centrais indisponíveis.' })
        const context = await authenticateLanRequest(request, security)
        authorizeBusinessRoute(context, { table: 'contas', method: 'GET' })
        const scope = syncSourceScope(url)
        if (!scope.deviceId || !scope.remoteProjectId) throw new Error('Escopo remoto da obrigação financeira não informado.')
        return sendJson(response, 200, finance.syncObligations(scope))
      }

      if (url.pathname === '/api/v1/field/rdo') {
        if (request.method !== 'POST') return methodNotAllowed(response, ['POST'])
        if (!field?.saveDailyReport) return sendJson(response, 503, { error: 'field_unavailable', message: 'Serviço central de RDO indisponível.' })
        const context = await authenticateLanRequest(request, security)
        const body = await readJson(request)
        authorizeAction(context, { domain: 'operation', action: body.id ? 'edit' : 'create' })
        return sendJson(response, 201, field.saveDailyReport(body))
      }

      if (url.pathname === '/api/v1/planning/overview') {
        if (request.method !== 'GET') return methodNotAllowed(response, ['GET'])
        if (!planning?.overview) return sendJson(response, 503, { error: 'planning_unavailable', message: 'Serviço central de Planejamento indisponível.' })
        const context = await authenticateLanRequest(request, security)
        authorizeAction(context, { domain: 'planning', action: 'view' })
        const obraId = Number(url.searchParams.get('obra_id'))
        return sendJson(response, 200, planning.overview(obraId))
      }

      const financePaymentMatch = url.pathname.match(FINANCE_PAYMENT_ROUTE)
      if (financePaymentMatch) {
        if (request.method !== 'POST') return methodNotAllowed(response, ['POST'])
        if (!finance?.accountPayment) return sendJson(response, 503, { error: 'finance_unavailable', message: 'Serviço financeiro central indisponível.' })
        const context = await authenticateLanRequest(request, security)
        authorizeAction(context, { domain: 'finance', action: 'approve' })
        const body = await readJson(request)
        return sendJson(response, 200, finance.accountPayment(Number(financePaymentMatch[1]), body.payment || {}, body.requestId))
      }

      if (url.pathname === '/api/v1/finance/dre') {
        if (request.method !== 'GET') return methodNotAllowed(response, ['GET'])
        if (!finance?.dre) return sendJson(response, 503, { error: 'finance_unavailable', message: 'Serviço financeiro central indisponível.' })
        const context = await authenticateLanRequest(request, security)
        authorizeAction(context, { domain: 'finance', action: 'view' })
        const filters = Object.fromEntries(url.searchParams.entries())
        return sendJson(response, 200, finance.dre(filters))
      }

      if (url.pathname === '/api/v1/finance/dashboard') {
        if (request.method !== 'GET') return methodNotAllowed(response, ['GET'])
        if (!finance?.dashboard) return sendJson(response, 503, { error: 'finance_unavailable', message: 'Serviço financeiro central indisponível.' })
        const context = await authenticateLanRequest(request, security)
        authorizeAction(context, { domain: 'finance', action: 'view' })
        const filters = Object.fromEntries(url.searchParams.entries())
        return sendJson(response, 200, finance.dashboard(filters))
      }

      if (url.pathname === '/api/v1/rh/catalog/compensation-policy') {
        if (request.method !== 'POST') return methodNotAllowed(response, ['POST'])
        if (!compensationPolicy?.save) return sendJson(response, 503, { error: 'rh_unavailable', message: 'Política central de remuneração indisponível.' })
        await authorizeRh(request, security, 'edit')
        return sendJson(response, 200, compensationPolicy.save(await readJson(request)))
      }

      if (url.pathname === '/api/v1/rh/payroll/employee') {
        if (request.method !== 'POST') return methodNotAllowed(response, ['POST'])
        if (!payroll?.getEmployee) return sendJson(response, 503, { error: 'rh_unavailable', message: 'Folha central indisponível.' })
        await authorizeRh(request, security, 'view')
        return sendJson(response, 200, payroll.getEmployee(await readJson(request)))
      }

      if (url.pathname === '/api/v1/rh/payroll/save-variable') {
        if (request.method !== 'POST') return methodNotAllowed(response, ['POST'])
        if (!payroll?.saveVariable) return sendJson(response, 503, { error: 'rh_unavailable', message: 'Folha central indisponível.' })
        await authorizeRh(request, security, 'edit')
        return sendJson(response, 200, payroll.saveVariable(await readJson(request)))
      }

      if (url.pathname === '/api/v1/rh/payroll/remove-variable') {
        if (request.method !== 'POST') return methodNotAllowed(response, ['POST'])
        if (!payroll?.removeVariable) return sendJson(response, 503, { error: 'rh_unavailable', message: 'Folha central indisponível.' })
        await authorizeRh(request, security, 'edit')
        const body = await readJson(request)
        return sendJson(response, 200, { ok: payroll.removeVariable(body.id) })
      }

      if (url.pathname === '/api/v1/rh/payroll/confirm') {
        if (request.method !== 'POST') return methodNotAllowed(response, ['POST'])
        if (!payroll?.confirm) return sendJson(response, 503, { error: 'rh_unavailable', message: 'Folha central indisponível.' })
        await authorizeRh(request, security, 'approve')
        return sendJson(response, 200, payroll.confirm(await readJson(request)))
      }

      if (url.pathname === '/api/v1/rh/payroll/pending') {
        if (request.method !== 'POST') return methodNotAllowed(response, ['POST'])
        if (!payroll?.pending) return sendJson(response, 503, { error: 'rh_unavailable', message: 'Folha central indisponível.' })
        await authorizeRh(request, security, 'view')
        const body = await readJson(request)
        return sendJson(response, 200, payroll.pending(body.competencia))
      }

      if (url.pathname === '/api/v1/rh/time/get') {
        if (request.method !== 'POST') return methodNotAllowed(response, ['POST'])
        if (!time?.get) return sendJson(response, 503, { error: 'rh_unavailable', message: 'Ponto central indisponível.' })
        await authorizeRh(request, security, 'view')
        return sendJson(response, 200, time.get(await readJson(request)))
      }

      if (url.pathname === '/api/v1/rh/time/auto-fill') {
        if (request.method !== 'POST') return methodNotAllowed(response, ['POST'])
        if (!time?.autoFill) return sendJson(response, 503, { error: 'rh_unavailable', message: 'Ponto central indisponível.' })
        await authorizeRh(request, security, 'edit')
        return sendJson(response, 200, time.autoFill(await readJson(request)))
      }

      if (url.pathname === '/api/v1/rh/time/save') {
        if (request.method !== 'POST') return methodNotAllowed(response, ['POST'])
        if (!time?.save) return sendJson(response, 503, { error: 'rh_unavailable', message: 'Ponto central indisponível.' })
        await authorizeRh(request, security, 'edit')
        return sendJson(response, 200, time.save(await readJson(request)))
      }

      if (url.pathname === '/api/v1/rh/time/document-context') {
        if (request.method !== 'POST') return methodNotAllowed(response, ['POST'])
        if (!time?.documentContext) return sendJson(response, 503, { error: 'rh_unavailable', message: 'Contexto central de documentos indisponível.' })
        await authorizeRh(request, security, 'view')
        return sendJson(response, 200, time.documentContext(await readJson(request)))
      }

      if (url.pathname === '/api/v1/migrations/start') {
        if (request.method !== 'POST') return methodNotAllowed(response, ['POST'])
        if (!migration?.start) return sendJson(response, 503, { error: 'migration_unavailable', message: 'Migração central indisponível.' })
        const actor = await authenticateLanRequest(request, security)
        requireAdminContext(actor)
        return sendJson(response, 201, migration.start(await readJson(request), actor))
      }

      const migrationMatch = url.pathname.match(MIGRATION_ROUTE)
      if (migrationMatch) {
        if (!migration) return sendJson(response, 503, { error: 'migration_unavailable', message: 'Migração central indisponível.' })
        const migrationId = decodeURIComponent(migrationMatch[1])
        const action = migrationMatch[2]
        const actor = await authenticateLanRequest(request, security)
        if (action === 'status') {
          if (request.method !== 'GET') return methodNotAllowed(response, ['GET'])
          return sendJson(response, 200, migration.status(migrationId, actor))
        }
        if (request.method !== 'POST') return methodNotAllowed(response, ['POST'])
        requireAdminContext(actor)
        if (action === 'record') return sendJson(response, 201, migration.importRecord(migrationId, await readJson(request), actor))
        if (action === 'validate') return sendJson(response, 200, migration.validate(migrationId, actor))
        if (action === 'commit') return sendJson(response, 200, migration.commit(migrationId, actor))
        if (action === 'rollback') return sendJson(response, 200, migration.rollback(migrationId, actor))
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
        return await handleEntityRequest(request, response, url, repository, versionedRepository, entityMatch, context)
      }

      return sendJson(response, 404, { error: 'not_found' })
    } catch (error) {
      if (error instanceof LanAuthorizationError || error instanceof PairingError) return sendJson(response, error.status, { error: error.code, message: error.message })
      if (error instanceof RevisionConflictError) {
        return sendJson(response, 409, {
          error: error.code,
          resourceType: error.resourceType,
          resourceId: error.resourceId,
          expectedRevision: error.expectedRevision,
          currentRevision: error.currentRevision,
          current: error.current
        })
      }
      if (error?.code === 'invalid_json') return sendJson(response, 400, { error: 'invalid_json', message: error.message })
      if (error?.code === 'payload_too_large') return sendJson(response, 413, { error: 'payload_too_large', message: error.message })
      const message = error instanceof Error ? error.message : String(error)
      return sendJson(response, 400, { error: 'validation_error', message })
    }
  })
}