import assert from 'node:assert/strict'
import test from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import { MigrationService } from '../src/migration-service.mjs'

const MIGRATION_SCHEMA = `
CREATE TABLE module_migrations(migration_id TEXT PRIMARY KEY,module TEXT NOT NULL,source_fingerprint TEXT NOT NULL,expected_counts_json TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL,validated_at TEXT,committed_at TEXT,rolled_back_at TEXT);
CREATE TABLE module_migration_records(migration_id TEXT NOT NULL,source_table TEXT NOT NULL,source_id TEXT NOT NULL,target_table TEXT NOT NULL,target_id INTEGER NOT NULL,created_target INTEGER NOT NULL,source_data_json TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(migration_id,source_table,source_id));`

const DOMAIN_SCHEMA = `
CREATE TABLE empresas(id INTEGER PRIMARY KEY AUTOINCREMENT,razao_social TEXT,status TEXT);
CREATE TABLE clientes(id INTEGER PRIMARY KEY AUTOINCREMENT,empresa_id INTEGER,nome TEXT);
CREATE TABLE obras(id INTEGER PRIMARY KEY AUTOINCREMENT,empresa_id INTEGER,cliente_id INTEGER,nome TEXT);
CREATE TABLE frentes_obra(id INTEGER PRIMARY KEY AUTOINCREMENT,obra_id INTEGER,nome TEXT);
CREATE TABLE rdos(id INTEGER PRIMARY KEY AUTOINCREMENT,obra_id INTEGER,frente_id INTEGER,data TEXT);
CREATE TABLE rdo_equipe(id INTEGER PRIMARY KEY AUTOINCREMENT,rdo_id INTEGER,frente_id INTEGER,funcionario_id INTEGER,nome TEXT);
CREATE TABLE rdo_equipamentos(id INTEGER PRIMARY KEY AUTOINCREMENT,rdo_id INTEGER,frente_id INTEGER,equipamento TEXT);
CREATE TABLE rdo_ocorrencias(id INTEGER PRIMARY KEY AUTOINCREMENT,rdo_id INTEGER,frente_id INTEGER,descricao TEXT);
CREATE TABLE rdo_anexos(id INTEGER PRIMARY KEY AUTOINCREMENT,rdo_id INTEGER,frente_id INTEGER,nome TEXT);
CREATE TABLE tarefas_obra(id INTEGER PRIMARY KEY AUTOINCREMENT,obra_id INTEGER,frente_id INTEGER,rdo_ocorrencia_id INTEGER,titulo TEXT);
CREATE TABLE etapas_obra(id INTEGER PRIMARY KEY AUTOINCREMENT,obra_id INTEGER,frente_id INTEGER,nome TEXT);
CREATE TABLE cronograma_etapas(id INTEGER PRIMARY KEY AUTOINCREMENT,obra_id INTEGER,etapa_id INTEGER,frente_id INTEGER,inicio TEXT);
CREATE TABLE itens_orcamentarios(id INTEGER PRIMARY KEY AUTOINCREMENT,obra_id INTEGER,etapa_id INTEGER,frente_id INTEGER,descricao TEXT);
CREATE TABLE fornecedores(id INTEGER PRIMARY KEY AUTOINCREMENT,empresa_id INTEGER,nome TEXT);
CREATE TABLE categorias_financeiras(id INTEGER PRIMARY KEY AUTOINCREMENT,nome TEXT UNIQUE,natureza TEXT,grupo_dre TEXT,ativa INTEGER);
CREATE TABLE contas(id INTEGER PRIMARY KEY AUTOINCREMENT,empresa_id INTEGER,obra_id INTEGER,frente_id INTEGER,fornecedor_id INTEGER,cliente_id INTEGER,categoria_id INTEGER,descricao TEXT);
CREATE TABLE pagamentos_conta(id INTEGER PRIMARY KEY AUTOINCREMENT,conta_id INTEGER,valor_centavos INTEGER);
CREATE TABLE cargos(id INTEGER PRIMARY KEY AUTOINCREMENT,empresa_id INTEGER,nome TEXT);
CREATE TABLE beneficios(id INTEGER PRIMARY KEY AUTOINCREMENT,empresa_id INTEGER,nome TEXT);
CREATE TABLE epis(id INTEGER PRIMARY KEY AUTOINCREMENT,empresa_id INTEGER,nome TEXT);
CREATE TABLE funcionarios(id INTEGER PRIMARY KEY AUTOINCREMENT,empresa_id INTEGER,obra_atual_id INTEGER,cargo_id INTEGER,nome TEXT);
CREATE TABLE funcionario_obras(id INTEGER PRIMARY KEY AUTOINCREMENT,empresa_id INTEGER,funcionario_id INTEGER,obra_id INTEGER,inicio TEXT);
CREATE TABLE cargo_beneficios(id INTEGER PRIMARY KEY AUTOINCREMENT,empresa_id INTEGER,cargo_id INTEGER,beneficio_id INTEGER,valor_centavos INTEGER);
CREATE TABLE funcionario_beneficios(id INTEGER PRIMARY KEY AUTOINCREMENT,empresa_id INTEGER,funcionario_id INTEGER,beneficio_id INTEGER,valor_centavos INTEGER);
CREATE TABLE folhas_pagamento(id INTEGER PRIMARY KEY AUTOINCREMENT,empresa_id INTEGER,conta_id INTEGER,competencia TEXT);
CREATE TABLE folha_lancamentos(id INTEGER PRIMARY KEY AUTOINCREMENT,empresa_id INTEGER,folha_id INTEGER,funcionario_id INTEGER,descricao TEXT);
CREATE TABLE pagamentos_funcionario(id INTEGER PRIMARY KEY AUTOINCREMENT,empresa_id INTEGER,funcionario_id INTEGER,folha_id INTEGER,competencia TEXT,valor_centavos INTEGER);
CREATE TABLE pontos_mensais(id INTEGER PRIMARY KEY AUTOINCREMENT,empresa_id INTEGER,funcionario_id INTEGER,competencia TEXT);
CREATE TABLE ponto_marcacoes(id INTEGER PRIMARY KEY AUTOINCREMENT,empresa_id INTEGER,ponto_mensal_id INTEGER,data TEXT);
CREATE TABLE funcionario_epis(id INTEGER PRIMARY KEY AUTOINCREMENT,empresa_id INTEGER,funcionario_id INTEGER,epi_id INTEGER,data_entrega TEXT);
`

const MODULES = {
  core: ['empresas','clientes','obras'],
  operation: ['frentes_obra','rdos','rdo_equipe','rdo_equipamentos','rdo_ocorrencias','rdo_anexos','tarefas_obra'],
  planning: ['etapas_obra','cronograma_etapas','itens_orcamentarios'],
  finance: ['fornecedores','categorias_financeiras','contas','pagamentos_conta'],
  rh: ['cargos','beneficios','epis','funcionarios','funcionario_obras','cargo_beneficios','funcionario_beneficios','folhas_pagamento','folha_lancamentos','pagamentos_funcionario','pontos_mensais','ponto_marcacoes','funcionario_epis']
}

const SOURCE='source-complete'
const actor={member:{memberId:'admin-1'},device:{id:'device-1'}}

function fixture(){
  const db=new DatabaseSync(':memory:')
  db.exec(MIGRATION_SCHEMA)
  db.exec(DOMAIN_SCHEMA)
  const allowed=new Set(Object.values(MODULES).flat())
  const repository={
    connection:()=>db,
    save(table,data){
      assert.ok(allowed.has(table),`unexpected table ${table}`)
      const keys=Object.keys(data).filter(key=>key!=='id')
      const result=db.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`).run(...keys.map(key=>data[key]))
      return db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(Number(result.lastInsertRowid))
    }
  }
  const audit=[]
  const service=new MigrationService({repository,security:{appendAudit:event=>{audit.push(event);return audit.length}},now:()=> '2026-10-01T12:00:00.000Z'})
  return {db,service,audit}
}

function counts(module,records){
  return Object.fromEntries(MODULES[module].map(table=>[table,(records[table]||[]).length]))
}

function migrate(f,module,records){
  const migrationId=`${module}-1`
  f.service.start({migrationId,module,sourceFingerprint:SOURCE,expectedCounts:counts(module,records)},actor)
  const imported={}
  for(const table of MODULES[module]){
    imported[table]=[]
    for(const record of records[table]||[]){
      const {id,...data}=record
      imported[table].push(f.service.importRecord(migrationId,{sourceTable:table,sourceId:id,data},actor))
    }
  }
  const validated=f.service.validate(migrationId,actor)
  assert.equal(validated.status,'validated')
  assert.equal(validated.sanityOk,true)
  const committed=f.service.commit(migrationId,actor)
  assert.equal(committed.status,'committed')
  assert.equal(committed.sanityOk,true)
  return {migrationId,imported,committed}
}

test('migrates core operation planning finance and rh with collisions mappings and seeds',()=>{
  const f=fixture()
  // Existing central IDs deliberately collide with local IDs. Migration must allocate/remap instead of preserving source IDs.
  f.db.prepare("INSERT INTO empresas(id,razao_social,status) VALUES(1,'Central existing','ativa')").run()
  f.db.prepare("INSERT INTO categorias_financeiras(id,nome,natureza,grupo_dre,ativa) VALUES(1,'Materiais','despesa','custos_obra',1)").run()

  const core=migrate(f,'core',{
    empresas:[{id:1,razao_social:'Empresa local',status:'ativa'}],
    clientes:[{id:2,empresa_id:1,nome:'Cliente local'}],
    obras:[{id:3,empresa_id:1,cliente_id:2,nome:'Obra local'}]
  })
  const companyId=core.imported.empresas[0].targetId
  const clientId=core.imported.clientes[0].targetId
  const workId=core.imported.obras[0].targetId
  assert.notEqual(companyId,1)
  assert.equal(f.db.prepare('SELECT empresa_id,cliente_id FROM obras WHERE id=?').get(workId).empresa_id,companyId)
  assert.equal(f.db.prepare('SELECT empresa_id,cliente_id FROM obras WHERE id=?').get(workId).cliente_id,clientId)

  const operation=migrate(f,'operation',{
    frentes_obra:[{id:10,obra_id:3,nome:'Frente A'}],
    rdos:[{id:11,obra_id:3,frente_id:10,data:'2026-10-01'}],
    rdo_equipe:[{id:12,rdo_id:11,frente_id:10,funcionario_id:100,nome:'João'}],
    rdo_equipamentos:[{id:13,rdo_id:11,frente_id:10,equipamento:'Betoneira'}],
    rdo_ocorrencias:[{id:14,rdo_id:11,frente_id:10,descricao:'Chuva'}],
    rdo_anexos:[{id:15,rdo_id:11,frente_id:10,nome:'foto.jpg'}],
    tarefas_obra:[{id:16,obra_id:3,frente_id:10,rdo_ocorrencia_id:14,titulo:'Reprogramar'}]
  })
  const frontId=operation.imported.frentes_obra[0].targetId
  const reportId=operation.imported.rdos[0].targetId
  const teamId=operation.imported.rdo_equipe[0].targetId
  assert.deepEqual(f.db.prepare('SELECT obra_id,frente_id FROM rdos WHERE id=?').get(reportId),{obra_id:workId,frente_id:frontId})
  assert.equal(f.db.prepare('SELECT funcionario_id FROM rdo_equipe WHERE id=?').get(teamId).funcionario_id,null)

  const planning=migrate(f,'planning',{
    etapas_obra:[{id:20,obra_id:3,frente_id:10,nome:'Instalação'}],
    cronograma_etapas:[{id:21,obra_id:3,etapa_id:20,frente_id:10,inicio:'2026-10-02'}],
    itens_orcamentarios:[{id:22,obra_id:3,etapa_id:20,frente_id:10,descricao:'Tubulação'}]
  })
  const stageId=planning.imported.etapas_obra[0].targetId
  assert.deepEqual(f.db.prepare('SELECT obra_id,etapa_id,frente_id FROM cronograma_etapas WHERE id=?').get(planning.imported.cronograma_etapas[0].targetId),{obra_id:workId,etapa_id:stageId,frente_id:frontId})

  const finance=migrate(f,'finance',{
    fornecedores:[{id:30,empresa_id:1,nome:'Fornecedor'}],
    categorias_financeiras:[{id:31,nome:'Materiais',natureza:'despesa',grupo_dre:'custos_obra',ativa:1}],
    contas:[{id:32,empresa_id:1,obra_id:3,frente_id:10,fornecedor_id:30,cliente_id:2,categoria_id:31,descricao:'Compra tubos'}],
    pagamentos_conta:[{id:33,conta_id:32,valor_centavos:15000}]
  })
  const supplierId=finance.imported.fornecedores[0].targetId
  const categoryId=finance.imported.categorias_financeiras[0].targetId
  const accountId=finance.imported.contas[0].targetId
  assert.equal(categoryId,1,'seed financeiro deve ser reutilizado')
  assert.equal(finance.imported.categorias_financeiras[0].reused,false,'mapping novo pode apontar para seed já existente')
  assert.deepEqual(f.db.prepare('SELECT empresa_id,obra_id,frente_id,fornecedor_id,cliente_id,categoria_id FROM contas WHERE id=?').get(accountId),{
    empresa_id:companyId,obra_id:workId,frente_id:frontId,fornecedor_id:supplierId,cliente_id:clientId,categoria_id:categoryId
  })

  const rh=migrate(f,'rh',{
    cargos:[{id:40,empresa_id:1,nome:'Encanador'}],
    beneficios:[{id:41,empresa_id:1,nome:'Vale-alimentação'}],
    epis:[{id:42,empresa_id:1,nome:'Botina'}],
    funcionarios:[{id:100,empresa_id:1,obra_atual_id:3,cargo_id:40,nome:'João'}],
    funcionario_obras:[{id:43,empresa_id:1,funcionario_id:100,obra_id:3,inicio:'2026-10-01'}],
    cargo_beneficios:[{id:44,empresa_id:1,cargo_id:40,beneficio_id:41,valor_centavos:30000}],
    funcionario_beneficios:[{id:45,empresa_id:1,funcionario_id:100,beneficio_id:41,valor_centavos:30000}],
    folhas_pagamento:[{id:46,empresa_id:1,conta_id:32,competencia:'2026-10'}],
    folha_lancamentos:[{id:47,empresa_id:1,folha_id:46,funcionario_id:100,descricao:'Salário'}],
    pagamentos_funcionario:[{id:48,empresa_id:1,funcionario_id:100,folha_id:46,competencia:'2026-10',valor_centavos:250000}],
    pontos_mensais:[{id:49,empresa_id:1,funcionario_id:100,competencia:'2026-10'}],
    ponto_marcacoes:[{id:50,empresa_id:1,ponto_mensal_id:49,data:'2026-10-01'}],
    funcionario_epis:[{id:51,empresa_id:1,funcionario_id:100,epi_id:42,data_entrega:'2026-10-01'}]
  })
  const employeeId=rh.imported.funcionarios[0].targetId
  const payrollId=rh.imported.folhas_pagamento[0].targetId
  const pointId=rh.imported.pontos_mensais[0].targetId
  assert.deepEqual(f.db.prepare('SELECT empresa_id,obra_atual_id,cargo_id FROM funcionarios WHERE id=?').get(employeeId),{
    empresa_id:companyId,obra_atual_id:workId,cargo_id:rh.imported.cargos[0].targetId
  })
  assert.equal(f.db.prepare('SELECT conta_id FROM folhas_pagamento WHERE id=?').get(payrollId).conta_id,accountId)
  assert.equal(f.db.prepare('SELECT ponto_mensal_id FROM ponto_marcacoes WHERE id=?').get(rh.imported.ponto_marcacoes[0].targetId).ponto_mensal_id,pointId)
  assert.equal(f.db.prepare('SELECT funcionario_id FROM rdo_equipe WHERE id=?').get(teamId).funcionario_id,employeeId,'RH deve completar FK diferida da equipe RDO')

  for(const module of Object.keys(MODULES)){
    const status=f.service.status(`${module}-1`)
    assert.equal(status.status,'committed')
    assert.equal(status.sanityOk,true)
    assert.deepEqual(status.counts,counts(module,{
      core:{},operation:{},planning:{},finance:{},rh:{}
    }[module]||{}),`placeholder guard ${module}`)
  }

  assert.equal(f.audit.filter(event=>event.action==='migration_started').length,5)
  assert.equal(f.audit.filter(event=>event.action==='migration_validated').length,5)
  assert.equal(f.audit.filter(event=>event.action==='migration_committed').length,5)
  f.db.close()
})
