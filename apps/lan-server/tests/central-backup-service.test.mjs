import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { LanRepository } from '../src/repository.mjs'
import { LanSecurityRepository } from '../src/security-repository.mjs'
import { CentralBackupService } from '../src/central-backup-service.mjs'

const migrationsDir = path.resolve(import.meta.dirname, '../migrations')
const fixtures = []
const sha256 = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex')

function fixture({ serverId='server-a', companyId='company-a' }={}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'obra-lan-backup-'))
  const databasePath = path.join(dataDir, 'obra-na-mao-lan.sqlite')
  const repository = new LanRepository({ filename: databasePath })
  const migrationState = repository.applyMigrations(migrationsDir)
  const security = new LanSecurityRepository({ db: repository.connection(), now: ()=>'2026-10-01T12:00:00.000Z' })
  security.initializeServer({ serverId, setupCodeHash:'setup-code-hash-secret' })
  security.claimServer({
    company:{ id:companyId, name:`Empresa ${companyId}` },
    cloudBaseUrl:'https://example.invalid',
    serverToken:'server-token-secret',
    snapshot:{ companyId, revision:'r1', generatedAt:'2026-10-01T12:00:00.000Z', members:[] }
  })
  security.createDevice({ memberId:'admin-1', installationId:'pc-1', deviceName:'PC 1', tokenHash:'device-token-hash-secret' })
  security.createPairingCode({ memberId:'admin-1', codeHash:'pairing-code-hash-secret', expiresAt:'2026-10-01T12:10:00.000Z', createdByDeviceId:'device-1' })
  const service = new CentralBackupService({
    repository, security, dataDir, migrationsDir,
    serverVersion:'0.3.0', expectedSchemaVersion:migrationState.version,
    now:()=>new Date('2026-10-01T12:00:00.000Z')
  })
  const value={ dataDir,databasePath,repository,security,service,migrationState }
  fixtures.push(value)
  return value
}

test.afterEach(()=>{
  while(fixtures.length){
    const f=fixtures.pop()
    try{f.repository.close()}catch{}
    fs.rmSync(f.dataDir,{recursive:true,force:true})
  }
})

test('backup central é consistente, verificável e não contém credenciais', async()=>{
  const f=fixture()
  f.repository.save('empresas',{razao_social:'Empresa operacional'})
  const backup=await f.service.create({reason:'manual'})
  const manifest=JSON.parse(fs.readFileSync(backup.manifest,'utf8'))

  assert.equal(manifest.product,'Obra na Mão LAN Server')
  assert.equal(manifest.serverId,'server-a')
  assert.equal(manifest.companyId,'company-a')
  assert.equal(manifest.schemaVersion,f.migrationState.version)
  assert.equal(manifest.fingerprint,sha256(backup.database))
  assert.equal(manifest.sizeBytes,fs.statSync(backup.database).size)
  assert.equal(manifest.reason,'manual')

  const bytes=fs.readFileSync(backup.database)
  for(const secret of ['server-token-secret','device-token-hash-secret','pairing-code-hash-secret','setup-code-hash-secret']) {
    assert.equal(bytes.includes(Buffer.from(secret)),false,`backup vazou ${secret}`)
    assert.equal(JSON.stringify(manifest).includes(secret),false)
  }

  const inspected=f.service.verifyManagedBackup(backup.backupId)
  assert.equal(inspected.integrity,'ok')
  assert.equal(inspected.schemaVersion,f.migrationState.version)
  assert.equal(inspected.identity.serverId,'server-a')
  assert.equal(inspected.identity.companyId,'company-a')
})

test('restore recupera dados do backup e preserva credenciais vivas da mesma instância', async()=>{
  const f=fixture()
  const company=f.repository.save('empresas',{razao_social:'Antes'})
  const backup=await f.service.create({reason:'manual'})
  f.repository.save('empresas',{id:company.id,razao_social:'Depois'})

  const result=await f.service.restoreManaged(backup.backupId)
  assert.equal(result.restored,true)
  assert.equal(f.repository.get('empresas',company.id).razao_social,'Antes')
  assert.equal(f.security.serverState().serverToken,'server-token-secret')
  assert.ok(f.security.deviceByTokenHash('device-token-hash-secret'))
  assert.equal(f.service.health().integrity,'ok')
  const audit=f.repository.connection().prepare("SELECT action FROM lan_audit WHERE action='central_restore_completed' ORDER BY id DESC LIMIT 1").get()
  assert.equal(audit.action,'central_restore_completed')
})

test('backup de outra instância/tenant é rejeitado antes de substituir banco reivindicado', async()=>{
  const a=fixture({serverId:'server-a',companyId:'company-a'})
  a.repository.save('empresas',{razao_social:'Tenant A'})
  const foreign=await a.service.create({reason:'manual'})

  const b=fixture({serverId:'server-b',companyId:'company-b'})
  b.repository.save('empresas',{razao_social:'Tenant B'})
  const target=path.join(b.service.backupsRoot(),foreign.backupId)
  fs.mkdirSync(path.dirname(target),{recursive:true})
  fs.cpSync(foreign.folder,target,{recursive:true})

  await assert.rejects(()=>b.service.restoreManaged(foreign.backupId),/instância|servidor|empresa|tenant/i)
  assert.equal(b.repository.list('empresas')[0].razao_social,'Tenant B')
  assert.equal(b.security.serverState().companyId,'company-b')
})

test('falha após troca restaura automaticamente safety backup e reabre instância anterior', async()=>{
  const f=fixture()
  const company=f.repository.save('empresas',{razao_social:'Versão backup'})
  const old=await f.service.create({reason:'manual'})
  f.repository.save('empresas',{id:company.id,razao_social:'Versão viva'})

  const reopen=f.service.reopenRepository.bind(f.service)
  let failOnce=true
  f.service.reopenRepository=()=>{if(failOnce){failOnce=false;throw new Error('falha simulada ao reabrir')}return reopen()}

  await assert.rejects(()=>f.service.restoreManaged(old.backupId),/recuperado|reabrir|restore/i)
  assert.equal(f.repository.get('empresas',company.id).razao_social,'Versão viva')
  assert.equal(f.security.serverState().serverToken,'server-token-secret')
  const audit=f.repository.connection().prepare("SELECT action FROM lan_audit WHERE action='central_restore_recovered' ORDER BY id DESC LIMIT 1").get()
  assert.equal(audit.action,'central_restore_recovered')
})

test('health operacional não expõe filesystem nem segredos', async()=>{
  const f=fixture()
  await f.service.create({reason:'maintenance'})
  const health=f.service.health()
  assert.equal(health.accessible,true)
  assert.equal(health.integrity,'ok')
  assert.equal(health.schemaVersion,f.migrationState.version)
  assert.equal(health.claimed,true)
  assert.equal(health.serverId,'server-a')
  assert.equal(health.companyId,'company-a')
  assert.ok(Array.isArray(health.migrationsApplied))
  assert.ok(health.lastBackup?.backupId)
  const serialized=JSON.stringify(health)
  assert.equal(serialized.includes(f.dataDir),false)
  assert.equal(serialized.includes('server-token-secret'),false)
  assert.equal(serialized.includes('device-token-hash-secret'),false)
})