import crypto from 'node:crypto'
import { ConcurrencyService } from './concurrency-service.mjs'

const ALLOWED_TYPES = new Set(['trabalho','falta','ferias','feriado','folga','afastado','sabado','domingo'])

function validCompetence(value) {
  const competence = String(value || '')
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competence)) throw new Error('Competência inválida.')
  return competence
}

function cleanTime(value) {
  const text = String(value || '')
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(text) ? text : null
}

function addMinutes(time, delta) {
  const [hour, minute] = String(time || '00:00').split(':').map(Number)
  const total = Math.max(0, Math.min(1439, hour * 60 + minute + delta))
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function jitter(employeeId, date, slot) {
  const values = [-7,-6,-5,-4,-3,-2,-1,1,2,3,4,5,6,7]
  const byte = crypto.createHash('sha256').update(`${employeeId}|${date}|${slot}`).digest()[slot]
  return values[byte % values.length]
}

function monthDays(competence) {
  const [year, month] = validCompetence(competence).split('-').map(Number)
  const length = new Date(year, month, 0).getDate()
  return Array.from({ length }, (_, index) => {
    const day = index + 1
    const data = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return { data, weekday: new Date(year, month - 1, day).getDay() }
  })
}

export class TimeService {
  constructor({ repository }) {
    if (!repository?.connection) throw new Error('Repositório LAN inválido para Ponto.')
    this.repository = repository
    this.concurrency = new ConcurrencyService({ db: repository.connection() })
  }

  get db() { return this.repository.connection() }

  ensure(employeeId, competence) {
    const employee = this.repository.get('funcionarios', Number(employeeId))
    if (!employee || employee.deleted_at || employee.status !== 'ativo') throw new Error('Funcionário ativo não encontrado.')
    const normalized = validCompetence(competence)
    let point = this.db.prepare('SELECT * FROM pontos_mensais WHERE empresa_id=? AND funcionario_id=? AND competencia=?').get(employee.empresa_id, employee.id, normalized)
    const created = !point
    if (!point) {
      point = this.repository.save('pontos_mensais', {
        empresa_id: employee.empresa_id,
        funcionario_id: employee.id,
        competencia: normalized,
        status: 'rascunho',
        preenchimento_automatico: 0,
        jornada_inicio: employee.jornada_inicio || '07:00',
        intervalo_inicio: employee.intervalo_inicio || '11:00',
        intervalo_fim: employee.intervalo_fim || '12:00',
        jornada_fim: employee.jornada_fim || '17:00'
      })
    }
    const revision = this.concurrency.current('pontos_mensais', point.id) || this.concurrency.initialize('pontos_mensais', point.id)
    return { employee, point: { ...point, revision }, created }
  }

  get(payload) {
    const base = this.ensure(payload.funcionario_id, payload.competencia)
    const marks = this.db.prepare('SELECT * FROM ponto_marcacoes WHERE empresa_id=? AND ponto_mensal_id=? ORDER BY data').all(base.employee.empresa_id, base.point.id)
    return { employee: base.employee, point: base.point, marks }
  }

  autoFill(payload) {
    this.db.exec('BEGIN IMMEDIATE;')
    try {
      const base = this.ensure(payload.funcionario_id, payload.competencia)
      const { employee, point, created } = base
      if (!created) this.concurrency.assertExpected('pontos_mensais', point.id, payload.expectedRevision, point)

      const overwrite = Boolean(payload.overwrite)
      const exists = this.db.prepare('SELECT id FROM ponto_marcacoes WHERE empresa_id=? AND ponto_mensal_id=? AND data=?')
      const upsert = this.db.prepare(`
        INSERT INTO ponto_marcacoes(empresa_id,ponto_mensal_id,data,tipo,entrada,intervalo_saida,intervalo_entrada,saida)
        VALUES (?,?,?,?,?,?,?,?)
        ON CONFLICT(ponto_mensal_id,data) DO UPDATE SET
          tipo=excluded.tipo,entrada=excluded.entrada,intervalo_saida=excluded.intervalo_saida,
          intervalo_entrada=excluded.intervalo_entrada,saida=excluded.saida,updated_at=CURRENT_TIMESTAMP
      `)

      for (const day of monthDays(point.competencia)) {
        if (!overwrite && exists.get(employee.empresa_id, point.id, day.data)) continue
        const weekend = day.weekday === 0 ? 'domingo' : day.weekday === 6 ? 'sabado' : null
        const values = weekend
          ? [null, null, null, null]
          : [
              addMinutes(point.jornada_inicio, jitter(employee.id, day.data, 0)),
              addMinutes(point.intervalo_inicio, jitter(employee.id, day.data, 1)),
              addMinutes(point.intervalo_fim, Math.abs(jitter(employee.id, day.data, 2))),
              addMinutes(point.jornada_fim, jitter(employee.id, day.data, 3))
            ]
        upsert.run(employee.empresa_id, point.id, day.data, weekend || 'trabalho', values[0], values[1], values[2], values[3])
      }
      this.db.prepare('UPDATE pontos_mensais SET preenchimento_automatico=1,updated_at=CURRENT_TIMESTAMP WHERE empresa_id=? AND id=?').run(employee.empresa_id, point.id)
      if (!created) this.concurrency.bump('pontos_mensais', point.id)
      this.db.exec('COMMIT;')
    } catch (error) {
      try { this.db.exec('ROLLBACK;') } catch {}
      throw error
    }
    return this.get(payload)
  }

  save(payload) {
    this.db.exec('BEGIN IMMEDIATE;')
    try {
      const base = this.ensure(payload.funcionario_id, payload.competencia)
      const { employee, point, created } = base
      if (!created) this.concurrency.assertExpected('pontos_mensais', point.id, payload.expectedRevision, point)

      const upsert = this.db.prepare(`
        INSERT INTO ponto_marcacoes(empresa_id,ponto_mensal_id,data,tipo,entrada,intervalo_saida,intervalo_entrada,saida,observacoes)
        VALUES (?,?,?,?,?,?,?,?,?)
        ON CONFLICT(ponto_mensal_id,data) DO UPDATE SET
          tipo=excluded.tipo,entrada=excluded.entrada,intervalo_saida=excluded.intervalo_saida,
          intervalo_entrada=excluded.intervalo_entrada,saida=excluded.saida,
          observacoes=excluded.observacoes,updated_at=CURRENT_TIMESTAMP
      `)

      for (const row of payload.marks || []) {
        const tipo = ALLOWED_TYPES.has(row.tipo) ? row.tipo : 'trabalho'
        const values = tipo === 'trabalho'
          ? [cleanTime(row.entrada), cleanTime(row.intervalo_saida), cleanTime(row.intervalo_entrada), cleanTime(row.saida)]
          : [null, null, null, null]
        upsert.run(employee.empresa_id, point.id, row.data, tipo, values[0], values[1], values[2], values[3], row.observacoes || null)
      }
      this.db.prepare("UPDATE pontos_mensais SET status='preenchido',updated_at=CURRENT_TIMESTAMP WHERE empresa_id=? AND id=?").run(employee.empresa_id, point.id)
      if (!created) this.concurrency.bump('pontos_mensais', point.id)
      this.db.exec('COMMIT;')
    } catch (error) {
      try { this.db.exec('ROLLBACK;') } catch {}
      throw error
    }
    return this.get(payload)
  }

  documentContext(payload) {
    const data = this.get(payload)
    const company = this.repository.get('empresas', data.employee.empresa_id)
    if (!company || company.deleted_at) throw new Error('Empresa do funcionário não encontrada.')
    const cargo = data.employee.cargo_id ? this.repository.get('cargos', data.employee.cargo_id) : null

    const benefitMap = new Map()
    if (cargo) {
      const rows = this.db.prepare(`
        SELECT cb.beneficio_id,b.nome AS descricao,cb.valor_centavos,cb.quinzena,cb.natureza
        FROM cargo_beneficios cb JOIN beneficios b ON b.id=cb.beneficio_id
        WHERE cb.empresa_id=? AND cb.cargo_id=? AND cb.ativo=1 AND b.empresa_id=? AND b.ativo=1
      `).all(data.employee.empresa_id, cargo.id, data.employee.empresa_id)
      for (const row of rows) benefitMap.set(row.beneficio_id, row)
    }

    const overrides = this.db.prepare(`
      SELECT fb.beneficio_id,b.nome AS descricao,fb.valor_centavos,1 AS quinzena,'credito' AS natureza
      FROM funcionario_beneficios fb JOIN beneficios b ON b.id=fb.beneficio_id
      WHERE fb.empresa_id=? AND fb.funcionario_id=? AND b.empresa_id=? AND b.ativo=1
        AND (fb.inicio IS NULL OR substr(fb.inicio,1,7)<=?)
        AND (fb.fim IS NULL OR substr(fb.fim,1,7)>=?)
      ORDER BY fb.beneficio_id,fb.inicio DESC
    `).all(data.employee.empresa_id, data.employee.id, data.employee.empresa_id, data.point.competencia, data.point.competencia)
    const seen = new Set()
    for (const row of overrides) {
      if (seen.has(row.beneficio_id)) continue
      seen.add(row.beneficio_id)
      benefitMap.set(row.beneficio_id, row)
    }

    return {
      employee: data.employee,
      company,
      cargo,
      benefits: Array.from(benefitMap.values()),
      point: data.point,
      marks: data.marks,
      documentStorage: 'local-derived'
    }
  }
}
