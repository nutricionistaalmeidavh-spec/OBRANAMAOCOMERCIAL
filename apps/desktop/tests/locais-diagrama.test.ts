import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { canMoveInto, locationOptions, locationWithDescendants, locationPath, siblingsOf } from '../src/utils/locations'

const rows = [
  { id: 1, nome: '1º pavimento', nivel: 1 },
  { id: 2, nome: 'Térreo', nivel: 0 },
  { id: 3, nome: 'Apto 101', local_pai_id: 1 },
  { id: 4, nome: 'Banheiro', local_pai_id: 3 },
  { id: 5, nome: 'Guarita', local_pai_id: 2 },
  { id: 6, nome: 'Canteiro' },
]

describe('locais da obra em diagrama', () => {
  it('ordena pavimentos por número, cadeia abaixo e locais diretos na obra por último', () => {
    expect(locationOptions(rows).map((o) => [o.id, o.depth])).toEqual([[2, 0], [5, 1], [1, 0], [3, 1], [4, 2], [6, 0]])
    expect(locationPath(rows, 4)).toBe('1º pavimento › Apto 101 › Banheiro')
  })
  it('herança: um local inclui tudo o que fica dentro', () => {
    expect([...locationWithDescendants(rows, 1)].sort()).toEqual([1, 3, 4])
  })
  it('o card oferece Lista e Diagrama e o atalho abre pendências filtradas pelo local', () => {
    const card = fs.readFileSync(path.resolve(import.meta.dirname, '../src/components/FloorsCard.tsx'), 'utf8')
    const diagram = fs.readFileSync(path.resolve(import.meta.dirname, '../src/components/LocationsDiagram.tsx'), 'utf8')
    const tasks = fs.readFileSync(path.resolve(import.meta.dirname, '../src/pages/TasksPage.tsx'), 'utf8')
    expect(card).toMatch(/Diagrama/)
    expect(diagram).toMatch(/\?obra=\$\{workId\}&local=\$\{current\.id\}/)
    expect(tasks).toMatch(/get\('local'\)/)
  })
  it('arrastar respeita as regras: pavimento não se move, nada entra em si mesmo, ordem dos irmãos', () => {
    expect(canMoveInto(rows, 1, 2)).toBe(false)
    expect(canMoveInto(rows, 3, 4)).toBe(false)
    expect(canMoveInto(rows, 3, 1)).toBe(false)
    expect(canMoveInto(rows, 3, 2)).toBe(true)
    expect(canMoveInto(rows, 5, null)).toBe(true)
    const ordered = [...rows, { id: 7, nome: 'Apto 102', local_pai_id: 1, ordem: 1 }, { id: 8, nome: 'Apto 100', local_pai_id: 1, ordem: 2 }]
    expect(siblingsOf(ordered, 7).map((r) => r.id)).toEqual([3, 7, 8])
  })
})
