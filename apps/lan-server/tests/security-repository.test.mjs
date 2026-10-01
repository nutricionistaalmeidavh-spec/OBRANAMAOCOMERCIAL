import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { LanRepository } from '../src/repository.mjs'
import { LanSecurityRepository } from '../src/security-repository.mjs'

function snapshot(revision='rev-1') {
  return {
    companyId: 'company-a', revision, generatedAt: '2026-09-29T20:00:00.000Z',
    members: [
      { memberId: 'member-admin', email: 'admin@example.com', name: 'Admin', role: 'admin', modules: ['obra360'], channels: ['desktop','mobile'], status: 'active' },
      { memberId: 'member-field', email: 'field@example.com', name: 'Campo', role: 'foreman', modules: ['obra360','rdo'], channels: ['desktop'], status: 'active' }
    ]
  }
}

test('security repository persists server claim, snapshot, devices, pairing and audit in the central DB', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'obn-lan-security-'))
  const filename = path.join(dir, 'central.sqlite')
  const now = () => '2026-09-29T20:00:00.000Z'
  let repository = new LanRepository({ filename })
  let security = new LanSecurityRepository({ db: repository.connection(), now })
  try {
    assert.equal(security.serverState(), null)
    security.initializeServer({ serverId: 'server-a', setupCodeHash: 'setup-hash' })
    assert.deepEqual(security.serverState(), {
      serverId: 'server-a', setupCodeHash: 'setup-hash', claimed: false,
      companyId: null, companyName: null, cloudBaseUrl: null, serverToken: null,
      claimedAt: null, lastCloudRefreshAt: null, identityRevision: null
    })

    security.claimServer({
      company: { id: 'company-a', name: 'Empresa A' }, cloudBaseUrl: 'https://cloud.example',
      serverToken: 'server-token-secret', snapshot: snapshot()
    })
    const claimed = security.serverState()
    assert.equal(claimed.claimed, true)
    assert.equal(claimed.companyId, 'company-a')
    assert.equal(claimed.identityRevision, 'rev-1')
    assert.equal(security.member('member-admin').role, 'admin')

    const device = security.createDevice({ memberId: 'member-admin', installationId: 'install-a', deviceName: 'PC Admin', tokenHash: 'device-token-hash' })
    assert.equal(device.status, 'active')
    assert.equal(security.deviceByTokenHash('device-token-hash').id, device.id)
    security.setDeviceStatus(device.id, 'revoked')
    assert.equal(security.deviceByTokenHash('device-token-hash').status, 'revoked')
    assert.equal(security.listDevices().length, 1)

    security.createPairingCode({ memberId: 'member-field', codeHash: 'pair-hash', expiresAt: '2026-09-29T20:10:00.000Z', createdByDeviceId: device.id })
    const invite = security.consumePairingCode('pair-hash')
    assert.equal(invite.memberId, 'member-field')
    assert.equal(security.consumePairingCode('pair-hash'), null, 'pairing code is single-use')

    security.appendAudit({ actorMemberId: 'member-admin', actorDeviceId: device.id, action: 'DEVICE_REVOKED', targetType: 'device', targetId: device.id, details: { reason: 'test' } })

    security.replaceSnapshot({ ...snapshot('rev-2'), members: [snapshot().members[0]] })
    assert.equal(security.serverState().identityRevision, 'rev-2')
    assert.equal(security.member('member-field'), null, 'snapshot replacement removes members no longer authorized by Cloud')
  } finally {
    repository.close()
  }

  repository = new LanRepository({ filename })
  security = new LanSecurityRepository({ db: repository.connection(), now })
  try {
    assert.equal(security.serverState().serverId, 'server-a')
    assert.equal(security.member('member-admin').email, 'admin@example.com')
    assert.equal(security.listDevices()[0].status, 'revoked')
  } finally {
    repository.close()
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('expired pairing code is not consumed', () => {
  const repository = new LanRepository({ filename: ':memory:' })
  const security = new LanSecurityRepository({ db: repository.connection(), now: () => '2026-09-29T20:11:00.000Z' })
  try {
    security.initializeServer({ serverId: 'server-a', setupCodeHash: 'hash' })
    security.createPairingCode({ memberId: 'member-admin', codeHash: 'expired', expiresAt: '2026-09-29T20:10:00.000Z', createdByDeviceId: 'device-a' })
    assert.equal(security.consumePairingCode('expired'), null)
  } finally { repository.close() }
})
