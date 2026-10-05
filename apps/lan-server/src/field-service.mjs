import domainCore from './domain-core.cjs'
const { rdoChildRows, rdoOccurrenceTask } = domainCore
import { ConcurrencyService } from './concurrency-service.mjs'

export class FieldService {
  constructor({ repository }) {
    this.repository = repository
    this.concurrency = new ConcurrencyService({ db: repository.connection() })
  }

  saveDailyReport(payload = {}) {
    if (!this.repository?.connection || !this.repository?.save) throw new Error('Repositório central inválido para RDO.')
    const db = this.repository.connection()
    const { expectedRevision, equipe = [], equipamentos = [], ocorrencias = [], anexos = [], ...data } = payload
    db.exec('BEGIN IMMEDIATE;')
    try {
      if (data.id) {
        const current = this.repository.get('rdos', Number(data.id))
        if (!current) throw new Error('RDO central não encontrado.')
        const observed = this.concurrency.current('rdos', current.id) || this.concurrency.initialize('rdos', current.id)
        this.concurrency.assertExpected('rdos', current.id, expectedRevision, { ...current, revision: observed })
      }

      const rdo = this.repository.save('rdos', data)
      if (!rdo) throw new Error('RDO central não encontrado.')

      if (payload.id) {
        const occurrenceIds = db.prepare('SELECT id FROM rdo_ocorrencias WHERE rdo_id=?').all(rdo.id).map(row => row.id)
        for (const id of occurrenceIds) {
          db.prepare("UPDATE tarefas_obra SET deleted_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE rdo_ocorrencia_id=? AND deleted_at IS NULL").run(id)
        }
        db.prepare('DELETE FROM rdo_equipe WHERE rdo_id=?').run(rdo.id)
        db.prepare('DELETE FROM rdo_equipamentos WHERE rdo_id=?').run(rdo.id)
        db.prepare('DELETE FROM rdo_ocorrencias WHERE rdo_id=?').run(rdo.id)
        db.prepare('DELETE FROM rdo_anexos WHERE rdo_id=?').run(rdo.id)
      }

      for (const row of rdoChildRows(equipe, rdo.id, data.frente_id, 'equipe')) this.repository.save('rdo_equipe', row)
      for (const row of rdoChildRows(equipamentos, rdo.id, data.frente_id, 'equipamentos')) this.repository.save('rdo_equipamentos', row)

      for (const row of rdoChildRows(ocorrencias, rdo.id, data.frente_id, 'ocorrencias')) {
        const occurrence = this.repository.save('rdo_ocorrencias', row)
        const task = rdoOccurrenceTask(row, data, occurrence.id)
        if (task) this.repository.save('tarefas_obra', task)
      }

      for (const row of rdoChildRows(anexos, rdo.id, data.frente_id, 'anexos')) this.repository.save('rdo_anexos', row)

      const revision = payload.id
        ? this.concurrency.bump('rdos', rdo.id)
        : this.concurrency.initialize('rdos', rdo.id)
      db.exec('COMMIT;')
      return { ...rdo, revision }
    } catch (error) {
      try { db.exec('ROLLBACK;') } catch {}
      throw error
    }
  }
}
