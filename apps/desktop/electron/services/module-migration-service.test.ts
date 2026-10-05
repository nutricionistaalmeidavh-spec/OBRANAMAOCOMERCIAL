import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const { ModuleMigrationService } = require('./module-migration-service.cjs')

function fixture({mode='lan-host', module='core', moduleState='migration-required', coreState='central-active', capabilities=['core','operation','planning','finance','rh'], rows=null as any}={}) {
  const config = new Map<string,string>()
  const data:any = rows || { empresas:[{id:1,razao_social:'A'}], clientes:[], obras:[] }
  const database:any = {
    list(table:string){ return [...(data[table]||[])].map((row:any)=>({...row})) },
    db:{ prepare(sql:string){
      return {
        get(key:string){ return sql.startsWith('SELECT valor') ? (config.has(key)?{valor:config.get(key)}:undefined) : undefined },
        run(key:string,value?:string){
          if (sql.startsWith('INSERT INTO configuracoes')) config.set(key,String(value))
          else if (sql.startsWith('DELETE FROM configuracoes')) config.delete(key)
          return {changes:1}
        }
      }
    }}
  }
  const calls:any[]=[]
  const expectedCounts=()=>Object.fromEntries(Object.entries(data).map(([table,items]:any)=>[table,items.length]))
  const lanClient:any={
    syncSourceCapabilities:vi.fn(async()=>({modules:capabilities,moduleContractVersions:{core:2,operation:2,planning:2,finance:2,rh:2,documents:1}})),
    migrationStart:vi.fn(async(input:any)=>{calls.push(['start',input]);return {status:'started',...input}}),
    migrationRecord:vi.fn(async(id:string,record:any)=>{calls.push(['record',id,record]);return {targetId:record.sourceId,reused:false}}),
    migrationValidate:vi.fn(async(id:string)=>{calls.push(['validate',id]);return {status:'validated',sanityOk:true}}),
    migrationCommit:vi.fn(async(id:string)=>{calls.push(['commit',id]);return {status:'committed',sanityOk:true}}),
    migrationStatus:vi.fn(async(id:string)=>{calls.push(['status',id]);return {migrationId:id,status:'committed',sanityOk:true,counts:expectedCounts(),targetCounts:expectedCounts(),missingTargets:[]}}),
    migrationRollback:vi.fn(async(id:string)=>{calls.push(['rollback',id]);return {status:'rolled_back'}})
  }
  const backup:any={createSafetySnapshot:vi.fn(async(context:any)=>{calls.push(['backup',context]);return {database:'/backup.sqlite',manifest:'/manifest.json',fingerprint:`backup-${calls.filter(x=>x[0]==='backup').length}`}})}
  const moduleStorage:any={
    state:vi.fn((name:string)=>({state:name==='core'?(module==='core'?moduleState:coreState):(name===module?moduleState:'central-active')})),
    dependencyBlockedBy:vi.fn(()=>null),
    activateAfterMigration:vi.fn((name:string)=>{calls.push(['activate',name]);return {state:'central-active'}})
  }
  const storage:any={state:()=>({operationalMode:mode,mode:mode==='local'?'local':'server'})}
  return {service:new ModuleMigrationService({database,storage,moduleStorage,lanClient,backup,appVersion:'1.0.0',uuid:()=> 'mig-1',sourceId:()=> 'source-1'}),calls,config,lanClient,moduleStorage,data,backup}
}

describe('ModuleMigrationService',()=>{
  it('remote usa o mesmo protocolo de migração central sem motor paralelo',async()=>{
    const remote=fixture({mode:'remote'})
    await expect(remote.service.preflight('core')).resolves.toMatchObject({canMigrate:true,capability:true})
  })

  it('preflight informa bloqueios sem iniciar escrita remota',async()=>{
    const local=fixture({mode:'local'})
    await expect(local.service.preflight('core')).resolves.toMatchObject({canMigrate:false,reason:'storage_not_central'})
    expect(local.lanClient.syncSourceCapabilities).not.toHaveBeenCalled()

    await expect(fixture({capabilities:[]}).service.preflight('core')).resolves.toMatchObject({canMigrate:false,reason:'capability_missing'})
    await expect(fixture({moduleState:'central-ready'}).service.preflight('core')).resolves.toMatchObject({canMigrate:false,reason:'migration_not_required'})
    const dependency=fixture({module:'operation',coreState:'migration-required',rows:{frentes_obra:[{id:1,obra_id:1,nome:'F'}]}})
    dependency.moduleStorage.dependencyBlockedBy.mockReturnValue('core')
    await expect(dependency.service.preflight('operation')).resolves.toMatchObject({canMigrate:false,reason:'core_dependency',dependencies:{core:'migration-required',blockedBy:'core'}})
  })

  it('faz backup antes da primeira escrita remota e ativa somente após commit + leitura de sanidade central',async()=>{
    const f=fixture({rows:{empresas:[{id:2,razao_social:'B'},{id:1,razao_social:'A'}],clientes:[{id:4,empresa_id:1,nome:'C'}],obras:[]}})
    const result=await f.service.migrate('core')
    expect(result).toMatchObject({status:'committed',sanityOk:true})
    expect(f.calls.map(x=>x[0])).toEqual(['backup','start','record','record','record','validate','commit','status','activate'])
    expect(f.calls.filter(x=>x[0]==='record').map(x=>`${x[2].sourceTable}:${x[2].sourceId}`)).toEqual(['empresas:1','empresas:2','clientes:4'])
    expect(f.config.has('module_migration_attempt_core')).toBe(false)
  })

  it('não ativa quando o servidor commitou mas a leitura de sanidade central falha',async()=>{
    const f=fixture()
    f.lanClient.migrationStatus.mockResolvedValueOnce({migrationId:'mig-1',status:'committed',sanityOk:false,missingTargets:[{table:'empresas',targetId:99}]})
    await expect(f.service.migrate('core')).rejects.toThrow(/sanidade|central/i)
    expect(f.moduleStorage.activateAfterMigration).not.toHaveBeenCalled()
    expect(f.config.has('module_migration_attempt_core')).toBe(true)
    expect(JSON.parse(f.config.get('module_migration_attempt_core')!).status).toBe('failed')
    expect(f.data.empresas).toEqual([{id:1,razao_social:'A'}])
  })

  it('retry de migrationId já commitado relê sanidade antes de ativar',async()=>{
    const f=fixture()
    f.lanClient.migrationStart.mockResolvedValueOnce({migrationId:'mig-1',status:'committed'})
    const result=await f.service.migrate('core')
    expect(result).toMatchObject({status:'committed',sanityOk:true})
    expect(f.calls.map(x=>x[0])).toEqual(['backup','status','activate'])
    expect(f.lanClient.migrationRecord).not.toHaveBeenCalled()
  })

  it('falha após gravação remota antes do ACK preserva lote; retry reutiliza migrationId e o mesmo registro',async()=>{
    const f=fixture()
    let first=true
    f.lanClient.migrationRecord.mockImplementation(async(id:string,record:any)=>{
      f.calls.push(['record',id,record])
      if(first){first=false;throw new Error('ACK perdido após gravação')}
      return {targetId:record.sourceId,reused:true}
    })
    await expect(f.service.migrate('core')).rejects.toThrow(/ACK perdido/)
    expect(f.lanClient.migrationRollback).not.toHaveBeenCalled()
    const pending=JSON.parse(f.config.get('module_migration_attempt_core')!)
    expect(pending).toMatchObject({migrationId:'mig-1',sourceFingerprint:'source-1',status:'failed'})
    expect(f.data.empresas).toEqual([{id:1,razao_social:'A'}])

    f.calls.length=0
    await expect(f.service.migrate('core')).resolves.toMatchObject({migrationId:'mig-1',status:'committed',sanityOk:true})
    expect(f.calls.find(x=>x[0]==='start')[1].migrationId).toBe('mig-1')
    expect(f.calls.find(x=>x[0]==='record')[2].sourceId).toBe(1)
  })

  it('recusa retry quando os dados do módulo mudaram desde a tentativa',async()=>{
    const f=fixture()
    f.lanClient.migrationRecord.mockRejectedValueOnce(new Error('timeout'))
    await expect(f.service.migrate('core')).rejects.toThrow(/timeout/)
    f.data.empresas[0].razao_social='Alterada depois da falha'
    const starts=f.lanClient.migrationStart.mock.calls.length
    await expect(f.service.migrate('core')).rejects.toThrow(/dados locais|origem.*mudou|rollback/i)
    expect(f.lanClient.migrationStart.mock.calls.length).toBe(starts)
  })

  it('rollback é explícito e só então limpa a tentativa local',async()=>{
    const f=fixture()
    f.lanClient.migrationRecord.mockRejectedValueOnce(new Error('offline'))
    await expect(f.service.migrate('core')).rejects.toThrow(/offline/)
    expect(f.config.has('module_migration_attempt_core')).toBe(true)
    await expect(f.service.rollback('core')).resolves.toMatchObject({status:'rolled_back'})
    expect(f.lanClient.migrationRollback).toHaveBeenCalledWith('mig-1')
    expect(f.config.has('module_migration_attempt_core')).toBe(false)
    expect(f.data.empresas).toEqual([{id:1,razao_social:'A'}])
  })

  it('mantém sourceFingerprint estável entre módulos e separado do hash do conteúdo',()=>{
    const f=fixture()
    const first=f.service.sourceFingerprint()
    f.data.empresas[0].razao_social='mudou'
    const second=f.service.sourceFingerprint()
    expect(first).toBe('source-1')
    expect(second).toBe(first)
    expect(f.config.get('migration_source_fingerprint')).toBe('source-1')
    expect(f.service.sourceDataHash('core')).not.toBe(f.service.sourceDataHash('operation'))
  })
})
