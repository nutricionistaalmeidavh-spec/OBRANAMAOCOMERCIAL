import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from './ui'
import { ROUTES } from '../routes/registry'
import { locationOptions, locationWithDescendants, type WorkLocation } from '../utils/locations'

type Props = {
  workId: string
  workName: string
  locations: WorkLocation[]
  tasks: Array<{ id: number; titulo: string; status: string; prioridade?: string; prazo?: string | null; local_id?: number | null }>
  onAddInside: (parentId: number) => void
  onEdit: (location: any) => void
  onRemove: (location: any) => void
}

const OPEN = (status: string) => !['concluida', 'cancelada'].includes(status)
const COLLAPSE_AT = 6

/**
 * Locais da obra as a map: pavimentos in columns by level, complements in their chain
 * under each, and what sits directly on the work apart. Counts include what is inside.
 */
export default function LocationsDiagram({ workId, workName, locations, tasks, onAddInside, onEdit, onRemove }: Props) {
  const [selected, setSelected] = useState<number | null>(null)
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  const options = useMemo(() => locationOptions(locations), [locations])
  const byId = useMemo(() => new Map(locations.map((row: any) => [Number(row.id), row])), [locations])
  const open = useMemo(() => tasks.filter((task) => OPEN(task.status) && task.local_id), [tasks])
  const countFor = (id: number) => { const scope = locationWithDescendants(locations, id); return open.filter((task) => scope.has(Number(task.local_id))).length }
  const totalOpen = tasks.filter((task) => OPEN(task.status)).length

  // Columns: each root (pavimento, then "direto na obra" roots grouped) with its chain below.
  const columns = useMemo(() => {
    const cols: Array<{ root: any | null; items: typeof options }> = []
    let direct: typeof options = []
    for (let i = 0; i < options.length; i++) {
      const option = options[i]
      if (option.depth) continue
      const chain = [] as typeof options
      for (let j = i + 1; j < options.length && options[j].depth > 0; j++) chain.push(options[j])
      if (option.floor) cols.push({ root: byId.get(option.id), items: chain })
      else direct = [...direct, { ...option, depth: 0 }, ...chain.map((item) => ({ ...item }))]
    }
    if (direct.length) cols.push({ root: null, items: direct })
    return cols
  }, [options, byId])

  const current: any = selected ? byId.get(selected) : null
  const currentOption = current ? options.find((option) => option.id === current.id) : null
  const currentTasks = current ? (() => { const scope = locationWithDescendants(locations, current.id); return open.filter((task) => scope.has(Number(task.local_id))) })() : []
  const badge = (count: number) => <span className={`loc-badge${count ? ' has' : ''}`} aria-label={`${count} pendências abertas`}>{count}</span>

  return <div className="loc-diagram">
    <div className="loc-canvas">
      <div className="loc-work"><strong>{workName || 'Obra'}</strong><span>{totalOpen} pendência{totalOpen === 1 ? '' : 's'} aberta{totalOpen === 1 ? '' : 's'}</span></div>
      <div className="loc-columns" style={{ gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, minmax(180px, 1fr))` }}>
        {columns.map((column, index) => {
          const key = column.root ? Number(column.root.id) : -1
          const isOpen = expanded[key] || column.items.length <= COLLAPSE_AT
          const shown = isOpen ? column.items : column.items.slice(0, COLLAPSE_AT - 1)
          const rootCount = column.root ? countFor(Number(column.root.id)) : 0
          return <div className="loc-column" key={key + ':' + index}>
            {column.root
              ? <button type="button" className={`loc-floor${selected === Number(column.root.id) ? ' active' : ''}`} onClick={() => setSelected(Number(column.root.id))}>
                <span className="loc-row"><strong>{column.root.nome}</strong>{badge(rootCount)}</span>
                <small>Pavimento {column.root.nivel} · {column.items.length} complemento{column.items.length === 1 ? '' : 's'}</small>
              </button>
              : <div className="loc-direct"><strong>Direto na obra</strong><small>Sem pavimento</small></div>}
            <div className="loc-chain">
              {shown.map((option) => <button type="button" key={option.id} className={`loc-item${selected === option.id ? ' active' : ''}`} style={{ marginLeft: option.depth * 14 }} onClick={() => setSelected(option.id)}>
                <span>{option.depth ? '↳ ' : ''}{byId.get(option.id)?.nome}</span>{badge(countFor(option.id))}
              </button>)}
              {!isOpen && <button type="button" className="loc-more" onClick={() => setExpanded({ ...expanded, [key]: true })}>+ {column.items.length - shown.length} complementos · expandir</button>}
            </div>
          </div>
        })}
      </div>
      <div className="loc-legend">
        <span><i className="sw floor"/>Pavimento (vai para o celular)</span>
        <span><i className="sw item"/>Complemento (opcional)</span>
        <span><i className="sw direct"/>Direto na obra</span>
        <span><span className="loc-badge has">2</span>Pendências abertas, somando o que fica dentro</span>
      </div>
    </div>
    <aside className="loc-panel" aria-live="polite">
      {current ? <>
        <small className="loc-eyebrow">LOCAL SELECIONADO</small>
        <h3>{current.nome}</h3>
        <small className="muted">{[workName, currentOption?.path].filter(Boolean).join(' › ')}</small>
        <div className="loc-tags"><span>{current.nivel !== null && current.nivel !== undefined ? `Pavimento ${current.nivel}` : current.local_pai_id ? 'Complemento' : 'Direto na obra'}</span><span className="warn">{currentTasks.length} pendência{currentTasks.length === 1 ? '' : 's'} aberta{currentTasks.length === 1 ? '' : 's'}</span></div>
        <div className="loc-tasks">{currentTasks.length ? currentTasks.slice(0, 8).map((task) => <div key={task.id}><strong>{task.titulo}</strong><small>{[task.prioridade, task.prazo].filter(Boolean).join(' · ')}</small></div>) : <small className="muted">Nenhuma pendência aberta aqui nem dentro.</small>}</div>
        <div className="loc-actions">
          <Button onClick={() => onAddInside(current.id)}>+ Complemento dentro</Button>
          <div className="loc-row">
            <Button variant="secondary" onClick={() => onEdit(current)}>Editar</Button>
            <Link className="button button-secondary" to={`${ROUTES.tasks}?obra=${workId}&local=${current.id}`}>Ver pendências</Link>
          </div>
          <Button variant="ghost" onClick={() => { onRemove(current); setSelected(null) }}>Remover local</Button>
        </div>
      </> : <><small className="loc-eyebrow">LOCAL SELECIONADO</small><p className="muted">Clique num pavimento ou complemento para ver o caminho, as pendências e as ações.</p></>}
    </aside>
  </div>
}
