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
import { createLanServer, LAN_SERVER_VERSION, refreshIdentitySnapshot } from './server.mjs'

const runtimeConfig = loadRuntimeConfig()
const { host, port, cloudBaseUrl } = runtimeConfig
const runtimePaths = ensureRuntimePaths(resolveRuntimePaths(runtimeConfig, {
  migrationsDir: path.resolve(import.meta.dirname, '../migrations')
}))
const { dataDir, databasePath, migrationsDir } = runtimePaths
const IDENTITY_REFRESH_MS = 5 * 60 * 1000

const repository = new LanRepository({ filename: databasePath })
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

async function refreshCachedIdentity() {
  if (!security.serverState()?.claimed) return
  try {
    await refreshIdentitySnapshot({ security, cloudAuthority })
  } catch (error) {
    console.warn(`Permissões Cloud temporariamente indisponíveis; usando último snapshot LAN válido. ${error instanceof Error ? error.message : ''}`.trim())
  }
}

server.listen(port, host, () => {
  console.log(`Obra na Mão LAN Server ${LAN_SERVER_VERSION} disponível em http://${host}:${port}`)
  console.log(`Banco central: ${databasePath}`)
  console.log(`Schema LAN: v${migrationState.version}`)
  const state = identity.state()
  if (state && !state.claimed && state.setupCode) {
    console.log(`Código de configuração LAN: ${state.setupCode}`)
  }
  void refreshCachedIdentity()
})

const identityRefreshTimer = setInterval(() => { void refreshCachedIdentity() }, IDENTITY_REFRESH_MS)
identityRefreshTimer.unref?.()

let shuttingDown = false
function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  clearInterval(identityRefreshTimer)
  server.close(() => {
    repository.close()
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
