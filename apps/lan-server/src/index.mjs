import path from 'node:path'
import { LanRepository } from './repository.mjs'
import { LanSecurityRepository } from './security-repository.mjs'
import { ServerIdentity } from './server-identity.mjs'
import { CloudAuthorityClient } from './cloud-authority-client.mjs'
import { PairingService } from './pairing-service.mjs'
import { MigrationService } from './migration-service.mjs'
import { RuntimeBackupService } from './runtime-backup-service.mjs'
import { BackupOperationsService } from './backup-operations-service.mjs'
import { createHealthService } from './health-service.mjs'
import { loadRuntimeConfig, runtimeConfigForDiagnostics } from './runtime-config.mjs'
import { ensureRuntimePaths, resolveRuntimePaths } from './runtime-paths.mjs'
import { attachReadinessRoute } from './readiness-route.mjs'
import { createRuntime } from './server-runtime.mjs'
import { createRuntimeLogger } from './runtime-logger.mjs'
import { createDiscoveryService } from './discovery-service.mjs'
import { createLanServer, LAN_SERVER_VERSION, refreshIdentitySnapshot } from './server.mjs'

const runtimeConfig = loadRuntimeConfig()
const { host, port, cloudBaseUrl } = runtimeConfig
const logger = createRuntimeLogger()
const runtimePaths = ensureRuntimePaths(resolveRuntimePaths(runtimeConfig, {
  migrationsDir: path.resolve(import.meta.dirname, '../migrations')
}))
const { dataDir, backupDir, databasePath, migrationsDir } = runtimePaths
const IDENTITY_REFRESH_MS = 5 * 60 * 1000

function bootstrapServer() {
  const repository = new LanRepository({ filename: databasePath })
  try {
    const migrationState = repository.applyMigrations(migrationsDir)
    const security = new LanSecurityRepository({ db: repository.connection() })
    const identity = new ServerIdentity({ security })
    const cloudAuthority = new CloudAuthorityClient({ baseUrl: cloudBaseUrl })
    const pairingService = new PairingService({ security })
    const migrationService = new MigrationService({ repository, security })
    const centralBackupService = new RuntimeBackupService({
      repository,
      security,
      dataDir,
      backupDir,
      migrationsDir,
      databasePath,
      serverVersion: LAN_SERVER_VERSION,
      expectedSchemaVersion: migrationState.version
    })
    const backupOperations = new BackupOperationsService({
      storage: centralBackupService,
      enabled: runtimeConfig.backupEnabled,
      intervalHours: runtimeConfig.backupIntervalHours,
      retentionCount: runtimeConfig.backupRetentionCount
    })
    const healthService = createHealthService({ centralStorage: centralBackupService, expectedSchemaVersion: migrationState.version })
    const server = attachReadinessRoute(createLanServer({
      serverVersion: LAN_SERVER_VERSION,
      repository,
      security,
      identity,
      cloudAuthority,
      cloudBaseUrl,
      pairingService,
      migrationService,
      centralBackupService,
      backupOperationsService: backupOperations,
      runtimeInfo: { mode: runtimeConfig.mode, transport: runtimeConfig.transport }
    }), healthService)

    return { server, repository, security, identity, cloudAuthority, migrationState, healthService, backupOperations, close: () => repository.close() }
  } catch (error) {
    try { repository.close() } catch {}
    throw error
  }
}

const runtime = createRuntime({ host, port, bootstrap: bootstrapServer })
try {
  await runtime.start()
} catch (error) {
  logger.error('server_start_failed', { error })
  throw error
}

const resources = runtime.resources()
const { security, identity, cloudAuthority, migrationState, backupOperations } = resources
backupOperations.start()

async function refreshCachedIdentity() {
  if (!security.serverState()?.claimed) return
  try {
    await refreshIdentitySnapshot({ security, cloudAuthority })
  } catch (error) {
    logger.warn('cloud_permissions_unavailable', { error })
  }
}

logger.info('server_started', {
  version: LAN_SERVER_VERSION,
  schemaVersion: migrationState.version,
  ...runtimeConfigForDiagnostics(runtimeConfig)
})
const state = identity.state()
const discovery = createDiscoveryService({
  host,
  servicePort: port,
  serverId: state?.serverId,
  instanceName: runtimeConfig.instanceName
})
if (runtimeConfig.mode === 'remote') {
  logger.info('lan_discovery_disabled', { reason: 'remote_mode' })
} else {
  try {
    const discoveryState = await discovery.start()
    if (discoveryState.running) logger.info('lan_discovery_started', { port })
    else logger.info('lan_discovery_disabled', { reason: discoveryState.reason })
  } catch (error) {
    logger.warn('lan_discovery_unavailable', { error })
  }
}
if (state && !state.claimed) {
  if (runtimeConfig.showSetupCode && state.setupCode) {
    process.stdout.write(`Obra na Mão Server setup code (explicit opt-in): ${state.setupCode}\n`)
  } else {
    logger.warn('server_claim_required', {
      serverId: state.serverId,
      hint: 'Execute uma sessão de configuração com OBRA_NA_MAO_SERVER_SHOW_SETUP_CODE=true para exibir o código temporário.'
    })
  }
}
void refreshCachedIdentity()

const identityRefreshTimer = setInterval(() => { void refreshCachedIdentity() }, IDENTITY_REFRESH_MS)
identityRefreshTimer.unref?.()

let shuttingDown = false
async function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  clearInterval(identityRefreshTimer)
  try {
    backupOperations.stop()
    await discovery.stop()
    await runtime.stop()
    logger.info('server_stopped', { reason: 'signal' })
    process.exit(0)
  } catch (error) {
    logger.error('server_stop_failed', { error })
    process.exit(1)
  }
}

process.on('SIGINT', () => { void shutdown() })
process.on('SIGTERM', () => { void shutdown() })
