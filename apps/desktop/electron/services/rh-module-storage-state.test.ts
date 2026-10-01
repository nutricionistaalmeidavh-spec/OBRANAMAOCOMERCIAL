import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { afterEach, describe, expect, it, vi } from 'vitest'

const require=createRequire(import.meta.url)
const { DatabaseService }=require('./database.cjs')
const { ModuleStorageStateService }=require('./module-storage-state-service.cjs')
const fixtures:any[]=[]

function fixture({operationalMode='lan-host',modules=['core','operation','planning','finance','rh']}={}){
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'rh-module-state-'))
  const database=new DatabaseService({dataDir,migrationsDir:path.resolve(import.meta.dirname,'../../database/migrations')})
  database.open()
  const storage={state:vi.fn(()=>({operationalMode,mode:operationalMode==='local'?'local':'server'}))}
  const lanClient={syncSourceCapabilities:vi.fn(async()=>({version:1,modules,bridgeEntities:['frentes_obra','tarefas_obra','rdos','cronograma_etapas']}))}
  const service=new ModuleStorageStateService({database,storage,lanClient})
  const value={dataDir,database,storage,lanClient,service};fixtures.push(value);return value
}

afterEach(()=>{for(const f of fixtures.splice(0)){f.database.close();fs.rmSync(f.dataDir,{recursive:true,force:true})}})

describe('RH module storage state',()=>{
  it('mantém RH local no modo local sem consultar capabilities',async()=>{
    const f=fixture({operationalMode:'local'})
    expect(f.service.state('rh')).toEqual(expect.objectContaining({module:'rh',state:'local'}))
    const refreshed=await f.service.refreshCapabilities()
    expect(refreshed.rh.state).toBe('local')
    expect(f.lanClient.syncSourceCapabilities).not.toHaveBeenCalled()
  })

  it('instalação nova ativa RH somente quando capability rh está disponível',async()=>{
    const f=fixture()
    expect(f.service.state('rh')).toEqual(expect.objectContaining({state:'central-ready',localRecords:0}))
    const refreshed=await f.service.refreshCapabilities()
    expect(refreshed.rh).toEqual(expect.objectContaining({state:'central-active',capabilityAvailable:true,localRecords:0}))
    expect(f.service.state('rh').state).toBe('central-active')
  })

  it('sem capability rh permanece central-ready e nunca cai para local',async()=>{
    const f=fixture({modules:['core','operation','planning','finance']})
    const refreshed=await f.service.refreshCapabilities()
    expect(refreshed.rh).toEqual(expect.objectContaining({state:'central-ready',capabilityAvailable:false}))
    expect(f.service.state('rh').state).toBe('central-ready')
  })

  it('qualquer dado RH local força migration-required e preserva os registros',async()=>{
    const f=fixture()
    const company=f.database.save('empresas',{razao_social:'Empresa RH local',status:'ativa'})
    const cargo=f.database.save('cargos',{nome:'Encanador local',salario_base_centavos:250000,ativo:1})
    const employee=f.database.save('funcionarios',{empresa_id:company.id,cargo_id:cargo.id,nome:'Funcionário local',status:'ativo',salario_centavos:250000})
    expect(f.service.state('rh')).toEqual(expect.objectContaining({state:'migration-required'}))
    const refreshed=await f.service.refreshCapabilities()
    expect(refreshed.rh.state).toBe('migration-required')
    expect(f.database.get('funcionarios',employee.id)?.nome).toBe('Funcionário local')
  })

  it('migration-required de RH permanece sticky após remoção dos dados locais',async()=>{
    const f=fixture()
    const company=f.database.save('empresas',{razao_social:'Empresa RH local',status:'ativa'})
    const employee=f.database.save('funcionarios',{empresa_id:company.id,nome:'Funcionário legado',status:'ativo',salario_centavos:100000})
    expect(f.service.state('rh').state).toBe('migration-required')
    f.database.remove('funcionarios',employee.id)
    const refreshed=await f.service.refreshCapabilities()
    expect(refreshed.rh.state).toBe('migration-required')
  })
})
