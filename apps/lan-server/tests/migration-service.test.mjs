import assert from 'node:assert/strict'
import test from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import { MigrationService } from '../src/migration-service.mjs'

const MIGRATION_SCHEMA = `
CREATE TABLE module_migrations(migration_id TEXT PRIMARY KEY,module TEXT NOT NULL,source_fingerprint TEXT NOT NULL,expected_counts_json TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL,validated_at TEXT,committed_at TEXT,rolled_back_at TEXT);
CREATE TABLE module_migration_records(migration_id TEXT NOT NULL,source_table TEXT NOT NULL,source_id TEXT NOT NULL,target_table TEXT NOT NULL,target_id INTEGER NOT NULL,created_target INTEGER NOT NULL,source_data_json TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(migration_id,source_table,source_id));`

function fixture() {
  const db = new DatabaseSync(':memory:')
  db.exec(MIGRATION_SCHEMA)
  db.exec(`CREATE TABLE empresas(id INTEGER PRIMARY KEY AUTOINCREMENT,razao_social TEXT NOT NULL);CREATE TABLE clientes(id INTEGER PRIMARY KEY AUTOINCREMENT,empresa_id INTEGER,nome TEXT NOT NULL);CREATE TABLE obras(id INTEGER PRIMARY KEY AUTOINCREMENT,empresa_id INTEGER NOT NULL,cliente_id INTEGER,nome TEXT NOT NULL);CREATE TABLE categorias_financeiras(id INTEGER PRIMARY KEY AUTOINCREMENT,nome TEXT UNIQUE,natureza TEXT,grupo_dre TEXT,ativa INTEGER);CREATE TABLE frentes_obra(id INTEGER PRIMARY KEY AUTOINCREMENT,obra_id INTEGER NOT NULL,nome TEXT);CREATE TABLE rdos(id INTEGER PRIMARY KEY AUTOINCREMENT,obra_id INTEGER NOT NULL,frente_id INTEGER,data TEXT);CREATE TABLE rdo_equipe(id INTEGER PRIMARY KEY AUTOINCREMENT,rdo_id INTEGER NOT NULL,frente_id INTEGER,funcionario_id INTEGER,nome TEXT);CREATE TABLE funcionarios(id INTEGER PRIMARY KEY AUTOINCREMENT,empresa_id INTEGER,nome TEXT);`)
  const allowed = new Set(['empresas','clientes','obras','categorias_financeiras','frentes_obra','rdos','rdo_equipe','funcionarios'])
  const repository = {
    connection: () => db,
    save(table, data) {
      assert.ok(allowed.has(table))
      const keys = Object.keys(data).filter(key => key !== 'id')
      const result = db.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`).run(...keys.map(key => data[key]))
      return db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(Number(result.lastInsertRowid))
    }
  }
  const audit=[]
  const security={appendAudit:event=>{audit.push(event);return audit.length}}
  return { db, audit, repository, service: new MigrationService({ repository, security, now: () => '2026-10-01T00:00:00.000Z' }) }
}

const actor={member:{memberId:'admin-1'},device:{id:'device-1'}}

test('start is idempotent only for same module fingerprint and expected counts', () => {
  const f = fixture()
  const input = { migrationId:'m1', module:'core', sourceFingerprint:'source-1', expectedCounts:{empresas:1,clientes:0,obras:0} }
  assert.equal(f.service.start(input,actor).status,'started')
  assert.equal(f.service.start(input,actor).status,'started')
  assert.throws(()=>f.service.start({...input,sourceFingerprint:'other'},actor),/fingerprint|origem/i)
  assert.throws(()=>f.service.start({...input,module:'finance'},actor),/módulo|module/i)
  assert.equal(f.audit.filter(event=>event.action==='migration_started').length,1)
  assert.equal(f.audit[0].actorMemberId,'admin-1')
  assert.equal(f.audit[0].actorDeviceId,'device-1')
  f.db.close()
})

test('record retry reuses same target and remaps core foreign keys', () => {
  const f = fixture()
  f.service.start({migrationId:'m1',module:'core',sourceFingerprint:'source-1',expectedCounts:{empresas:1,clientes:1,obras:1}},actor)
  const company=f.service.importRecord('m1',{sourceTable:'empresas',sourceId:10,data:{razao_social:'Empresa'}},actor)
  const again=f.service.importRecord('m1',{sourceTable:'empresas',sourceId:10,data:{razao_social:'Empresa'}},actor)
  assert.equal(again.targetId,company.targetId);assert.equal(again.reused,true)
  const client=f.service.importRecord('m1',{sourceTable:'clientes',sourceId:20,data:{empresa_id:10,nome:'Cliente'}},actor)
  const work=f.service.importRecord('m1',{sourceTable:'obras',sourceId:30,data:{empresa_id:10,cliente_id:20,nome:'Obra'}},actor)
  assert.equal(f.db.prepare('SELECT empresa_id FROM clientes WHERE id=?').get(client.targetId).empresa_id,company.targetId)
  const savedWork=f.db.prepare('SELECT empresa_id,cliente_id FROM obras WHERE id=?').get(work.targetId)
  assert.equal(savedWork.empresa_id,company.targetId)
  assert.equal(savedWork.cliente_id,client.targetId)
  assert.equal(f.service.status('m1').sanityOk,true)
  f.db.close()
})

test('validation gates commit and rollback deletes only current created targets', () => {
  const f=fixture()
  f.service.start({migrationId:'m1',module:'core',sourceFingerprint:'source-1',expectedCounts:{empresas:1,clientes:1,obras:0}},actor)
  f.service.importRecord('m1',{sourceTable:'empresas',sourceId:1,data:{razao_social:'A'}},actor)
  assert.throws(()=>f.service.validate('m1',actor),/contagem|count/i)
  assert.throws(()=>f.service.commit('m1',actor),/validada/i)
  const before=f.db.prepare('SELECT COUNT(*) n FROM empresas').get().n

  f.service.start({migrationId:'m2',module:'core',sourceFingerprint:'source-2',expectedCounts:{empresas:1,clientes:0,obras:0}},actor)
  f.service.importRecord('m2',{sourceTable:'empresas',sourceId:2,data:{razao_social:'B'}},actor)
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM empresas').get().n,before+1)
  f.service.rollback('m2',actor)
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM empresas').get().n,before)
  assert.ok(f.audit.some(event=>event.action==='migration_rollback'))
  f.db.close()
})

test('sanity detects missing mapped target and blocks validation', () => {
  const f=fixture()
  f.service.start({migrationId:'m1',module:'core',sourceFingerprint:'source-1',expectedCounts:{empresas:1,clientes:0,obras:0}},actor)
  const imported=f.service.importRecord('m1',{sourceTable:'empresas',sourceId:1,data:{razao_social:'A'}},actor)
  f.db.prepare('DELETE FROM empresas WHERE id=?').run(imported.targetId)
  const status=f.service.status('m1')
  assert.equal(status.sanityOk,false)
  assert.deepEqual(status.missingTargets,[{table:'empresas',targetId:imported.targetId,sourceTable:'empresas',sourceId:'1'}])
  assert.throws(()=>f.service.validate('m1',actor),/sanidade|destino|mapping/i)
  f.db.close()
})

test('validate and commit emit operational audit only after central sanity succeeds', () => {
  const f=fixture()
  f.service.start({migrationId:'m1',module:'core',sourceFingerprint:'source-1',expectedCounts:{empresas:1,clientes:0,obras:0}},actor)
  f.service.importRecord('m1',{sourceTable:'empresas',sourceId:1,data:{razao_social:'A'}},actor)
  const validated=f.service.validate('m1',actor)
  assert.equal(validated.status,'validated')
  assert.equal(validated.sanityOk,true)
  const committed=f.service.commit('m1',actor)
  assert.equal(committed.status,'committed')
  assert.equal(committed.sanityOk,true)
  assert.deepEqual(f.audit.filter(e=>e.action.startsWith('migration_')).map(e=>e.action),['migration_started','migration_validated','migration_committed'])
  f.db.close()
})

test('service follows repository connection after central database reopen', () => {
  const f=fixture()
  f.service.start({migrationId:'old',module:'core',sourceFingerprint:'source-1',expectedCounts:{empresas:0,clientes:0,obras:0}},actor)
  const replacement=new DatabaseSync(':memory:')
  replacement.exec(MIGRATION_SCHEMA)
  replacement.exec(`CREATE TABLE empresas(id INTEGER PRIMARY KEY AUTOINCREMENT,razao_social TEXT NOT NULL);CREATE TABLE clientes(id INTEGER PRIMARY KEY AUTOINCREMENT,empresa_id INTEGER,nome TEXT NOT NULL);CREATE TABLE obras(id INTEGER PRIMARY KEY AUTOINCREMENT,empresa_id INTEGER NOT NULL,cliente_id INTEGER,nome TEXT NOT NULL);`)
  f.repository.connection=()=>replacement
  assert.equal(f.service.start({migrationId:'new',module:'core',sourceFingerprint:'source-2',expectedCounts:{empresas:0,clientes:0,obras:0}},actor).migrationId,'new')
  assert.equal(replacement.prepare('SELECT COUNT(*) n FROM module_migrations').get().n,1)
  replacement.close();f.db.close()
})

test('committed core mappings are reused by later module migrations with same source fingerprint', () => {
  const f=fixture()
  f.service.start({migrationId:'core-1',module:'core',sourceFingerprint:'source-1',expectedCounts:{empresas:1,clientes:0,obras:1}},actor)
  f.service.importRecord('core-1',{sourceTable:'empresas',sourceId:1,data:{razao_social:'A'}},actor)
  const work=f.service.importRecord('core-1',{sourceTable:'obras',sourceId:7,data:{empresa_id:1,nome:'Obra'}},actor)
  f.service.validate('core-1',actor);f.service.commit('core-1',actor)
  f.service.start({migrationId:'op-1',module:'operation',sourceFingerprint:'source-1',expectedCounts:{frentes_obra:1,rdos:0,rdo_equipe:0,rdo_equipamentos:0,rdo_ocorrencias:0,rdo_anexos:0,tarefas_obra:0}},actor)
  const front=f.service.importRecord('op-1',{sourceTable:'frentes_obra',sourceId:9,data:{obra_id:7,nome:'Frente'}},actor)
  assert.equal(f.db.prepare('SELECT obra_id FROM frentes_obra WHERE id=?').get(front.targetId).obra_id,work.targetId)
  f.db.close()
})

test('RH employee import backfills deferred RDO team employee reference', () => {
  const f=fixture()
  f.service.start({migrationId:'core-1',module:'core',sourceFingerprint:'source-1',expectedCounts:{empresas:1,clientes:0,obras:1}},actor)
  f.service.importRecord('core-1',{sourceTable:'empresas',sourceId:1,data:{razao_social:'A'}},actor)
  f.service.importRecord('core-1',{sourceTable:'obras',sourceId:7,data:{empresa_id:1,nome:'Obra'}},actor);f.service.validate('core-1',actor);f.service.commit('core-1',actor)
  f.service.start({migrationId:'op-1',module:'operation',sourceFingerprint:'source-1',expectedCounts:{frentes_obra:0,rdos:1,rdo_equipe:1,rdo_equipamentos:0,rdo_ocorrencias:0,rdo_anexos:0,tarefas_obra:0}},actor)
  const report=f.service.importRecord('op-1',{sourceTable:'rdos',sourceId:5,data:{obra_id:7,data:'2026-10-01'}},actor)
  const team=f.service.importRecord('op-1',{sourceTable:'rdo_equipe',sourceId:6,data:{rdo_id:5,funcionario_id:99,nome:'João'}},actor)
  assert.equal(f.db.prepare('SELECT funcionario_id FROM rdo_equipe WHERE id=?').get(team.targetId).funcionario_id,null)
  f.service.validate('op-1',actor);f.service.commit('op-1',actor)
  f.service.start({migrationId:'rh-1',module:'rh',sourceFingerprint:'source-1',expectedCounts:{cargos:0,beneficios:0,epis:0,funcionarios:1,funcionario_obras:0,cargo_beneficios:0,funcionario_beneficios:0,folhas_pagamento:0,folha_lancamentos:0,pagamentos_funcionario:0,pontos_mensais:0,ponto_marcacoes:0,funcionario_epis:0}},actor)
  const employee=f.service.importRecord('rh-1',{sourceTable:'funcionarios',sourceId:99,data:{empresa_id:1,nome:'João'}},actor)
  assert.equal(f.db.prepare('SELECT funcionario_id FROM rdo_equipe WHERE id=?').get(team.targetId).funcionario_id,employee.targetId)
  assert.ok(report.targetId)
  f.db.close()
})