import { ArrowRight, BriefcaseBusiness, CalendarClock, Edit3, HardHat, MapPin, NotebookPen, Plus, Trash2, Upload } from 'lucide-react'
import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Confirm, Empty, Field, FormActions, Kpi, Loading, Modal, PageHeader, Status } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { brDate, brl, toCents, today } from '../utils/format'

const initial = { empresa_id: '', nome: '', codigo: '', cliente_id: '', endereco: '', responsavel: '', valor: '', data_inicio: today(), previsao_termino: '', status: 'planejada', observacoes: '' }
type QuickRegistryKind = 'empresa' | 'cliente'

const quickCompanyInitial = { razao_social: '', nome_fantasia: '', cnpj: '', telefone: '', email: '', endereco: '', observacoes: '' }
const quickClientInitial = { nome: '', documento: '', telefone: '', email: '', observacoes: '' }

export default function WorksPage() {
  const navigate = useNavigate()
  const works = useAsync(() => window.fluxoDre.obras.list(), [])
  const companies = useAsync(() => window.fluxoDre.empresas.list(), [])
  const clients = useAsync(() => window.fluxoDre.clientes.list(), [])
  const storage = useAsync(() => window.fluxoDre.storage.state(), [])
  const moduleStates = useAsync(async () => {
    const [core, operation, planning, finance, rh] = await Promise.all([
      window.fluxoDre.storage.moduleState('core'),
      window.fluxoDre.storage.moduleState('operation'),
      window.fluxoDre.storage.moduleState('planning'),
      window.fluxoDre.storage.moduleState('finance'),
      window.fluxoDre.storage.moduleState('rh')
    ])
    return { core, operation, planning, finance, rh }
  }, [])
  const serverMode = storage.data?.mode === 'server'
  const moduleActive = (module: 'core'|'operation'|'planning'|'finance'|'rh') => !serverMode || moduleStates.data?.[module]?.state === 'central-active'
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<any>(initial)
  const [selectedId, setSelectedId] = useState('')
  const [remove, setRemove] = useState<any>(null)
  const [importing, setImporting] = useState(false)
  const [notice, setNotice] = useState('')
  const [quickRegistry, setQuickRegistry] = useState<QuickRegistryKind | null>(null)
  const [quickForm, setQuickForm] = useState<any>(null)
  const [quickSaving, setQuickSaving] = useState(false)
  const [quickError, setQuickError] = useState('')
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

  const openQuickRegistry = (kind: QuickRegistryKind) => {
    setQuickRegistry(kind)
    setQuickForm(kind === 'empresa' ? { ...quickCompanyInitial } : { ...quickClientInitial })
    setQuickError('')
  }

  const closeQuickRegistry = () => {
    if (quickSaving) return
    setQuickRegistry(null)
    setQuickForm(null)
    setQuickError('')
  }

  const submitQuickRegistry = async (event: FormEvent) => {
    event.preventDefault()
    if (!quickRegistry || !quickForm) return
    setQuickSaving(true)
    setQuickError('')
    try {
      if (quickRegistry === 'empresa') {
        const saved = await window.fluxoDre.empresas.save({ ...quickForm, status: 'ativa' })
        companies.setData((previous: any) => [...(previous || []).filter((item: any) => item.id !== saved.id), saved])
        setForm((current: any) => ({ ...current, empresa_id: String(saved.id) }))
      } else {
        const saved = await window.fluxoDre.clientes.save({ ...quickForm, status: 'ativa' })
        clients.setData((previous: any) => [...(previous || []).filter((item: any) => item.id !== saved.id), saved])
        setForm((current: any) => ({ ...current, cliente_id: String(saved.id) }))
      }
      setQuickRegistry(null)
      setQuickForm(null)
    } catch (error) {
      setQuickError(error instanceof Error ? error.message : 'Não foi possível salvar o cadastro.')
    } finally {
      setQuickSaving(false)
    }
  }

  const importSpreadsheets = async () => {
    if (serverMode) return
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
  const pendingCount = selectedOverview?.pendências?.length || 0
  const totalContratado = selectedOverview?.frentes?.reduce((sum: number, item: any) => sum + Number(item.contratado_centavos || 0), 0) || 0
  const totalPago = selectedOverview?.frentes?.reduce((sum: number, item: any) => sum + Number(item.pago_centavos || 0), 0) || 0

  return <>
    <PageHeader title="Obras" description="Escolha a obra atual e acesse execução, planejamento e resultado em um único lugar." actions={<div className="row-actions"><Button variant="secondary" icon={<Upload size={16}/>} onClick={importSpreadsheets} disabled={importing||serverMode}>Importar planilhas</Button><Button icon={<Plus size={16}/>} onClick={() => open()}>Nova obra</Button></div>}/>
    {serverMode && <div className="success-box" style={{ marginBottom: 14 }}><strong>Servidor da empresa ativo.</strong> As áreas disponíveis abaixo usam os dados compartilhados da empresa.</div>}
    {works.loading ? <Card><Loading/></Card> : works.data?.length ? <>
      <div className="filters">
        <Field label="Obra atual"><select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}><option value="">Selecione uma obra</option>{works.data.map((work: any) => <option key={work.id} value={work.id}>{work.nome}</option>)}</select><small>{serverMode ? 'Esta seleção define a obra usada nos acessos e resumos abaixo.' : 'Esta seleção define a obra usada nos acessos e resumos abaixo.'}</small></Field>
      </div>
      <div className="dashboard-grid">
        <Card>
          <div className="card-header"><div><h2>Todas as obras</h2><span>Troque a obra atual sem perder o contexto</span></div></div>
          <div className="work-cards" style={{ gridTemplateColumns: '1fr', padding: 16 }}>
            {works.data.map((work: any) => {
              const isSelected = String(work.id) === selectedId
              return <Card className="work-card" key={work.id} style={{ boxShadow: 'none', borderColor: isSelected ? '#93b4f4' : undefined }}>
                <div onClick={() => setSelectedId(String(work.id))}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <div><h3>{work.nome}</h3><p>{work.codigo || 'Sem código'} - {companies.data?.find((company: any) => company.id === work.empresa_id)?.nome_fantasia || 'Empresa'}</p></div>
                    <Status value={work.status}/>
                  </div>
                  <div className="work-metrics">
                    <div><span>Contratado</span><strong>{brl(work.valor_contratado_centavos)}</strong></div>
                    <div><span>Início</span><strong>{brDate(work.data_inicio)}</strong></div>
                    <div><span>Avanço físico</span><strong>{Number(work.percentual_fisico || 0).toFixed(1)}%</strong></div>
                    <div><span>Previsão</span><strong>{brDate(work.previsao_termino)}</strong></div>
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
          <div className="card-header"><div><h2>Resumo da obra</h2><span>{selectedWork?.nome || 'Selecione uma obra'}</span></div>{selectedId && moduleActive('core') && <Button variant="secondary" icon={<ArrowRight size={15}/>} onClick={() => navigate(`/obras/${selectedId}`)}>Abrir 360</Button>}</div>
          {!selectedId ? <Empty title="Selecione uma obra" description="Depois disso os cards mostram os resumos operacionais."/> : !moduleActive('core') ? <Empty title="Esta obra ainda está sendo preparada" description="Conclua a configuração do servidor para liberar o resumo desta obra."/> : overview.loading ? <Loading/> : <div className="card-body">
            <p style={{ fontSize: 12, color: '#647084', display: 'flex', gap: 7, alignItems: 'center', marginTop: 0 }}><MapPin size={15}/>{selectedWork?.endereco || 'Endereço não informado'}</p>
            <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(130px, 1fr))', marginBottom: 14 }}>
              <Kpi label="Orçado" value={brl(selectedOverview?.orcado_centavos || 0)}/>
              <Kpi label="Contratado" value={brl(totalContratado)}/>
              <Kpi label="Pago" value={brl(totalPago)}/>
              <Kpi label="Pendências" value={String(pendingCount)}/>
            </div>
            <p style={{ fontSize: 11, color: '#7c8798', marginBottom: 0 }}>{selectedWork?.observacoes || 'Sem observações cadastradas.'}</p>
          </div>}
        </Card>
      </div>
      <div className="work-cards" style={{ marginTop: 16 }}>
        <OperationCard icon={<BriefcaseBusiness size={22}/>} title="Frentes de serviço" text="Especialidades, subfrentes e checklist por pavimento ou geral." metric={`${frontCount} frentes`} detail={`${selectedOverview?.frentes?.filter((front: any) => front.status === 'ativa').length || 0} ativas`} disabled={!selectedId||!moduleActive('operation')} disabledReason={serverMode&&!moduleActive('operation')?'Esta área ainda está sendo preparada no servidor.':undefined} onClick={() => navigate(`/frentes?obra=${selectedId}`)}/>
        <OperationCard icon={<CalendarClock size={22}/>} title="Planejamento" text="Etapas, Curva S, previsto x realizado e caixa por obra." metric={`${stageCount} etapas`} detail={selectedOverview?.cronograma?.[0] ? `Próxima: ${selectedOverview.cronograma[0].nome}` : 'Sem etapas'} disabled={!selectedId||!moduleActive('planning')} disabledReason={serverMode&&!moduleActive('planning')?'Esta área ainda está sendo preparada no servidor.':undefined} onClick={() => navigate(`/planejamento?obra=${selectedId}`)}/>
        <OperationCard icon={<NotebookPen size={22}/>} title="Diário de obra" text="RDOs, equipe, equipamentos, ocorrências, anexos e pendências." metric={`${rdoCount} RDOs`} detail={pendingCount ? `${pendingCount} pendências abertas` : 'Sem pendências'} disabled={!selectedId||!moduleActive('operation')} disabledReason={serverMode&&!moduleActive('operation')?'Esta área ainda está sendo preparada no servidor.':undefined} onClick={() => navigate(`/rdo?obra=${selectedId}`)}/>
        <OperationCard icon={<HardHat size={22}/>} title="Obra 360" text="Resumo financeiro e operacional da obra." metric={selectedOverview?.availability?.medicoes===false?'—':brl(selectedOverview?.medido_centavos || 0)} detail={selectedOverview?.serverPartial?'Resumo disponível':'Medições da obra'} disabled={!selectedId||!moduleActive('core')} disabledReason={serverMode&&!moduleActive('core')?'Esta área ainda está sendo preparada no servidor.':undefined} onClick={() => navigate(`/obras/${selectedId}`)}/>
      </div>
    </> : <Card><Empty title="Nenhuma obra cadastrada" description="Cadastre a primeira obra para organizar orçamento, medições e resultado." action={<Button onClick={() => open()}>Cadastrar obra</Button>}/></Card>}
    {notice && <div className="success-box" style={{ marginTop: 14 }}>{notice}</div>}
    <Modal open={modal} title={form.id ? 'Editar obra' : 'Nova obra'} onClose={() => setModal(false)} size="lg">
      <form onSubmit={submit}>
        <div className="modal-body form-grid form-grid-3">
          <Field label="Nome" required><input required value={form.nome} onChange={(event) => setForm({ ...form, nome: event.target.value })}/></Field>
          <Field label="Código"><input value={form.codigo || ''} onChange={(event) => setForm({ ...form, codigo: event.target.value })}/></Field>
          <Field label="Empresa" required>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8 }}>
              <select required value={form.empresa_id} onChange={(event) => setForm({ ...form, empresa_id: event.target.value })}><option value="">Selecione</option>{companies.data?.map((item: any) => <option value={item.id} key={item.id}>{item.nome_fantasia || item.razao_social}</option>)}</select>
              <button type="button" className="icon-button" onClick={() => openQuickRegistry('empresa')} title="Cadastrar nova empresa" aria-label="Cadastrar nova empresa"><Plus size={16}/></button>
            </div>
          </Field>
          <Field label="Cliente">
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8 }}>
              <select value={form.cliente_id || ''} onChange={(event) => setForm({ ...form, cliente_id: event.target.value })}><option value="">Sem cliente</option>{clients.data?.map((item: any) => <option value={item.id} key={item.id}>{item.nome}</option>)}</select>
              <button type="button" className="icon-button" onClick={() => openQuickRegistry('cliente')} title="Cadastrar novo cliente" aria-label="Cadastrar novo cliente"><Plus size={16}/></button>
            </div>
          </Field>
          <Field label="Responsável"><input value={form.responsavel || ''} onChange={(event) => setForm({ ...form, responsavel: event.target.value })}/></Field>
          <Field label="Valor contratado"><input value={form.valor} onChange={(event) => setForm({ ...form, valor: event.target.value })} placeholder="0,00"/></Field>
          <Field label="Data de início"><input type="date" value={form.data_inicio || ''} onChange={(event) => setForm({ ...form, data_inicio: event.target.value })}/></Field>
          <Field label="Previsão de termino"><input type="date" value={form.previsao_termino || ''} onChange={(event) => setForm({ ...form, previsao_termino: event.target.value })}/></Field>
          <Field label="Status"><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="planejada">Planejada</option><option value="ativa">Ativa</option><option value="pausada">Pausada</option><option value="concluida">Concluída</option></select></Field>
          <Field label="Endereço" wide><input value={form.endereco || ''} onChange={(event) => setForm({ ...form, endereco: event.target.value })}/></Field>
          <Field label="Observações" wide><textarea value={form.observacoes || ''} onChange={(event) => setForm({ ...form, observacoes: event.target.value })}/></Field>
        </div>
        <FormActions onCancel={() => setModal(false)}/>
      </form>
    </Modal>
    <Modal open={!!quickRegistry} title={quickRegistry === 'empresa' ? 'Nova empresa' : 'Novo cliente'} onClose={closeQuickRegistry}>
      <form onSubmit={submitQuickRegistry}>
        <div className="modal-body form-grid">
          {quickRegistry === 'empresa' ? <>
            <Field label="Razão social" required><input required value={quickForm?.razao_social || ''} onChange={(event) => setQuickForm({ ...quickForm, razao_social: event.target.value })}/></Field>
            <Field label="Nome fantasia"><input value={quickForm?.nome_fantasia || ''} onChange={(event) => setQuickForm({ ...quickForm, nome_fantasia: event.target.value })}/></Field>
            <Field label="CNPJ"><input value={quickForm?.cnpj || ''} onChange={(event) => setQuickForm({ ...quickForm, cnpj: event.target.value })}/></Field>
            <Field label="Telefone"><input value={quickForm?.telefone || ''} onChange={(event) => setQuickForm({ ...quickForm, telefone: event.target.value })}/></Field>
            <Field label="E-mail"><input type="email" value={quickForm?.email || ''} onChange={(event) => setQuickForm({ ...quickForm, email: event.target.value })}/></Field>
            <Field label="Endereço" wide><input value={quickForm?.endereco || ''} onChange={(event) => setQuickForm({ ...quickForm, endereco: event.target.value })}/></Field>
            <Field label="Observações" wide><textarea value={quickForm?.observacoes || ''} onChange={(event) => setQuickForm({ ...quickForm, observacoes: event.target.value })}/></Field>
          </> : <>
            <Field label="Nome" required><input required value={quickForm?.nome || ''} onChange={(event) => setQuickForm({ ...quickForm, nome: event.target.value })}/></Field>
            <Field label="CPF/CNPJ"><input value={quickForm?.documento || ''} onChange={(event) => setQuickForm({ ...quickForm, documento: event.target.value })}/></Field>
            <Field label="Telefone"><input value={quickForm?.telefone || ''} onChange={(event) => setQuickForm({ ...quickForm, telefone: event.target.value })}/></Field>
            <Field label="E-mail"><input type="email" value={quickForm?.email || ''} onChange={(event) => setQuickForm({ ...quickForm, email: event.target.value })}/></Field>
            <Field label="Observações" wide><textarea value={quickForm?.observacoes || ''} onChange={(event) => setQuickForm({ ...quickForm, observacoes: event.target.value })}/></Field>
          </>}
          {quickError && <p role="alert" className="field-wide" style={{ margin: 0, color: '#b42318', fontSize: 12 }}>{quickError}</p>}
        </div>
        <FormActions onCancel={closeQuickRegistry} submitLabel="Cadastrar" loading={quickSaving}/>
      </form>
    </Modal>
    <Confirm open={!!remove} title="Excluir obra" description="A obra será desativada. Os arquivos físicos não serão apagados." danger onCancel={() => setRemove(null)} onConfirm={async () => { await window.fluxoDre.obras.remove(remove.id); setRemove(null); works.reload(); overview.reload() }}/>
  </>
}

function OperationCard({ icon, title, text, metric, detail, disabled, disabledReason, onClick }: { icon: ReactNode; title: string; text: string; metric: string; detail: string; disabled: boolean; disabledReason?: string; onClick: () => void }) {
  return <Card className="work-card" title={disabledReason} style={{ opacity: disabled ? .55 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }} onClick={() => { if (!disabled) onClick() }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
      <div className="kpi-icon">{icon}</div>
      <ArrowRight size={18} color="#7d8798"/>
    </div>
    <h3 style={{ marginTop: 14 }}>{title}</h3>
    <p>{text}</p>
    <div className="work-metrics" style={{ gridTemplateColumns: '1fr 1fr' }}>
      <div><span>Resumo</span><strong>{metric}</strong></div>
      <div><span>Status</span><strong>{disabledReason || detail}</strong></div>
    </div>
  </Card>
}