import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import test from 'node:test'
import { createLanServer } from '../src/server.mjs'

const digest=value=>createHash('sha256').update(String(value)).digest('hex')

function security(role='admin'){
  return {
    serverState:()=>({claimed:true,companyId:'company-a'}),
    deviceByTokenHash:hash=>hash===digest('admin-token')?{id:'device-a',memberId:'member-a',status:'active'}:null,
    member:id=>id==='member-a'?{memberId:id,role,status:'active',channels:['desktop'],modules:['obra360','finance','rh']}:null,
    touchDevice:()=>{}
  }
}

async function withServer({role='admin',maintenance=false}={},work){
  const calls=[]
  const centralBackupService={
    isMaintenanceActive:()=>maintenance,
    health:()=>({accessible:true,integrity:'ok',schemaVersion:6,claimed:true,serverId:'server-a',companyId:'company-a',sizeBytes:123,lastBackup:null,maintenance}),
    create:async input=>{calls.push(['backup',input]);return {backupId:'b1',createdAt:'2026-10-01T12:00:00.000Z',fingerprint:'abc',schemaVersion:6,serverId:'server-a',companyId:'company-a',serverVersion:'0.3.0',sizeBytes:123,reason:input.reason}},
    verifyManagedBackup:(id,input)=>{calls.push(['verify',id,input]);return {integrity:'ok',schemaVersion:6,fingerprint:'abc',sizeBytes:123,manifest:{backupId:id,serverId:'server-a',companyId:'company-a'}}},
    restoreManaged:async(id,input)=>{calls.push(['restore',id,input]);return {restored:true,backupId:id,safetyBackupId:'safety-1',schemaVersion:6}}
  }
  const server=createLanServer({security:security(role),centralBackupService})
  server.listen(0,'127.0.0.1');await once(server,'listening')
  const address=server.address();const base=`http://127.0.0.1:${address.port}`
  try{return await work({base,calls})}finally{server.close();await once(server,'close')}
}

const auth={'authorization':'Bearer admin-token','content-type':'application/json'}
const post=(base,path,body={})=>fetch(base+path,{method:'POST',headers:auth,body:JSON.stringify(body)})

test('Admin autenticado consulta health e cria/verifica/restaura backup gerenciado sem paths',async()=>withServer({},async({base,calls})=>{
  let response=await fetch(base+'/api/v1/admin/storage/health',{headers:{authorization:'Bearer admin-token'}})
  assert.equal(response.status,200)
  const health=await response.json();assert.equal(health.integrity,'ok');assert.equal('databasePath' in health,false)

  response=await post(base,'/api/v1/admin/storage/backup',{reason:'maintenance'})
  assert.equal(response.status,201)
  const created=await response.json();assert.equal(created.backupId,'b1');assert.equal('folder' in created,false);assert.equal('database' in created,false);assert.equal('manifest' in created,false)

  response=await post(base,'/api/v1/admin/storage/verify',{backupId:'b1'})
  assert.equal(response.status,200)
  const verified=await response.json();assert.equal(verified.integrity,'ok');assert.equal('database' in verified,false);assert.equal('folder' in verified,false)

  response=await post(base,'/api/v1/admin/storage/restore',{backupId:'b1'})
  assert.equal(response.status,200)
  assert.equal((await response.json()).restored,true)
  assert.deepEqual(calls.map(item=>item[0]),['backup','verify','restore'])
}))

test('operações de storage central exigem Admin atual, sem nova ACL granular',async()=>withServer({role:'foreman'},async({base})=>{
  const health=await fetch(base+'/api/v1/admin/storage/health',{headers:{authorization:'Bearer admin-token'}})
  assert.equal(health.status,403)
  assert.equal((await health.json()).error,'admin_required')
  const backup=await post(base,'/api/v1/admin/storage/backup',{reason:'manual'})
  assert.equal(backup.status,403)
}))

test('maintenance lock bloqueia operações normais mas mantém health HTTP básico e diagnóstico admin',async()=>withServer({maintenance:true},async({base})=>{
  let response=await fetch(base+'/health')
  assert.equal(response.status,200)
  response=await fetch(base+'/api/v1/admin/storage/health',{headers:{authorization:'Bearer admin-token'}})
  assert.equal(response.status,200)
  assert.equal((await response.json()).maintenance,true)
  response=await fetch(base+'/api/v1/sync-source/capabilities',{headers:{authorization:'Bearer admin-token'}})
  assert.equal(response.status,503)
  assert.equal((await response.json()).error,'storage_maintenance')
}))
