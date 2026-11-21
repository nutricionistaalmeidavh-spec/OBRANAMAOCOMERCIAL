import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { OnlineService } = require('./online-service.cjs')

describe('storage binding after transferring the company to a single computer', () => {
  it('does not reuse obsolete member LAN-server credentials for a local-single company', () => {
    const session = {
      storageTopology: { mode: 'local-single', serverId: null },
      desktopStorage: { mode: 'lan-server', serverId: 'old-principal', autoEnroll: true }
    }
    expect(OnlineService.prototype.storageBinding(session)).toBeNull()
  })
  it('keeps requiring the matching LAN server for a company still using shared storage', () => {
    const session = {
      storageTopology: { mode: 'lan-server', serverId: 'old-principal' },
      desktopStorage: { mode: 'lan-server', serverId: 'old-principal', autoEnroll: true }
    }
    expect(OnlineService.prototype.storageBinding(session)).toMatchObject({ mode: 'lan-server', serverId: 'old-principal' })
  })
})
