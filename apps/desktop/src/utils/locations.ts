/** Canonical work locations: pavimentos (with level) on top, complements optionally inside. */
export type WorkLocation = { id: number; nome: string; nivel?: number | null; local_pai_id?: number | null; obra_id?: number }
export type LocationOption = { id: number; label: string; path: string; depth: number; floor: boolean; orphan: boolean }

const isFloor = (row: WorkLocation) => row.nivel !== null && row.nivel !== undefined
const byName = (a: WorkLocation, b: WorkLocation) => String(a.nome).localeCompare(String(b.nome), 'pt-BR')

/** Tree order: pavimentos by level with their complements, then locations directly on the work. */
export function locationOptions(rows: WorkLocation[] = []): LocationOption[] {
  const children = new Map<number, WorkLocation[]>()
  const ids = new Set(rows.map((row) => Number(row.id)))
  for (const row of rows) {
    const parent = row.local_pai_id ? Number(row.local_pai_id) : 0
    if (parent && !ids.has(parent)) continue
    if (parent) children.set(parent, [...(children.get(parent) || []), row])
  }
  const out: LocationOption[] = []
  const seen = new Set<number>()
  const walk = (row: WorkLocation, depth: number, trail: string[], orphan: boolean) => {
    if (seen.has(Number(row.id)) || depth > 20) return
    seen.add(Number(row.id))
    const path = [...trail, row.nome]
    out.push({ id: Number(row.id), label: `${'   '.repeat(depth)}${depth ? '↳ ' : ''}${row.nome}`, path: path.join(' › '), depth, floor: isFloor(row), orphan })
    for (const child of (children.get(Number(row.id)) || []).sort(byName)) walk(child, depth + 1, path, orphan)
  }
  const roots = rows.filter((row) => !row.local_pai_id || !ids.has(Number(row.local_pai_id)))
  roots.filter(isFloor).sort((a, b) => Number(a.nivel) - Number(b.nivel)).forEach((row) => walk(row, 0, [], false))
  roots.filter((row) => !isFloor(row)).sort(byName).forEach((row) => walk(row, 0, [], true))
  return out
}

/** The location and everything inside it, for filters that follow the chain. */
export function locationWithDescendants(rows: WorkLocation[] = [], id: number | string): Set<number> {
  const target = Number(id), out = new Set<number>([target])
  let grew = true
  while (grew) {
    grew = false
    for (const row of rows) if (row.local_pai_id && out.has(Number(row.local_pai_id)) && !out.has(Number(row.id))) { out.add(Number(row.id)); grew = true }
  }
  return out
}

export function locationPath(rows: WorkLocation[] = [], id: number | string | null | undefined): string {
  if (!id) return ''
  return locationOptions(rows).find((option) => option.id === Number(id))?.path || ''
}
