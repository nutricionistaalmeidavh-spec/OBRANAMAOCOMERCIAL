import assert from 'node:assert/strict'
import test from 'node:test'
import { LanRepository } from '../src/repository.mjs'
import { LanSecurityRepository } from '../src/security-repository.mjs'

const permissionsA = {
  core: ['view', 'edit'],
  operation: ['view'],
  planning: [],
  finance: [],
  rh: []
}

function createSecurity() {
  const repository = new LanRepository({ filename: ':memory:' })
  const security = new LanSecurityRepository({ db: repository.connection(), now: () => '2026-10-01T16:00:00.000Z' })
  security.initializeServer({ serverId: 'server-a', setupCodeHash: 'setup-hash' })
  return { repository, security }
}

function snapshot({ companyId = 'company-a', revision = 'snapshot-1', permissions = permissionsA, permissionsRevision = 'perm-1' } = {}) {
  return {
    companyId,
    revision,
    generatedAt: '2026-10-01T16:00:00.000Z',
    members: [{
      memberId: 'member-a',
      email: 'member@example.com',
      role: 'foreman',
      modules: ['obra360', 'rdo'],
      channels: ['desktop'],
      status: 'active',
      ...(permissions === undefined ? {} : { permissions }),
      ...(permissionsRevision === undefined ? {} : { permissionsRevision })
    }]
  }
}

test('granular permissions and revision round-trip through LAN snapshot cache', () => {
  const { repository, security } = createSecurity()
  try {
    security.claimServer({ company: { id: 'company-a', name: 'A' }, cloudBaseUrl: 'https://cloud.example', serverToken: 'token', snapshot: snapshot() })
    const member = security.member('member-a')
    assert.deepEqual(member.permissions, permissionsA)
    assert.equal(member.permissionsRevision, 'perm-1')
  } finally { repository.close() }
})

test('legacy snapshot without granular fields remains valid and exposes no fabricated matrix', () => {
  const { repository, security } = createSecurity()
  try {
    security.claimServer({ company: { id: 'company-a', name: 'A' }, cloudBaseUrl: 'https://cloud.example', serverToken: 'token', snapshot: snapshot({ permissions: undefined, permissionsRevision: undefined }) })
    const member = security.member('member-a')
    assert.equal(member.permissions, undefined)
    assert.equal(member.permissionsRevision, undefined)
    assert.deepEqual(member.modules, ['obra360', 'rdo'])
  } finally { repository.close() }
})

test('snapshot refresh atomically replaces granular permissions and permission revision', () => {
  const { repository, security } = createSecurity()
  try {
    security.claimServer({ company: { id: 'company-a', name: 'A' }, cloudBaseUrl: 'https://cloud.example', serverToken: 'token', snapshot: snapshot() })
    const nextPermissions = { ...permissionsA, core: ['view'] }
    security.replaceSnapshot(snapshot({ revision: 'snapshot-2', permissions: nextPermissions, permissionsRevision: 'perm-2' }))
    const member = security.member('member-a')
    assert.deepEqual(member.permissions, nextPermissions)
    assert.equal(member.permissionsRevision, 'perm-2')
    assert.equal(security.serverState().identityRevision, 'snapshot-2')
  } finally { repository.close() }
})

test('mismatched tenant snapshot rolls back without losing the last valid granular policy', () => {
  const { repository, security } = createSecurity()
  try {
    security.claimServer({ company: { id: 'company-a', name: 'A' }, cloudBaseUrl: 'https://cloud.example', serverToken: 'token', snapshot: snapshot() })
    assert.throws(() => security.replaceSnapshot(snapshot({ companyId: 'company-b', revision: 'bad', permissionsRevision: 'bad-perm' })), /outra empresa/i)
    const member = security.member('member-a')
    assert.deepEqual(member.permissions, permissionsA)
    assert.equal(member.permissionsRevision, 'perm-1')
    assert.equal(security.serverState().identityRevision, 'snapshot-1')
  } finally { repository.close() }
})
