// Canonical work locations (locais_obra): pavimentos have a level and sit at the top;
// complements hang optionally under a pavimento or another complement. Shared by the
// local Desktop and the Obra na Mão Server so both bases enforce the same chain.
function hasColumn(db, table, column) {
  try { return db.prepare(`PRAGMA table_info(${table})`).all().some(row => row.name === column) } catch { return false }
}
const blank = value => value === null || value === undefined || value === ''

function requireWorkLocation(db, localId, workId, label = 'Local') {
  if (blank(localId)) return null
  const row = db.prepare('SELECT id,obra_id,nivel,local_pai_id FROM locais_obra WHERE id=?').get(Number(localId))
  if (!row) throw new Error(`${label} não encontrado.`)
  if (Number(row.obra_id) !== Number(workId)) throw new Error(`${label} deve pertencer à mesma obra.`)
  return row
}

/** Validates writes that touch the location chain. `get(key)` reads the merged value. */
function validateLocationWrite(db, table, get, current = null) {
  if (table === 'locais_obra') {
    if (!hasColumn(db, 'locais_obra', 'local_pai_id')) return
    const parentId = get('local_pai_id'), workId = get('obra_id')
    if (blank(parentId)) return
    if (!blank(get('nivel'))) throw new Error('Pavimento fica direto na obra; complementos é que ficam dentro de um local.')
    const parent = requireWorkLocation(db, parentId, workId, 'Local de cima')
    const selfId = current?.id
    if (selfId) {
      // Walk up from the new parent: reaching this local again would close a loop.
      let cursor = parent, guard = 0
      while (cursor && guard++ < 100) {
        if (Number(cursor.id) === Number(selfId)) throw new Error('Um local não pode ficar dentro dele mesmo.')
        cursor = blank(cursor.local_pai_id) ? null : db.prepare('SELECT id,local_pai_id FROM locais_obra WHERE id=?').get(Number(cursor.local_pai_id))
      }
    }
    return
  }
  if (table === 'tarefas_obra' && hasColumn(db, 'tarefas_obra', 'local_id')) {
    requireWorkLocation(db, get('local_id'), get('obra_id'))
    return
  }
  if ((table === 'rdo_ocorrencias' || table === 'rdo_equipe') && hasColumn(db, table, 'local_id')) {
    if (blank(get('local_id'))) return
    const report = db.prepare('SELECT obra_id FROM rdos WHERE id=?').get(Number(get('rdo_id')))
    if (!report) throw new Error('RDO não encontrado.')
    requireWorkLocation(db, get('local_id'), report.obra_id)
  }
}

/** Ids of a location and everything inside it (for filters that include the chain). */
function locationDescendants(db, localId) {
  const out = new Set([Number(localId)])
  let frontier = [Number(localId)]
  while (frontier.length && out.size < 5000) {
    const rows = db.prepare(`SELECT id FROM locais_obra WHERE local_pai_id IN (${frontier.map(() => '?').join(',')})`).all(...frontier)
    frontier = rows.map(r => Number(r.id)).filter(id => !out.has(id))
    frontier.forEach(id => out.add(id))
  }
  return [...out]
}

/**
 * Open items per location of a work: open pendências (tarefas) and open RDO occurrences
 * that did not become a pendência yet (so nothing counts twice). `total` adds everything
 * inside the location, following the chain.
 */
function locationCounts(db, workId) {
  const work = Number(workId)
  const out = { byLocal: {}, open: 0 }
  if (!hasColumn(db, 'locais_obra', 'local_pai_id')) return out
  const locais = db.prepare('SELECT id,local_pai_id FROM locais_obra WHERE obra_id=?').all(work)
  for (const row of locais) out.byLocal[row.id] = { tasks: 0, occurrences: 0, own: 0, total: 0 }
  const taskDeleted = hasColumn(db, 'tarefas_obra', 'deleted_at') ? ' AND deleted_at IS NULL' : ''
  out.open = db.prepare(`SELECT COUNT(*) AS n FROM tarefas_obra WHERE obra_id=? AND status NOT IN ('concluida','cancelada')${taskDeleted}`).get(work).n
  if (hasColumn(db, 'tarefas_obra', 'local_id')) {
    for (const row of db.prepare(`SELECT local_id, COUNT(*) AS n FROM tarefas_obra WHERE obra_id=? AND local_id IS NOT NULL AND status NOT IN ('concluida','cancelada')${taskDeleted} GROUP BY local_id`).all(work))
      if (out.byLocal[row.local_id]) out.byLocal[row.local_id].tasks = row.n
  }
  if (hasColumn(db, 'rdo_ocorrencias', 'local_id')) {
    const rdoDeleted = hasColumn(db, 'rdos', 'deleted_at') ? ' AND r.deleted_at IS NULL' : ''
    const linked = hasColumn(db, 'tarefas_obra', 'rdo_ocorrencia_id') ? `AND NOT EXISTS (SELECT 1 FROM tarefas_obra t WHERE t.rdo_ocorrencia_id=o.id${taskDeleted.replace('deleted_at', 't.deleted_at')})` : ''
    for (const row of db.prepare(`SELECT o.local_id, COUNT(*) AS n FROM rdo_ocorrencias o JOIN rdos r ON r.id=o.rdo_id WHERE r.obra_id=? AND o.local_id IS NOT NULL AND COALESCE(o.status,'aberta') <> 'resolvida'${rdoDeleted} ${linked} GROUP BY o.local_id`).all(work))
      if (out.byLocal[row.local_id]) out.byLocal[row.local_id].occurrences = row.n
  }
  const children = new Map()
  for (const row of locais) if (row.local_pai_id && out.byLocal[row.local_pai_id]) children.set(row.local_pai_id, [...(children.get(row.local_pai_id) || []), row.id])
  const total = (id, guard = 0) => {
    const node = out.byLocal[id]
    if (guard > 50) return node.own
    return node.own + (children.get(id) || []).reduce((sum, child) => sum + total(child, guard + 1), 0)
  }
  for (const node of Object.values(out.byLocal)) node.own = node.tasks + node.occurrences
  for (const id of Object.keys(out.byLocal)) out.byLocal[id].total = total(Number(id))
  return out
}

module.exports = { validateLocationWrite, locationDescendants, requireWorkLocation, locationCounts }
