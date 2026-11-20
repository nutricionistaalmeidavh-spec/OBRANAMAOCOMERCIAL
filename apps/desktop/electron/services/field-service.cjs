const { rdoChildRows, rdoOccurrenceTask } = require('./domain-core.cjs')

class FieldService {
  constructor({ db }) { this.db = db }

  saveDailyReport(payload) {
    const { equipe = [], equipamentos = [], ocorrencias = [], anexos = [], ...data } = payload
    return this.db.db.transaction(() => {
      const rdo = this.db.save('rdos', data)

      // Ocorrências e tarefas derivadas são entidades canônicas com histórico próprio:
      // não apague/recrie pendências ao editar horas, equipe ou atividades do RDO.
      const previous = payload.id
        ? this.db.db.prepare('SELECT * FROM rdo_ocorrencias WHERE rdo_id=?').all(rdo.id)
        : []
      const previousById = new Map(previous.map(row => [Number(row.id), row]))
      const keptOccurrenceIds = new Set()

      if (payload.id) {
        this.db.db.prepare('DELETE FROM rdo_equipe WHERE rdo_id=?').run(rdo.id)
        this.db.db.prepare('DELETE FROM rdo_equipamentos WHERE rdo_id=?').run(rdo.id)
        this.db.db.prepare('DELETE FROM rdo_anexos WHERE rdo_id=?').run(rdo.id)
      }
      for (const row of rdoChildRows(equipe, rdo.id, data.frente_id, 'equipe')) this.db.save('rdo_equipe', row)
      for (const row of rdoChildRows(equipamentos, rdo.id, data.frente_id, 'equipamentos')) this.db.save('rdo_equipamentos', row)

      for (const row of rdoChildRows(ocorrencias, rdo.id, data.frente_id, 'ocorrencias')) {
        const sourceId = Number(row.id || 0)
        const oldOccurrence = sourceId ? previousById.get(sourceId) : null
        if (sourceId && !oldOccurrence) throw new Error('Ocorrência não pertence a este Diário de obra.')
        if (oldOccurrence && keptOccurrenceIds.has(sourceId)) throw new Error('Ocorrência duplicada no Diário de obra.')

        const occurrence = this.db.save('rdo_ocorrencias', { ...row, ...(oldOccurrence ? { id: sourceId } : {}) })
        keptOccurrenceIds.add(Number(occurrence.id))

        const oldTask = oldOccurrence
          ? this.db.db.prepare("SELECT * FROM tarefas_obra WHERE rdo_ocorrencia_id=? AND deleted_at IS NULL ORDER BY id LIMIT 1").get(occurrence.id)
          : null
        const newTask = rdoOccurrenceTask(row, data, occurrence.id)
        if (!newTask) {
          if (oldTask) this.db.db.prepare("UPDATE tarefas_obra SET deleted_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?").run(oldTask.id)
          continue
        }
        if (!oldTask) {
          this.db.save('tarefas_obra', newTask)
          continue
        }
        const changed = (field) => String(row[field] ?? '') !== String(oldOccurrence[field] ?? '')
        const status = changed('status') ? newTask.status : oldTask.status
        this.db.save('tarefas_obra', {
          ...newTask,
          id: oldTask.id,
          responsavel: changed('responsavel') ? newTask.responsavel : oldTask.responsavel,
          prazo: changed('prazo') ? newTask.prazo : oldTask.prazo,
          prioridade: changed('prioridade') ? newTask.prioridade : oldTask.prioridade,
          status,
          concluido_em: status === 'concluida' ? oldTask.concluido_em : null
        })
      }
      // Excluir apenas ocorrências que o usuário realmente retirou do RDO.
      for (const old of previous) {
        if (keptOccurrenceIds.has(Number(old.id))) continue
        this.db.db.prepare("UPDATE tarefas_obra SET deleted_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE rdo_ocorrencia_id=? AND deleted_at IS NULL").run(old.id)
        this.db.db.prepare('DELETE FROM rdo_ocorrencias WHERE id=? AND rdo_id=?').run(old.id, rdo.id)
      }

      for (const row of rdoChildRows(anexos, rdo.id, data.frente_id, 'anexos')) this.db.save('rdo_anexos', row)

      this.db.audit('rdos', rdo.id, payload.id ? 'atualizar_rdo' : 'registrar_rdo', {
        obra_id: Number(data.obra_id),
        frente_id: data.frente_id || null,
        equipe: equipe.length,
        equipamentos: equipamentos.length,
        ocorrencias: ocorrencias.length,
        anexos: anexos.length
      })
      return rdo
    })()
  }
}

module.exports = { FieldService }
