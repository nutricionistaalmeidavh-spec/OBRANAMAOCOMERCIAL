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

      for (const row of equipe) {
        this.db.save('rdo_equipe', {
          ...row,
          rdo_id: rdo.id,
          frente_id: row.frente_id || data.frente_id || null,
          funcionario_id: row.funcionario_id || null,
          horas: Number(row.horas || 0),
          custo_centavos: Number(row.custo_centavos || 0)
        })
      }

      for (const row of equipamentos) {
        this.db.save('rdo_equipamentos', {
          ...row,
          rdo_id: rdo.id,
          frente_id: row.frente_id || data.frente_id || null,
          horas_uso: Number(row.horas_uso || 0),
          custo_centavos: Number(row.custo_centavos || 0)
        })
      }

      for (const row of ocorrencias) {
        const occurrence = this.db.save('rdo_ocorrencias', {
          ...row,
          rdo_id: rdo.id,
          frente_id: row.frente_id || data.frente_id || null
        })
        if (row.status !== 'resolvida') {
          this.db.save('tarefas_obra', {
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
        this.db.save('rdo_anexos', { ...row, rdo_id: rdo.id, frente_id: row.frente_id || data.frente_id || null })
      }

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
