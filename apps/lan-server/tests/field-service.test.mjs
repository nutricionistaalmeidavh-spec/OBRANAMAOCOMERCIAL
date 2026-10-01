import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { LanRepository } from '../src/repository.mjs'
import { FieldService } from '../src/field-service.mjs'

const migrationsDir = path.resolve(import.meta.dirname, '../migrations')

function fixture() {
  const repository = new LanRepository({ filename: ':memory:' })
  repository.applyMigrations(migrationsDir)
  const company = repository.save('empresas', { razao_social: 'Empresa Campo' })
  const work = repository.save('obras', { empresa_id: company.id, nome: 'Obra Campo' })
  const front = repository.save('frentes_obra', { obra_id: work.id, nome: 'Torre A' })
  const field = new FieldService({ repository })
  return { repository, company, work, front, field }
}

function payload(f, overrides = {}) {
  return {
    obra_id: f.work.id,
    frente_id: f.front.id,
    data: '2026-09-30',
    clima: 'seco',
    status: 'rascunho',
    atividades: 'Instalação hidráulica',
    observacoes: 'Primeiro RDO',
    equipe: [{ funcionario_id: 99, nome: 'João', funcao: 'Encanador', horas: 8, custo_centavos: 24000 }],
    equipamentos: [{ nome: 'Martelete', horas_uso: 2, custo_centavos: 5000 }],
    ocorrencias: [{ tipo: 'pendencia', descricao: 'Revisar prumada', status: 'aberta', prioridade: 'alta', responsavel: 'Victor' }],
    anexos: [{ documento_id: 123, legenda: 'Foto do shaft' }],
    ...overrides
  }
}

function children(db, rdoId) {
  return {
    equipe: db.prepare('SELECT * FROM rdo_equipe WHERE rdo_id=? ORDER BY id').all(rdoId),
    equipamentos: db.prepare('SELECT * FROM rdo_equipamentos WHERE rdo_id=? ORDER BY id').all(rdoId),
    ocorrencias: db.prepare('SELECT * FROM rdo_ocorrencias WHERE rdo_id=? ORDER BY id').all(rdoId),
    anexos: db.prepare('SELECT * FROM rdo_anexos WHERE rdo_id=? ORDER BY id').all(rdoId)
  }
}

test('cria RDO, filhos e tarefa da ocorrência em uma única operação', () => {
  const f = fixture()
  try {
    const rdo = f.field.saveDailyReport(payload(f))
    const rows = children(f.repository.connection(), rdo.id)
    assert.equal(rows.equipe.length, 1)
    assert.equal(rows.equipe[0].frente_id, f.front.id)
    assert.equal(rows.equipamentos.length, 1)
    assert.equal(rows.ocorrencias.length, 1)
    assert.equal(rows.anexos.length, 1)

    const tasks = f.repository.list('tarefas_obra', { obra_id: f.work.id })
    assert.equal(tasks.length, 1)
    assert.equal(tasks[0].rdo_ocorrencia_id, rows.ocorrencias[0].id)
    assert.equal(tasks[0].origem_tipo, 'rdo_ocorrencia')
    assert.match(tasks[0].titulo, /Revisar prumada/)
  } finally { f.repository.close() }
})

test('editar RDO substitui filhos e remove logicamente tarefas das ocorrências antigas', () => {
  const f = fixture()
  try {
    const original = f.field.saveDailyReport(payload(f))
    const oldOccurrence = children(f.repository.connection(), original.id).ocorrencias[0]
    const oldTask = f.repository.connection().prepare('SELECT * FROM tarefas_obra WHERE rdo_ocorrencia_id=?').get(oldOccurrence.id)

    const updated = f.field.saveDailyReport(payload(f, {
      id: original.id,
      atividades: 'Atividade revisada',
      equipe: [{ nome: 'Maria', funcao: 'Ajudante', horas: 6 }],
      equipamentos: [],
      ocorrencias: [{ tipo: 'qualidade', descricao: 'Conferir teste', status: 'em_andamento' }],
      anexos: []
    }))

    assert.equal(updated.id, original.id)
    assert.equal(updated.atividades, 'Atividade revisada')
    const rows = children(f.repository.connection(), updated.id)
    assert.equal(rows.equipe.length, 1)
    assert.equal(rows.equipe[0].nome, 'Maria')
    assert.equal(rows.equipamentos.length, 0)
    assert.equal(rows.ocorrencias.length, 1)
    assert.equal(rows.ocorrencias[0].descricao, 'Conferir teste')
    assert.equal(rows.anexos.length, 0)

    const staleTask = f.repository.connection().prepare('SELECT * FROM tarefas_obra WHERE id=?').get(oldTask.id)
    assert.ok(staleTask.deleted_at)
    const activeTasks = f.repository.list('tarefas_obra', { obra_id: f.work.id })
    assert.equal(activeTasks.length, 1)
    assert.equal(activeTasks[0].rdo_ocorrencia_id, rows.ocorrencias[0].id)
  } finally { f.repository.close() }
})

test('ocorrência resolvida não gera nova tarefa', () => {
  const f = fixture()
  try {
    f.field.saveDailyReport(payload(f, { ocorrencias: [{ tipo: 'qualidade', descricao: 'Resolvida', status: 'resolvida' }] }))
    assert.equal(f.repository.list('tarefas_obra', { obra_id: f.work.id }).length, 0)
  } finally { f.repository.close() }
})

test('falha em um filho reverte RDO e todos os filhos da transação', () => {
  const f = fixture()
  try {
    const beforeRdos = f.repository.list('rdos', { obra_id: f.work.id }).length
    assert.throws(() => f.field.saveDailyReport(payload(f, {
      data: '2026-10-01',
      equipe: [{ nome: null, horas: 8 }]
    })))
    assert.equal(f.repository.list('rdos', { obra_id: f.work.id }).length, beforeRdos)
    assert.equal(f.repository.connection().prepare('SELECT COUNT(*) AS n FROM rdo_equipe').get().n, 0)
    assert.equal(f.repository.connection().prepare('SELECT COUNT(*) AS n FROM tarefas_obra').get().n, 0)
  } finally { f.repository.close() }
})
