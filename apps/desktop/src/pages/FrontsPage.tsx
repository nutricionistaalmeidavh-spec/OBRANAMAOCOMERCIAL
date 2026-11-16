import { CheckCircle2, ClipboardCheck, Edit3, Plus, Trash2 } from 'lucide-react'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, Confirm, Empty, Field, FormActions, Loading, Modal, PageHeader, Status } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { brDate, today } from '../utils/format'

const frontInitial = { obra_id: '', nome: '', codigo: '', ordem: '0', status: 'ativa', observacoes: '' }
const subInitial = { obra_id: '', frente_id: '', nome: '', codigo: '', pavimento: 'Geral', escopo: '', ordem: '0', status: 'ativa', observacoes: '' }
const checklistInitial = { obra_id: '', frente_id: '', subfrente_id: '', pavimento: 'Geral', descricao: '', tipo: 'execucao', status: 'pendente', responsavel: '', prazo: today(), observacoes: '' }

export default function FrontsPage() {
  const [work, setWork] = useState(new URLSearchParams(location.search).get('obra') || '')
  const [selectedFront, setSelectedFront] = useState('')
  const [selectedSub, setSelectedSub] = useState('')
  const [frontForm, setFrontForm] = useState<any>(() => new URLSearchParams(location.search).get('novaEtapa') === '1' ? { ...frontInitial, obra_id: new URLSearchParams(location.search).get('obra') || '' } : null)
  const [saveError,setSaveError]=useState('')
  const [subForm, setSubForm] = useState<any>(null)
  const [checkForm, setCheckForm] = useState<any>(null)
  const [remove, setRemove] = useState<any>(null)
  const works = useAsync(() => window.fluxoDre.obras.list(), [])
  const storage = useAsync(() => window.fluxoDre.storage.state(), [])
  const operationStorage = useAsync(() => window.fluxoDre.storage.moduleState('operation'), [])
  const serverMode = storage.data?.mode === 'server'
  const operationActive = !serverMode || operationStorage.data?.state === 'central-active'
  const fronts = useAsync(() => operationActive && work ? window.fluxoDre.frentes.list({ obra_id: Number(work) }) : Promise.resolve([]), [work, operationActive])
  const subfronts = useAsync(() => operationActive && selectedFront ? window.fluxoDre.subfrentes.list({ frente_id: Number(selectedFront) }) : Promise.resolve([]), [selectedFront, operationActive])
  const checklist = useAsync(() => operationActive && selectedFront ? window.fluxoDre.checklistFrente.list({ frente_id: Number(selectedFront) }) : Promise.resolve([]), [selectedFront, operationActive])
  const currentFront = fronts.data?.find((item: any) => String(item.id) === selectedFront)
  const currentSub = subfronts.data?.find((item: any) => String(item.id) === selectedSub)
  const checklistRows = useMemo(() => (checklist.data || []).filter((item: any) => !selectedSub || String(item.subfrente_id || '') === selectedSub), [checklist.data, selectedSub])

  useEffect(() => {
    if (!fronts.data?.length) return
    const stillExists = fronts.data.some((item: any) => String(item.id) === selectedFront)
    if (!stillExists) {
      setSelectedFront(String(fronts.data[0].id))
      setSelectedSub('')
    }
  }, [fronts.data, selectedFront])

  async function submitFront(event: FormEvent) {
    event.preventDefault()
    setSaveError('')
    try {
      const newFront=!frontForm.id
      const saved = await window.fluxoDre.frentes.save({ ...frontForm, obra_id: Number(frontForm.obra_id), ordem: Number(frontForm.ordem || 0) })
      setFrontForm(null)
      setWork(String(frontForm.obra_id))
      setSelectedFront(String(saved.id))
      setSelectedSub('')
      fronts.reload()
      if (newFront) setSubForm({ ...subInitial, obra_id:String(saved.obra_id), frente_id:String(saved.id) })
    } catch(e) { setSaveError(e instanceof Error ? e.message : 'Não foi possível salvar a etapa.') }
  }
  async function submitSub(event: FormEvent) {
    event.preventDefault()
    setSaveError('')
    try {
      const saved = await window.fluxoDre.subfrentes.save({ ...subForm, obra_id: Number(subForm.obra_id), frente_id: Number(subForm.frente_id), ordem: Number(subForm.ordem || 0) })
      setSubForm(null)
      setSelectedSub(String(saved.id))
      subfronts.reload()
    } catch(e) { setSaveError(e instanceof Error ? e.message : 'Não foi possível salvar a subetapa.') }
  }
  async function submitChecklist(event: FormEvent) {
    event.preventDefault()
    await window.fluxoDre.checklistFrente.save({ ...checkForm, obra_id: Number(checkForm.obra_id), frente_id: Number(checkForm.frente_id), subfrente_id: checkForm.subfrente_id ? Number(checkForm.subfrente_id) : null, concluido_em: checkForm.status === 'concluido' ? (checkForm.concluido_em || today()) : null })
    setCheckForm(null)
    checklist.reload()
  }
  async function completeItem(item: any) {
    await window.fluxoDre.checklistFrente.save({ id: item.id, revision: item.revision, status: item.status === 'concluido' ? 'pendente' : 'concluido', concluido_em: item.status === 'concluido' ? null : today() })
    checklist.reload()
  }
  function openSub(item?: any) {
    if (!selectedFront || !currentFront) return
    setSaveError('')
    setSubForm(item ? { ...item, ordem: String(item.ordem), frente_id: String(item.frente_id), obra_id: String(item.obra_id) } : { ...subInitial, obra_id: work, frente_id: selectedFront })
  }
  function openChecklist(item?: any) {
    if (!selectedFront || !currentFront) return
    setCheckForm(item ? { ...item, frente_id: String(item.frente_id), obra_id: String(item.obra_id), subfrente_id: item.subfrente_id || '', prazo: item.prazo || '' } : { ...checklistInitial, obra_id: work, frente_id: selectedFront, subfrente_id: selectedSub })
  }
  return <>
    <PageHeader title="Etapas e subetapas" description="Organize os serviços da obra em etapas e subetapas, com checklists e prazos." actions={<Button icon={<Plus size={16}/>} disabled={!work||!operationActive} onClick={() => setFrontForm({ ...frontInitial, obra_id: work })} >Nova etapa</Button>}/>
    {serverMode&&!operationActive&&<div className="success-box" style={{ marginBottom: 14 }}><strong>Preparando o uso compartilhado da operação.</strong> As etapas ficam temporariamente indisponíveis para evitar dados divergentes. Finalize a configuração do uso compartilhado em Configurações para liberar etapas, subetapas e checklists.</div>}
    {serverMode&&operationActive&&<div className="success-box" style={{ marginBottom: 14 }}><strong>Operação compartilhada pronta.</strong> Etapas, subetapas e checklists estão disponíveis para os computadores autorizados.</div>}
    <div className="filters"><Field label="Obra"><select value={work} onChange={(event) => { setWork(event.target.value); setSelectedFront(''); setSelectedSub('') }}><option value="">Selecione uma obra</option>{works.data?.map((item: any) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field></div>
    <div className="dashboard-grid">
      <Card>{fronts.loading ? <Loading/> : fronts.data?.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Etapa</th><th>Codigo</th><th>Ordem</th><th>Status</th><th>Selecionar</th><th/></tr></thead><tbody>{fronts.data.map((item: any) => {
        const isSelected = String(item.id) === selectedFront
        return <tr key={item.id} className={isSelected ? 'selected-row' : ''}><td><strong>{item.nome}</strong>{item.observacoes ? <small>{item.observacoes}</small> : null}</td><td>{item.codigo || '-'}</td><td>{item.ordem}</td><td><Status value={item.status}/></td><td><Button type="button" variant={isSelected ? 'primary' : 'secondary'} onClick={() => { setSelectedFront(String(item.id)); setSelectedSub('') }}>{isSelected ? 'Selecionada' : 'Selecionar'}</Button></td><td><div className="row-actions"><button className="icon-button" onClick={() => setFrontForm({ ...item, obra_id: String(item.obra_id), ordem: String(item.ordem) })} title="Editar"><Edit3 size={15}/></button><button className="icon-button" onClick={() => setRemove({ type: 'frente', item })} title="Remover"><Trash2 size={15}/></button></div></td></tr>
      })}</tbody></table></div> : <Empty title={work ? 'Nenhuma etapa cadastrada' : 'Selecione uma obra'} description="Sugestoes: estrutura, alvenaria, hidraulica, eletrica, esquadrias e acabamento." action={work ? <Button onClick={() => setFrontForm({ ...frontInitial, obra_id: work })}>Criar primeira etapa</Button> : undefined}/>}</Card>
      <Card><div className="card-header"><div><h2>Subetapas</h2><span>{currentFront ? currentFront.nome : 'Selecione uma etapa'}</span></div><Button variant="secondary" icon={<Plus size={15}/>} disabled={!selectedFront||!operationActive} onClick={() => openSub()}>Adicionar subetapa</Button></div>{subfronts.loading ? <Loading/> : selectedFront ? subfronts.data?.length ? <div className="stage-list">{subfronts.data.map((item: any) => <div key={item.id} className={String(item.id) === selectedSub ? 'selected-row-block' : ''}><div><button className="link-button" onClick={() => setSelectedSub(String(item.id))}><strong>{item.nome}</strong></button><span>{item.pavimento || 'Geral'} - {item.escopo || 'Sem escopo detalhado'}</span></div><div className="row-actions"><Status value={item.status}/><button className="icon-button" onClick={() => openSub(item)}><Edit3 size={15}/></button></div></div>)}</div> : <Empty title="Nenhuma subetapa" description="Crie uma subetapa para detalhar os serviços desta etapa." action={<Button variant="secondary" onClick={() => openSub()}>Criar primeira subetapa</Button>}/> : <Empty title="Selecione uma etapa" description="Selecione uma etapa para cadastrar suas subetapas."/>}</Card>
    </div>
    <Card style={{ marginTop: 16 }}><div className="card-header"><div><h2>Checklist da etapa</h2><span>{currentSub ? `${currentFront?.nome} - ${currentSub.nome}` : currentFront ? currentFront.nome : 'Selecione uma etapa'}</span></div><Button variant="secondary" icon={<ClipboardCheck size={15}/>} disabled={!selectedFront||!operationActive} onClick={() => openChecklist()}>Adicionar item</Button></div>{checklist.loading ? <Loading/> : selectedFront ? checklistRows.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Item</th><th>Subetapa</th><th>Pavimento</th><th>Responsavel</th><th>Prazo</th><th>Status</th><th/></tr></thead><tbody>{checklistRows.map((item: any) => <tr key={item.id}><td><strong>{item.descricao}</strong><small>{item.observacoes}</small></td><td>{subfronts.data?.find((sub: any) => sub.id === item.subfrente_id)?.nome || 'Geral'}</td><td>{item.pavimento || 'Geral'}</td><td>{item.responsavel || '-'}</td><td>{brDate(item.prazo)}</td><td><Status value={item.status}/></td><td><div className="row-actions"><button className="icon-button" onClick={() => completeItem(item)} title={item.status === 'concluido' ? 'Reabrir' : 'Concluir'}><CheckCircle2 size={15}/></button><button className="icon-button" onClick={() => openChecklist(item)}><Edit3 size={15}/></button></div></td></tr>)}</tbody></table></div> : <Empty title="Checklist vazio" description="Cadastre itens por pavimento ou gerais para controlar a execucao."/> : <Empty title="Selecione uma frente" description="O checklist acompanha a execucao da frente selecionada."/>}</Card>
    {work && <div style={{marginTop:12,marginBottom:12}}><Link to={`/planejamento?obra=${work}`} className="button button-secondary">Abrir cronograma desta obra</Link></div>}
    {saveError && <p role="alert" style={{color:"#b42318"}}>{saveError}</p>}
    <Modal open={!!frontForm} title="Etapa da obra" onClose={() => setFrontForm(null)}><form onSubmit={submitFront}><div className="modal-body form-grid"><Field label="Obra" required><select required value={frontForm?.obra_id || ''} onChange={(event) => setFrontForm({ ...frontForm, obra_id: event.target.value })}><option value="">Selecione</option>{works.data?.map((item: any) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field><Field label="Nome" required><input required value={frontForm?.nome || ''} onChange={(event) => setFrontForm({ ...frontForm, nome: event.target.value })} placeholder="Ex.: Hidráulica, acabamento"/></Field><Field label="Codigo"><input value={frontForm?.codigo || ''} onChange={(event) => setFrontForm({ ...frontForm, codigo: event.target.value })}/></Field><Field label="Ordem"><input type="number" min="0" value={frontForm?.ordem || 0} onChange={(event) => setFrontForm({ ...frontForm, ordem: event.target.value })}/></Field><Field label="Status"><select value={frontForm?.status || 'ativa'} onChange={(event) => setFrontForm({ ...frontForm, status: event.target.value })}><option value="ativa">Ativa</option><option value="pausada">Pausada</option><option value="concluida">Concluida</option></select></Field><Field label="Observacoes" wide><textarea value={frontForm?.observacoes || ''} onChange={(event) => setFrontForm({ ...frontForm, observacoes: event.target.value })}/></Field></div><FormActions onCancel={() => setFrontForm(null)} submitLabel="Salvar etapa"/></form></Modal>
    <Modal open={!!subForm} title="Subetapa" onClose={() => setSubForm(null)}><form onSubmit={submitSub}><div className="modal-body form-grid"><Field label="Nome" required><input required value={subForm?.nome || ''} onChange={(event) => setSubForm({ ...subForm, nome: event.target.value })} placeholder="Ex.: Prumadas, louças e metais"/></Field><Field label="Pavimento/escopo"><input value={subForm?.pavimento || ''} onChange={(event) => setSubForm({ ...subForm, pavimento: event.target.value })} placeholder="Geral, 1o pavimento..."/></Field><Field label="Codigo"><input value={subForm?.codigo || ''} onChange={(event) => setSubForm({ ...subForm, codigo: event.target.value })}/></Field><Field label="Ordem"><input type="number" min="0" value={subForm?.ordem || 0} onChange={(event) => setSubForm({ ...subForm, ordem: event.target.value })}/></Field><Field label="Status"><select value={subForm?.status || 'ativa'} onChange={(event) => setSubForm({ ...subForm, status: event.target.value })}><option value="ativa">Ativa</option><option value="pausada">Pausada</option><option value="concluida">Concluida</option></select></Field><Field label="Escopo" wide><textarea value={subForm?.escopo || ''} onChange={(event) => setSubForm({ ...subForm, escopo: event.target.value })}/></Field></div><FormActions onCancel={() => setSubForm(null)} submitLabel="Salvar subetapa"/></form></Modal>
    <Modal open={!!checkForm} title="Item de checklist" onClose={() => setCheckForm(null)}><form onSubmit={submitChecklist}><div className="modal-body form-grid"><Field label="Subetapa"><select value={checkForm?.subfrente_id || ''} onChange={(event) => setCheckForm({ ...checkForm, subfrente_id: event.target.value })}><option value="">Geral da frente</option>{subfronts.data?.map((item: any) => <option key={item.id} value={item.id}>{item.nome} - {item.pavimento || 'Geral'}</option>)}</select></Field><Field label="Pavimento"><input value={checkForm?.pavimento || ''} onChange={(event) => setCheckForm({ ...checkForm, pavimento: event.target.value })}/></Field><Field label="Descricao" required wide><textarea required value={checkForm?.descricao || ''} onChange={(event) => setCheckForm({ ...checkForm, descricao: event.target.value })}/></Field><Field label="Responsavel"><input value={checkForm?.responsavel || ''} onChange={(event) => setCheckForm({ ...checkForm, responsavel: event.target.value })}/></Field><Field label="Prazo"><input type="date" value={checkForm?.prazo || ''} onChange={(event) => setCheckForm({ ...checkForm, prazo: event.target.value })}/></Field><Field label="Status"><select value={checkForm?.status || 'pendente'} onChange={(event) => setCheckForm({ ...checkForm, status: event.target.value })}><option value="pendente">Pendente</option><option value="em_andamento">Em andamento</option><option value="concluido">Concluido</option><option value="bloqueado">Bloqueado</option></select></Field></div><FormActions onCancel={() => setCheckForm(null)} submitLabel="Salvar item"/></form></Modal>
    <Confirm open={!!remove} title="Remover etapa" description="Os dados vinculados serao preservados, mas a frente deixara de aparecer em novas selecoes." danger onCancel={() => setRemove(null)} onConfirm={async () => { await window.fluxoDre.frentes.remove(remove.item.id, remove.item.revision); setRemove(null); fronts.reload() }}/>
  </>
}
