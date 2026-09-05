import { afterEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'

const require=createRequire(import.meta.url)
const { DatabaseService }=require('./database-safe.cjs')
const { AdmissionConfigService }=require('./admission-config-service.cjs')
const dirs:string[]=[]
const temp=()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'commercial-admission-config-'));dirs.push(dir);return dir}
afterEach(()=>dirs.splice(0).forEach(dir=>fs.rmSync(dir,{recursive:true,force:true})))

describe('company-scoped admission configuration',()=>{
  it('isolates document profiles and EPI kits by company',()=>{
    const db=new DatabaseService({dataDir:temp(),migrationsDir:path.resolve(process.cwd(),'database','migrations')});db.open()
    try{
      const a=db.save('empresas',{razao_social:'EMPRESA A'}), b=db.save('empresas',{razao_social:'EMPRESA B'})
      const cargo=db.save('cargos',{nome:'Cargo Configuração',salario_base_centavos:0,ativo:1})
      const epi=db.save('epis',{nome:'EPI Configuração',ca:'CA-TESTE',unidade:'un',ativo:1})
      const service=new AdmissionConfigService({db})
      service.saveDocumentProfile({empresa_id:a.id,documento_key:'ordem_servico',ativo:1,obrigatorio:1,configuracao:{riscos:'Risco da empresa A'}})
      service.saveEpiKit({empresa_id:a.id,cargo_id:cargo.id,epi_id:epi.id,quantidade_texto:'02',ativo:1})
      expect(service.documentProfiles(a.id)).toHaveLength(1)
      expect(service.documentProfiles(b.id)).toHaveLength(0)
      expect(service.epiKit(a.id,cargo.id)[0]).toMatchObject({epi_id:epi.id,quantidade_texto:'02'})
      expect(service.epiKit(b.id,cargo.id)).toHaveLength(0)
    }finally{db.close()}
  })
})
