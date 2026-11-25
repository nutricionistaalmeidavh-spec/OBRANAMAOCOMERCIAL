import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import {createRequire} from 'node:module'
import {LanRepository} from '../src/repository.mjs'
const require=createRequire(import.meta.url)
const {seed,snapshot,check,rows}=require('../../../tests/fixtures/synthetic-stock-upgrade.cjs')
test('atualiza base fictícia LAN 37 para 42 preservando todos os dados anteriores',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'obra-ficticia-lan-')),old=path.join(dir,'old-migrations'),current=path.resolve(import.meta.dirname,'../migrations'),filename=path.join(dir,'central.sqlite')
 fs.mkdirSync(old)
 for(const name of fs.readdirSync(current).filter(name=>/^\d+.*\.sql$/.test(name)&&Number(name.match(/^\d+/)[0])<=37))fs.copyFileSync(path.join(current,name),path.join(old,name))
 let repository=new LanRepository({filename})
 try{
  assert.equal(repository.applyMigrations(old).version,37)
  let db=repository.connection();db.exec('BEGIN IMMEDIATE')
  const ids=seed(db);db.exec('COMMIT')
  const before=snapshot(db)
  repository.close();repository=new LanRepository({filename});db=repository.connection()
  assert.deepEqual(repository.applyMigrations(current).applied,[38,39,40,41,42])
  db.exec('BEGIN IMMEDIATE');const catalog=check(db,ids,before);db.exec('COMMIT')
  repository.close();repository=new LanRepository({filename});db=repository.connection()
  assert.deepEqual(repository.applyMigrations(current).applied,[])
  assert.deepEqual(rows(db,'SELECT id,uid FROM materiais_estoque ORDER BY id'),catalog)
  assert.deepEqual(snapshot(db,before),before)
 }finally{repository.close();fs.rmSync(dir,{recursive:true,force:true})}
})
