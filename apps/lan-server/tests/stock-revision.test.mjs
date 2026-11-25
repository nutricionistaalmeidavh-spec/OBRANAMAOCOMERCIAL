import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import {LanRepository} from '../src/repository.mjs'
import domainCore from '../src/domain-core.cjs'
const {stockRevision}=domainCore
test('revision invalidates only relevant work/company and rolls back with ledger',()=>{
 const repo=new LanRepository({filename:':memory:'})
 try{
 repo.applyMigrations(path.resolve(import.meta.dirname,'../migrations'))
 const a=repo.save('empresas',{razao_social:'A'}),b=repo.save('empresas',{razao_social:'B'})
 const w=repo.save('obras',{empresa_id:a.id,nome:'W'}),other=repo.save('obras',{empresa_id:b.id,nome:'Other'})
 const db=repo.connection(),read=id=>stockRevision(db,{obra_id:id}).revision
 const v=read(w.id),v2=read(other.id)
 db.exec('BEGIN IMMEDIATE')
 repo.save('movimentacoes_estoque',{obra_id:w.id,descricao:'Tubo',unidade:'m',tipo:'entrada',quantidade:2,data:'2026-11-25'})
 assert.notEqual(read(w.id),v);assert.equal(read(other.id),v2)
 db.exec('ROLLBACK')
 assert.equal(read(w.id),v)
 repo.save('movimentacoes_estoque',{obra_id:w.id,descricao:'Tubo',unidade:'m',tipo:'entrada',quantidade:2,data:'2026-11-25'})
 assert.notEqual(read(w.id),v);assert.equal(read(other.id),v2)
 assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[])
 }finally{repo.close()}
})
