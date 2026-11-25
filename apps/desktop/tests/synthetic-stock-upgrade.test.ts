import {it,expect} from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const {DatabaseService}=require('../electron/services/database.cjs')
const {seed,snapshot,check,rows}=require('../../../tests/fixtures/synthetic-stock-upgrade.cjs')
it('atualiza base fictícia Desktop 26 para 31 preservando todos os dados anteriores',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'obra-ficticia-desktop-')),old=path.join(dir,'old-migrations'),current=path.resolve(import.meta.dirname,'../database/migrations')
 fs.mkdirSync(old)
 for(const name of fs.readdirSync(current).filter(name=>/^\d+.*\.sql$/.test(name)&&Number(name.match(/^\d+/)![0])<=26))fs.copyFileSync(path.join(current,name),path.join(old,name))
 const service=new DatabaseService({dataDir:dir,migrationsDir:old})
 try{
  service.open()
  expect(service.db.pragma('user_version',{simple:true})).toBe(26)
  const ids=service.db.transaction(()=>seed(service.db))()
  const before=snapshot(service.db)
  service.migrationsDir=current
  // Invoke the production migration runner on a populated, isolated database.
  // Backup mechanics are separate from schema preservation and not simulated here.
  service.migrate(false)
  expect(service.db.pragma('user_version',{simple:true})).toBe(33)
  const catalog=service.db.transaction(()=>check(service.db,ids,before))()
  service.close();service.open()
  expect(rows(service.db,'SELECT id,uid FROM materiais_estoque ORDER BY id')).toEqual(catalog)
  expect(snapshot(service.db,before)).toEqual(before)
  expect(service.db.pragma('foreign_key_check')).toEqual([])
 }finally{service.close();fs.rmSync(dir,{recursive:true,force:true})}
},30000)
