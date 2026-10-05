import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { LanRepository } from '../src/repository.mjs'
import { createVersionedRepository } from '../src/versioned-repository.mjs'

const migrationsDir = path.resolve(import.meta.dirname, '../migrations')

function fixture() {
  const repository = new LanRepository({ filename:':memory:' })
  repository.applyMigrations(migrationsDir)
  const company = repository.save('empresas', { razao_social:'Empresa Operação' })
  const workA = repository.save('obras', { empresa_id:company.id, nome:'Obra A' })
  const workB = repository.save('obras', { empresa_id:company.id, nome:'Obra B' })
  const frontA = repository.save('frentes_obra', { obra_id:workA.id, nome:'Hidráulica' })
  const frontB = repository.save('frentes_obra', { obra_id:workB.id, nome:'Elétrica' })
  return { repository, versioned:createVersionedRepository(repository), company, workA, workB, frontA, frontB }
}

test('subfrente e checklist centrais preservam obra/frente canônicas', () => {
  const f = fixture()
  try {
    const sub = f.versioned.create('subfrentes_obra', { obra_id:f.workA.id, frente_id:f.frontA.id, nome:'Prumadas', pavimento:'Geral' })
    assert.equal(sub.revision, 1)
    const item = f.versioned.create('checklist_frente_itens', {
      obra_id:f.workA.id, frente_id:f.frontA.id, subfrente_id:sub.id, descricao:'Teste estanqueidade', prazo:'2026-10-10'
    })
    assert.equal(item.subfrente_id, sub.id)
    assert.equal(item.revision, 1)
    assert.throws(() => f.versioned.create('checklist_frente_itens', {
      obra_id:f.workB.id, frente_id:f.frontB.id, subfrente_id:sub.id, descricao:'Inválido'
    }), /mesma frente e obra/i)
  } finally { f.repository.close() }
})

test('subfrente com checklist não pode ser movida para outra frente', () => {
  const f = fixture()
  try {
    const sub = f.versioned.create('subfrentes_obra', { obra_id:f.workA.id, frente_id:f.frontA.id, nome:'Ramais' })
    f.versioned.create('checklist_frente_itens', { obra_id:f.workA.id, frente_id:f.frontA.id, subfrente_id:sub.id, descricao:'Conferir ramais' })
    assert.throws(() => f.versioned.update('subfrentes_obra', sub.id, sub.revision, {
      obra_id:f.workB.id, frente_id:f.frontB.id
    }), /possui checklist/i)
  } finally { f.repository.close() }
})
