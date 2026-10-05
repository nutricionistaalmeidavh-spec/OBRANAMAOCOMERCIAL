import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { LanRepository } from '../src/repository.mjs'
import { applyLanMigrations } from '../src/migrations.mjs'

const migrationsDir = path.resolve(import.meta.dirname, '../migrations')
const migratedTables = [
  'locais_obra', 'frentes_obra', 'subfrentes_obra', 'checklist_frente_itens', 'tarefas_obra', 'rdos', 'rdo_equipe', 'rdo_equipamentos', 'rdo_ocorrencias', 'rdo_anexos',
  'etapas_obra', 'cronograma_etapas', 'itens_orcamentarios', 'medicoes', 'medicao_itens', 'medicao_mapa_itens',
  'fornecedores', 'categorias_financeiras', 'contas', 'pagamentos_conta', 'solicitacoes_compra', 'cotacoes_compra', 'pedidos_compra', 'pedido_compra_itens', 'recebimentos_materiais', 'movimentacoes_estoque', 'contratos_obra', 'contrato_aditivos',
  'funcionarios', 'funcionario_obras', 'cargos', 'beneficios', 'cargo_beneficios', 'funcionario_beneficios',
  'folhas_pagamento', 'folha_lancamentos', 'pagamentos_funcionario', 'pontos_mensais', 'ponto_marcacoes', 'epis', 'funcionario_epis',
  'module_migrations', 'module_migration_records', 'record_revisions',
  'fontes_documentais', 'arquivos', 'documentos', 'medicao_anexos', 'contrato_anexos', 'pedido_compra_anexos', 'documentos_editaveis', 'modelos_documento_rh'
]

test('aplica schema LAN atual de forma idempotente e preserva core ao reabrir', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'obra-lan-migrations-'))
  const filename = path.join(dir, 'central.sqlite')
  let repository = new LanRepository({ filename })
  const company = repository.save('empresas', { razao_social: 'Empresa preservada' })

  const first = applyLanMigrations(repository.connection(), migrationsDir)
  const second = applyLanMigrations(repository.connection(), migrationsDir)

  assert.equal(first.version, 26)
  assert.equal(second.version, first.version)
  assert.deepEqual(first.applied, [2, 3, 4, 5, 6, 20, 21, 22, 23, 24, 25, 26])
  assert.deepEqual(second.applied, [])
  assert.equal(repository.connection().prepare('PRAGMA user_version').get().user_version, 26)
  for (const table of migratedTables) {
    assert.equal(repository.connection().prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name=?").get(table).n, 1)
  }
  assert.equal(repository.connection().prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='index' AND name='idx_rdos_obra_frente_data'").get().n, 1)
  assert.equal(repository.connection().prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='index' AND name='idx_cronograma_obra_frente'").get().n, 1)
  assert.equal(repository.connection().prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='index' AND name='idx_contas_empresa_obra'").get().n, 1)
  assert.equal(repository.connection().prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='index' AND name='idx_rh_funcionarios_empresa_status'").get().n, 1)
  assert.equal(repository.connection().prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='index' AND name='idx_record_revisions_updated_at'").get().n, 1)
  repository.close()

  repository = new LanRepository({ filename })
  const reopened = applyLanMigrations(repository.connection(), migrationsDir)
  assert.equal(reopened.version, first.version)
  assert.deepEqual(reopened.applied, [])
  assert.equal(repository.get('empresas', company.id).razao_social, 'Empresa preservada')
  repository.close()
  fs.rmSync(dir, { recursive: true, force: true })
})
