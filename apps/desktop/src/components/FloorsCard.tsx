import { Edit3, Plus, Trash2 } from 'lucide-react'
import { FormEvent, useMemo, useState } from 'react'
import { Button, Card, Confirm, Empty, Field, FormActions, Loading, Modal } from './ui'
import { useAsync } from '../hooks/useAsync'

/** Default name for a floor level: 0 = Térreo, negatives = subsolos. */
export function floorName(level: number) {
  if (level === 0) return 'Térreo'
  if (level < 0) return `Subsolo ${-level}`
  return `${level}º pavimento`
}

/**
 * Pavimentos da obra: canonical locais owned by the Desktop and published to the
 * phone (Obra360). The phone only shows this list; it no longer keeps its own.
 */
export default function FloorsCard({ workId, disabled }: { workId: string; disabled?: boolean }) {
  const [form, setForm] = useState<any>(null)
  const [remove, setRemove] = useState<any>(null)
  const [error, setError] = useState('')
  const rows = useAsync(() => workId && !disabled ? window.fluxoDre.locais.list({ obra_id: Number(workId) }) : Promise.resolve([]), [workId, disabled])
  const floors = useMemo(() => (rows.data || []).filter((row: any) => row.nivel !== null && row.nivel !== undefined).sort((a: any, b: any) => Number(a.nivel) - Number(b.nivel)), [rows.data])
  const nextLevel = floors.length ? Math.max(...floors.map((row: any) => Number(row.nivel))) + 1 : 0

  function open(item?: any) {
    setError('')
    setForm(item ? { id: item.id, nome: item.nome, nivel: String(item.nivel) } : { nome: floorName(nextLevel), nivel: String(nextLevel), auto: true })
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    const level = Number(form.nivel)
    if (!Number.isInteger(level) || level < -20 || level > 400) { setError('Informe o número do pavimento: 0 para térreo, negativo para subsolo.'); return }
    if (floors.some((row: any) => Number(row.nivel) === level && row.id !== form.id)) { setError('Já existe um pavimento com esse número nesta obra.'); return }
    try {
      await window.fluxoDre.locais.save({ ...(form.id ? { id: form.id } : {}), obra_id: Number(workId), nome: String(form.nome || floorName(level)).trim(), tipo: 'pavimento', nivel: level, ordem: level })
      setForm(null)
      rows.reload()
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível salvar o pavimento.') }
  }
  async function confirmRemove() {
    try { await window.fluxoDre.locais.remove(remove.id, remove.revision); setRemove(null); rows.reload() }
    catch { setRemove(null); setError('Este pavimento está em uso no orçamento e não pode ser removido.') }
  }

  return <Card style={{ marginTop: 16 }}>
    <div className="card-header"><div><h2>Pavimentos</h2><span>Lista oficial da obra, enviada ao celular (Obra360) na sincronização.</span></div>
      <Button variant="secondary" icon={<Plus size={15}/>} disabled={!workId || disabled} onClick={() => open()}>Adicionar pavimento</Button></div>
    {rows.loading ? <Loading/> : floors.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Pavimento</th><th>Número</th><th/></tr></thead><tbody>
      {floors.map((item: any) => <tr key={item.id}><td><strong>{item.nome}</strong></td><td>{item.nivel}</td><td className="row-actions">
        <Button variant="ghost" icon={<Edit3 size={14}/>} onClick={() => open(item)}>Editar</Button>
        <Button variant="ghost" icon={<Trash2 size={14}/>} onClick={() => setRemove(item)}>Remover</Button></td></tr>)}
    </tbody></table></div> : <Empty title={workId ? 'Nenhum pavimento cadastrado' : 'Selecione uma obra'} description="Cadastre térreo, subsolos e andares. O celular passa a mostrar exatamente esta lista." action={workId && !disabled ? <Button onClick={() => open()}>Cadastrar primeiro pavimento</Button> : undefined}/>}
    {error && <p role="alert" style={{ color: '#b42318' }}>{error}</p>}
    <Modal open={!!form} title="Pavimento" onClose={() => setForm(null)}><form onSubmit={submit}><div className="modal-body form-grid">
      <Field label="Número" required><input required type="number" min={-20} max={400} step={1} value={form?.nivel ?? ''} onChange={(event) => setForm({ ...form, nivel: event.target.value, ...(form?.auto ? { nome: floorName(Number(event.target.value)) } : {}) })}/></Field>
      <Field label="Nome" required><input required value={form?.nome || ''} onChange={(event) => setForm({ ...form, nome: event.target.value, auto: false })} placeholder="Ex.: Térreo, 1º pavimento, Cobertura"/></Field>
    </div><FormActions onCancel={() => setForm(null)} submitLabel="Salvar pavimento"/></form></Modal>
    <Confirm open={!!remove} title="Remover pavimento" description="O pavimento deixa de aparecer no celular. O que já foi registrado nele no celular é mantido e aparece como fora do cadastro." danger onCancel={() => setRemove(null)} onConfirm={confirmRemove}/>
  </Card>
}
