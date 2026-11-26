import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { LanRepository } from '../src/repository.mjs'
import locationIntegrity from '../src/location-integrity.cjs'

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

    // Counts: open pendências + open occurrences not yet a pendência, rolled up the chain.
    repository.save('tarefas_obra', { obra_id: work.id, titulo: 'Feita', local_id: bath.id, status: 'concluida', prioridade: 'normal' })
    const converted = repository.save('rdo_ocorrencias', { rdo_id: rdo.id, tipo: 'atraso', descricao: 'Virou pendência', local_id: bath.id })
    repository.save('tarefas_obra', { obra_id: work.id, titulo: 'Da ocorrência', local_id: bath.id, rdo_ocorrencia_id: converted.id, status: 'aberta', prioridade: 'normal' })
    const counts = locationIntegrity.locationCounts(repository.connection(), work.id)
    assert.deepEqual(counts.byLocal[bath.id], { tasks: 2, occurrences: 0, own: 2, total: 2 })
    assert.deepEqual(counts.byLocal[apto.id], { tasks: 0, occurrences: 1, own: 1, total: 3 })
    assert.equal(counts.byLocal[floor.id].total, 3)
    const team = repository.save('rdo_equipe', { rdo_id: rdo.id, nome: 'Equipe', local_id: apto.id, horas: 8 })
    assert.equal(team.local_id, apto.id)
    const otherRdo = repository.save('rdos', { obra_id: other.id, data: '2026-11-26' })
    assert.throws(() => repository.save('rdo_equipe', { rdo_id: otherRdo.id, nome: 'X', local_id: apto.id, horas: 1 }), /mesma obra/)
  } finally { repository.close() }
})
