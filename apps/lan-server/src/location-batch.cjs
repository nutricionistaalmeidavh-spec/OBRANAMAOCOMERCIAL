// Batch creation of units (apartamentos, salas, lojas) by floor ranges, with optional
// duplex units and a room template per unit. Same code in the local Desktop and in the
// Obra na Mão Server. Idempotent: a location with the same name under the same parent
// is reused, never duplicated, so a range can be generated again to complete it.

const MAX_CREATE = 5000
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const floorName = n => n === 0 ? 'Térreo' : n < 0 ? `Subsolo ${-n}` : `${n}º pavimento`
const int = (value, min, max) => { const n = Number(value); return Number.isSafeInteger(n) && n >= min && n <= max ? n : null }
const clean = (value, max = 80) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

/** Normalises and validates the user's ranges; throws a readable error. */
function normalizeSpec(spec) {
  const ranges = Array.isArray(spec?.faixas) ? spec.faixas : []
  if (!ranges.length) throw new Error('Inclua pelo menos uma faixa de pavimentos.')
  if (ranges.length > 30) throw new Error('Use no máximo 30 faixas.')
  return {
    createFloors: spec.criarPavimentos !== false,
    ranges: ranges.map((raw, index) => {
      const label = `Faixa ${index + 1}`
      const from = int(raw?.de, -20, 400), to = int(raw?.ate, -20, 400), units = int(raw?.unidades, 1, 99)
      if (from === null || to === null || to < from) throw new Error(`${label}: informe o pavimento inicial e o final (o final não pode ser menor).`)
      if (units === null) throw new Error(`${label}: informe de 1 a 99 unidades por andar.`)
      const pattern = ['numero', 'letra'].includes(raw?.padrao) ? raw.padrao : 'numero'
      if (pattern === 'letra' && units > LETTERS.length) throw new Error(`${label}: com letras, no máximo ${LETTERS.length} unidades por andar.`)
      const duplex = raw?.duplex === true
      if (duplex && (to - from + 1) % 2) throw new Error(`${label}: duplex ocupa 2 andares; a faixa precisa ter um número par de pavimentos.`)
      const rooms = (Array.isArray(raw?.ambientes) ? raw.ambientes : String(raw?.ambientes || '').split(','))
        .map(name => clean(name, 60)).filter(Boolean).slice(0, 30)
      return { from, to, units, pattern, prefix: clean(raw?.prefixo || 'Apto', 30) || 'Apto', duplex, rooms }
    }),
  }
}

function unitName(range, level, index) {
  const code = range.pattern === 'letra' ? `${level}${LETTERS[index - 1]}` : `${level}${String(index).padStart(2, '0')}`
  return `${range.prefix} ${code}`
}

/**
 * Plans (dryRun) or applies the batch. `store` = { db, save(table, data) }.
 * Returns counts plus a sample per floor; with dryRun nothing is written.
 */
function batchLocations(store, workId, spec, { dryRun = true } = {}) {
  const { db } = store
  const work = Number(workId)
  if (!db.prepare('SELECT 1 FROM obras WHERE id=?').get(work)) throw new Error('Obra não encontrada.')
  const { createFloors, ranges } = normalizeSpec(spec)
  const rows = db.prepare('SELECT id,nome,nivel,local_pai_id FROM locais_obra WHERE obra_id=?').all(work)
  const floors = new Map(rows.filter(r => r.nivel !== null && r.nivel !== undefined).map(r => [Number(r.nivel), r]))
  const childKey = (parent, name) => `${parent}\u0000${name.toLocaleLowerCase('pt-BR')}`
  const children = new Map(rows.filter(r => r.local_pai_id).map(r => [childKey(r.local_pai_id, String(r.nome)), r]))
  const summary = { floors: 0, units: 0, upper: 0, rooms: 0, existing: 0, missingFloors: [] }
  const sample = new Map()
  let pending = 0, order = 0

  // In a dry run new rows get negative ids so the plan can still be followed down the chain.
  let fakeId = -1
  const ensureFloor = (level) => {
    if (floors.has(level)) return floors.get(level)
    if (!createFloors) { summary.missingFloors.push(level); return null }
    summary.floors++; pending++
    const row = dryRun ? { id: fakeId--, nome: floorName(level), nivel: level } : store.save('locais_obra', { obra_id: work, nome: floorName(level), tipo: 'pavimento', nivel: level, ordem: level, local_pai_id: null })
    floors.set(level, row)
    return row
  }
  const ensureChild = (parent, name, tipo, counter) => {
    const existing = children.get(childKey(parent.id, name))
    if (existing) { summary.existing++; return existing }
    summary[counter]++; pending++
    if (pending > MAX_CREATE) throw new Error(`O lote passa de ${MAX_CREATE} locais. Divida em faixas menores.`)
    const row = dryRun ? { id: fakeId--, nome: name } : store.save('locais_obra', { obra_id: work, nome: name, tipo, nivel: null, ordem: ++order, local_pai_id: parent.id })
    children.set(childKey(parent.id, name), row)
    return row
  }

  for (const range of ranges) {
    const step = range.duplex ? 2 : 1
    for (let level = range.from; level <= range.to; level += step) {
      const floor = ensureFloor(level)
      const upperFloor = range.duplex ? ensureFloor(level + 1) : null
      if (!floor || (range.duplex && !upperFloor)) continue
      const names = []
      for (let index = 1; index <= range.units; index++) {
        const name = unitName(range, level, index)
        const unit = ensureChild(floor, name, 'unidade', 'units')
        for (const room of range.rooms) ensureChild(unit, room, 'ambiente', 'rooms')
        if (upperFloor) ensureChild(upperFloor, `${name} — piso superior`, 'unidade', 'upper')
        names.push(name)
      }
      if (!sample.has(level)) sample.set(level, { floor: floorName(level), units: names.length, first: names[0], last: names[names.length - 1], duplex: range.duplex })
    }
  }
  return { dryRun, ...summary, total: summary.floors + summary.units + summary.upper + summary.rooms, sample: [...sample.values()].slice(0, 60) }
}

/** Applies the batch atomically on either SQLite driver (better-sqlite3 or node:sqlite). */
function applyLocationBatch(store, workId, spec) {
  store.db.exec('BEGIN IMMEDIATE')
  try { const result = batchLocations(store, workId, spec, { dryRun: false }); store.db.exec('COMMIT'); return result }
  catch (error) { try { store.db.exec('ROLLBACK') } catch { /* already closed */ } throw error }
}

module.exports = { batchLocations, applyLocationBatch, normalizeSpec, unitName }
