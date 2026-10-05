import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { afterEach, describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const { DatabaseService } = require('./database.cjs')
const { ModuleMigrationService } = require('./module-migration-service.cjs')
const created: Array<{ dir: string; database: any }> = []

function database() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'obra-rh-migration-'))
  const db = new DatabaseService({ dataDir: dir, migrationsDir: path.resolve(import.meta.dirname, '../../database/migrations') })
  db.open()
  created.push({ dir, database: db })
  return db
}

function service(db:any, lanClient:any = {}) {
  return new ModuleMigrationService({
    database:db,
    storage:{state:()=>({mode:'server',operationalMode:'lan-host'})},
    moduleStorage:{
      state:(name:string)=>({state:name==='rh'?'migration-required':'central-active'}),
      dependencyBlockedBy:()=>null,
      activateAfterMigration:vi.fn(()=>({state:'central-active'}))
    },
    lanClient:{
      syncSourceCapabilities:vi.fn(async()=>({modules:['core','operation','planning','finance','rh']})),
      migrationStart:vi.fn(async(input:any)=>({status:'started',...input})),
      migrationRecord:vi.fn(async(_id:string,record:any)=>({targetId:record.sourceId,reused:false})),
      migrationValidate:vi.fn(async()=>({status:'validated',sanityOk:true})),
      migrationCommit:vi.fn(async()=>({status:'committed',sanityOk:true})),
      migrationStatus:vi.fn(async(id:string)=>({migrationId:id,status:'committed',sanityOk:true,counts:{},targetCounts:{},missingTargets:[]})),
      migrationRollback:vi.fn(async()=>({status:'rolled_back'})),
      ...lanClient
    },
    backup:{createSafetySnapshot:vi.fn(async()=>({database:'/backup.sqlite',manifest:'/manifest.json',fingerprint:'backup-1'}))},
    uuid:()=> 'rh-mig-1',
    sourceId:()=> 'source-1'
  })
}

afterEach(()=>{
  for(const item of created.splice(0)){
    try{item.database.close()}catch{}
    fs.rmSync(item.dir,{recursive:true,force:true})
  }
})

describe('legacy RH company inference',()=>{
  it('usa a única empresa como fallback determinístico sem reescrever o banco legado',()=>{
    const db=database()
    const company=db.save('empresas',{razao_social:'MH Hidráulica',status:'ativa'})
    const migration=service(db)
    const cargo=db.list('cargos')[0]
    expect(cargo.empresa_id).toBeUndefined()
    expect(migration.resolveLegacyRhCompanyId('cargos',cargo)).toBe(company.id)
    const exported=migration.exportModule('rh')
    expect(exported.records.cargos[0].empresa_id).toBe(company.id)
    expect(db.list('cargos')[0].empresa_id).toBeUndefined()
  })

  it('em base multiempresa infere cargo, benefício, EPI e vínculos pelo funcionário quando inequívoco',()=>{
    const db=database()
    const a=db.save('empresas',{razao_social:'Empresa A',status:'ativa'})
    db.save('empresas',{razao_social:'Empresa B',status:'ativa'})
    const cargo=db.list('cargos')[0]
    const benefit=db.list('beneficios')[0]
    const epi=db.list('epis')[0]
    const employee=db.save('funcionarios',{empresa_id:a.id,cargo_id:cargo.id,nome:'João',status:'ativo'})
    const fb=db.save('funcionario_beneficios',{funcionario_id:employee.id,beneficio_id:benefit.id,valor_centavos:0})
    const fe=db.save('funcionario_epis',{funcionario_id:employee.id,epi_id:epi.id,data_entrega:'2026-10-01',quantidade:1})
    const migration=service(db)
    expect(migration.resolveLegacyRhCompanyId('cargos',cargo)).toBe(a.id)
    expect(migration.resolveLegacyRhCompanyId('beneficios',benefit)).toBe(a.id)
    expect(migration.resolveLegacyRhCompanyId('epis',epi)).toBe(a.id)
    expect(migration.resolveLegacyRhCompanyId('funcionario_beneficios',fb)).toBe(a.id)
    expect(migration.resolveLegacyRhCompanyId('funcionario_epis',fe)).toBe(a.id)
  })

  it('bloqueia registro RH ambíguo em base multiempresa em vez de escolher empresa arbitrária',()=>{
    const db=database()
    const a=db.save('empresas',{razao_social:'Empresa A',status:'ativa'})
    const b=db.save('empresas',{razao_social:'Empresa B',status:'ativa'})
    const cargo=db.list('cargos')[0]
    db.save('funcionarios',{empresa_id:a.id,cargo_id:cargo.id,nome:'A',status:'ativo'})
    db.save('funcionarios',{empresa_id:b.id,cargo_id:cargo.id,nome:'B',status:'ativo'})
    const migration=service(db)
    expect(()=>migration.resolveLegacyRhCompanyId('cargos',cargo)).toThrow(new RegExp(`ambígua.*cargos #${cargo.id}.*${a.id}.*${b.id}`,'i'))
  })

  it('bloqueia órfão RH sem vínculo em base multiempresa antes de iniciar escrita remota',async()=>{
    const db=database()
    db.save('empresas',{razao_social:'Empresa A',status:'ativa'})
    db.save('empresas',{razao_social:'Empresa B',status:'ativa'})
    const migration=service(db)
    await expect(migration.migrate('rh')).rejects.toThrow(/base multiempresa sem vínculo inequívoco/i)
    expect(migration.lanClient.migrationStart).not.toHaveBeenCalled()
  })

  it('detecta empresa_id legado que contradiz a obra atual do funcionário',()=>{
    const db=database()
    const a=db.save('empresas',{razao_social:'Empresa A',status:'ativa'})
    const b=db.save('empresas',{razao_social:'Empresa B',status:'ativa'})
    const work=db.save('obras',{empresa_id:b.id,nome:'Obra B',status:'ativa'})
    const migration=service(db)
    expect(()=>migration.resolveLegacyRhCompanyId('funcionarios',{id:99,empresa_id:a.id,obra_atual_id:work.id}))
      .toThrow(/empresa divergente.*funcionarios #99/i)
  })
})
