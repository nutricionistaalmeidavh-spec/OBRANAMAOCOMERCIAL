import assert from 'node:assert/strict'
import test from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import { validateCoreOperationOwnership } from '../src/domain-integrity.mjs'

function fixture(){
  const db=new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE empresas(id INTEGER PRIMARY KEY,deleted_at TEXT);
    CREATE TABLE clientes(id INTEGER PRIMARY KEY,empresa_id INTEGER,deleted_at TEXT);
    CREATE TABLE obras(id INTEGER PRIMARY KEY,empresa_id INTEGER NOT NULL,cliente_id INTEGER,deleted_at TEXT);
    CREATE TABLE frentes_obra(id INTEGER PRIMARY KEY,obra_id INTEGER NOT NULL,deleted_at TEXT);
    CREATE TABLE rdos(id INTEGER PRIMARY KEY,obra_id INTEGER NOT NULL,frente_id INTEGER,deleted_at TEXT);
    CREATE TABLE rdo_equipe(id INTEGER PRIMARY KEY,rdo_id INTEGER NOT NULL,frente_id INTEGER,funcionario_id INTEGER);
    CREATE TABLE rdo_equipamentos(id INTEGER PRIMARY KEY,rdo_id INTEGER NOT NULL,frente_id INTEGER);
    CREATE TABLE rdo_ocorrencias(id INTEGER PRIMARY KEY,rdo_id INTEGER NOT NULL,frente_id INTEGER);
    CREATE TABLE rdo_anexos(id INTEGER PRIMARY KEY,rdo_id INTEGER NOT NULL,frente_id INTEGER);
    CREATE TABLE tarefas_obra(id INTEGER PRIMARY KEY,obra_id INTEGER NOT NULL,frente_id INTEGER,rdo_ocorrencia_id INTEGER,deleted_at TEXT);
    CREATE TABLE funcionarios(id INTEGER PRIMARY KEY,empresa_id INTEGER,deleted_at TEXT);
  `)
  db.exec(`INSERT INTO empresas(id) VALUES(1),(2); INSERT INTO clientes(id,empresa_id) VALUES(10,1),(20,2); INSERT INTO obras(id,empresa_id,cliente_id) VALUES(100,1,10),(200,2,20); INSERT INTO frentes_obra(id,obra_id) VALUES(1000,100),(2000,200); INSERT INTO rdos(id,obra_id,frente_id) VALUES(5000,100,1000),(6000,200,2000); INSERT INTO rdo_ocorrencias(id,rdo_id,frente_id) VALUES(7000,5000,1000),(8000,6000,2000); INSERT INTO funcionarios(id,empresa_id) VALUES(90,1),(91,2);`)
  return db
}

test('obra cannot reference client from another company',()=>{
  const db=fixture();assert.throws(()=>validateCoreOperationOwnership(db,'obras',{empresa_id:1,cliente_id:20},null),/Cliente.*mesma empresa/i);db.close()
})

test('RDO and task cannot combine front or occurrence from another work',()=>{
  const db=fixture()
  assert.throws(()=>validateCoreOperationOwnership(db,'rdos',{obra_id:100,frente_id:2000},null),/Frente.*mesma obra/i)
  assert.throws(()=>validateCoreOperationOwnership(db,'tarefas_obra',{obra_id:100,frente_id:1000,rdo_ocorrencia_id:8000},null),/Ocorrência.*mesma obra/i)
  db.close()
})

test('RDO child front and employee must match the RDO work/company',()=>{
  const db=fixture()
  assert.throws(()=>validateCoreOperationOwnership(db,'rdo_equipe',{rdo_id:5000,frente_id:2000,nome:'X'},null),/Frente.*mesma obra/i)
  assert.throws(()=>validateCoreOperationOwnership(db,'rdo_equipe',{rdo_id:5000,funcionario_id:91,nome:'X'},null),/Funcionário.*mesma empresa/i)
  db.close()
})

test('front PUT cannot move to another work while existing children still reference it',()=>{
  const db=fixture()
  db.exec('INSERT INTO tarefas_obra(id,obra_id,frente_id) VALUES(1,100,1000)')
  const current={id:1000,obra_id:100}
  assert.throws(()=>validateCoreOperationOwnership(db,'frentes_obra',{obra_id:200},current),/Frente.*vínculos|mover/i)
  db.close()
})
