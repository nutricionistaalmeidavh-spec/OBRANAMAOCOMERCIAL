export class FieldService {
  constructor({ repository }) {
    this.repository = repository
  }

  saveDailyReport(payload = {}) {
    if (!this.repository?.connection || !this.repository?.save) throw new Error('Repositório central inválido para RDO.')
    const db = this.repository.connection()
    const { equipe = [], equipamentos = [], ocorrencias = [], anexos = [], ...data } = payload
    db.exec('BEGIN IMMEDIATE;')
    try {
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

      for (const row of equipe) {
        this.repository.save('rdo_equipe', {
          ...row,
          rdo_id: rdo.id,
          frente_id: row.frente_id || data.frente_id || null,
          funcionario_id: row.funcionario_id || null,
          horas: Number(row.horas || 0),
          custo_centavos: Number(row.custo_centavos || 0)
        })
      }

      for (const row of equipamentos) {
        this.repository.save('rdo_equipamentos', {
          ...row,
          rdo_id: rdo.id,
          frente_id: row.frente_id || data.frente_id || null,
          horas_uso: Number(row.horas_uso || 0),
          custo_centavos: Number(row.custo_centavos || 0)
        })
      }

      for (const row of ocorrencias) {
        const occurrence = this.repository.save('rdo_ocorrencias', {
          ...row,
          rdo_id: rdo.id,
          frente_id: row.frente_id || data.frente_id || null
        })
        if (row.status !== 'resolvida') {
          this.repository.save('tarefas_obra', {
            obra_id: data.obra_id,
            frente_id: row.frente_id || data.frente_id || null,
            rdo_ocorrencia_id: occurrence.id,
            origem_tipo: 'rdo_ocorrencia',
            origem_id: occurrence.id,
            titulo: `${row.tipo || 'Ocorrencia'}: ${row.descricao}`.slice(0, 180),
            descricao: `Gerada pelo RDO de ${data.data}. ${row.descricao || ''}`.trim(),
            responsavel: row.responsavel || null,
            prazo: row.prazo || null,
            prioridade: row.prioridade || 'normal',
            status: row.status === 'em_andamento' ? 'em_andamento' : 'aberta'
          })
        }
      }

      for (const row of anexos) {
        this.repository.save('rdo_anexos', {
          ...row,
          rdo_id: rdo.id,
          frente_id: row.frente_id || data.frente_id || null
        })
      }

      db.exec('COMMIT;')
      return rdo
    } catch (error) {
      try { db.exec('ROLLBACK;') } catch {}
      throw error
    }
  }
}
