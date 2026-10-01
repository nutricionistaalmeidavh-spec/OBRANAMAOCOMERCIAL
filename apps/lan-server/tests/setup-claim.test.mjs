import assert from 'node:assert/strict'
import { once } from 'node:events'
import test from 'node:test'
import { createLanServer } from '../src/server.mjs'

function securityFixture() {
  let claimed = false
  let createdDevice = null
  return {
    state: () => ({ claimed, serverId: 'server-a', companyId: claimed ? 'company-a' : null }),
    serverState() { return this.state() },
    claimServerWithDevice({ company, cloudBaseUrl, serverToken, snapshot, device }) {
      assert.equal(company.id, 'company-a')
      assert.equal(snapshot.companyId, 'company-a')
      assert.equal(serverToken, 'server-secret')
      assert.equal(cloudBaseUrl, 'https://cloud.example')
      claimed = true
      createdDevice = { id: 'lan-device-a', ...device, status: 'active' }
      return { state: this.state(), device: createdDevice }
    },
    member(memberId) {
      if (memberId !== 'member-admin') return null
      return { memberId, email: 'admin@example.com', role: 'admin', modules: ['obra360'], channels: ['desktop','mobile'], status: 'active' }
    }
  }
}

async function fixture({ redeemResult } = {}) {
  const security = securityFixture()
  const identity = {
    state: () => ({ serverId: 'server-a', claimed: security.serverState().claimed, companyId: security.serverState().companyId, setupCode: 'ABCD-EFGH' }),
    verifySetupCode: async code => code === 'ABCD-EFGH',
    invalidateSetupCode() {}
  }
  const cloudAuthority = {
    async redeemClaim() {
      return redeemResult || {
        serverToken: 'server-secret',
        company: { id: 'company-a', name: 'Empresa A' },
        claimingMemberId: 'member-admin',
        issuedByDeviceId: 'cloud-device-a',
        snapshot: { companyId: 'company-a', revision: 'rev-1', generatedAt: '2026-09-29T20:00:00.000Z', members: [{ memberId: 'member-admin', email: 'admin@example.com', role: 'admin', modules: ['obra360'], channels: ['desktop','mobile'], status: 'active' }] }
      }
    },
    async snapshot() { throw new Error('not used') }
  }
  const server = createLanServer({ repository: null, security, identity, cloudAuthority, cloudBaseUrl: 'https://cloud.example' })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  return { server, baseUrl: `http://127.0.0.1:${address.port}`, security }
}

async function close(server) {
  server.close()
  await once(server, 'close')
}

async function post(baseUrl, path, body) {
  return fetch(baseUrl + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
}

test('setup status exposes only claimed and serverId', async () => {
  const { server, baseUrl } = await fixture()
  try {
    const response = await fetch(`${baseUrl}/api/v1/setup/status`)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { claimed: false, serverId: 'server-a' })
  } finally { await close(server) }
})

test('successful setup claim binds company and returns first LAN admin token once', async () => {
  const { server, baseUrl, security } = await fixture()
  try {
    const response = await post(baseUrl, '/api/v1/setup/claim', { setupCode: 'ABCD-EFGH', claimToken: 'claim-token', installationId: 'install-a', deviceName: 'PC Principal' })
    assert.equal(response.status, 201)
    const payload = await response.json()
    assert.equal(payload.claimed, true)
    assert.deepEqual(payload.company, { id: 'company-a', name: 'Empresa A' })
    assert.equal(payload.device.member.memberId, 'member-admin')
    assert.ok(typeof payload.deviceToken === 'string' && payload.deviceToken.length >= 40)
    assert.equal(security.serverState().claimed, true)

    const second = await post(baseUrl, '/api/v1/setup/claim', { setupCode: 'ABCD-EFGH', claimToken: 'claim-token-2', installationId: 'install-b', deviceName: 'PC 2' })
    assert.equal(second.status, 409)
  } finally { await close(server) }
})

test('setup claim rejects invalid setup code and Cloud/member mismatches without claiming', async () => {
  const invalidCode = await fixture()
  try {
    const response = await post(invalidCode.baseUrl, '/api/v1/setup/claim', { setupCode: 'WRONG', claimToken: 'claim-token', installationId: 'install-a', deviceName: 'PC Principal' })
    assert.equal(response.status, 403)
    assert.equal(invalidCode.security.serverState().claimed, false)
  } finally { await close(invalidCode.server) }

  const mismatch = await fixture({ redeemResult: {
    serverToken: 'server-secret',
    company: { id: 'company-a', name: 'Empresa A' },
    claimingMemberId: 'member-user',
    issuedByDeviceId: 'cloud-device-a',
    snapshot: { companyId: 'company-a', revision: 'rev-x', members: [{ memberId: 'member-user', email: 'user@example.com', role: 'employee', modules: ['obra360'], channels: ['desktop'], status: 'active' }] }
  } })
  try {
    const response = await post(mismatch.baseUrl, '/api/v1/setup/claim', { setupCode: 'ABCD-EFGH', claimToken: 'claim-token', installationId: 'install-a', deviceName: 'PC Principal' })
    assert.equal(response.status, 403)
    assert.equal(mismatch.security.serverState().claimed, false)
  } finally { await close(mismatch.server) }
})
