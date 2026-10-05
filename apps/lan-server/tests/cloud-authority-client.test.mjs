import assert from 'node:assert/strict'
import test from 'node:test'
import { CloudAuthorityClient } from '../src/cloud-authority-client.mjs'

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

test('Cloud authority client requires HTTPS by default', () => {
  assert.throws(() => new CloudAuthorityClient({ baseUrl: 'http://example.test' }), /HTTPS/i)
  assert.doesNotThrow(() => new CloudAuthorityClient({ baseUrl: 'https://example.test' }))
})

test('redeemClaim posts server id and claim token to the Cloud authority endpoint', async () => {
  const calls = []
  const client = new CloudAuthorityClient({
    baseUrl: 'https://example.test',
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init })
      return jsonResponse({ serverToken: 'server-token', company: { id: 'company-a', name: 'Empresa A' }, claimingMemberId: 'member-a', issuedByDeviceId: 'device-a', snapshot: { companyId: 'company-a', revision: 'rev-1', members: [] } })
    }
  })

  const result = await client.redeemClaim({ serverId: 'server-a', claimToken: 'claim-secret' })
  assert.equal(result.serverToken, 'server-token')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'https://example.test/api/lan/claim/redeem')
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), { serverId: 'server-a', claimToken: 'claim-secret' })
})

test('snapshot sends server token only as bearer authorization and validates returned shape', async () => {
  let request
  const client = new CloudAuthorityClient({
    baseUrl: 'https://example.test/',
    fetchImpl: async (url, init) => {
      request = { url: String(url), init }
      return jsonResponse({ serverId: 'server-a', company: { id: 'company-a', name: 'Empresa A' }, snapshot: { companyId: 'company-a', revision: 'rev-2', generatedAt: '2026-09-29T20:00:00.000Z', members: [] } })
    }
  })

  const result = await client.snapshot({ serverToken: 'top-secret' })
  assert.equal(result.snapshot.companyId, 'company-a')
  assert.equal(request.url, 'https://example.test/api/lan/server/snapshot')
  assert.equal(request.init.headers.authorization, 'Bearer top-secret')
  assert.equal(String(request.init.body || ''), '')
})

test('errors never echo claim or server secrets', async () => {
  const client = new CloudAuthorityClient({
    baseUrl: 'https://example.test',
    fetchImpl: async () => jsonResponse({ error: 'invalid' }, 403)
  })

  await assert.rejects(
    () => client.redeemClaim({ serverId: 'server-a', claimToken: 'claim-super-secret' }),
    error => {
      assert.equal(String(error.message).includes('claim-super-secret'), false)
      return true
    }
  )
  await assert.rejects(
    () => client.snapshot({ serverToken: 'server-super-secret' }),
    error => {
      assert.equal(String(error.message).includes('server-super-secret'), false)
      return true
    }
  )
})

test('redeemEnrollment sends server bearer token and installation-bound enrollment token',async()=>{
  let request
  const client=new CloudAuthorityClient({
    baseUrl:'https://example.test',
    fetchImpl:async(url,init)=>{
      request={url:String(url),init}
      return jsonResponse({companyId:'company-a',serverId:'server-a',memberId:'member-a',installationId:'install-a'})
    }
  })
  const result=await client.redeemEnrollment({serverToken:'server-secret',serverId:'server-a',enrollmentToken:'enroll-secret',installationId:'install-a'})
  assert.equal(result.memberId,'member-a')
  assert.equal(request.url,'https://example.test/api/lan/enroll/redeem')
  assert.equal(request.init.headers.authorization,'Bearer server-secret')
  assert.deepEqual(JSON.parse(String(request.init.body)),{serverId:'server-a',enrollmentToken:'enroll-secret',installationId:'install-a'})
})
