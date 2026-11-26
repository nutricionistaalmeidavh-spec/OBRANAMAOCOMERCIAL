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
  if (table === 'rdo_ocorrencias' && hasColumn(db, 'rdo_ocorrencias', 'local_id')) {
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

module.exports = { validateLocationWrite, locationDescendants, requireWorkLocation }
