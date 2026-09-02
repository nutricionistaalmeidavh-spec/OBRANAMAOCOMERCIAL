import { CheckCircle2, Edit3, Plus, RotateCcw } from 'lucide-react'
import { FormEvent, useMemo, useState } from 'react'
import { Button, Card, Empty, Field, FormActions, Loading, Modal, PageHeader, Status } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { brDate, today } from '../utils/format'

const blank = { obra_id: '', frente_id: '', titulo: '', descricao: '', responsavel: '', prazo: today(), prioridade: 'normal', status: 'aberta', origem_tipo: 'manual' }

export default function TasksPage() {
  const [work, setWork] = useState(new URLSearchParams(location.search).get('obra') || '')
  const [front, setFront] = useState('')
  const [status, setStatus] = useState('ativas')
  const [form, setForm] = useState<any>(null)
  const works = useAsync(() => window.fluxoDre.obras.list(), [])
  const fronts = useAsync(() => work ? window.fluxoDre.frentes.list({ obra_id: Number(work) }) : Promise.resolve([]), [work])
  const tasks = useAsync(() => work ? window.fluxoDre.tarefas.list({ obra_id: Number(work) }) : Promise.resolve([]), [work])
  const rows = useMemo(() => (tasks.data || []).filter((task: any) => {
    const statusOk = status === 'todas' || (status === 'ativas' ? !['concluida', 'cancelada'].includes(task.status) : task.status === status)
    const frontOk = !front || String(task.frente_id || '') === front
    return statusOk && frontOk
  }), [tasks.data, status, front])
  async function save(event: FormEvent) {
    event.preventDefault()
    await window.fluxoDre.tarefas.save({ ...form, obra_id: Number(form.obra_id), frente_id: form.frente_id ? Number(form.frente_id) : null, origem_tipo: form.origem_tipo || 'manual' })
    setForm(null)
    tasks.reload()
  }
  async function setTaskStatus(task: any, next: string) {
    await window.fluxoDre.tarefas.save({ id: task.id, status: next, concluido_em: next === 'concluida' ? today() : null })
    tasks.reload()
  }
  const open = (task?: any) => setForm(task ? { ...task, frente_id: task.frente_id || '', prazo: task.prazo || '' } : { ...blank, obra_id: work })
  return <>
    <PageHeader title="Tarefas e pendencias" description="Acompanhe responsaveis, prazo, origem e prioridade por obra e frente." actions={<Button icon={<Plus size={16}/>} disabled={!work} onClick={() => open()}>Nova pendencia</Button>}/>
    <div className="filters">
      <Field label="Obra"><select value={work} onChange={(event) => { setWork(event.target.value); setFront('') }}><option value="">Selecione</option>{works.data?.map((item: any) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field>
      <Field label="Frente"><select value={front} onChange={(event) => setFront(event.target.value)} disabled={!work}><option value="">Todas</option>{fronts.data?.map((item: any) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field>
      <Field label="Status"><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="ativas">Ativas</option><option value="aberta">Aberta</option><option value="em_andamento">Em andamento</option><option value="concluida">Concluida</option><option value="todas">Todas</option></select></Field>
    </div>
    <Card>{tasks.loading ? <Loading/> : rows.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Tarefa</th><th>Origem</th><th>Frente</th><th>Responsavel</th><th>Prazo</th><th>Status</th><th/></tr></thead><tbody>{rows.map((item: any) => {
      const overdue = item.prazo && item.prazo < today() && !['concluida', 'cancelada'].includes(item.status)
      return <tr key={item.id}><td><strong>{item.titulo}</strong><small>{item.descricao}</small></td><td>{item.origem_tipo === 'rdo_ocorrencia' ? 'RDO' : item.origem_tipo || 'manual'}</td><td>{fronts.data?.find((frontItem: any) => frontItem.id === item.frente_id)?.nome || 'Obra geral'}</td><td>{item.responsavel || '-'}</td><td>{brDate(item.prazo)}{overdue && <small className="danger-text">Atrasada</small>}</td><td><Status value={item.status}/></td><td><div className="row-actions"><button className="icon-button" onClick={() => open(item)} title="Editar"><Edit3 size={15}/></button>{item.status === 'concluida' ? <button className="icon-button" onClick={() => setTaskStatus(item, 'aberta')} title="Reabrir"><RotateCcw size={15}/></button> : <button className="icon-button" onClick={() => setTaskStatus(item, 'concluida')} title="Concluir"><CheckCircle2 size={15}/></button>}</div></td></tr>
    })}</tbody></table></div> : <Empty title={work ? 'Nenhuma pendencia neste filtro' : 'Selecione uma obra'} description="Registre pendencias manuais ou acompanhe as geradas pelo RDO."/>}</Card>
    <Modal open={!!form} title={form?.id ? 'Editar pendencia' : 'Nova pendencia'} onClose={() => setForm(null)}><form onSubmit={save}><div className="modal-body form-grid">
      <Field label="Frente"><select value={form?.frente_id || ''} onChange={(event) => setForm({ ...form, frente_id: event.target.value })}><option value="">Obra geral</option>{fronts.data?.map((item: any) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field>
      <Field label="Titulo" required><input required value={form?.titulo || ''} onChange={(event) => setForm({ ...form, titulo: event.target.value })}/></Field>
      <Field label="Responsavel"><input value={form?.responsavel || ''} onChange={(event) => setForm({ ...form, responsavel: event.target.value })}/></Field>
      <Field label="Prazo"><input type="date" value={form?.prazo || ''} onChange={(event) => setForm({ ...form, prazo: event.target.value })}/></Field>
      <Field label="Prioridade"><select value={form?.prioridade || 'normal'} onChange={(event) => setForm({ ...form, prioridade: event.target.value })}><option value="baixa">Baixa</option><option value="normal">Normal</option><option value="alta">Alta</option><option value="urgente">Urgente</option></select></Field>
      <Field label="Status"><select value={form?.status || 'aberta'} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="aberta">Aberta</option><option value="em_andamento">Em andamento</option><option value="concluida">Concluida</option><option value="cancelada">Cancelada</option></select></Field>
      <Field label="Descricao" wide><textarea value={form?.descricao || ''} onChange={(event) => setForm({ ...form, descricao: event.target.value })}/></Field>
    </div><FormActions onCancel={() => setForm(null)}/></form></Modal>
  </>
}
