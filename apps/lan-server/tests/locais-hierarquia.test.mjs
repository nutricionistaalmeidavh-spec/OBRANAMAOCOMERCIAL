import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { LanRepository } from '../src/repository.mjs'

function setup() {
  const repository = new LanRepository({ filename: ':memory:' })
  repository.applyMigrations(path.resolve(import.meta.dirname, '../migrations'))
  const company = repository.save('empresas', { razao_social: 'Empresa' })
  const client = repository.save('clientes', { empresa_id: company.id, nome: 'Cliente' })
  const work = repository.save('obras', { empresa_id: company.id, cliente_id: client.id, nome: 'Obra', status: 'ativa' })
  const other = repository.save('obras', { empresa_id: company.id, cliente_id: client.id, nome: 'Outra', status: 'ativa' })
  return { repository, work, other }
}

test('locais em cadeia: pavimento no topo, complementos opcionais dentro', () => {
  const { repository, work, other } = setup()
  try {
    const floor = repository.save('locais_obra', { obra_id: work.id, nome: '1º pavimento', nivel: 1 })
    const apto = repository.save('locais_obra', { obra_id: work.id, nome: 'Apto 101', local_pai_id: floor.id })
    const bath = repository.save('locais_obra', { obra_id: work.id, nome: 'Banheiro', local_pai_id: apto.id })
    repository.save('locais_obra', { obra_id: work.id, nome: 'Canteiro' })
    assert.equal(bath.local_pai_id, apto.id)
    assert.throws(() => repository.save('locais_obra', { obra_id: work.id, nome: 'Mezanino', nivel: 2, local_pai_id: floor.id }), /Pavimento fica direto na obra/)
    assert.throws(() => repository.save('locais_obra', { id: apto.id, obra_id: work.id, nome: 'Apto 101', local_pai_id: bath.id }), /dentro dele mesmo/)
    assert.throws(() => repository.save('locais_obra', { obra_id: other.id, nome: 'X', local_pai_id: floor.id }), /mesma obra/)

    const task = repository.save('tarefas_obra', { obra_id: work.id, titulo: 'Vazamento', local_id: bath.id, status: 'aberta', prioridade: 'normal' })
    assert.equal(task.local_id, bath.id)
    assert.throws(() => repository.save('tarefas_obra', { obra_id: other.id, titulo: 'Errada', local_id: bath.id, status: 'aberta', prioridade: 'normal' }), /mesma obra/)
    const rdo = repository.save('rdos', { obra_id: work.id, data: '2026-11-26' })
    const occurrence = repository.save('rdo_ocorrencias', { rdo_id: rdo.id, tipo: 'qualidade', descricao: 'Infiltração', local_id: apto.id })
    assert.equal(occurrence.local_id, apto.id)
    assert.throws(() => repository.remove('locais_obra', apto.id))
  } finally { repository.close() }
})
