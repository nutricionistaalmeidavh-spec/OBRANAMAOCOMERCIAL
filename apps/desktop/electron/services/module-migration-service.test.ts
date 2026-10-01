import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { ModuleMigrationService } = require('./module-migration-service.cjs')

function fixture({mode='lan-host', moduleState='migration-required', capabilities=['core'], existingAttempt=null as any}={}) {
  const config = new Map<string,string>()
  if (existingAttempt) config.set('module_migration_attempt_core', JSON.stringify(existingAttempt))
  const rows:any = { empresas:[{id:1,razao_social:'A'}], clientes:[], obras:[] }
  const database:any = {
    list(table:string){ return [...(rows[table]||[])] },
    db:{ prepare(sql:string){
      return {
        get(key:string){ return sql.startsWith('SELECT valor') ? (config.has(key)?{valor:config.get(key)}:undefined) : undefined },
        run(key:string,value?:string){
          if (sql.startsWith('INSERT INTO configuracoes')) config.set(key,String(value))
          else if (sql.startsWith('DELETE FROM configuracoes')) config.delete(key)
        }
      }
    }}
  }
  const calls:any[]=[]
  const lanClient:any={
    syncSourceCapabilities:async()=>({modules:capabilities}),
    migrationStart:async(input:any)=>{calls.push(['start',input]);return {status:'started',...input}},
    migrationRecord:async(id:string,record:any)=>{calls.push(['record',id,record]);return {targetId:record.sourceId,reused:false}},
    migrationValidate:async(id:string)=>{calls.push(['validate',id]);return {status:'validated'}},
    migrationCommit:async(id:string)=>{calls.push(['commit',id]);return {status:'committed'}},
    migrationRollback:async(id:string)=>{calls.push(['rollback',id]);return {status:'rolled_back'}}
  }
  const backup:any={createSafetySnapshot:async(context:any)=>{calls.push(['backup',context]);return {database:'/backup.sqlite',fingerprint:'backup-hash'}}}
  const moduleStorage:any={state:(module:string)=>({state:module==='core'?moduleState:'central-active'}),activateAfterMigration:(module:string)=>{calls.push(['activate',module]);return {state:'central-active'}}}
  const storage:any={state:()=>({operationalMode:mode,mode:mode==='local'?'local':'server'})}
  return {service:new ModuleMigrationService({database,storage,moduleStorage,lanClient,backup,uuid:()=> 'mig-1',sourceId:()=> 'source-1'}),calls,config,lanClient,moduleStorage}
}

describe('ModuleMigrationService',()=>{
  it('rejeita modo local, capability ausente e módulo sem migration-required',async()=>{
    await expect(fixture({mode:'local'}).service.preflight('core')).rejects.toThrow(/LAN|servidor/i)
    await expect(fixture({capabilities:[]}).service.preflight('core')).rejects.toThrow(/capability|suporta/i)
    await expect(fixture({moduleState:'central-ready'}).service.preflight('core')).rejects.toThrow(/migra/i)
  })

  it('faz backup antes da primeira escrita remota e ativa somente após commit',async()=>{
    const f=fixture()
    const result=await f.service.migrate('core')
    expect(result.status).toBe('committed')
    expect(f.calls.map(x=>x[0])).toEqual(['backup','start','record','validate','commit','activate'])
    expect(f.config.has('module_migration_attempt_core')).toBe(false)
  })

  it('falha remota faz rollback sem ativar o módulo',async()=>{
    const f=fixture()
    f.lanClient.migrationRecord=async(id:string,record:any)=>{f.calls.push(['record',id,record]);throw new Error('network down')}
    await expect(f.service.migrate('core')).rejects.toThrow(/network down/)
    expect(f.calls.map(x=>x[0])).toEqual(['backup','start','record','rollback'])
    expect(f.calls.some(x=>x[0]==='activate')).toBe(false)
    expect(f.config.has('module_migration_attempt_core')).toBe(false)
  })

  it('preserva migrationId quando rollback falha para permitir retry idempotente',async()=>{
    const f=fixture()
    let first=true
    f.lanClient.migrationRecord=async(id:string,record:any)=>{f.calls.push(['record',id,record]);if(first){first=false;throw new Error('timeout')}return {targetId:1,reused:true}}
    f.lanClient.migrationRollback=async(id:string)=>{f.calls.push(['rollback',id]);throw new Error('offline')}
    await expect(f.service.migrate('core')).rejects.toThrow(/timeout/)
    expect(JSON.parse(f.config.get('module_migration_attempt_core')!).migrationId).toBe('mig-1')
    f.calls.length=0
    await f.service.migrate('core')
    expect(f.calls.find(x=>x[0]==='start')[1].migrationId).toBe('mig-1')
  })
})
