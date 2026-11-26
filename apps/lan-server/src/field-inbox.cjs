const crypto = require('node:crypto')

const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
const rec = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {}
const DATE = /^\d{4}-\d{2}-\d{2}$/
const STAGE_STATUS = new Set(['not_started', 'released', 'in_progress', 'completed', 'blocked'])
const STATUS_LABEL = { not_started: 'não iniciado', released: 'liberado', in_progress: 'em execução', completed: 'concluído', blocked: 'bloqueado' }
const floorName = n => n === 0 ? 'Térreo' : n < 0 ? `Subsolo ${-n}` : `${n}º pavimento`

/**
 * Applies what the field team records on the phone to the canonical owners of this base
 * (local Desktop or Obra na Mão Server).
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
    let issues = 0, staged = 0, floors = 0, progress = 0
    this.db.exec('BEGIN IMMEDIATE')
    try {
      if (applyTasks) { floors = this.seedFloors(scope, state); progress = this.ingestProgress(scope, state); this.ingestHistory(scope, state) }
      for (const issue of Array.isArray(state.issues) ? state.issues : []) {
        const item = rec(issue), id = String(item.id || '')
        if (!id) continue
        const payload = { title: String(item.title || 'Pendência').slice(0, 200), reason: String(item.reason || '').slice(0, 2000), type: String(item.type || ''), floor: item.floor ?? null, service: String(item.service || ''), status: item.status === 'resolved' ? 'resolved' : 'open', external: !!item.external, ...(Number.isSafeInteger(Number(item.placeId)) && Number(item.placeId) > 0 ? { placeId: Number(item.placeId) } : {}) }
        const result = this.upsert(scope, 'issue', id, payload)
        if (!applyTasks) { if (result.changed) this.db.prepare("UPDATE field_inbox SET payload_json=?,payload_hash=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(JSON.stringify(payload), result.digest, result.row.id); continue }
        if (result.created || (result.row.status === 'pending' && !result.row.local_id)) {
          const task = this.database.save('tarefas_obra', {
            obra_id: Number(scope.workId), titulo: payload.title, ...this.floorLocal(scope.workId, payload.floor, payload.placeId),
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
    return { issues, staged, floors, progress }
  }

  /**
   * One-time import of the floors that already exist in the online Obra360 into the
   * work's locais (pavimentos). Afterwards the Desktop owns the list: deleting a
   * pavimento in the office is never undone by the phone. Matched by floor level only.
   */
  seedFloors(scope, state) {
    const hasSeed = this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='obra360_locais_seed'").get()
    if (!hasSeed) return 0
    const workId = Number(scope.workId), remote = String(scope.remoteProjectId)
    if (!Number.isSafeInteger(workId) || workId < 1) return 0
    if (this.db.prepare('SELECT 1 FROM obra360_locais_seed WHERE remote_project_id=? AND work_id=?').get(remote, workId)) return 0
    const existing = this.db.prepare('SELECT COUNT(*) AS n FROM locais_obra WHERE obra_id=? AND nivel IS NOT NULL').get(workId).n
    const levels = [...new Set((Array.isArray(state.floors) ? state.floors : []).map(f => Number(rec(f).number)).filter(n => Number.isSafeInteger(n) && n >= -20 && n <= 400))].sort((a, b) => a - b)
    let created = 0
    if (!existing) {
      for (const [index, level] of levels.entries()) {
        const name = floorName(level)
        const sameName = this.db.prepare('SELECT id,nivel FROM locais_obra WHERE obra_id=? AND nome=?').get(workId, name)
        if (sameName) { if (sameName.nivel == null) this.db.prepare('UPDATE locais_obra SET nivel=?,ordem=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(level, index, sameName.id); continue }
        this.db.prepare("INSERT INTO locais_obra(obra_id,nome,tipo,nivel,ordem) VALUES(?,?,'pavimento',?,?)").run(workId, name, level, index)
        created++
      }
    }
    this.db.prepare('INSERT INTO obra360_locais_seed(remote_project_id,work_id,imported) VALUES(?,?,?)').run(remote, workId, created)
    return created
  }

  /**
   * Stage progress and checklists recorded on the phone, for canonical pavimentos only.
   * The newest change wins (phone stamps updatedAt); the first sync imports what already
   * exists. The Desktop then publishes the official state back in the field catalog.
   */
  ingestProgress(scope, state) {
    const has = this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='obra360_andamento'").get()
    if (!has) return 0
    const workId = Number(scope.workId)
    if (!Number.isSafeInteger(workId) || workId < 1) return 0
    const levels = new Set(this.db.prepare('SELECT nivel FROM locais_obra WHERE obra_id=? AND nivel IS NOT NULL').all(workId).map(r => Number(r.nivel)))
    if (!levels.size) return 0
    const current = this.db.prepare('SELECT updated_at FROM obra360_andamento WHERE obra_id=? AND nivel=? AND servico=?')
    const upsert = this.db.prepare(`INSERT INTO obra360_andamento(obra_id,nivel,servico,status,checklist_json,updated_at,origem) VALUES(?,?,?,?,?,?,'campo')
      ON CONFLICT(obra_id,nivel,servico) DO UPDATE SET status=excluded.status,checklist_json=excluded.checklist_json,updated_at=excluded.updated_at,origem='campo'`)
    let changed = 0
    for (const floor of Array.isArray(state.floors) ? state.floors : []) {
      const level = Number(rec(floor).number)
      if (!levels.has(level)) continue
      for (const raw of Array.isArray(floor.stages) ? floor.stages.slice(0, 300) : []) {
        const st = rec(raw), service = String(st.service || '').slice(0, 80), status = String(st.status || '')
        if (!service || !STAGE_STATUS.has(status)) continue
        const stamp = typeof st.updatedAt === 'string' && !Number.isNaN(Date.parse(st.updatedAt)) ? new Date(st.updatedAt).toISOString() : null
        const row = current.get(workId, level, service)
        if (row && (!stamp || stamp <= row.updated_at)) continue
        const checklist = (Array.isArray(st.checklist) ? st.checklist : []).slice(0, 60).map(item => { const c = rec(item); return { id: String(c.id || '').slice(0, 80) || 'item', label: String(c.label || '').slice(0, 200), checked: c.checked === true, required: c.required === true } })
        upsert.run(workId, level, service, status, JSON.stringify(checklist), stamp || '1970-01-01T00:00:00.000Z')
        changed++
      }
    }
    return changed
  }

  /** Append-only copy of the phone history; never edited or removed by a later sync. */
  ingestHistory(scope, state) {
    if (!this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='obra360_historico'").get()) return 0
    const workId = Number(scope.workId)
    if (!Number.isSafeInteger(workId) || workId < 1) return 0
    const insert = this.db.prepare("INSERT OR IGNORE INTO obra360_historico(obra_id,origem_id,nivel,servico,data,hora,descricao,origem) VALUES(?,?,?,?,?,?,?,'campo')")
    let added = 0
    for (const raw of (Array.isArray(state.history) ? state.history : []).slice(-2000)) {
      const h = rec(raw), id = String(h.id || '').slice(0, 120), date = String(h.date || ''), label = String(h.label || '').trim().slice(0, 500)
      if (!id || id.startsWith('escritorio:') || !DATE.test(date) || !label) continue
      const level = Number(h.floor), time = /^\d{2}:\d{2}/.test(String(h.time || '')) ? String(h.time).slice(0, 5) : null
      added += insert.run(workId, 'campo:' + id, Number.isSafeInteger(level) ? level : null, h.service ? String(h.service).slice(0, 80) : null, date, time, label).changes
    }
    return added
  }

  historyList({ workId, nivel, date, limit } = {}) {
    const where = ['h.obra_id=?'], args = [Number(workId)]
    if (nivel !== undefined && nivel !== null) { where.push('h.nivel=?'); args.push(Number(nivel)) }
    if (date) { where.push('h.data=?'); args.push(String(date)) }
    args.push(Math.min(Math.max(Number(limit) || 50, 1), 500))
    return this.db.prepare(`SELECT h.id,h.nivel,h.servico,h.data,h.hora,h.descricao,h.origem,r.id AS rdo_id FROM obra360_historico h
      LEFT JOIN rdos r ON r.obra_id=h.obra_id AND r.data=h.data AND r.deleted_at IS NULL
      WHERE ${where.join(' AND ')} ORDER BY h.data DESC,h.hora DESC,h.id DESC LIMIT ?`).all(...args)
      .map(row => ({ id: row.id, nivel: row.nivel, service: row.servico, date: row.data, time: row.hora, label: row.descricao, origin: row.origem, rdoId: row.rdo_id || null }))
  }

  progressList(workId) {
    return this.db.prepare('SELECT nivel,servico,status,checklist_json,updated_at,origem FROM obra360_andamento WHERE obra_id=? ORDER BY nivel,servico').all(Number(workId))
      .map(row => { let checklist = []; try { checklist = JSON.parse(row.checklist_json || '[]') } catch { /* keep empty */ } return { nivel: row.nivel, service: row.servico, status: row.status, checklist, updatedAt: row.updated_at, origin: row.origem } })
  }

  /** Office edit: becomes the official state and is published back to the phone. */
  progressSave({ workId, nivel, service, status, checklist }) {
    const work = Number(workId), level = Number(nivel), key = String(service || '').slice(0, 80)
    if (!Number.isSafeInteger(work) || !Number.isSafeInteger(level) || !/^etapa:\d+$/.test(key)) throw new Error('Andamento inválido.')
    if (!STAGE_STATUS.has(String(status))) throw new Error('Situação inválida.')
    if (!this.db.prepare('SELECT 1 FROM locais_obra WHERE obra_id=? AND nivel=?').get(work, level)) throw new Error('Pavimento não cadastrado nesta obra.')
    if (!this.db.prepare('SELECT 1 FROM etapas_obra WHERE id=? AND obra_id=? AND deleted_at IS NULL').get(Number(key.slice(6)), work)) throw new Error('Subetapa não encontrada nesta obra.')
    const items = (Array.isArray(checklist) ? checklist : []).slice(0, 60).map(item => { const c = rec(item); return { id: String(c.id || '').slice(0, 80) || 'item', label: String(c.label || '').slice(0, 200), checked: c.checked === true, required: c.required === true } })
    const now = new Date().toISOString()
    this.db.prepare(`INSERT INTO obra360_andamento(obra_id,nivel,servico,status,checklist_json,updated_at,origem) VALUES(?,?,?,?,?,?,'escritorio')
      ON CONFLICT(obra_id,nivel,servico) DO UPDATE SET status=excluded.status,checklist_json=excluded.checklist_json,updated_at=excluded.updated_at,origem='escritorio'`).run(work, level, key, String(status), JSON.stringify(items), now)
    if (this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='obra360_historico'").get()) {
      const floor = this.db.prepare('SELECT nome FROM locais_obra WHERE obra_id=? AND nivel=?').get(work, level)
      const stage = this.db.prepare('SELECT nome FROM etapas_obra WHERE id=?').get(Number(key.slice(6)))
      const done = items.filter(i => i.checked).length
      const label = `${stage?.nome || 'Subetapa'} · ${floor?.nome || floorName(level)}: ${STATUS_LABEL[status]}${items.length ? ` (checklist ${done}/${items.length})` : ''} — escritório`
      const local = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString()
      this.db.prepare("INSERT INTO obra360_historico(obra_id,origem_id,nivel,servico,data,hora,descricao,origem) VALUES(?,?,?,?,?,?,?,'escritorio')")
        .run(work, 'escritorio:' + require('node:crypto').randomUUID(), level, key, local.slice(0, 10), local.slice(11, 16), label)
    }
    return { nivel: level, service: key, status: String(status), checklist: items, updatedAt: now, origin: 'escritorio' }
  }

  /** Pavimento of the phone record, matched by floor level only (never by name). */
  floorLocal(workId, floor, placeId = null) {
    const level = Number(floor)
    try {
      if (!this.db.prepare("SELECT 1 FROM pragma_table_info('tarefas_obra') WHERE name='local_id'").get()) return {}
      // A complement picked on the phone, by its canonical id, if it is still of this work.
      if (placeId) {
        const place = this.db.prepare('SELECT id FROM locais_obra WHERE id=? AND obra_id=?').get(Number(placeId), Number(workId))
        if (place) return { local_id: place.id }
      }
      if (floor === null || floor === undefined || floor === '' || !Number.isSafeInteger(level)) return {}
      const row = this.db.prepare('SELECT id FROM locais_obra WHERE obra_id=? AND nivel=?').get(Number(workId), level)
      return row ? { local_id: row.id } : {}
    } catch { return {} }
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
      const task = this.database.save('tarefas_obra', { obra_id: Number(row.work_id), ...this.floorLocal(row.work_id, payload.floor, payload.placeId), titulo: String(payload.title || 'Pendência').slice(0, 200), descricao: [payload.reason, 'Registrada no celular (Obra360).'].filter(Boolean).join('\n'), prioridade: payload.type === 'blocked' ? 'alta' : 'normal', status: payload.status === 'resolved' ? 'concluida' : 'aberta' })
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
    timeService.save({ funcionario_id: employee.id, competencia, marks: [mark], expectedRevision: current.point?.revision })
    this.mark(id, 'applied', { localTable: 'ponto_marcacoes' })
    return { ok: true }
  }

  mark(id, status, extra = {}) {
    this.db.prepare('UPDATE field_inbox SET status=?,local_table=COALESCE(?,local_table),local_id=COALESCE(?,local_id),message=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?')
      .run(status, extra.localTable || null, extra.localId || null, Number(id))
  }
}

module.exports = { FieldInbox }
