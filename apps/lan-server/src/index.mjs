import path from 'node:path'
import { LanRepository } from './repository.mjs'
import { LanSecurityRepository } from './security-repository.mjs'
import { ServerIdentity } from './server-identity.mjs'
import { CloudAuthorityClient } from './cloud-authority-client.mjs'
import { PairingService } from './pairing-service.mjs'
import { MigrationService } from './migration-service.mjs'
import { CentralBackupService } from './central-backup-service.mjs'
import { loadRuntimeConfig } from './runtime-config.mjs'
import { ensureRuntimePaths, resolveRuntimePaths } from './runtime-paths.mjs'
import { createRuntime } from './server-runtime.mjs'
import { createLanServer, LAN_SERVER_VERSION, refreshIdentitySnapshot } from './server.mjs'

const runtimeConfig = loadRuntimeConfig()
const { host, port, cloudBaseUrl } = runtimeConfig
const runtimePaths = ensureRuntimePaths(resolveRuntimePaths(runtimeConfig, {
  migrationsDir: path.resolve(import.meta.dirname, '../migrations')
}))
const { dataDir, databasePath, migrationsDir } = runtimePaths
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
    const centralBackupService = new CentralBackupService({
      repository,
      security,
      dataDir,
      migrationsDir,
      databasePath,
      serverVersion: LAN_SERVER_VERSION,
      expectedSchemaVersion: migrationState.version
    })
    const server = createLanServer({
      serverVersion: LAN_SERVER_VERSION,
      repository,
      security,
      identity,
      cloudAuthority,
      cloudBaseUrl,
      pairingService,
      migrationService,
      centralBackupService
    })

    return {
      server,
      repository,
      security,
      identity,
      cloudAuthority,
      migrationState,
      close: () => repository.close()
    }
  } catch (error) {
    try { repository.close() } catch {}
    throw error
  }
}

const runtime = createRuntime({ host, port, bootstrap: bootstrapServer })
await runtime.start()

const resources = runtime.resources()
const { security, identity, cloudAuthority, migrationState } = resources

async function refreshCachedIdentity() {
  if (!security.serverState()?.claimed) return
  try {
    await refreshIdentitySnapshot({ security, cloudAuthority })
  } catch (error) {
    console.warn(`Permissões Cloud temporariamente indisponíveis; usando último snapshot LAN válido. ${error instanceof Error ? error.message : ''}`.trim())
  }
}

console.log(`Obra na Mão LAN Server ${LAN_SERVER_VERSION} disponível em http://${host}:${port}`)
console.log(`Banco central: ${databasePath}`)
console.log(`Schema LAN: v${migrationState.version}`)
const state = identity.state()
if (state && !state.claimed && state.setupCode) {
  console.log(`Código de configuração LAN: ${state.setupCode}`)
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
    await runtime.stop()
    process.exit(0)
  } catch (error) {
    console.error(`Falha ao encerrar Obra na Mão Server: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}

process.on('SIGINT', () => { void shutdown() })
process.on('SIGTERM', () => { void shutdown() })
