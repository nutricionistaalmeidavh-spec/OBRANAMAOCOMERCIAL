import test from 'node:test'
import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import service from '../../desktop/electron/services/local-rdo-binding.cjs'
test('primeiro vínculo em base limpa; homônimos, escopo errado e empresa diversa não são vinculados',()=>{
 const db=new DatabaseSync(':memory:')
 try{
 db.exec('CREATE TABLE empresas(id INTEGER PRIMARY KEY,razao_social TEXT,deleted_at TEXT);CREATE TABLE obras(id INTEGER PRIMARY KEY,empresa_id INTEGER,nome TEXT,deleted_at TEXT);CREATE TABLE field_rdo_links(remote_project_id TEXT,rdo_id INTEGER);CREATE TABLE rdos(id INTEGER PRIMARY KEY,obra_id INTEGER,deleted_at TEXT)')
 const url='https://example.test',s={authorized:true,role:'admin',company:{id:'c',name:'Empresa'},project:{id:'p',companyId:'c',name:'Residencial'},device:{id:'d'}}
 const cfg={tenant:{baseUrl:url,companyId:'c'},firstProject:{baseUrl:url,companyId:'c',projectId:'p',deviceId:'d'}}
 const resolve=(x=s)=>service.localRdoBinding(db,x,cfg,url)
 assert.equal(resolve({...s,role:'employee'}),null)
 assert.equal(resolve({...s,project:{...s.project,companyId:'another'}}),null)
 assert.deepEqual(resolve(),{companyId:1,workId:1})
 assert.equal(resolve(),null)
 db.exec("INSERT INTO rdos(id,obra_id) VALUES(1,1);INSERT INTO field_rdo_links VALUES('p',1)")
 assert.equal(resolve().workId,1)
 }finally{db.close()}
})
