import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import { LanSecurityRepository } from '../src/security-repository.mjs'
import { authenticateLanRequest, LanAuthorizationError } from '../src/authorization.mjs'

const digest = value => createHash('sha256').update(String(value)).digest('hex')
function snapshot(companyId, revision, memberId='admin') { return { companyId, revision, generatedAt:'2026-10-01T00:00:00.000Z', members:[{memberId,email:`${memberId}@example.com`,role:'admin',modules:['obra360','finance','rh'],channels:['desktop'],status:'active'}] } }
function claimed(companyId, token) { const db=new DatabaseSync(':memory:'); const security=new LanSecurityRepository({db,now:()=> '2026-10-01T00:00:00.000Z'}); security.initializeServer({serverId:`server-${companyId}`,setupCodeHash:'setup-hash'}); security.claimServerWithDevice({company:{id:companyId,name:companyId},cloudBaseUrl:'https://cloud.example',serverToken:`server-secret-${companyId}`,snapshot:snapshot(companyId,'rev-1'),device:{memberId:'admin',installationId:`install-${companyId}`,deviceName:'PC',tokenHash:digest(token)}}); return {db,security} }

test('token from server B is rejected by server A', async()=>{
  const a=claimed('company-a','token-a'), b=claimed('company-b','token-b')
  await assert.rejects(()=>authenticateLanRequest(new Request('http://a/api',{headers:{authorization:'Bearer token-b'}}),a.security), error=>error instanceof LanAuthorizationError&&error.status===401&&error.code==='invalid_device_token'&&!String(error.message).includes('token-b'))
  a.db.close();b.db.close()
})

test('claimed server rejects second company claim without mutation',()=>{
  const {db,security}=claimed('company-a','token-a')
  const before={state:security.serverState(),members:security.members(),devices:security.listDevices()}
  assert.throws(()=>security.claimServer({company:{id:'company-b',name:'B'},cloudBaseUrl:'https://cloud.example',serverToken:'secret-b',snapshot:snapshot('company-b','rev-b')}),/já foi vinculado/)
  assert.deepEqual({state:security.serverState(),members:security.members(),devices:security.listDevices()},before)
  db.close()
})

test('replaceSnapshot rejects another company atomically',()=>{
  const {db,security}=claimed('company-a','token-a')
  const before={state:security.serverState(),members:security.members()}
  assert.throws(()=>security.replaceSnapshot(snapshot('company-b','rev-b','other')),/outra empresa/)
  assert.deepEqual({state:security.serverState(),members:security.members()},before)
  db.close()
})
