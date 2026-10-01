import assert from 'node:assert/strict'
import test from 'node:test'
import { LanRepository } from '../src/repository.mjs'

test('persistencia central cobre empresas, clientes e obras com relacionamentos', () => {
  const repository = new LanRepository({ filename: ':memory:' })
  try {
    const empresa = repository.save('empresas', { razao_social: 'Empresa A' })
    const cliente = repository.save('clientes', { empresa_id: empresa.id, nome: 'Cliente A' })
    const obra = repository.save('obras', { empresa_id: empresa.id, cliente_id: cliente.id, nome: 'Obra A' })

    assert.equal(empresa.id, 1)
    assert.equal(cliente.empresa_id, empresa.id)
    assert.equal(obra.cliente_id, cliente.id)
    assert.equal(repository.list('empresas').length, 1)
    assert.equal(repository.list('clientes', { empresa_id: empresa.id }).length, 1)
    assert.equal(repository.list('obras', { empresa_id: empresa.id }).length, 1)

    const updated = repository.save('obras', { id: obra.id, nome: 'Obra Atualizada' })
    assert.equal(updated.nome, 'Obra Atualizada')
    assert.equal(updated.empresa_id, empresa.id)

    assert.equal(repository.remove('clientes', cliente.id), true)
    assert.deepEqual(repository.list('clientes', { empresa_id: empresa.id }), [])
    assert.equal(repository.get('clientes', cliente.id)?.id, cliente.id, 'get preserva registro soft-deleted para consistencia referencial')
  } finally {
    repository.close()
  }
})

test('repository rejeita tabelas e campos fora do contrato e respeita FKs', () => {
  const repository = new LanRepository({ filename: ':memory:' })
  try {
    assert.throws(() => repository.list('documentos'), /Entidade não disponível/)
    assert.throws(() => repository.save('empresas', { campo_inexistente: 'x' }), /Nenhum dado válido/)
    assert.throws(() => repository.save('clientes', { empresa_id: 999, nome: 'Órfão' }), /empresa não encontrado|referência|constraint|foreign/i)
  } finally {
    repository.close()
  }
})
