function columns(db, table) {
  try { return new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(row => String(row.name))) } catch { return new Set() }
}

function existsTable(db, table) { return columns(db, table).size > 0 }

function activeRow(db, table, id) {
  if (id === null || id === undefined || id === '') return null
  const cols = columns(db, table)
  if (!cols.size) return null
  const deleted = cols.has('deleted_at') ? ' AND deleted_at IS NULL' : ''
  return db.prepare(`SELECT * FROM ${table} WHERE id=?${deleted}`).get(Number(id)) || null
}

function value(data, current, key) { return Object.hasOwn(data || {}, key) ? data[key] : current?.[key] }

function requireRow(db, table, id, label) {
  const row = activeRow(db, table, id)
  if (!row) throw new Error(`${label} não encontrado.`)
  return row
}

function sameWorkFront(db, frontId, workId) {
  if (frontId === null || frontId === undefined || frontId === '') return
  const front = requireRow(db, 'frentes_obra', frontId, 'Frente')
  if (Number(front.obra_id) !== Number(workId)) throw new Error('Frente deve pertencer à mesma obra.')
}

function workCompany(db, workId) { return requireRow(db, 'obras', workId, 'Obra').empresa_id }

export function validateCoreOperationOwnership(db, table, data, current = null) {
  const get = key => value(data, current, key)
  if (table === 'clientes') {
    const companyId = get('empresa_id')
    if (companyId !== null && companyId !== undefined && companyId !== '') requireRow(db, 'empresas', companyId, 'Empresa')
    return
  }
  if (table === 'obras') {
    const companyId = get('empresa_id')
    requireRow(db, 'empresas', companyId, 'Empresa')
    const clientId = get('cliente_id')
    if (clientId !== null && clientId !== undefined && clientId !== '') {
      const client = requireRow(db, 'clientes', clientId, 'Cliente')
      if (client.empresa_id !== null && Number(client.empresa_id) !== Number(companyId)) throw new Error('Cliente deve pertencer à mesma empresa.')
    }
    return
  }
  if (table === 'frentes_obra') {
    const workId = get('obra_id')
    requireRow(db, 'obras', workId, 'Obra')
    if (current?.id && Number(current.obra_id) !== Number(workId)) {
      const dependent = [['rdos','frente_id'],['tarefas_obra','frente_id'],['etapas_obra','frente_id'],['cronograma_etapas','frente_id'],['itens_orcamentarios','frente_id']]
      for (const [child, fk] of dependent) {
        if (!existsTable(db, child)) continue
        const childCols = columns(db, child)
        const deleted = childCols.has('deleted_at') ? ' AND deleted_at IS NULL' : ''
        const hit = db.prepare(`SELECT 1 AS found FROM ${child} WHERE ${fk}=?${deleted} LIMIT 1`).get(Number(current.id))
        if (hit) throw new Error('Frente possui vínculos e não pode ser movida para outra obra.')
      }
    }
    return
  }
  if (table === 'rdos') {
    const workId = get('obra_id')
    requireRow(db, 'obras', workId, 'Obra')
    sameWorkFront(db, get('frente_id'), workId)
    return
  }
  if (table === 'tarefas_obra') {
    const workId = get('obra_id')
    requireRow(db, 'obras', workId, 'Obra')
    sameWorkFront(db, get('frente_id'), workId)
    const occurrenceId = get('rdo_ocorrencia_id')
    if (occurrenceId !== null && occurrenceId !== undefined && occurrenceId !== '') {
      const occurrence = requireRow(db, 'rdo_ocorrencias', occurrenceId, 'Ocorrência')
      const report = requireRow(db, 'rdos', occurrence.rdo_id, 'RDO da ocorrência')
      if (Number(report.obra_id) !== Number(workId)) throw new Error('Ocorrência deve pertencer à mesma obra.')
    }
    return
  }
  if (['rdo_equipe','rdo_equipamentos','rdo_ocorrencias','rdo_anexos'].includes(table)) {
    const report = requireRow(db, 'rdos', get('rdo_id'), 'RDO')
    sameWorkFront(db, get('frente_id'), report.obra_id)
    if (table === 'rdo_equipe') {
      const employeeId = get('funcionario_id')
      if (employeeId !== null && employeeId !== undefined && employeeId !== '' && existsTable(db, 'funcionarios')) {
        const employee = requireRow(db, 'funcionarios', employeeId, 'Funcionário')
        const companyId = workCompany(db, report.obra_id)
        if (employee.empresa_id !== null && Number(employee.empresa_id) !== Number(companyId)) throw new Error('Funcionário deve pertencer à mesma empresa da obra.')
      }
    }
  }
}
