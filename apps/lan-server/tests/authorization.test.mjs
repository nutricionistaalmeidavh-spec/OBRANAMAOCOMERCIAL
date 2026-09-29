import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { authenticateLanRequest, authorizeBusinessRoute, LanAuthorizationError } from '../src/authorization.mjs'

const digest = value => createHash('sha256').update(String(value)).digest('hex')

function fixture({ deviceStatus='active', memberStatus='active', role='admin', modules=['obra360'], channels=['desktop'] } = {}) {
  const lookups=[]
  const security={
    deviceByTokenHash(hash){
      lookups.push(hash)
      return hash===digest('valid-device-token') ? { id:'device-a', memberId:'member-a', status:deviceStatus } : null
    },
    member(memberId){
      return memberId==='member-a' ? { memberId, email:'user@example.com', role, modules, channels, status:memberStatus } : null
    },
    touchDevice(id){ return { id } }
  }
  return { security, lookups }
}

const request = token => new Request('http://lan.local/api/v1/empresas', { headers: token===undefined ? {} : { authorization:`Bearer ${token}` } })

async function rejectsStatus(fn,status){
  await assert.rejects(fn,error=>{
    assert.ok(error instanceof LanAuthorizationError)
    assert.equal(error.status,status)
    return true
  })
}

test('missing, malformed and unknown bearer credentials are rejected without exposing token', async()=>{
  const {security}=fixture()
  await rejectsStatus(()=>authenticateLanRequest(new Request('http://lan.local'),security),401)
  await rejectsStatus(()=>authenticateLanRequest(new Request('http://lan.local',{headers:{authorization:'Basic abc'}}),security),401)
  await assert.rejects(
    ()=>authenticateLanRequest(request('unknown-super-secret'),security),
    error=>{ assert.equal(String(error.message).includes('unknown-super-secret'),false); assert.equal(error.status,401); return true }
  )
})

test('bearer token is hashed before lookup and active device/member context is returned', async()=>{
  const {security,lookups}=fixture()
  const context=await authenticateLanRequest(request('valid-device-token'),security)
  assert.equal(context.device.id,'device-a')
  assert.equal(context.member.role,'admin')
  assert.deepEqual(lookups,[digest('valid-device-token')])
})

test('revoked device, missing/revoked member and no desktop channel are denied', async()=>{
  await rejectsStatus(()=>authenticateLanRequest(request('valid-device-token'),fixture({deviceStatus:'revoked'}).security),403)
  await rejectsStatus(()=>authenticateLanRequest(request('valid-device-token'),fixture({memberStatus:'revoked'}).security),403)
  await rejectsStatus(()=>authenticateLanRequest(request('valid-device-token'),fixture({channels:['mobile']}).security),403)
})

test('business policy reuses Cloud role/module snapshot instead of LAN-only permissions', async()=>{
  const admin=await authenticateLanRequest(request('valid-device-token'),fixture({role:'admin',modules:[]}).security)
  assert.doesNotThrow(()=>authorizeBusinessRoute(admin,{table:'empresas',method:'DELETE'}))

  const field=await authenticateLanRequest(request('valid-device-token'),fixture({role:'foreman',modules:['obra360'],channels:['desktop']}).security)
  assert.doesNotThrow(()=>authorizeBusinessRoute(field,{table:'obras',method:'PUT'}))

  const noModule=await authenticateLanRequest(request('valid-device-token'),fixture({role:'foreman',modules:['rdo'],channels:['desktop']}).security)
  assert.throws(()=>authorizeBusinessRoute(noModule,{table:'obras',method:'GET'}),error=>error instanceof LanAuthorizationError&&error.status===403)
})
