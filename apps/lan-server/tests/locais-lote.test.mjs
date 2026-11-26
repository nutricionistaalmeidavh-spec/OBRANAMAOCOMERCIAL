import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { LanRepository } from '../src/repository.mjs'
import batchModule from '../src/location-batch.cjs'

const { batchLocations, applyLocationBatch } = batchModule

function setup() {
  const repository = new LanRepository({ filename: ':memory:' })
  repository.applyMigrations(path.resolve(import.meta.dirname, '../migrations'))
  const company = repository.save('empresas', { razao_social: 'Empresa' })
  const client = repository.save('clientes', { empresa_id: company.id, nome: 'Cliente' })
  const work = repository.save('obras', { empresa_id: company.id, cliente_id: client.id, nome: 'Torre', status: 'ativa' })
  const db = repository.connection()
  return { repository, work, db, store: { db, save: (t, d) => repository.save(t, d) } }
}

const spec = { criarPavimentos: true, faixas: [
  { de: 1, ate: 24, unidades: 8, padrao: 'numero', prefixo: 'Apto', duplex: false, ambientes: '' },
  { de: 25, ate: 26, unidades: 2, padrao: 'numero', prefixo: 'Apto', duplex: true, ambientes: 'Sala, Cozinha' },
] }

test('lote: 1º ao 24º com 8 por andar e duplex no 25º/26º', () => {
  const { repository, work, db, store } = setup()
  try {
    const preview = batchLocations(store, work.id, spec, { dryRun: true })
    assert.deepEqual({ f: preview.floors, u: preview.units, up: preview.upper, r: preview.rooms }, { f: 26, u: 194, up: 2, r: 4 })
    assert.equal(db.prepare('SELECT COUNT(*) n FROM locais_obra').get().n, 0)

    const applied = applyLocationBatch(store, work.id, spec)
    assert.equal(applied.total, 226)
    const names = db.prepare("SELECT l.nome, p.nome AS pai FROM locais_obra l LEFT JOIN locais_obra p ON p.id=l.local_pai_id WHERE l.nome IN ('Apto 101','Apto 2408','Apto 2501','Apto 2501 — piso superior','Sala')").all().map(r => ({ ...r }))
    assert.deepEqual(names.sort((a, b) => a.nome.localeCompare(b.nome)), [
      { nome: 'Apto 101', pai: '1º pavimento' }, { nome: 'Apto 2408', pai: '24º pavimento' },
      { nome: 'Apto 2501', pai: '25º pavimento' }, { nome: 'Apto 2501 — piso superior', pai: '26º pavimento' },
      { nome: 'Sala', pai: 'Apto 2501' }, { nome: 'Sala', pai: 'Apto 2502' },
    ].sort((a, b) => a.nome.localeCompare(b.nome)))

    const again = batchLocations(store, work.id, spec, { dryRun: true })
    assert.equal(again.total, 0)
    assert.equal(again.existing, 200)
    assert.throws(() => batchLocations(store, work.id, { faixas: [{ de: 25, ate: 27, unidades: 2, duplex: true }] }), /número par/)
  } finally { repository.close() }
})
