const crypto = require('node:crypto')

const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
const rec = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {}
const DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Applies what the field team records on the phone to the Desktop's canonical owners.
 * - Issues (pendências) become tasks of the work, idempotently; resolving on the
 *   phone completes the task.
 * - Attendance and compensations are staged for review in the Ponto: payroll data
 *   is never changed without the office confirming.
 * People are matched only by the stable field identity published by the Desktop
 * (rdo_emp_*), never by name.
 */
class FieldInbox {
  constructor({ database, peopleFor }) {
    this.database = database
    this.db = database.db
    this.peopleFor = peopleFor
  }

  available() {
    try { return !!this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='field_inbox'").get() } catch { return false }
  }

  row(scope, kind, key) {
    return this.db.prepare('SELECT * FROM field_inbox WHERE remote_project_id=? AND kind=? AND remote_key=?').get(String(scope.remoteProjectId), kind, String(key))
  }

  upsert(scope, kind, key, payload, defaults = {}) {
    const digest = hash(payload), current = this.row(scope, kind, key)
    if (!current) {
      this.db.prepare('INSERT INTO field_inbox(remote_project_id,work_id,kind,remote_key,payload_json,payload_hash,status,local_table,local_id,message) VALUES(?,?,?,?,?,?,?,?,?,?)')
        .run(String(scope.remoteProjectId), Number(scope.workId), kind, String(key), JSON.stringify(payload), digest, defaults.status || 'pending', defaults.localTable || null, defaults.localId || null, defaults.message || null)
      return { created: true, row: this.row(scope, kind, key) }
    }
    if (current.payload_hash === digest) return { created: false, changed: false, row: current }
    return { created: false, changed: true, row: current, digest }
  }

  /** @param applyTasks true only when the work's tasks live in this local base. */
  apply(scope, snapshot, { applyTasks = false } = {}) {
    if (!this.available() || !scope?.remoteProjectId) return { issues: 0, staged: 0 }
    const state = rec(snapshot)
    let issues = 0, staged = 0
    this.db.exec('BEGIN IMMEDIATE')
    try {
      for (const issue of Array.isArray(state.issues) ? state.issues : []) {
        const item = rec(issue), id = String(item.id || '')
        if (!id) continue
        const payload = { title: String(item.title || 'Pendência').slice(0, 200), reason: String(item.reason || '').slice(0, 2000), type: String(item.type || ''), floor: item.floor ?? null, service: String(item.service || ''), status: item.status === 'resolved' ? 'resolved' : 'open', external: !!item.external }
        const result = this.upsert(scope, 'issue', id, payload)
        if (!applyTasks) { if (result.changed) this.db.prepare("UPDATE field_inbox SET payload_json=?,payload_hash=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(JSON.stringify(payload), result.digest, result.row.id); continue }
        if (result.created || (result.row.status === 'pending' && !result.row.local_id)) {
          const task = this.database.save('tarefas_obra', {
            obra_id: Number(scope.workId), titulo: payload.title,
            descricao: [payload.reason, payload.external ? 'Responsabilidade externa.' : '', 'Registrada no celular (Obra360).'].filter(Boolean).join('\n'),
            prioridade: payload.type === 'blocked' ? 'alta' : 'normal', status: payload.status === 'resolved' ? 'concluida' : 'aberta'
          })
          this.db.prepare("UPDATE field_inbox SET status='applied',local_table='tarefas_obra',local_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(task.id, result.row.id)
          issues++
        } else if (result.changed && result.row.local_id) {
          const task = this.database.get('tarefas_obra', Number(result.row.local_id))
          const previous = JSON.parse(result.row.payload_json || '{}')
          if (task && !task.deleted_at && previous.status !== payload.status && ['aberta', 'concluida'].includes(task.status))
            this.database.save('tarefas_obra', { id: task.id, status: payload.status === 'resolved' ? 'concluida' : 'aberta' })
          this.db.prepare('UPDATE field_inbox SET payload_json=?,payload_hash=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(JSON.stringify(payload), result.digest, result.row.id)
        }
      }
      const people = this.peopleFor(scope)
      const byId = new Map(people.map(person => [person.id, person]))
      const legacy = new Map((Array.isArray(state.employees) ? state.employees : []).map(e => [String(rec(e).id || ''), String(rec(e).name || '')]))
      for (const [date, value] of Object.entries(rec(state.days))) {
        if (!DATE.test(date)) continue
        const day = rec(value)
        for (const [employeeId, status] of Object.entries(rec(day.attendance))) {
          if (!['present', 'absent'].includes(status)) continue
          const person = byId.get(employeeId)
          const payload = { date, employeeId, status, funcionarioId: person?.localId ?? null, name: person?.name || legacy.get(employeeId) || 'Funcionário do celular' }
          staged += this.stage(scope, 'attendance', `${date}:${employeeId}`, payload)
        }
        for (const event of Array.isArray(day.events) ? day.events : []) {
          const item = rec(event)
          if (item.kind !== 'compensation' || !item.id) continue
          const employeeId = String(item.employeeId || ''), person = byId.get(employeeId)
          const payload = { date: DATE.test(String(item.date || '')) ? String(item.date) : date, employeeId, status: 'compensation', funcionarioId: person?.localId ?? null, name: person?.name || legacy.get(employeeId) || 'Funcionário do celular' }
          staged += this.stage(scope, 'compensation', String(item.id), payload)
        }
      }
      this.db.exec('COMMIT')
    } catch (error) { this.db.exec('ROLLBACK'); throw error }
    return { issues, staged }
  }

  stage(scope, kind, key, payload) {
    const result = this.upsert(scope, kind, key, payload)
    if (result.created) return 1
    if (!result.changed) return 0
    // A change on the phone after review goes back to the office.
    this.db.prepare("UPDATE field_inbox SET payload_json=?,payload_hash=?,status='pending',message=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
      .run(JSON.stringify(payload), result.digest, result.row.status === 'applied' ? 'Alterado no celular depois do lançamento; confira de novo.' : null, result.row.id)
    return 1
  }

  pending(workIds) {
    if (!this.available()) return []
    const ids = (workIds || []).map(Number).filter(Number.isSafeInteger)
    if (!ids.length) return []
    const rows = this.db.prepare(`SELECT * FROM field_inbox WHERE status='pending' AND work_id IN (${ids.map(() => '?').join(',')}) ORDER BY kind, created_at LIMIT 300`).all(...ids)
    return rows.map(row => ({ id: row.id, kind: row.kind, workId: row.work_id, message: row.message, ...JSON.parse(row.payload_json) }))
  }

  get(id) {
    const row = this.available() ? this.db.prepare('SELECT * FROM field_inbox WHERE id=?').get(Number(id)) : null
    return row ? { ...row, payload: JSON.parse(row.payload_json) } : null
  }

  /** Office confirmation: creates the task, or writes the reviewed day into the canonical Ponto. */
  applyItem({ id, funcionarioId, overwrite = false, workIds = [] }, timeService) {
    const row = this.get(id)
    if (!row || row.status !== 'pending' || !workIds.map(Number).includes(Number(row.work_id))) throw new Error('Registro do celular não encontrado ou já conferido.')
    const payload = row.payload
    if (row.kind === 'issue') {
      const task = this.database.save('tarefas_obra', { obra_id: Number(row.work_id), titulo: String(payload.title || 'Pendência').slice(0, 200), descricao: [payload.reason, 'Registrada no celular (Obra360).'].filter(Boolean).join('\n'), prioridade: payload.type === 'blocked' ? 'alta' : 'normal', status: payload.status === 'resolved' ? 'concluida' : 'aberta' })
      this.mark(id, 'applied', { localTable: 'tarefas_obra', localId: task.id })
      return { ok: true, taskId: task.id }
    }
    const employeeId = Number(payload.funcionarioId || funcionarioId)
    const employee = Number.isSafeInteger(employeeId) ? this.database.get('funcionarios', employeeId) : null
    const work = this.database.get('obras', Number(row.work_id))
    if (!employee || employee.deleted_at || !work || Number(employee.empresa_id) !== Number(work.empresa_id)) throw new Error('Escolha o funcionário desta empresa que corresponde ao registro do celular.')
    const competencia = String(payload.date).slice(0, 7), current = timeService.get({ funcionario_id: employee.id, competencia })
    const tipo = payload.status === 'present' ? 'trabalho' : payload.status === 'absent' ? 'falta' : 'folga'
    const existing = (current.marks || []).find(mark => mark.data === payload.date)
    // Never overwrite what the office already marked without an explicit confirmation.
    if (existing && existing.tipo !== tipo && !overwrite) throw Object.assign(new Error(`O ponto de ${employee.nome} já tem "${existing.tipo}" neste dia. Confirme para substituir.`), { code: 'PONTO_EXISTS' })
    const point = current.point || {}
    const note = payload.status === 'present' ? 'Presença registrada no celular (Obra360).' : payload.status === 'absent' ? 'Falta registrada no celular (Obra360).' : 'Compensação registrada no celular (Obra360).'
    const mark = tipo === 'trabalho'
      ? { data: payload.date, tipo, entrada: existing?.entrada || point.jornada_inicio, intervalo_saida: existing?.intervalo_saida || point.intervalo_inicio, intervalo_entrada: existing?.intervalo_entrada || point.intervalo_fim, saida: existing?.saida || point.jornada_fim, observacoes: existing?.observacoes || note }
      : { data: payload.date, tipo, observacoes: note }
    timeService.save({ funcionario_id: employee.id, competencia, marks: [mark] })
    this.mark(id, 'applied', { localTable: 'ponto_marcacoes' })
    return { ok: true }
  }

  mark(id, status, extra = {}) {
    this.db.prepare('UPDATE field_inbox SET status=?,local_table=COALESCE(?,local_table),local_id=COALESCE(?,local_id),message=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?')
      .run(status, extra.localTable || null, extra.localId || null, Number(id))
  }
}

module.exports = { FieldInbox }
