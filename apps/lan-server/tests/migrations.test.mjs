import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { LanRepository } from '../src/repository.mjs'
import { applyLanMigrations } from '../src/migrations.mjs'

const migrationsDir = path.resolve(import.meta.dirname, '../migrations')
const migratedTables = [
  'frentes_obra',
  'tarefas_obra',
  'rdos',
  'rdo_equipe',
  'rdo_equipamentos',
  'rdo_ocorrencias',
  'rdo_anexos',
  'etapas_obra',
  'cronograma_etapas',
  'itens_orcamentarios'
]

test('aplica schema LAN atual de forma idempotente e preserva core ao reabrir', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'obra-lan-migrations-'))
  const filename = path.join(dir, 'central.sqlite')
  let repository = new LanRepository({ filename })
  const company = repository.save('empresas', { razao_social: 'Empresa preservada' })

  const first = applyLanMigrations(repository.connection(), migrationsDir)
  const second = applyLanMigrations(repository.connection(), migrationsDir)

  assert.equal(first.version, 3)
  assert.equal(second.version, 3)
  assert.deepEqual(first.applied, [2, 3])
  assert.deepEqual(second.applied, [])
  assert.equal(repository.connection().prepare('PRAGMA user_version').get().user_version, 3)
  for (const table of migratedTables) {
    assert.equal(repository.connection().prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name=?").get(table).n, 1)
  }
  assert.equal(repository.connection().prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='index' AND name='idx_rdos_obra_frente_data'").get().n, 1)
  assert.equal(repository.connection().prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='index' AND name='idx_cronograma_obra_frente'").get().n, 1)
  repository.close()

  repository = new LanRepository({ filename })
  const reopened = applyLanMigrations(repository.connection(), migrationsDir)
  assert.equal(reopened.version, 3)
  assert.deepEqual(reopened.applied, [])
  assert.equal(repository.get('empresas', company.id).razao_social, 'Empresa preservada')
  repository.close()
  fs.rmSync(dir, { recursive: true, force: true })
})
