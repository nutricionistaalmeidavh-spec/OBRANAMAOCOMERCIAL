import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'
import { LanRepository } from '../src/repository.mjs'
import { MigrationService } from '../src/migration-service.mjs'

test('RH migrates imported payroll provenance with different central IDs and rolls back only its batch', () => {
  const repository = new LanRepository({ filename: ':memory:' })
  repository.applyMigrations(path.resolve(import.meta.dirname, '../migrations'))
  const service = new MigrationService({ repository })
  const db = repository.connection()
  try {
    const unrelated = repository.save('importacoes', { arquivo: 'existing.xlsx', hash: 'existing', aba: 'Folha' })
    service.start({ migrationId: 'core', module: 'core', sourceFingerprint: 'source', expectedCounts: { empresas: 1 } })
    service.importRecord('core', { sourceTable: 'empresas', sourceId: 100, data: { razao_social: 'Empresa' } })
    service.validate('core'); service.commit('core')
    service.start({ migrationId: 'rh', module: 'rh', sourceFingerprint: 'source', expectedCounts: { funcionarios: 1, importacoes: 1, importacao_linhas: 1, folhas_pagamento: 1, folha_lancamentos: 1 } })
    const add = (sourceTable, sourceId, data) => service.importRecord('rh', { sourceTable, sourceId, data }).targetId
    const employee = add('funcionarios', 800, { empresa_id: 100, nome: 'Funcionário', status: 'ativo' })
    const imported = add('importacoes', 200, { arquivo: 'payroll.xlsx', hash: 'payroll', aba: 'Folha' })
    const line = add('importacao_linhas', 300, { importacao_id: 200, celula: 'B2', tipo: 'salario', dados_brutos: '{}', entidade_tipo: 'funcionarios', entidade_id: 800 })
    add('folhas_pagamento', 400, { empresa_id: 100, competencia: '2026-10' })
    const entry = add('folha_lancamentos', 500, { empresa_id: 100, folha_id: 400, funcionario_id: 800, tipo: 'salario', natureza: 'credito', valor_centavos: 10000, importacao_linha_id: 300 })
    assert.equal(db.prepare('SELECT importacao_linha_id FROM folha_lancamentos WHERE id=?').get(entry).importacao_linha_id, line)
    const audit = db.prepare('SELECT * FROM importacao_linhas WHERE id=?').get(line)
    assert.equal(audit.importacao_id, imported)
    assert.equal(audit.entidade_id, employee)
    assert.equal(JSON.parse(db.prepare("SELECT source_data_json FROM module_migration_records WHERE migration_id='rh' AND source_table='importacao_linhas'").get().source_data_json).entidade_id, 800)
    assert.equal(service.validate('rh').sanityOk, true)
    assert.equal(service.rollback('rh').status, 'rolled_back')
    assert.equal(db.prepare('SELECT COUNT(*) n FROM folha_lancamentos').get().n, 0)
    assert.equal(db.prepare('SELECT COUNT(*) n FROM importacao_linhas').get().n, 0)
    assert.equal(db.prepare('SELECT id FROM importacoes').get().id, unrelated.id)
    assert.equal(service.status('core').status, 'committed')
  } finally { db.close() }
})
