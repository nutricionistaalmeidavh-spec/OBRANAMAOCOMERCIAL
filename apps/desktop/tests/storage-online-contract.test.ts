import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const preload = fs.readFileSync(path.resolve(process.cwd(), 'electron/preload.cjs'), 'utf8')
const main = fs.readFileSync(path.resolve(process.cwd(), 'electron/main.cjs'), 'utf8')

describe('storage and Web/PWA public contract separation', () => {
  it('keeps storage lifecycle and migration API separate from online/session/sync', () => {
    const storageBlock = preload.match(/storage:\s*\{[\s\S]*?\r?\n\s*\},\r?\n\s*lan:/)?.[0] || ''
    expect(storageBlock).not.toBe('')
    expect(storageBlock).toContain("state: () => call('storage:state')")
    expect(storageBlock).toContain("configure: (input) => call('storage:configure', input)")
    expect(storageBlock).toContain("testConnection: () => call('storage:test-connection')")
    expect(storageBlock).toContain("discoverServers: () => call('storage:discover-servers')")
    expect(storageBlock).toContain("probeAddress: (address, operationalMode = 'lan-client') => call('storage:probe-address'")
    expect(storageBlock).toContain("connectAddress: (address, operationalMode = 'lan-client') => call('storage:connect-address'")
    expect(storageBlock).toContain("moduleState: (module) => call('storage:module-state'")
    expect(storageBlock).toContain("migrationPreflight: (module) => call('storage:migration-preflight'")
    expect(storageBlock).toContain("migrationStatus: (module) => call('storage:migration-status'")
    expect(storageBlock).toContain("migrateModule: (module) => call('storage:migrate-module'")
    expect(storageBlock).toContain("rollbackModuleMigration: (module) => call('storage:rollback-module-migration'")
    expect(storageBlock).not.toContain('online:')
    expect(storageBlock).not.toContain("call('online:")
    expect(storageBlock).not.toContain("call('online:sync")
    expect(storageBlock).not.toContain("call('online:session")
  })

  it('guards lan-host against connecting to its own discovered identity before switching modes', () => {
    const connectBlock = main.match(/async function connectStorageAddress\(address, operationalMode = 'lan-client'\) \{[\s\S]*?\r?\n\}/)?.[0] || ''
    expect(connectBlock).toContain("previous.operationalMode === 'lan-host'")
    expect(connectBlock).toContain('services.lanSetup.status()')
    expect(connectBlock).toContain('rejectServerId')
    expect(connectBlock).toContain('services.storage.connectAddress(address')
  })

  it('keeps the existing online auth/session/sync API available', () => {
    expect(preload).toContain("passwordAuth: (input) => call('online:password-auth', input)")
    expect(preload).toContain("state: () => call('online:state')")
    expect(preload).toContain("session: () => call('online:session')")
    expect(preload).toContain("syncState: () => call('online:sync-state')")
    expect(preload).toContain("configureSync: (scope) => call('online:sync-configure', scope)")
    expect(preload).toContain("syncNow: () => call('online:sync-now')")
    expect(preload).toContain("syncPull: (sinceRevision) => call('online:sync-pull', { sinceRevision })")
    expect(preload).toContain("syncPush: (changes) => call('online:sync-push', { changes })")
  })

  it('routes storage lifecycle without coupling it to the existing online/sync services', () => {
    const configureStorageBlock = main.match(/async function configureStorage\(payload\) \{[\s\S]*?\r?\n\}/)?.[0] || ''
    expect(main).toContain("ipcMain.handle('storage:configure', envelope((payload) => configureStorage(payload)))")
    expect(main).toContain("ipcMain.handle('storage:test-connection', envelope(() => services.storage.testConnection()))")
    expect(main).toContain("ipcMain.handle('storage:discover-servers', envelope(() => services.serverDiscovery.discover()))")
    expect(main).toContain("ipcMain.handle('storage:probe-address', envelope(({ address, operationalMode }) => services.storage.probeAddress(address, { operationalMode })))")
    expect(main).toContain("ipcMain.handle('storage:connect-address', envelope(({ address, operationalMode }) => connectStorageAddress(address, operationalMode)))")
    expect(main).toContain("ipcMain.handle('lan:reconnect', envelope(() => services.serverReconnect.reconnect()))")
    expect(main).toContain("await services.serverReconnect.reconnect()")
    expect(configureStorageBlock).toContain('services.storage.configure(payload)')
    expect(configureStorageBlock).toContain('services.lanHost')
    expect(configureStorageBlock).not.toContain('services.online')
    expect(configureStorageBlock).not.toContain('services.sync')
    expect(main).not.toContain("storage:configure', envelope((payload) => services.online")
    expect(main).toContain("ipcMain.handle('online:state', envelope(() => services.online.state()))")
    expect(main).toContain("ipcMain.handle('online:session', envelope(() => services.online.session()))")
    expect(main).toContain("ipcMain.handle('online:sync-state', envelope(() => services.sync.state()))")
    expect(main).toContain("ipcMain.handle('online:sync-now', envelope(() => { requireSyncAvailable(); return services.sync.run({ retryNow: true }) }))")
  })
})
