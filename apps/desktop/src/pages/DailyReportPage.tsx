import { ClipboardPlus, Edit3, Paperclip, Plus } from 'lucide-react'
import { FormEvent, useState } from 'react'
import { Button, Card, Empty, Field, FormActions, Loading, Modal, PageHeader, Status } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { brDate, brl, toCents, today } from '../utils/format'

const blank = { obra_id: '', frente_id: '', data: today(), clima: 'ensolarado', status: 'rascunho', atividades: '', observacoes: '', equipe: [], equipamentos: [], ocorrencias: [] }

export default function DailyReportPage() {
  const [work, setWork] = useState(new URLSearchParams(location.search).get('obra') || '')
  const [front, setFront] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<any>(blank)
  const [notice, setNotice] = useState('')
  const works = useAsync(() => window.fluxoDre.obras.list(), [])
  const fronts = useAsync(() => work ? window.fluxoDre.frentes.list({ obra_id: Number(work) }) : Promise.resolve([]), [work])
  const rdos = useAsync(() => work ? window.fluxoDre.rdos.list({ obra_id: Number(work) }) : Promise.resolve([]), [work])
  const employees = useAsync(() => window.fluxoDre.funcionarios.list(), [])
  const rows = (rdos.data || []).filter((rdo: any) => !front || String(rdo.frente_id || '') === front)
  const add = (key: string, row: any) => setForm({ ...form, [key]: [...form[key], row] })
  const change = (key: string, index: number, field: string, value: string) => setForm({ ...form, [key]: form[key].map((row: any, i: number) => i === index ? { ...row, [field]: value } : row) })
  const remove = (key: string, index: number) => setForm({ ...form, [key]: form[key].filter((_: any, i: number) => i !== index) })
  async function open(rdo?: any) {
    if (!rdo) {
      setForm({ ...blank, obra_id: work, frente_id: front })
      setModal(true)
      return
    }
    const [equipe, equipamentos, ocorrencias] = await Promise.all([
      window.fluxoDre.rdoEquipe.list({ rdo_id: rdo.id }),
      window.fluxoDre.rdoEquipamentos.list({ rdo_id: rdo.id }),
      window.fluxoDre.rdoOcorrencias.list({ rdo_id: rdo.id })
    ])
    setForm({
      ...rdo,
      frente_id: rdo.frente_id || '',
      equipe: equipe.map((row: any) => ({ ...row, frente_id: row.frente_id || '', horas: String(row.horas), custo: (row.custo_centavos / 100).toFixed(2).replace('.', ',') })),
      equipamentos: equipamentos.map((row: any) => ({ ...row, frente_id: row.frente_id || '', horas_uso: String(row.horas_uso), custo: (row.custo_centavos / 100).toFixed(2).replace('.', ',') })),
      ocorrencias: ocorrencias.map((row: any) => ({ ...row, frente_id: row.frente_id || '', prazo: row.prazo || '' }))
    })
    setModal(true)
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    await window.fluxoDre.campo.saveRdo({
      ...form,
      obra_id: Number(form.obra_id),
      frente_id: form.frente_id ? Number(form.frente_id) : null,
      equipe: (form.equipe || []).map((row: any) => ({ ...row, frente_id: row.frente_id ? Number(row.frente_id) : form.frente_id ? Number(form.frente_id) : null, custo_centavos: toCents(row.custo || 0) })),
      equipamentos: (form.equipamentos || []).map((row: any) => ({ ...row, frente_id: row.frente_id ? Number(row.frente_id) : form.frente_id ? Number(form.frente_id) : null, custo_centavos: toCents(row.custo || 0) })),
      ocorrencias: (form.ocorrencias || []).map((row: any) => ({ ...row, frente_id: row.frente_id ? Number(row.frente_id) : form.frente_id ? Number(form.frente_id) : null }))
    })
    setModal(false)
    setWork(String(form.obra_id))
    rdos.reload()
  }
  async function attach(rdo: any) {
    const result = await window.fluxoDre.documentos.importForWork({ obra_id: rdo.obra_id, frente_id: rdo.frente_id || null, rdo_id: rdo.id, categoria: 'rdo', title: `RDO ${brDate(rdo.data)}` })
    if (result) setNotice(`Anexo vinculado ao RDO de ${brDate(rdo.data)}.`)
  }
  return <>
    <PageHeader title="Diario de obra" description="Registre diariamente frente, equipe, equipamentos, custos, ocorrencias e anexos." actions={<Button icon={<ClipboardPlus size={16}/>} disabled={!work} onClick={() => open()}>Novo RDO</Button>}/>
    <div className="filters">
      <Field label="Obra"><select value={work} onChange={(event) => { setWork(event.target.value); setFront('') }}><option value="">Selecione</option>{works.data?.map((item: any) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field>
      <Field label="Frente"><select value={front} onChange={(event) => setFront(event.target.value)} disabled={!work}><option value="">Todas</option>{fronts.data?.map((item: any) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field>
    </div>
    {notice && <div className="success-box">{notice}</div>}
    <Card>{rdos.loading ? <Loading/> : rows.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Data</th><th>Frente</th><th>Clima</th><th>Atividades</th><th>Status</th><th/></tr></thead><tbody>{rows.map((rdo: any) => <tr key={rdo.id}><td><strong>{brDate(rdo.data)}</strong></td><td>{fronts.data?.find((item: any) => item.id === rdo.frente_id)?.nome || 'Obra geral'}</td><td>{rdo.clima || '-'}</td><td>{rdo.atividades || '-'}</td><td><Status value={rdo.status}/></td><td><div className="row-actions"><button className="icon-button" onClick={() => open(rdo)} title="Editar"><Edit3 size={15}/></button><button className="icon-button" onClick={() => attach(rdo)} title="Anexar arquivo"><Paperclip size={15}/></button></div></td></tr>)}</tbody></table></div> : <Empty title={work ? 'Nenhum RDO registrado' : 'Selecione uma obra'} description="O RDO substitui anotacoes dispersas em planilhas e mensagens."/>}</Card>
    <Modal open={modal} title={form.id ? 'Editar RDO' : 'Novo RDO'} onClose={() => setModal(false)} size="xl"><form onSubmit={submit}><div className="modal-body">
      <div className="form-grid form-grid-3">
        <Field label="Obra" required><select required value={form.obra_id} onChange={(event) => { setForm({ ...form, obra_id: event.target.value, frente_id: '' }); setWork(event.target.value) }}><option value="">Selecione</option>{works.data?.map((item: any) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field>
        <Field label="Frente principal"><select value={form.frente_id || ''} onChange={(event) => setForm({ ...form, frente_id: event.target.value })}><option value="">Obra geral</option>{fronts.data?.map((item: any) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field>
        <Field label="Data" required><input required type="date" value={form.data} onChange={(event) => setForm({ ...form, data: event.target.value })}/></Field>
        <Field label="Clima"><select value={form.clima} onChange={(event) => setForm({ ...form, clima: event.target.value })}><option value="ensolarado">Ensolarado</option><option value="nublado">Nublado</option><option value="chuva">Chuva</option><option value="intermitente">Chuva intermitente</option></select></Field>
        <Field label="Status"><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="rascunho">Rascunho</option><option value="concluido">Concluido</option></select></Field>
        <Field label="Atividades executadas" wide required><textarea required value={form.atividades} onChange={(event) => setForm({ ...form, atividades: event.target.value })}/></Field>
        <Field label="Observacoes" wide><textarea value={form.observacoes || ''} onChange={(event) => setForm({ ...form, observacoes: event.target.value })}/></Field>
      </div>
      <RdoSection title="Equipe no dia" addLabel="Adicionar pessoa" onAdd={() => add('equipe', { funcionario_id: '', frente_id: form.frente_id || '', nome: '', funcao: '', horas: '8', custo: '0', observacoes: '' })}>{(form.equipe || []).map((row: any, index: number) => <div className="rdo-row" key={index}><select value={row.frente_id || ''} onChange={(event) => change('equipe', index, 'frente_id', event.target.value)}><option value="">Frente principal</option>{fronts.data?.map((item: any) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select><select value={row.funcionario_id || ''} onChange={(event) => { const person = employees.data?.find((item: any) => item.id === Number(event.target.value)); change('equipe', index, 'funcionario_id', event.target.value); if (person) { change('equipe', index, 'nome', person.nome); change('equipe', index, 'funcao', person.cargo_nome || '') } }}><option value="">Avulso / terceirizado</option>{employees.data?.map((person: any) => <option key={person.id} value={person.id}>{person.nome}</option>)}</select><input placeholder="Nome" value={row.nome} onChange={(event) => change('equipe', index, 'nome', event.target.value)}/><input placeholder="Funcao" value={row.funcao || ''} onChange={(event) => change('equipe', index, 'funcao', event.target.value)}/><input type="number" min="0" step="0.5" placeholder="Horas" value={row.horas} onChange={(event) => change('equipe', index, 'horas', event.target.value)}/><input placeholder="Custo" value={row.custo || ''} onChange={(event) => change('equipe', index, 'custo', event.target.value)}/><button type="button" className="icon-button" onClick={() => remove('equipe', index)}>x</button></div>)}</RdoSection>
      <RdoSection title="Equipamentos" addLabel="Adicionar equipamento" onAdd={() => add('equipamentos', { frente_id: form.frente_id || '', nome: '', horas_uso: '0', custo: '0', observacoes: '' })}>{(form.equipamentos || []).map((row: any, index: number) => <div className="rdo-row rdo-equipment" key={index}><select value={row.frente_id || ''} onChange={(event) => change('equipamentos', index, 'frente_id', event.target.value)}><option value="">Frente principal</option>{fronts.data?.map((item: any) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select><input placeholder="Equipamento" value={row.nome} onChange={(event) => change('equipamentos', index, 'nome', event.target.value)}/><input type="number" min="0" step="0.5" placeholder="Horas" value={row.horas_uso} onChange={(event) => change('equipamentos', index, 'horas_uso', event.target.value)}/><input placeholder="Custo" value={row.custo || ''} onChange={(event) => change('equipamentos', index, 'custo', event.target.value)}/><input placeholder="Observacao" value={row.observacoes || ''} onChange={(event) => change('equipamentos', index, 'observacoes', event.target.value)}/><button type="button" className="icon-button" onClick={() => remove('equipamentos', index)}>x</button></div>)}</RdoSection>
      <RdoSection title="Ocorrencias e impedimentos" addLabel="Adicionar ocorrencia" onAdd={() => add('ocorrencias', { frente_id: form.frente_id || '', tipo: 'falta_material', descricao: '', status: 'aberta', prioridade: 'normal', responsavel: '', prazo: '' })}>{(form.ocorrencias || []).map((row: any, index: number) => <div className="rdo-row rdo-occurrence" key={index}><select value={row.frente_id || ''} onChange={(event) => change('ocorrencias', index, 'frente_id', event.target.value)}><option value="">Frente principal</option>{fronts.data?.map((item: any) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select><select value={row.tipo} onChange={(event) => change('ocorrencias', index, 'tipo', event.target.value)}><option value="falta_material">Falta de material</option><option value="atraso">Atraso</option><option value="retrabalho">Retrabalho</option><option value="seguranca">Seguranca</option><option value="qualidade">Qualidade</option><option value="pendencia_cliente">Pendencia do cliente</option></select><input placeholder="Descricao" value={row.descricao} onChange={(event) => change('ocorrencias', index, 'descricao', event.target.value)}/><input placeholder="Responsavel" value={row.responsavel || ''} onChange={(event) => change('ocorrencias', index, 'responsavel', event.target.value)}/><input type="date" value={row.prazo || ''} onChange={(event) => change('ocorrencias', index, 'prazo', event.target.value)}/><select value={row.prioridade || 'normal'} onChange={(event) => change('ocorrencias', index, 'prioridade', event.target.value)}><option value="normal">Normal</option><option value="alta">Alta</option><option value="urgente">Urgente</option></select><select value={row.status} onChange={(event) => change('ocorrencias', index, 'status', event.target.value)}><option value="aberta">Aberta</option><option value="em_andamento">Em andamento</option><option value="resolvida">Resolvida</option></select><button type="button" className="icon-button" onClick={() => remove('ocorrencias', index)}>x</button></div>)}</RdoSection>
      <div className="notice">Anexos e fotos ficam disponiveis pelo botao de anexo depois que o RDO e salvo.</div>
    </div><FormActions onCancel={() => setModal(false)} submitLabel="Salvar RDO"/></form></Modal>
  </>
}

function RdoSection({ title, addLabel, onAdd, children }: { title: string; addLabel: string; onAdd: () => void; children: any }) {
  return <section className="rdo-section"><div><h3>{title}</h3><Button type="button" variant="secondary" icon={<Plus size={14}/>} onClick={onAdd}>{addLabel}</Button></div>{children}</section>
}
