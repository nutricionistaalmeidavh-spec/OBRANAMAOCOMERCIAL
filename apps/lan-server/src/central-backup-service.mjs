import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomBytes } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'

const REQUIRED_TABLES = [
  'empresas','clientes','obras','frentes_obra','cronograma_etapas','contas','funcionarios',
  'lan_server_identity','lan_members_cache','lan_devices','lan_pairing_codes','lan_audit','module_migrations','module_migration_records'
]

const sha256 = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const sqlLiteral = value => `'${String(value).replaceAll("'", "''")}'`
const safeBackupId = value => /^[A-Za-z0-9._-]+$/.test(String(value || ''))

function migrationFiles(migrationsDir, schemaVersion) {
  if (!migrationsDir || !fs.existsSync(migrationsDir)) return []
  return fs.readdirSync(migrationsDir)
    .map(name => ({ name, match:name.match(/^(\d+)_.*\.sql$/) }))
    .filter(item => item.match && Number(item.match[1]) <= Number(schemaVersion))
    .sort((a,b)=>Number(a.match[1])-Number(b.match[1]))
    .map(item=>item.name)
}

function publicManifest(manifest) {
  if (!manifest) return null
  return {
    backupId:manifest.backupId,
    createdAt:manifest.createdAt,
    fingerprint:manifest.fingerprint,
    schemaVersion:manifest.schemaVersion,
    serverId:manifest.serverId,
    companyId:manifest.companyId,
    serverVersion:manifest.serverVersion,
    sizeBytes:manifest.sizeBytes,
    reason:manifest.reason
  }
}

export class CentralBackupService {
  constructor({ repository, security, dataDir, migrationsDir, databasePath = null, serverVersion = '', expectedSchemaVersion = null, now = () => new Date() }) {
    if (!repository?.connection || !repository?.close) throw new Error('Repositório LAN inválido para backup central.')
    if (!security?.serverState) throw new Error('Repositório de segurança LAN inválido para backup central.')
    if (!dataDir) throw new Error('Diretório de dados LAN não informado.')
    this.repository=repository
    this.security=security
    this.dataDir=dataDir
    this.migrationsDir=migrationsDir
    this.databasePath=databasePath || path.join(dataDir,'obra-na-mao-lan.sqlite')
    this.serverVersion=String(serverVersion || '')
    this.expectedSchemaVersion=expectedSchemaVersion === null ? null : Number(expectedSchemaVersion)
    this.now=now
    this.maintenance=false
  }

  backupsRoot(){ return path.join(this.dataDir,'backups','central') }
  isMaintenanceActive(){ return this.maintenance }

  actorFields(actor){
    return { actorMemberId:actor?.member?.memberId || null, actorDeviceId:actor?.device?.id || null }
  }

  audit(action,{ actor=null,targetId=null,details={} }={}){
    try{this.security.appendAudit?.({ ...this.actorFields(actor), action, targetType:'central_storage', targetId, details })}catch{}
  }

  identity(){
    const state=this.security.serverState?.() || {}
    return { serverId:state.serverId || null, companyId:state.companyId || null, claimed:!!state.claimed }
  }

  captureLiveSecrets(){
    const db=this.repository.connection()
    const identity=db.prepare('SELECT server_token,setup_code_hash FROM lan_server_identity WHERE id=1').get() || {}
    const devices=db.prepare('SELECT * FROM lan_devices ORDER BY paired_at,id').all()
    return { serverToken:identity.server_token || null, setupCodeHash:identity.setup_code_hash || null, devices }
  }

  restoreLiveSecrets(secrets){
    const db=this.repository.connection()
    db.exec('BEGIN IMMEDIATE;')
    try{
      db.prepare('UPDATE lan_server_identity SET server_token=?,setup_code_hash=? WHERE id=1').run(secrets?.serverToken || null,secrets?.setupCodeHash || null)
      db.prepare('DELETE FROM lan_devices').run()
      const insert=db.prepare('INSERT INTO lan_devices(id,member_id,installation_id,device_name,token_hash,status,paired_at,last_seen_at,revoked_at) VALUES(?,?,?,?,?,?,?,?,?)')
      for(const row of secrets?.devices || []) insert.run(row.id,row.member_id,row.installation_id,row.device_name,row.token_hash,row.status,row.paired_at,row.last_seen_at,row.revoked_at)
      db.prepare('DELETE FROM lan_pairing_codes').run()
      db.exec('COMMIT;')
    }catch(error){try{db.exec('ROLLBACK;')}catch{};throw error}
  }

  sanitizeBackup(file){
    const db=new DatabaseSync(file)
    try{
      db.exec('PRAGMA secure_delete = ON;')
      db.exec('BEGIN IMMEDIATE;')
      try{
        db.prepare('UPDATE lan_server_identity SET server_token=NULL,setup_code_hash=NULL WHERE id=1').run()
        db.prepare('DELETE FROM lan_devices').run()
        db.prepare('DELETE FROM lan_pairing_codes').run()
        db.exec('COMMIT;')
      }catch(error){try{db.exec('ROLLBACK;')}catch{};throw error}
      db.exec('VACUUM;')
    }finally{db.close()}
  }

  inspectFile(file,{ enforceCurrentIdentity=false, requireSanitized=true }={}){
    if (!fs.existsSync(file)) throw new Error('Arquivo de backup central não encontrado.')
    let db
    try{
      db=new DatabaseSync(file,{readOnly:true})
      const integrityRows=db.prepare('PRAGMA integrity_check').all()
      const integrity=integrityRows.every(row=>String(row.integrity_check || '').toLowerCase()==='ok')?'ok':'failed'
      if(integrity!=='ok') throw new Error('PRAGMA integrity_check falhou no backup central.')
      const tables=new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row=>String(row.name)))
      const missing=REQUIRED_TABLES.filter(table=>!tables.has(table))
      if(missing.length) throw new Error(`Banco LAN incompleto: ${missing.join(', ')}.`)
      const schemaVersion=Number(db.prepare('PRAGMA user_version').get()?.user_version || 0)
      if(this.expectedSchemaVersion !== null && schemaVersion !== this.expectedSchemaVersion) throw new Error(`Schema LAN incompatível: esperado ${this.expectedSchemaVersion}, recebido ${schemaVersion}.`)
      const row=db.prepare('SELECT server_id,company_id,server_token,setup_code_hash FROM lan_server_identity WHERE id=1').get()
      if(!row?.server_id) throw new Error('Banco não possui identidade válida do Obra na Mão LAN Server.')
      if(requireSanitized){
        if(row.server_token || row.setup_code_hash) throw new Error('Backup central contém credencial de identidade que deveria ter sido sanitizada.')
        if(Number(db.prepare('SELECT COUNT(*) AS n FROM lan_devices').get()?.n || 0)!==0) throw new Error('Backup central contém credenciais de dispositivos.')
        if(Number(db.prepare('SELECT COUNT(*) AS n FROM lan_pairing_codes').get()?.n || 0)!==0) throw new Error('Backup central contém códigos de pareamento.')
      }
      const current=this.identity()
      if(enforceCurrentIdentity && current.claimed){
        if(String(row.server_id)!==String(current.serverId)) throw new Error('Backup pertence a outra instância de servidor.')
        if(String(row.company_id || '')!==String(current.companyId || '')) throw new Error('Backup pertence a outra empresa/tenant.')
      }
      return { integrity,schemaVersion,identity:{serverId:String(row.server_id),companyId:row.company_id?String(row.company_id):null},tables:[...tables] }
    }finally{try{db?.close()}catch{}}
  }

  createBackupId(){
    const stamp=this.now().toISOString().replace(/[:.]/g,'-')
    return `${stamp}-${randomBytes(4).toString('hex')}`
  }

  async create({ reason='manual', actor=null }={}){
    const backupId=this.createBackupId()
    const folder=path.join(this.backupsRoot(),backupId)
    fs.mkdirSync(folder,{recursive:true})
    const database=path.join(folder,'obra-na-mao-lan.sqlite')
    const manifestPath=path.join(folder,'manifest.json')
    try{
      this.repository.connection().exec(`VACUUM INTO ${sqlLiteral(database)};`)
      this.sanitizeBackup(database)
      const inspected=this.inspectFile(database)
      const identity=this.identity()
      const stat=fs.statSync(database)
      const manifest={
        product:'Obra na Mão LAN Server',backupId,createdAt:this.now().toISOString(),fingerprint:sha256(database),
        schemaVersion:inspected.schemaVersion,serverId:identity.serverId,companyId:identity.companyId,
        serverVersion:this.serverVersion || null,sizeBytes:stat.size,reason:String(reason || 'manual')
      }
      fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`,'utf8')
      this.audit('central_backup_validated',{actor,targetId:backupId,details:{schemaVersion:manifest.schemaVersion,sizeBytes:manifest.sizeBytes,reason:manifest.reason}})
      this.audit('central_backup_created',{actor,targetId:backupId,details:{fingerprint:manifest.fingerprint,schemaVersion:manifest.schemaVersion,sizeBytes:manifest.sizeBytes,reason:manifest.reason}})
      return { backupId,folder,database,manifest:manifestPath,...publicManifest(manifest) }
    }catch(error){
      this.audit('central_backup_validation_failed',{actor,targetId:backupId,details:{reason:String(reason || 'manual'),message:error instanceof Error?error.message:String(error)}})
      throw error
    }
  }

  readManifest(backupId){
    if(!safeBackupId(backupId)) throw new Error('Identificador de backup inválido.')
    const folder=path.join(this.backupsRoot(),String(backupId))
    const manifestPath=path.join(folder,'manifest.json')
    if(!fs.existsSync(manifestPath)) throw new Error('Manifest do backup central não encontrado.')
    const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'))
    if(String(manifest.backupId)!==String(backupId)) throw new Error('Manifest pertence a outro backup.')
    return {folder,manifestPath,database:path.join(folder,'obra-na-mao-lan.sqlite'),manifest}
  }

  verifyManagedBackup(backupId,{ enforceCurrentIdentity=false, actor=null }={}){
    try{
      const item=this.readManifest(backupId)
      const fingerprint=sha256(item.database)
      const sizeBytes=fs.statSync(item.database).size
      if(fingerprint!==String(item.manifest.fingerprint || '')) throw new Error('Fingerprint SHA-256 do backup central não confere.')
      if(Number(item.manifest.sizeBytes)!==sizeBytes) throw new Error('Tamanho do backup central diverge do manifest.')
      const inspected=this.inspectFile(item.database,{enforceCurrentIdentity,requireSanitized:true})
      if(Number(item.manifest.schemaVersion)!==inspected.schemaVersion) throw new Error('Versão de schema diverge do manifest.')
      if(String(item.manifest.serverId || '')!==String(inspected.identity.serverId || '')) throw new Error('Identidade do servidor diverge do manifest.')
      if(String(item.manifest.companyId || '')!==String(inspected.identity.companyId || '')) throw new Error('Tenant do banco diverge do manifest.')
      this.audit('central_backup_validated',{actor,targetId:String(backupId),details:{schemaVersion:inspected.schemaVersion,sizeBytes}})
      return {...inspected,fingerprint,sizeBytes,manifest:publicManifest(item.manifest),database:item.database,folder:item.folder}
    }catch(error){
      this.audit('central_backup_validation_failed',{actor,targetId:String(backupId || ''),details:{message:error instanceof Error?error.message:String(error)}})
      throw error
    }
  }

  reopenRepository(){
    const FreshRepository=this.repository.constructor
    const fresh=new FreshRepository({filename:this.databasePath})
    this.repository.db=fresh.connection()
    this.security.db=this.repository.connection()
    return this.repository.connection()
  }

  replaceDatabaseFrom(source){
    const temp=`${this.databasePath}.restore-${randomBytes(4).toString('hex')}.tmp`
    fs.copyFileSync(source,temp)
    fs.rmSync(this.databasePath,{force:true})
    fs.rmSync(`${this.databasePath}-wal`,{force:true})
    fs.rmSync(`${this.databasePath}-shm`,{force:true})
    fs.renameSync(temp,this.databasePath)
  }

  async restoreManaged(backupId,{actor=null}={}){
    const candidate=this.verifyManagedBackup(backupId,{enforceCurrentIdentity:true,actor})
    const liveIdentity=this.identity()
    if(!liveIdentity.claimed) throw new Error('Restore central gerenciado exige uma instância já reivindicada; bootstrap entre instâncias não faz parte deste fluxo seguro.')
    const secrets=this.captureLiveSecrets()
    this.audit('central_restore_started',{actor,targetId:String(backupId),details:{schemaVersion:candidate.schemaVersion}})
    const safety=await this.create({reason:'before-restore',actor})

    this.maintenance=true
    let replaced=false
    try{
      this.repository.close()
      this.replaceDatabaseFrom(candidate.database)
      replaced=true
      this.reopenRepository()
      this.restoreLiveSecrets(secrets)
      const final=this.inspectFile(this.databasePath,{enforceCurrentIdentity:true,requireSanitized:false})
      if(final.integrity!=='ok') throw new Error('Banco restaurado falhou na verificação final.')
      this.audit('central_restore_completed',{actor,targetId:String(backupId),details:{safetyBackupId:safety.backupId,schemaVersion:final.schemaVersion}})
      return {restored:true,backupId:String(backupId),safetyBackupId:safety.backupId,schemaVersion:final.schemaVersion}
    }catch(error){
      if(replaced){
        try{
          try{this.repository.close()}catch{}
          this.replaceDatabaseFrom(safety.database)
          this.reopenRepository()
          this.restoreLiveSecrets(secrets)
          this.inspectFile(this.databasePath,{enforceCurrentIdentity:true,requireSanitized:false})
          this.audit('central_restore_recovered',{actor,targetId:String(backupId),details:{safetyBackupId:safety.backupId,originalError:error instanceof Error?error.message:String(error)}})
          throw new Error(`Restore central falhou; o banco anterior foi recuperado automaticamente. ${error instanceof Error?error.message:String(error)}`)
        }catch(recoveryError){
          if(String(recoveryError?.message || '').startsWith('Restore central falhou;')) throw recoveryError
          throw new Error(`Restore central falhou e a recuperação automática também falhou: ${error instanceof Error?error.message:String(error)}; recuperação: ${recoveryError instanceof Error?recoveryError.message:String(recoveryError)}`)
        }
      }
      throw error
    }finally{
      this.maintenance=false
    }
  }

  latestBackup(){
    if(!fs.existsSync(this.backupsRoot())) return null
    const manifests=[]
    for(const entry of fs.readdirSync(this.backupsRoot(),{withFileTypes:true})){
      if(!entry.isDirectory()) continue
      try{manifests.push(this.readManifest(entry.name).manifest)}catch{}
    }
    manifests.sort((a,b)=>String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    return publicManifest(manifests[0] || null)
  }

  health(){
    try{
      const db=this.repository.connection()
      const rows=db.prepare('PRAGMA integrity_check').all()
      const integrity=rows.every(row=>String(row.integrity_check || '').toLowerCase()==='ok')?'ok':'failed'
      const schemaVersion=Number(db.prepare('PRAGMA user_version').get()?.user_version || 0)
      const identity=this.identity()
      return {
        accessible:true,integrity,schemaVersion,migrationsApplied:migrationFiles(this.migrationsDir,schemaVersion),
        claimed:identity.claimed,serverId:identity.serverId,companyId:identity.companyId,
        sizeBytes:fs.existsSync(this.databasePath)?fs.statSync(this.databasePath).size:null,
        lastBackup:this.latestBackup(),maintenance:this.maintenance
      }
    }catch(error){
      const identity=this.identity()
      return {accessible:false,integrity:'unknown',schemaVersion:null,migrationsApplied:[],claimed:identity.claimed,serverId:identity.serverId,companyId:identity.companyId,sizeBytes:null,lastBackup:this.latestBackup(),maintenance:this.maintenance,error:error instanceof Error?error.message:String(error)}
    }
  }
}

export { REQUIRED_TABLES }
