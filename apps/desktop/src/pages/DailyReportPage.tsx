import { ClipboardPlus, Edit3, Paperclip, Plus } from 'lucide-react'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Button, Card, Empty, Field, FormActions, Loading, Modal, PageHeader, Status } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { useSearchParams } from 'react-router-dom'
import { brDate, brl, toCents, today } from '../utils/format'

const blank = { obra_id: '', frente_id: '', data: today(), clima: 'ensolarado', status: 'rascunho', atividades: '', observacoes: '', equipe: [], equipamentos: [], ocorrencias: [] }

import Obra360DayHistory from '../components/Obra360DayHistory'
import { locationOptions } from '../utils/locations'

export default function DailyReportPage() {
  const [params] = useSearchParams()
  const requestedWork = params.get('obra') || ''
  const [work, setWork] = useState(requestedWork)
  useEffect(() => { setWork(requestedWork); setFront('') }, [requestedWork])
  const [front, setFront] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<any>(blank)
  const [notice, setNotice] = useState('')
  const works = useAsync(() => window.fluxoDre.obras.list(), [])
  useEffect(() => { if (!requestedWork && works.data?.length === 1) setWork(String(works.data[0].id)) }, [requestedWork, works.data])
  const [stock,setStock]=useState<any>(null)
  const [pendingConsumption,setPendingConsumption]=useState<Array<{rdoId:number;date:string;message:string}>>([])
  useEffect(()=>{if(typeof window.fluxoDre?.online?.syncState!=='function')return;let active=true;window.fluxoDre.online.syncState().then(state=>{if(active)setPendingConsumption(state?.fieldRdoPendingConsumption||[])}).catch(()=>undefined);return()=>{active=false}},[notice])
  const [stockBusy,setStockBusy]=useState(false)
  async function openStock(id:number,status:string) {
    setStockBusy(true);setError('')
    try {setStock({...await window.fluxoDre.campo.materials(id),readOnly:['concluido','fechado','finalizado'].includes(status),requestId:crypto.randomUUID()})}
    catch(cause){setError(cause instanceof Error?cause.message:'Falha ao carregar o estoque.')}
    finally{setStockBusy(false)}
  }
  async function applyPending(){
    if(!stock?.pending||stockBusy||stock.readOnly)return
    setStockBusy(true);setError('')
    try {await window.fluxoDre.campo.materials(stock.rdoId,{applyPending:true});setStock(null);setNotice('Consumo enviado pelo celular aplicado ao estoque da obra.')}
    catch(cause){setError(cause instanceof Error?cause.message:'Ainda não foi possível aplicar o consumo.')}
    finally{setStockBusy(false)}
  }
  async function saveStock(){
    if(!stock||stockBusy||stock.readOnly)return
    setStockBusy(true);setError('')
    try {await window.fluxoDre.campo.materials(stock.rdoId,{requestId:stock.requestId,expectedRevision:stock.revision,items:stock.items});setStock(null);setNotice('Consumo registrado no estoque da obra.')}
    catch(cause){setError(cause instanceof Error?cause.message:'Falha ao registrar consumo.')}
    finally{setStockBusy(false)}
  }
  const [error, setError] = useState('')
  const storage = useAsync(() => window.fluxoDre.storage.state(), [])
  const operationStorage = useAsync(() => window.fluxoDre.storage.moduleState('operation'), [])
  const rhStorage = useAsync(() => window.fluxoDre.storage.moduleState('rh'), [])
  const documentsStorage = useAsync(() => window.fluxoDre.storage.moduleState('documents'), [])
  const serverMode = storage.data?.mode === 'server'
  const operationActive = !serverMode || operationStorage.data?.state === 'central-active'
  const rhActive = !serverMode || rhStorage.data?.state === 'central-active'
  const documentsActive = !serverMode || documentsStorage.data?.state === 'central-active'
  const fronts = useAsync(() => operationActive && work ? window.fluxoDre.frentes.list({ obra_id: Number(work) }) : Promise.resolve([]), [work, operationActive])
  const placeWork = form?.obra_id || work
  const rdoPlaces = useAsync(() => operationActive && placeWork ? window.fluxoDre.locais.list({ obra_id: Number(placeWork) }) : Promise.resolve([]), [placeWork, operationActive])
  const rdoPlaceOptions = useMemo(() => locationOptions(rdoPlaces.data || []), [rdoPlaces.data])
  const rdos = useAsync(() => operationActive && work ? window.fluxoDre.rdos.list({ obra_id: Number(work) }) : Promise.resolve([]), [work, operationActive])
  const employees = useAsync(() => rhActive ? window.fluxoDre.funcionarios.list() : Promise.resolve([]), [rhActive])
  const selectedWork = works.data?.find((item:any) => String(item.id) === work)
  const people = (employees.data || []).filter((item:any) => selectedWork && String(item.empresa_id) === String(selectedWork.empresa_id))
  const readFailures = [['obras', works], ['etapas', fronts], ['diários', rdos], ['funcionários', employees], ['configuração', storage], ['operação', operationStorage], ['RH', rhStorage]] as const
  const rows = (rdos.data || []).filter((rdo: any) => !front || String(rdo.frente_id || '') === front)
  const add = (key: string, row: any) => setForm({ ...form, [key]: [...form[key], row] })
  const change = (key: string, index: number, field: string, value: string) => setForm({ ...form, [key]: form[key].map((row: any, i: number) => i === index ? { ...row, [field]: value } : row) })
  const remove = (key: string, index: number) => setForm({ ...form, [key]: form[key].filter((_: any, i: number) => i !== index) })
  async function open(rdo?: any) {
    setError(''); try {
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
      equipe: equipe.map((row: any) => ({ ...row, frente_id: row.frente_id || '', local_id: row.local_id || '', horas: String(row.horas), custo: (row.custo_centavos / 100).toFixed(2).replace('.', ',') })),
      equipamentos: equipamentos.map((row: any) => ({ ...row, frente_id: row.frente_id || '', horas_uso: String(row.horas_uso), custo: (row.custo_centavos / 100).toFixed(2).replace('.', ',') })),
      ocorrencias: ocorrencias.map((row: any) => ({ ...row, frente_id: row.frente_id || '', local_id: row.local_id || '', prazo: row.prazo || '' }))
    })
    setModal(true)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha ao abrir o diário.') }
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(''); try {
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
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o diário.') }
  }
  async function attach(rdo: any) {
    if (!documentsActive) {
      setNotice('Os anexos estão temporariamente indisponíveis. Finalize a configuração do uso compartilhado em Configurações e tente novamente.')
      return
    }
    const result = await window.fluxoDre.documentos.importForWork({ obra_id: rdo.obra_id, frente_id: rdo.frente_id || null, rdo_id: rdo.id, categoria: 'rdo', title: `RDO ${brDate(rdo.data)}` })
    if (result) setNotice(`Anexo vinculado ao RDO de ${brDate(rdo.data)}.`)
  }
  return <>
    <PageHeader title="Diario de obra" description="Registre diariamente a etapa, equipe, equipamentos, custos, ocorrencias e anexos." actions={<Button icon={<ClipboardPlus size={16}/>} disabled={!selectedWork||!operationActive} onClick={() => open()}>Novo RDO</Button>}/>
    {serverMode&&!operationActive&&<div className="success-box" style={{ marginBottom: 14 }}><strong>Diário de obra temporariamente indisponível.</strong> Finalize a configuração do uso compartilhado em Configurações antes de trabalhar no diário.</div>}
    {serverMode&&operationActive&&!rhActive&&<div className="success-box" style={{ marginBottom: 14 }}><strong>Equipe cadastrada temporariamente indisponível.</strong> Finalize a configuração do uso compartilhado em Configurações. Você ainda pode registrar pessoas avulsas ou terceirizadas no RDO.</div>}
    <div className="filters">
      <Field label="Obra"><select value={work} onChange={(event) => { setWork(event.target.value); setFront('') }}><option value="">Selecione</option>{works.data?.map((item: any) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field>
      <Field label="Etapa"><select value={front} onChange={(event) => setFront(event.target.value)} disabled={!work}><option value="">Todas</option>{fronts.data?.map((item: any) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field>
    </div>
    {!modal && error && <p role="alert">{error}</p>}
    {readFailures.filter(([,q]) => q.error).map(([label,q]) => <p role="alert" key={label}>Não foi possível carregar {label}: {q.error?.message} <Button onClick={() => void q.reload()}>Tentar novamente</Button></p>)}
    {notice && <div className="success-box">{notice}</div>}
    {!!pendingConsumption.length && <div className="error-box" role="status"><strong>Consumo do celular aguardando estoque</strong><p>Estes diários foram integrados, mas o material ainda não saiu do estoque. Abra o consumo do dia para aplicar.</p><ul>{pendingConsumption.map(item=><li key={item.rdoId}>{new Date(item.date+'T12:00:00').toLocaleDateString('pt-BR')}: {item.message} <Button variant="secondary" disabled={stockBusy} onClick={()=>void openStock(item.rdoId,'rascunho')}>Abrir consumo</Button></li>)}</ul></div>}
    <Card>{rdos.error ? null : rdos.loading ? <Loading/> : rows.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Data</th><th>Etapa</th><th>Clima</th><th>Atividades</th><th>Status</th><th/></tr></thead><tbody>{rows.map((rdo: any) => <tr key={rdo.id}><td><strong>{brDate(rdo.data)}</strong></td><td>{fronts.data?.find((item: any) => item.id === rdo.frente_id)?.nome || 'Obra geral'}</td><td>{rdo.clima || '-'}</td><td>{rdo.atividades || '-'}</td><td><Status value={rdo.status}/></td><td><div className="row-actions"><Button variant="secondary" disabled={stockBusy} onClick={() => void openStock(rdo.id,rdo.status)}>Materiais</Button><button className="icon-button" onClick={() => open(rdo)} title="Editar"><Edit3 size={15}/></button><button className="icon-button" disabled={!documentsActive} onClick={() => attach(rdo)} title={documentsActive?'Anexar arquivo':'Anexos temporariamente indisponíveis'}><Paperclip size={15}/></button></div></td></tr>)}</tbody></table></div> : <Empty title={work ? 'Ainda não há Diário de obra' : 'Selecione uma obra'} description={work ? 'Registre o primeiro dia de campo para reunir atividades, equipe, equipamentos e ocorrências. Cadastre antes as etapas da obra em Etapas e subetapas e os funcionários em RH, se ainda não existirem.' : 'Escolha uma obra para consultar e registrar o Diário de obra.'} action={selectedWork && operationActive && !rdos.error ? <Button onClick={() => open()}>Registrar primeiro RDO</Button> : undefined}/>}</Card>
    <Modal open={!!stock} title="Consumo de materiais da obra" onClose={()=>{if(!stockBusy)setStock(null)}}>{stock&&<form onSubmit={e=>{e.preventDefault();void saveStock()}}><div className="modal-body">
      <p>Informe o total consumido neste diário. Ao confirmar, o estoque recebe apenas a diferença em relação ao consumo já registrado.</p>
      {stock.pending&&<div className="error-box" role="status"><strong>Consumo do celular aguardando estoque</strong><p>{stock.pending.message} Registre a entrada do material e aplique, ou ajuste as quantidades abaixo e confirme.</p><ul>{stock.pending.items.map((item:any)=><li key={item.id}>{item.descricao}: {item.quantidade} {item.unidade}</li>)}</ul><Button type="button" variant="secondary" disabled={stockBusy||stock.readOnly} onClick={()=>void applyPending()}>Aplicar consumo do celular</Button></div>}
      {error&&<p role="alert">{error}</p>}
      {error && <p role="alert">{error}</p>}{stock.readOnly && <p>Diário concluído. Reabra o diário para alterar o consumo.</p>}<fieldset disabled={stockBusy||stock.readOnly}>{stock.items.map((line:any,index:number)=><div className="row-actions" key={line.id}><span>{line.descricao} ({line.unidade})</span><input aria-label={'Quantidade de '+line.descricao} type="number" min="0.000001" step="any" required value={line.quantidade} onChange={e=>setStock({...stock,requestId:crypto.randomUUID(),items:stock.items.map((v:any,i:number)=>i===index?{...v,quantidade:e.target.value}:v)})}/><Button type="button" onClick={()=>setStock({...stock,requestId:crypto.randomUUID(),items:stock.items.filter((_:any,i:number)=>i!==index)})}>Remover</Button></div>)}
      <Field label="Adicionar material"><select value="" onChange={e=>{const m=stock.materials.find((v:any)=>v.id===e.target.value);if(m)setStock({...stock,requestId:crypto.randomUUID(),items:[...stock.items,{id:crypto.randomUUID(),material_id:m.id,descricao:m.descricao,unidade:m.unidade,quantidade:1}]})}}><option value="">Selecione no estoque da obra</option>{stock.materials.map((m:any)=><option key={m.id} value={m.id}>{m.descricao} — {m.saldo} {m.unidade}</option>)}</select></Field></fieldset>
      <Button type="submit" disabled={stockBusy||stock.readOnly}>Confirmar consumo</Button></div></form>}</Modal>
    <Modal open={modal} title={form.id ? 'Editar RDO' : 'Novo RDO'} onClose={() => setModal(false)} size="xl"><form onSubmit={submit}><div className="modal-body">{error && <p role="alert">{error}</p>}<Obra360DayHistory workId={form.obra_id} date={form.data}/>
      <div className="form-grid form-grid-3">
        <Field label="Obra" required><select required disabled={!!form.id || !!form.equipe?.length || !!form.equipamentos?.length || !!form.ocorrencias?.length} value={form.obra_id} onChange={(event) => { setForm({ ...form, obra_id: event.target.value, frente_id: '' }); setWork(event.target.value) }}><option value="">Selecione</option>{works.data?.map((item: any) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field>
        <Field label="Etapa principal"><select value={form.frente_id || ''} onChange={(event) => setForm({ ...form, frente_id: event.target.value })}><option value="">Obra geral</option>{fronts.data?.map((item: any) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field>
        <Field label="Data" required><input required type="date" value={form.data} onChange={(event) => setForm({ ...form, data: event.target.value })}/></Field>
        <Field label="Clima"><select value={form.clima} onChange={(event) => setForm({ ...form, clima: event.target.value })}><option value="ensolarado">Ensolarado</option><option value="nublado">Nublado</option><option value="chuva">Chuva</option><option value="intermitente">Chuva intermitente</option></select></Field>
        <Field label="Status"><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="rascunho">Rascunho</option><option value="concluido">Concluido</option></select></Field>
        <Field label="Atividades executadas" wide required><textarea required value={form.atividades} onChange={(event) => setForm({ ...form, atividades: event.target.value })}/></Field>
        <Field label="Observacoes" wide><textarea value={form.observacoes || ''} onChange={(event) => setForm({ ...form, observacoes: event.target.value })}/></Field>
      </div>
      <RdoSection title="Equipe no dia" addLabel="Adicionar pessoa" onAdd={() => add('equipe', { funcionario_id: '', frente_id: form.frente_id || '', local_id: '', nome: '', funcao: '', horas: '8', custo: '0', observacoes: '' })}>{(form.equipe || []).map((row: any, index: number) => <div className="rdo-row" key={index}><select value={row.frente_id || ''} onChange={(event) => change('equipe', index, 'frente_id', event.target.value)}><option value="">Etapa principal</option>{fronts.data?.map((item: any) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select><select aria-label="Local da atividade" value={row.local_id || ''} onChange={(event) => change('equipe', index, 'local_id', event.target.value)}><option value="">Geral (sem local)</option>{rdoPlaceOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select><select value={row.funcionario_id || ''} onChange={(event) => { const person = people.find((item: any) => item.id === Number(event.target.value)); setForm((current:any) => ({ ...current, equipe: current.equipe.map((entry:any, i:number) => i === index ? { ...entry, funcionario_id: person?.id ?? '', nome: person?.nome ?? '', funcao: person?.cargo_nome ?? '' } : entry) })) }}><option value="">Avulso / terceirizado</option>{people.map((person: any) => <option key={person.id} value={person.id}>{person.nome}</option>)}</select><input placeholder="Nome" value={row.nome} onChange={(event) => change('equipe', index, 'nome', event.target.value)}/><input placeholder="Funcao" value={row.funcao || ''} onChange={(event) => change('equipe', index, 'funcao', event.target.value)}/><input type="number" min="0" step="0.5" placeholder="Horas" value={row.horas} onChange={(event) => change('equipe', index, 'horas', event.target.value)}/><input placeholder="Custo" value={row.custo || ''} onChange={(event) => change('equipe', index, 'custo', event.target.value)}/><button type="button" className="icon-button" onClick={() => remove('equipe', index)}>x</button></div>)}</RdoSection>
      <RdoSection title="Equipamentos" addLabel="Adicionar equipamento" onAdd={() => add('equipamentos', { frente_id: form.frente_id || '', nome: '', horas_uso: '0', custo: '0', observacoes: '' })}>{(form.equipamentos || []).map((row: any, index: number) => <div className="rdo-row rdo-equipment" key={index}><select value={row.frente_id || ''} onChange={(event) => change('equipamentos', index, 'frente_id', event.target.value)}><option value="">Etapa principal</option>{fronts.data?.map((item: any) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select><input placeholder="Equipamento" value={row.nome} onChange={(event) => change('equipamentos', index, 'nome', event.target.value)}/><input type="number" min="0" step="0.5" placeholder="Horas" value={row.horas_uso} onChange={(event) => change('equipamentos', index, 'horas_uso', event.target.value)}/><input placeholder="Custo" value={row.custo || ''} onChange={(event) => change('equipamentos', index, 'custo', event.target.value)}/><input placeholder="Observacao" value={row.observacoes || ''} onChange={(event) => change('equipamentos', index, 'observacoes', event.target.value)}/><button type="button" className="icon-button" onClick={() => remove('equipamentos', index)}>x</button></div>)}</RdoSection>
      <RdoSection title="Ocorrencias e impedimentos" addLabel="Adicionar ocorrencia" onAdd={() => add('ocorrencias', { frente_id: form.frente_id || '', local_id: '', tipo: 'falta_material', descricao: '', status: 'aberta', prioridade: 'normal', responsavel: '', prazo: '' })}>{(form.ocorrencias || []).map((row: any, index: number) => <div className="rdo-row rdo-occurrence" key={index}><select value={row.frente_id || ''} onChange={(event) => change('ocorrencias', index, 'frente_id', event.target.value)}><option value="">Etapa principal</option>{fronts.data?.map((item: any) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select><select aria-label="Local da ocorrência" value={row.local_id || ''} onChange={(event) => change('ocorrencias', index, 'local_id', event.target.value)}><option value="">Geral (sem local)</option>{rdoPlaceOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select><select value={row.tipo} onChange={(event) => change('ocorrencias', index, 'tipo', event.target.value)}><option value="falta_material">Falta de material</option><option value="atraso">Atraso</option><option value="retrabalho">Retrabalho</option><option value="seguranca">Seguranca</option><option value="qualidade">Qualidade</option><option value="pendencia_cliente">Pendencia do cliente</option></select><input placeholder="Descricao" value={row.descricao} onChange={(event) => change('ocorrencias', index, 'descricao', event.target.value)}/><input placeholder="Responsavel" value={row.responsavel || ''} onChange={(event) => change('ocorrencias', index, 'responsavel', event.target.value)}/><input type="date" value={row.prazo || ''} onChange={(event) => change('ocorrencias', index, 'prazo', event.target.value)}/><select value={row.prioridade || 'normal'} onChange={(event) => change('ocorrencias', index, 'prioridade', event.target.value)}><option value="normal">Normal</option><option value="alta">Alta</option><option value="urgente">Urgente</option></select><select value={row.status} onChange={(event) => change('ocorrencias', index, 'status', event.target.value)}><option value="aberta">Aberta</option><option value="em_andamento">Em andamento</option><option value="resolvida">Resolvida</option></select><button type="button" className="icon-button" onClick={() => remove('ocorrencias', index)}>x</button></div>)}</RdoSection>
      <div className="notice">Depois de salvar, use Materiais para registrar o consumo no estoque ou o clipe para anexar fotos e documentos.</div>
    </div><FormActions onCancel={() => setModal(false)} submitLabel="Salvar RDO"/></form></Modal>
  </>
}

function RdoSection({ title, addLabel, onAdd, children }: { title: string; addLabel: string; onAdd: () => void; children: any }) {
  return <section className="rdo-section"><div><h3>{title}</h3><Button type="button" variant="secondary" icon={<Plus size={14}/>} onClick={onAdd}>{addLabel}</Button></div>{children}</section>
}
