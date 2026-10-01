import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const preload = fs.readFileSync(path.resolve(process.cwd(), 'electron/preload.cjs'), 'utf8')
const main = fs.readFileSync(path.resolve(process.cwd(), 'electron/main.cjs'), 'utf8')

describe('storage and Web/PWA public contract separation', () => {
  it('keeps storage limited to storage state/configuration/connection testing', () => {
    const storageBlock = preload.match(/storage:\s*\{[^\n]+\}/)?.[0] || ''
    expect(storageBlock).toContain("state: () => call('storage:state')")
    expect(storageBlock).toContain("configure: (input) => call('storage:configure', input)")
    expect(storageBlock).toContain("testConnection: () => call('storage:test-connection')")
    expect(storageBlock).not.toContain('online:')
    expect(storageBlock).not.toContain('sync')
    expect(storageBlock).not.toContain('session')
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
    const configureStorageBlock = main.match(/async function configureStorage\(payload\) \{[\s\S]*?\n\}/)?.[0] || ''
    expect(main).toContain("ipcMain.handle('storage:configure', envelope((payload) => configureStorage(payload)))")
    expect(main).toContain("ipcMain.handle('storage:test-connection', envelope(() => services.storage.testConnection()))")
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
