import { afterEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'

const require=createRequire(import.meta.url)
const Database=require('better-sqlite3')
const { DatabaseService: BaseDatabaseService }=require('./database.cjs')
const { DatabaseService: SafeDatabaseService }=require('./database-safe.cjs')
const tempDirs:string[]=[]

function tempDir(label:string){const dir=fs.mkdtempSync(path.join(os.tmpdir(),`commercial-rh-${label}-`));tempDirs.push(dir);return dir}
function projectMigrations(){return path.resolve(process.cwd(),'database','migrations')}
function copyMigrationsThrough(destination:string,maxVersion:number){
  fs.mkdirSync(destination,{recursive:true})
  for(const file of fs.readdirSync(projectMigrations())){
    const version=Number(file.match(/^\d+/)?.[0]||0)
    if(version&&version<=maxVersion)fs.copyFileSync(path.join(projectMigrations(),file),path.join(destination,file))
  }
}

afterEach(()=>{for(const dir of tempDirs.splice(0))fs.rmSync(dir,{recursive:true,force:true})})

describe('commercial safe database migration',()=>{
  it('creates a synchronous snapshot before schema upgrades and preserves existing data',()=>{
    const dataDir=tempDir('data'), oldMigrations=tempDir('migrations-v13')
    copyMigrationsThrough(oldMigrations,13)
    const before=new BaseDatabaseService({dataDir,migrationsDir:oldMigrations})
    before.open()
    const company=before.save('empresas',{razao_social:'EMPRESA TESTE',cnpj:'00.000.000/0001-00'})
    const employee=before.save('funcionarios',{empresa_id:company.id,nome:'COLABORADOR TESTE',cpf:'99999999999',salario_centavos:250000})
    before.close()

    const upgraded=new SafeDatabaseService({dataDir,migrationsDir:projectMigrations()})
    upgraded.open()
    try{
      expect(upgraded.db.pragma('user_version',{simple:true})).toBeGreaterThanOrEqual(16)
      expect(upgraded.get('funcionarios',employee.id)?.nome).toBe('COLABORADOR TESTE')
      const backupDir=path.join(dataDir,'backups','pre-migration')
      const backups=fs.readdirSync(backupDir).filter((file:string)=>file.endsWith('.sqlite'))
      expect(backups).toHaveLength(1)
      const snapshot=new Database(path.join(backupDir,backups[0]),{readonly:true})
      try{
        expect(snapshot.pragma('integrity_check',{simple:true})).toBe('ok')
        expect(snapshot.pragma('user_version',{simple:true})).toBe(13)
        expect(snapshot.prepare('SELECT nome FROM funcionarios WHERE id=?').get(employee.id)).toEqual({nome:'COLABORADOR TESTE'})
        const columns=new Set(snapshot.prepare('PRAGMA table_info(funcionarios)').all().map((row:any)=>row.name))
        expect(columns.has('matricula_esocial')).toBe(false)
      }finally{snapshot.close()}
    }finally{upgraded.close()}
  })
})
