import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { ServerIdentity } from '../src/server-identity.mjs'

const sha256 = value => createHash('sha256').update(String(value)).digest('hex')

function fakeSecurity(initial = null) {
  let state = initial ? { ...initial } : null
  return {
    serverState() { return state ? { ...state } : null },
    initializeServer({ serverId, setupCodeHash }) {
      if (!state) state = { serverId, setupCodeHash, claimed: false, companyId: null }
      else if (!state.claimed) state = { ...state, setupCodeHash }
      return { ...state }
    },
    clearSetupCode() {
      if (state) state = { ...state, setupCodeHash: null }
      return state ? { ...state } : null
    }
  }
}

test('first boot creates a stable server id and transient setup code while unclaimed', async () => {
  const security = fakeSecurity()
  const identity = new ServerIdentity({
    security,
    serverIdFactory: () => 'server-12345678',
    setupCodeFactory: () => 'ABCD-EFGH'
  })

  const state = identity.state()
  assert.equal(state.serverId, 'server-12345678')
  assert.equal(state.claimed, false)
  assert.equal(state.setupCode, 'ABCD-EFGH')
  assert.equal(security.serverState().setupCodeHash, sha256('ABCD-EFGH'))
  assert.equal(await identity.verifySetupCode('ABCD-EFGH'), true)
  assert.equal(await identity.verifySetupCode('ZZZZ-ZZZZ'), false)
})

test('restart preserves server id but rotates an unclaimed setup code instead of storing plaintext', async () => {
  const security = fakeSecurity({ serverId: 'server-stable', setupCodeHash: sha256('OLD-CODE'), claimed: false, companyId: null })
  const identity = new ServerIdentity({ security, serverIdFactory: () => 'server-new', setupCodeFactory: () => 'NEW-CODE' })

  assert.equal(identity.state().serverId, 'server-stable')
  assert.equal(identity.state().setupCode, 'NEW-CODE')
  assert.equal(security.serverState().setupCodeHash, sha256('NEW-CODE'))
  assert.equal(await identity.verifySetupCode('OLD-CODE'), false)
  assert.equal(await identity.verifySetupCode('NEW-CODE'), true)
})

test('claimed server never exposes or regenerates setup code', async () => {
  const security = fakeSecurity({ serverId: 'server-claimed', setupCodeHash: null, claimed: true, companyId: 'company-a' })
  const identity = new ServerIdentity({ security, setupCodeFactory: () => { throw new Error('must not generate') } })

  assert.deepEqual(identity.state(), { serverId: 'server-claimed', claimed: true, companyId: 'company-a', setupCode: null })
  assert.equal(await identity.verifySetupCode('ANYTHING'), false)
  identity.invalidateSetupCode()
  assert.equal(security.serverState().setupCodeHash, null)
})
