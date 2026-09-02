import { ArrowRight, BriefcaseBusiness, CalendarClock, Edit3, HardHat, MapPin, NotebookPen, Plus, Trash2, Upload } from 'lucide-react'
import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Confirm, Empty, Field, FormActions, Kpi, Loading, Modal, PageHeader, Status } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { brDate, brl, toCents, today } from '../utils/format'

const initial = { empresa_id: '', nome: '', codigo: '', cliente_id: '', endereco: '', responsavel: '', valor: '', data_inicio: today(), previsao_termino: '', status: 'planejada', observacoes: '' }

export default function WorksPage() {
  const navigate = useNavigate()
  const works = useAsync(() => window.fluxoDre.obras.list(), [])
  const companies = useAsync(() => window.fluxoDre.empresas.list(), [])
  const clients = useAsync(() => window.fluxoDre.clientes.list(), [])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<any>(initial)
  const [selectedId, setSelectedId] = useState('')
  const [remove, setRemove] = useState<any>(null)
  const [importing, setImporting] = useState(false)
  const [notice, setNotice] = useState('')
  const overview = useAsync(() => selectedId ? window.fluxoDre.obras.overview(Number(selectedId)) : Promise.resolve(null), [selectedId])
  const selectedWork = useMemo(() => works.data?.find((work: any) => String(work.id) === selectedId), [works.data, selectedId])

  useEffect(() => {
    if (!works.data?.length) return
    const stillExists = works.data.some((work: any) => String(work.id) === selectedId)
    if (!stillExists) setSelectedId(String(works.data[0].id))
  }, [works.data, selectedId])

  const open = (work?: any) => {
    setForm(work ? { ...work, valor: (work.valor_contratado_centavos / 100).toFixed(2).replace('.', ',') } : initial)
    setModal(true)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const saved = await window.fluxoDre.obras.save({ ...form, empresa_id: Number(form.empresa_id), cliente_id: form.cliente_id ? Number(form.cliente_id) : null, valor_contratado_centavos: toCents(form.valor) })
    setModal(false)
    setSelectedId(String(saved.id))
    works.reload()
  }

  const importSpreadsheets = async () => {
    setImporting(true)
    setNotice('')
    try {
      const result = await window.fluxoDre.obras.importSpreadsheets()
      if (!result?.canceled) {
        setNotice('Importado: ' + (result.obra?.nome || 'obra') + ' com ' + (result.orcamento?.created || 0) + ' itens de orcamento e ' + (result.medicoes?.reduce((sum: number, item: any) => sum + (item.linhas || 0), 0) || 0) + ' linhas de medicao.')
        if (result.obra?.id) setSelectedId(String(result.obra.id))
        works.reload()
      }
    } finally {
      setImporting(false)
    }
  }

  const selectedOverview = overview.data
  const frontCount = selectedOverview?.frentes?.length || 0
  const stageCount = selectedOverview?.cronograma?.length || 0
  const rdoCount = selectedOverview?.rdos?.length || 0
  const pendingCount = selectedOverview?.pendencias?.length || 0
  const totalContratado = selectedOverview?.frentes?.reduce((sum: number, item: any) => sum + Number(item.contratado_centavos || 0), 0) || 0
  const totalPago = selectedOverview?.frentes?.reduce((sum: number, item: any) => sum + Number(item.pago_centavos || 0), 0) || 0

  return <>
    <PageHeader title="Obras" description="Escolha uma obra e acompanhe as areas operacionais em um unico hub." actions={<div className="row-actions"><Button variant="secondary" icon={<Upload size={16}/>} onClick={importSpreadsheets} disabled={importing}>Importar planilhas</Button><Button icon={<Plus size={16}/>} onClick={() => open()}>Nova obra</Button></div>}/>
    {works.loading ? <Card><Loading/></Card> : works.data?.length ? <>
      <div className="filters">
        <Field label="Obra em foco"><select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}><option value="">Selecione uma obra</option>{works.data.map((work: any) => <option key={work.id} value={work.id}>{work.nome}</option>)}</select><small>Os cards abaixo usam esta obra e abrem as telas completas ja filtradas.</small></Field>
      </div>
      <div className="dashboard-grid">
        <Card>
          <div className="card-header"><div><h2>Carteira de obras</h2><span>Selecione a obra de trabalho</span></div></div>
          <div className="work-cards" style={{ gridTemplateColumns: '1fr', padding: 16 }}>
            {works.data.map((work: any) => {
              const isSelected = String(work.id) === selectedId
              return <Card className="work-card" key={work.id} style={{ boxShadow: 'none', borderColor: isSelected ? '#93b4f4' : undefined }}>
                <div onClick={() => setSelectedId(String(work.id))}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <div><h3>{work.nome}</h3><p>{work.codigo || 'Sem codigo'} - {companies.data?.find((company: any) => company.id === work.empresa_id)?.nome_fantasia || 'Empresa'}</p></div>
                    <Status value={work.status}/>
                  </div>
                  <div className="work-metrics">
                    <div><span>Contratado</span><strong>{brl(work.valor_contratado_centavos)}</strong></div>
                    <div><span>Inicio</span><strong>{brDate(work.data_inicio)}</strong></div>
                    <div><span>Avanco fisico</span><strong>{Number(work.percentual_fisico || 0).toFixed(1)}%</strong></div>
                    <div><span>Previsao</span><strong>{brDate(work.previsao_termino)}</strong></div>
                  </div>
                </div>
                <div className="row-actions" style={{ marginTop: 10 }}>
                  <Button type="button" variant={isSelected ? 'primary' : 'secondary'} onClick={() => setSelectedId(String(work.id))}>{isSelected ? 'Selecionada' : 'Selecionar'}</Button>
                  <button className="icon-button" onClick={() => open(work)} title="Editar"><Edit3 size={15}/></button>
                  <button className="icon-button" onClick={() => setRemove(work)} title="Excluir"><Trash2 size={15}/></button>
                </div>
              </Card>
            })}
          </div>
        </Card>
        <Card>
          <div className="card-header"><div><h2>Unidade gerencial</h2><span>{selectedWork?.nome || 'Selecione uma obra'}</span></div>{selectedId && <Button variant="secondary" icon={<ArrowRight size={15}/>} onClick={() => navigate(`/obras/${selectedId}`)}>Abrir 360</Button>}</div>
          {!selectedId ? <Empty title="Selecione uma obra" description="Depois disso os cards mostram os resumos operacionais."/> : overview.loading ? <Loading/> : <div className="card-body">
            <p style={{ fontSize: 12, color: '#647084', display: 'flex', gap: 7, alignItems: 'center', marginTop: 0 }}><MapPin size={15}/>{selectedWork?.endereco || 'Endereco nao informado'}</p>
            <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(130px, 1fr))', marginBottom: 14 }}>
              <Kpi label="Orcado" value={brl(selectedOverview?.orcado_centavos || 0)}/>
              <Kpi label="Contratado" value={brl(totalContratado)}/>
              <Kpi label="Pago" value={brl(totalPago)}/>
              <Kpi label="Pendencias" value={String(pendingCount)}/>
            </div>
            <p style={{ fontSize: 11, color: '#7c8798', marginBottom: 0 }}>{selectedWork?.observacoes || 'Sem observacoes cadastradas.'}</p>
          </div>}
        </Card>
      </div>
      <div className="work-cards" style={{ marginTop: 16 }}>
        <OperationCard icon={<BriefcaseBusiness size={22}/>} title="Frentes de servico" text="Especialidades, subfrentes e checklist por pavimento ou geral." metric={`${frontCount} frentes`} detail={`${selectedOverview?.frentes?.filter((front: any) => front.status === 'ativa').length || 0} ativas`} disabled={!selectedId} onClick={() => navigate(`/frentes?obra=${selectedId}`)}/>
        <OperationCard icon={<CalendarClock size={22}/>} title="Planejamento" text="Etapas, Curva S, previsto x realizado e caixa por obra." metric={`${stageCount} etapas`} detail={selectedOverview?.cronograma?.[0] ? `Proxima: ${selectedOverview.cronograma[0].nome}` : 'Sem etapas'} disabled={!selectedId} onClick={() => navigate(`/planejamento?obra=${selectedId}`)}/>
        <OperationCard icon={<NotebookPen size={22}/>} title="Diario de obra" text="RDOs, equipe, equipamentos, ocorrencias, anexos e pendencias." metric={`${rdoCount} RDOs`} detail={pendingCount ? `${pendingCount} pendencias abertas` : 'Sem pendencias'} disabled={!selectedId} onClick={() => navigate(`/rdo?obra=${selectedId}`)}/>
        <OperationCard icon={<HardHat size={22}/>} title="Obra 360" text="Resumo completo financeiro, operacional, compras, contratos e documentos." metric={brl(selectedOverview?.medido_centavos || 0)} detail="Medido na obra" disabled={!selectedId} onClick={() => navigate(`/obras/${selectedId}`)}/>
      </div>
    </> : <Card><Empty title="Nenhuma obra cadastrada" description="Cadastre a primeira obra para organizar orcamento, medicao e resultado." action={<Button onClick={() => open()}>Cadastrar obra</Button>}/></Card>}
    {notice && <div className="success-box" style={{ marginTop: 14 }}>{notice}</div>}
    <Modal open={modal} title={form.id ? 'Editar obra' : 'Nova obra'} onClose={() => setModal(false)} size="lg"><form onSubmit={submit}><div className="modal-body form-grid form-grid-3"><Field label="Nome" required><input required value={form.nome} onChange={(event) => setForm({ ...form, nome: event.target.value })}/></Field><Field label="Codigo"><input value={form.codigo || ''} onChange={(event) => setForm({ ...form, codigo: event.target.value })}/></Field><Field label="Empresa" required><select required value={form.empresa_id} onChange={(event) => setForm({ ...form, empresa_id: event.target.value })}><option value="">Selecione</option>{companies.data?.map((item: any) => <option value={item.id} key={item.id}>{item.nome_fantasia || item.razao_social}</option>)}</select></Field><Field label="Cliente"><select value={form.cliente_id || ''} onChange={(event) => setForm({ ...form, cliente_id: event.target.value })}><option value="">Sem cliente</option>{clients.data?.map((item: any) => <option value={item.id} key={item.id}>{item.nome}</option>)}</select></Field><Field label="Responsavel"><input value={form.responsavel || ''} onChange={(event) => setForm({ ...form, responsavel: event.target.value })}/></Field><Field label="Valor contratado"><input value={form.valor} onChange={(event) => setForm({ ...form, valor: event.target.value })} placeholder="0,00"/></Field><Field label="Data de inicio"><input type="date" value={form.data_inicio || ''} onChange={(event) => setForm({ ...form, data_inicio: event.target.value })}/></Field><Field label="Previsao de termino"><input type="date" value={form.previsao_termino || ''} onChange={(event) => setForm({ ...form, previsao_termino: event.target.value })}/></Field><Field label="Status"><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="planejada">Planejada</option><option value="ativa">Ativa</option><option value="pausada">Pausada</option><option value="concluida">Concluida</option></select></Field><Field label="Endereco" wide><input value={form.endereco || ''} onChange={(event) => setForm({ ...form, endereco: event.target.value })}/></Field><Field label="Observacoes" wide><textarea value={form.observacoes || ''} onChange={(event) => setForm({ ...form, observacoes: event.target.value })}/></Field></div><FormActions onCancel={() => setModal(false)}/></form></Modal>
    <Confirm open={!!remove} title="Excluir obra" description="A obra sera removida logicamente. Os arquivos fisicos nao serao apagados." danger onCancel={() => setRemove(null)} onConfirm={async () => { await window.fluxoDre.obras.remove(remove.id); setRemove(null); works.reload(); overview.reload() }}/>
  </>
}

function OperationCard({ icon, title, text, metric, detail, disabled, onClick }: { icon: ReactNode; title: string; text: string; metric: string; detail: string; disabled: boolean; onClick: () => void }) {
  return <Card className="work-card" style={{ opacity: disabled ? .55 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }} onClick={() => { if (!disabled) onClick() }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
      <div className="kpi-icon">{icon}</div>
      <ArrowRight size={18} color="#7d8798"/>
    </div>
    <h3 style={{ marginTop: 14 }}>{title}</h3>
    <p>{text}</p>
    <div className="work-metrics" style={{ gridTemplateColumns: '1fr 1fr' }}>
      <div><span>Resumo</span><strong>{metric}</strong></div>
      <div><span>Status</span><strong>{detail}</strong></div>
    </div>
  </Card>
}
