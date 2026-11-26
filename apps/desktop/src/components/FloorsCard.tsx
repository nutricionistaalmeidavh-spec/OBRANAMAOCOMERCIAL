import { Edit3, Plus, Trash2 } from 'lucide-react'
import { FormEvent, useMemo, useState } from 'react'
import { Button, Card, Confirm, Empty, Field, FormActions, Loading, Modal } from './ui'
import { useAsync } from '../hooks/useAsync'
import { locationOptions, locationWithDescendants } from '../utils/locations'
import LocationsDiagram from './LocationsDiagram'

/** Default name for a floor level: 0 = Térreo, negatives = subsolos. */
export function floorName(level: number) {
  if (level === 0) return 'Térreo'
  if (level < 0) return `Subsolo ${-level}`
  return `${level}º pavimento`
}

/**
 * Locais da obra, one canonical list: pavimentos (with a number, published to the phone)
 * and complements that optionally sit inside a pavimento or another complement.
 */
export default function FloorsCard({ workId, disabled }: { workId: string; disabled?: boolean }) {
  const [form, setForm] = useState<any>(null)
  const [remove, setRemove] = useState<any>(null)
  const [error, setError] = useState('')
  const [view, setView] = useState<'list' | 'diagram'>(() => { try { return localStorage.getItem('locais.view') === 'list' ? 'list' : 'diagram' } catch { return 'diagram' } })
  const chooseView = (next: 'list' | 'diagram') => { setView(next); try { localStorage.setItem('locais.view', next) } catch { /* optional */ } }
  const work = useAsync(() => workId ? window.fluxoDre.obras.get(Number(workId)) : Promise.resolve(null), [workId])
  const tasks = useAsync(() => workId && !disabled && view === 'diagram' ? window.fluxoDre.tarefas.list({ obra_id: Number(workId) }) : Promise.resolve([]), [workId, disabled, view])
  const counts = useAsync(() => workId && !disabled && view === 'diagram' ? window.fluxoDre.locais.counts(Number(workId)).catch(() => null) : Promise.resolve(null), [workId, disabled, view])
  const rows = useAsync(() => workId && !disabled ? window.fluxoDre.locais.list({ obra_id: Number(workId) }) : Promise.resolve([]), [workId, disabled])
  const all = useMemo(() => rows.data || [], [rows.data])
  const options = useMemo(() => locationOptions(all), [all])
  const byId = useMemo(() => new Map(all.map((row: any) => [Number(row.id), row])), [all])
  const floors = all.filter((row: any) => row.nivel !== null && row.nivel !== undefined)
  const nextLevel = floors.length ? Math.max(...floors.map((row: any) => Number(row.nivel))) + 1 : 0

  function openFloor(item?: any) {
    setError('')
    setForm(item ? { kind: 'floor', id: item.id, nome: item.nome, nivel: String(item.nivel) } : { kind: 'floor', nome: floorName(nextLevel), nivel: String(nextLevel), auto: true })
  }
  function openComplement(item?: any, parentId?: number) {
    setError('')
    setForm(item ? { kind: 'complement', id: item.id, nome: item.nome, local_pai_id: item.local_pai_id ? String(item.local_pai_id) : '' } : { kind: 'complement', nome: '', local_pai_id: parentId ? String(parentId) : '' })
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    try {
      if (form.kind === 'floor') {
        const level = Number(form.nivel)
        if (!Number.isInteger(level) || level < -20 || level > 400) { setError('Informe o número do pavimento: 0 para térreo, negativo para subsolo.'); return }
        if (floors.some((row: any) => Number(row.nivel) === level && row.id !== form.id)) { setError('Já existe um pavimento com esse número nesta obra.'); return }
        await window.fluxoDre.locais.save({ ...(form.id ? { id: form.id } : {}), obra_id: Number(workId), nome: String(form.nome || floorName(level)).trim(), tipo: 'pavimento', nivel: level, ordem: level, local_pai_id: null })
      } else {
        const nome = String(form.nome || '').trim()
        if (!nome) { setError('Informe o nome do local.'); return }
        await window.fluxoDre.locais.save({ ...(form.id ? { id: form.id } : {}), obra_id: Number(workId), nome, tipo: 'complemento', nivel: null, local_pai_id: form.local_pai_id ? Number(form.local_pai_id) : null })
      }
      setForm(null)
      rows.reload()
      counts.reload()
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível salvar o local.') }
  }
  async function confirmRemove() {
    try { await window.fluxoDre.locais.remove(remove.id, remove.revision); setRemove(null); rows.reload() }
    catch { setRemove(null); setError('Este local tem locais dentro dele ou está em uso (orçamento, pendências ou RDO) e não pode ser removido.') }
  }
  // A complement cannot move inside itself or inside something it contains.
  const blocked = form?.id ? locationWithDescendants(all, form.id) : new Set<number>()

  return <Card style={{ marginTop: 16 }}>
    <div className="card-header"><div><h2>Locais da obra</h2><span>Pavimentos vão para o celular (Obra360). Complementos (guarita, apto, banheiro…) ficam dentro de um pavimento ou de outro local, se quiser.</span></div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="segmented" role="group" aria-label="Forma de ver">
          <button type="button" className={view === 'list' ? 'active' : ''} aria-pressed={view === 'list'} onClick={() => chooseView('list')}>Lista</button>
          <button type="button" className={view === 'diagram' ? 'active' : ''} aria-pressed={view === 'diagram'} onClick={() => chooseView('diagram')}>Diagrama</button>
        </div>
        <Button variant="secondary" icon={<Plus size={15}/>} disabled={!workId || disabled} onClick={() => openFloor()}>Pavimento</Button>
        <Button variant="secondary" icon={<Plus size={15}/>} disabled={!workId || disabled} onClick={() => openComplement()}>Complemento</Button>
      </div></div>
    {rows.loading ? <Loading/> : options.length && view === 'diagram' ? <LocationsDiagram workId={workId} workName={work.data?.nome || ''} locations={all} counts={counts.data} tasks={tasks.data || []} onAddInside={(id) => openComplement(undefined, id)} onEdit={(item) => item.nivel !== null && item.nivel !== undefined ? openFloor(item) : openComplement(item)} onRemove={(item) => setRemove(item)}/> : options.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Local</th><th>Tipo</th><th/></tr></thead><tbody>
      {options.map((option) => { const item: any = byId.get(option.id); return <tr key={option.id}>
        <td style={{ paddingLeft: 12 + option.depth * 20 }}><strong>{option.depth ? '↳ ' : ''}{item.nome}</strong></td>
        <td>{option.floor ? `Pavimento ${item.nivel}` : option.orphan && !option.depth ? 'Direto na obra' : 'Complemento'}</td>
        <td className="row-actions">
          <Button variant="ghost" icon={<Plus size={14}/>} onClick={() => openComplement(undefined, option.id)}>Dentro</Button>
          <Button variant="ghost" icon={<Edit3 size={14}/>} onClick={() => option.floor ? openFloor(item) : openComplement(item)}>Editar</Button>
          <Button variant="ghost" icon={<Trash2 size={14}/>} onClick={() => setRemove(item)}>Remover</Button></td></tr> })}
    </tbody></table></div> : <Empty title={workId ? 'Nenhum local cadastrado' : 'Selecione uma obra'} description="Cadastre térreo, subsolos e andares. Depois, se quiser, os complementos de cada um." action={workId && !disabled ? <Button onClick={() => openFloor()}>Cadastrar primeiro pavimento</Button> : undefined}/>}
    {error && <p role="alert" style={{ color: '#b42318' }}>{error}</p>}
    <Modal open={!!form} title={form?.kind === 'floor' ? 'Pavimento' : 'Complemento'} onClose={() => setForm(null)}><form onSubmit={submit}><div className="modal-body form-grid">
      {form?.kind === 'floor'
        ? <Field label="Número" required><input required type="number" min={-20} max={400} step={1} value={form?.nivel ?? ''} onChange={(event) => setForm({ ...form, nivel: event.target.value, ...(form?.auto ? { nome: floorName(Number(event.target.value)) } : {}) })}/></Field>
        : <Field label="Fica em"><select value={form?.local_pai_id || ''} onChange={(event) => setForm({ ...form, local_pai_id: event.target.value })}><option value="">Direto na obra</option>{options.filter((option) => !blocked.has(option.id)).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></Field>}
      <Field label="Nome" required><input required value={form?.nome || ''} onChange={(event) => setForm({ ...form, nome: event.target.value, auto: false })} placeholder={form?.kind === 'floor' ? 'Ex.: Térreo, 1º pavimento, Cobertura' : 'Ex.: Guarita, Apto 101, Banheiro'}/></Field>
    </div><FormActions onCancel={() => setForm(null)} submitLabel="Salvar local"/></form></Modal>
    <Confirm open={!!remove} title="Remover local" description="Só é possível remover um local vazio e sem uso. Se for um pavimento, o que já foi registrado nele no celular é mantido e aparece como fora do cadastro." danger onCancel={() => setRemove(null)} onConfirm={confirmRemove}/>
  </Card>
}
