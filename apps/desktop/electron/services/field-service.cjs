const { rdoChildRows, rdoOccurrenceTask } = require('./domain-core.cjs')

class FieldService {
  constructor({ db }) { this.db = db }

  saveDailyReport(payload) {
    const { equipe = [], equipamentos = [], ocorrencias = [], anexos = [], ...data } = payload
    return this.db.db.transaction(() => {
      const rdo = this.db.save('rdos', data)

      if (payload.id) {
        const occurrenceIds = this.db.db.prepare('SELECT id FROM rdo_ocorrencias WHERE rdo_id=?').all(rdo.id).map((row) => row.id)
        for (const id of occurrenceIds) {
          this.db.db.prepare("UPDATE tarefas_obra SET deleted_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE rdo_ocorrencia_id=? AND deleted_at IS NULL").run(id)
        }
        this.db.db.prepare('DELETE FROM rdo_equipe WHERE rdo_id=?').run(rdo.id)
        this.db.db.prepare('DELETE FROM rdo_equipamentos WHERE rdo_id=?').run(rdo.id)
        this.db.db.prepare('DELETE FROM rdo_ocorrencias WHERE rdo_id=?').run(rdo.id)
        this.db.db.prepare('DELETE FROM rdo_anexos WHERE rdo_id=?').run(rdo.id)
      }

      for (const row of rdoChildRows(equipe, rdo.id, data.frente_id, 'equipe')) this.db.save('rdo_equipe', row)
      for (const row of rdoChildRows(equipamentos, rdo.id, data.frente_id, 'equipamentos')) this.db.save('rdo_equipamentos', row)

      for (const row of rdoChildRows(ocorrencias, rdo.id, data.frente_id, 'ocorrencias')) {
        const occurrence = this.db.save('rdo_ocorrencias', row)
        const task = rdoOccurrenceTask(row, data, occurrence.id)
        if (task) this.db.save('tarefas_obra', task)
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
