import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { LanRepository } from '../src/repository.mjs'
import { LanSecurityRepository } from '../src/security-repository.mjs'
import { RuntimeBackupService } from '../src/runtime-backup-service.mjs'

const migrationsDir=path.resolve(import.meta.dirname,'../migrations')
const fixtures=[]
function fixture(){
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'obra-f27-storage-'))
  const repository=new LanRepository({filename:path.join(dataDir,'obra-na-mao-lan.sqlite')})
  const migration=repository.applyMigrations(migrationsDir)
  const security=new LanSecurityRepository({db:repository.connection(),now:()=> '2026-10-01T12:00:00.000Z'})
  security.initializeServer({serverId:'srv-a',setupCodeHash:'setup'})
  security.claimServer({company:{id:'company-a',name:'Empresa'},cloudBaseUrl:'https://example.test',serverToken:'server-secret',snapshot:{companyId:'company-a',revision:'r1',generatedAt:'2026-10-01T12:00:00.000Z',members:[]}})
  const service=new RuntimeBackupService({repository,security,dataDir,backupDir:path.join(dataDir,'backups'),migrationsDir,databasePath:path.join(dataDir,'obra-na-mao-lan.sqlite'),expectedSchemaVersion:migration.version,serverVersion:'0.3.0'})
  fixtures.push({dataDir,repository})
  return{service,repository}
}
test.afterEach(()=>{while(fixtures.length){const f=fixtures.pop();try{f.repository.close()}catch{};fs.rmSync(f.dataDir,{recursive:true,force:true})}})

test('managed backups can be listed, restore-tested and pruned without exposing paths',async()=>{
  const {service}=fixture()
  const a=await service.create({reason:'scheduled'})
  await new Promise(r=>setTimeout(r,5))
  const b=await service.create({reason:'manual'})
  const list=service.listManagedBackups()
  assert.equal(list.length,2)
  assert.equal(list[0].backupId,b.backupId)
  assert.equal(Object.hasOwn(list[0],'database'),false)
  assert.equal(Object.hasOwn(list[0],'folder'),false)

  const tested=service.testRestoreManaged(b.backupId)
  assert.equal(tested.restorable,true)
  assert.equal(tested.integrity,'ok')
  assert.equal(Object.hasOwn(tested,'database'),false)

  const pruned=service.pruneManaged(1)
  assert.equal(pruned.retained,1)
  assert.deepEqual(pruned.removed,[a.backupId])
  assert.deepEqual(service.listManagedBackups().map(x=>x.backupId),[b.backupId])
})
