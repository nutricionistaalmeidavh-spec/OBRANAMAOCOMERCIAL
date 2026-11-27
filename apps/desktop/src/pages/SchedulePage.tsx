import { ROUTES } from '../routes/registry'
import { Link } from 'react-router-dom'
import { Edit3, Plus, Trash2, FileSpreadsheet } from 'lucide-react'
import OperationalSheetGrid,{type SheetColumn,type SheetRow} from '../components/OperationalSheetGrid'
import {parseBrDecimal} from '../utils/operational-sheet'
import { FormEvent, useState } from 'react'
import { Button, Card, Confirm, Empty, Field, FormActions, Loading, Modal, PageHeader, Status } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { brDate, brl, toCents, today } from '../utils/format'

const blank = { obra_id: '', frente_id: '', nome: '', responsavel: '', previsto_inicio: '', previsto_fim: '', percentual_previsto: '0', percentual_realizado: '0', custo_planejado: '0', custo_realizado: '0', status: 'pendente', observacoes: '' }

export default function SchedulePage() {
  const [work, setWork] = useState(new URLSearchParams(location.search).get('obra') || '')
  const [form, setForm] = useState<any>(() => {
    const query=new URLSearchParams(location.search)
    return query.get('frente') ? { ...blank, obra_id:query.get('obra')||'', frente_id:query.get('frente')||'' } : null
  })
  const [remove, setRemove] = useState<any>(null)
  const [sheetOpen,setSheetOpen]=useState(false)
  const [sheetError,setSheetError]=useState('')
  const storagePlanning=useAsync(()=>window.fluxoDre.storage.moduleState('planning'),[])
  const works = useAsync(() => window.fluxoDre.obras.list(), [])
  const fronts = useAsync(() => work ? window.fluxoDre.frentes.list({ obra_id: Number(work) }) : Promise.resolve([]), [work])
  const items = useAsync(() => work ? window.fluxoDre.cronograma.list({ obra_id: Number(work) }) : Promise.resolve([]), [work])
  const overview = useAsync(() => work ? window.fluxoDre.planejamento.overview(Number(work)) : Promise.resolve(null), [work])
  const open = (item?: any) => setForm(item ? { ...item, frente_id: item.frente_id || '', percentual_previsto: String(item.percentual_previsto), percentual_realizado: String(item.percentual_realizado), custo_planejado: (item.custo_planejado_centavos / 100).toFixed(2).replace('.', ','), custo_realizado: (item.custo_realizado_centavos / 100).toFixed(2).replace('.', ',') } : { ...blank, obra_id: work })
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!form.frente_id && !form.id) throw new Error('Selecione a etapa da obra que será programada.')
    await window.fluxoDre.cronograma.save({ ...form, obra_id: Number(form.obra_id), frente_id: form.frente_id ? Number(form.frente_id) : null, percentual_previsto: Number(form.percentual_previsto), percentual_realizado: Number(form.percentual_realizado), custo_planejado_centavos: toCents(form.custo_planejado), custo_realizado_centavos: toCents(form.custo_realizado) })
    setWork(String(form.obra_id))
    setForm(null)
    items.reload()
    overview.reload()
  }
  const sheetColumns:SheetColumn[]=[
    {key:'nome',label:'Programação',edit:true,width:210},
    {key:'frente_nome',label:'Etapa da obra',value:row=>fronts.data?.find((item:any)=>item.id===Number(row.frente_id))?.nome||'Editar vínculo nos detalhes'},
    {key:'responsavel',label:'Responsável',edit:true},
    {key:'previsto_inicio',label:'Início',edit:true,kind:'date'},
    {key:'previsto_fim',label:'Fim',edit:true,kind:'date'},
    {key:'duracao',label:'Dias planejados',value:row=>{
      const start=String(row.previsto_inicio||''),end=String(row.previsto_fim||'')
      if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(start)||!/^\\d{4}-\\d{2}-\\d{2}$/.test(end))return '—'
      const days=Math.floor((Date.parse(end+'T00:00:00Z')-Date.parse(start+'T00:00:00Z'))/86400000)+1
      return Number.isFinite(days)&&days>0?days:'—'
    }},
    {key:'percentual_previsto',label:'% previsto',edit:true,kind:'decimal'},
    {key:'percentual_realizado',label:'% realizado',edit:true,kind:'decimal'},
    {key:'status',label:'Situação',edit:true,kind:'select',options:['pendente','em_andamento','atrasada','concluida'].map(value=>({value,label:value.replaceAll('_',' ')}))},
    {key:'custo_planejado',label:'Custo planejado R$',edit:true,kind:'money'},
    {key:'custo_realizado',label:'Custo realizado R$',edit:true,kind:'money'}
  ]
  const sheetRows:SheetRow[]=(items.data||[]).map((row:any)=>({
    ...row,frente_id:row.frente_id||'',
    custo_planejado:(Number(row.custo_planejado_centavos||0)/100).toFixed(2).replace('.',','),
    custo_realizado:(Number(row.custo_realizado_centavos||0)/100).toFixed(2).replace('.',',')
  }))
  const commitSheet=async(changed:SheetRow[])=>{
    const batch=changed.map(row=>{
      const planned=parseBrDecimal(row.custo_planejado)
      const actual=parseBrDecimal(row.custo_realizado)
      if(planned===null||actual===null||planned<0||actual<0)throw new Error('Custos devem ser números positivos ou zero.')
      return {id:Number(row.id),updated_at:String(row.updated_at||''),nome:String(row.nome||''),
        frente_id:row.frente_id?Number(row.frente_id):null,responsavel:String(row.responsavel||''),
        previsto_inicio:String(row.previsto_inicio||''),previsto_fim:String(row.previsto_fim||''),
        percentual_previsto:row.percentual_previsto,percentual_realizado:row.percentual_realizado,
        status:String(row.status||'pendente'),custo_planejado_centavos:Math.round(planned*100),
        custo_realizado_centavos:Math.round(actual*100)}
    })
    await window.fluxoDre.operationalSheet.p1Commit({area:'cronograma',obraId:Number(work),rows:batch})
    await items.reload();overview.reload();setSheetError('')
  }
  const sheetDisabled=storagePlanning.data&&!['local','migration-required'].includes(storagePlanning.data.state)
    ?'Edição coletiva disponível no Desktop local; no servidor utilize a edição individual até homologar a paridade.':undefined
  const isLate = (item:any) => !!item.previsto_fim && item.previsto_fim < today() && Number(item.percentual_realizado || 0) < 100 && item.status !== 'concluida'
  const curveMax = Math.max(1, ...(overview.data?.curve || []).map((item: any) => Math.max(item.previsto_centavos, item.realizado_centavos)))
  return <>
    <PageHeader title="Cronograma e planejamento" description="Defina a programação das etapas da obra, acompanhe prazos, progresso e custos planejados." actions={<div className="row-actions"><Button variant="secondary" icon={<FileSpreadsheet size={15}/>} disabled={!work} onClick={()=>setSheetOpen(v=>!v)}>{sheetOpen?'Ocultar planilha':'Editar em planilha'}</Button><Button icon={<Plus size={16}/>} disabled={!work} onClick={() => open()} >Nova programação</Button></div>}/>
    <div className="filters"><Field label="Obra"><select value={work} onChange={(event) => setWork(event.target.value)}><option value="">Selecione</option>{works.data?.map((item: any) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field></div>
    {overview.data?.curve?.length ? <div className="dashboard-grid" style={{ marginBottom: 14 }}>
      <Card><div className="card-header"><h2>Curva S</h2><span>Previsto x realizado acumulado</span></div><div className="card-body stage-list">{overview.data.curve.map((item: any) => <div key={item.etapa_id}><div><strong>{item.nome}</strong><span>{brDate(item.data)}</span></div><div className="curve-bars"><span style={{ width: `${Math.max(4, item.previsto_centavos / curveMax * 100)}%` }}>{brl(item.previsto_centavos)}</span><span style={{ width: `${Math.max(4, item.realizado_centavos / curveMax * 100)}%` }}>{brl(item.realizado_centavos)}</span></div></div>)}</div></Card>
      <Card><div className="card-header"><h2>Previsao de caixa</h2><span>Receber x pagar por competencia</span></div>{overview.data.cash?.length ? <div className="stage-list">{overview.data.cash.map((item: any) => <div key={item.competencia}><div><strong>{item.competencia}</strong><span>Receber {brl(item.receber_centavos)} / pagar {brl(item.pagar_centavos)}</span></div><div className="number">{brl(item.saldo_acumulado_centavos)}</div></div>)}</div> : <Empty title="Sem contas vinculadas" description="Contas da obra alimentam a previsao automaticamente."/>}</Card>
    </div> : null}
    <Card>{items.loading ? <Loading/> : items.data?.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Programação</th><th>Etapa da obra</th><th>Prazo</th><th>Status</th><th>Avanco</th><th className="number">Custo planejado</th><th/></tr></thead><tbody>{items.data.map((item: any) => <tr key={item.id}><td><strong>{item.nome}</strong><small>{item.responsavel}</small></td><td>{fronts.data?.find((front: any) => front.id === item.frente_id)?.nome || 'Obra geral'}</td><td>{brDate(item.previsto_inicio)} a {brDate(item.previsto_fim)}</td><td><Status value={isLate(item)?'atrasada':item.status}/></td><td>{item.percentual_previsto}% / {item.percentual_realizado}%</td><td className="number">{brl(item.custo_planejado_centavos)}</td><td><button className="icon-button" onClick={() => open(item)}><Edit3 size={15}/></button><button className="icon-button" onClick={() => setRemove(item)}><Trash2 size={15}/></button></td></tr>)}</tbody></table></div> : <Empty title={work ? 'Nenhuma programação cadastrada' : 'Selecione uma obra'} description="Cadastre uma programação vinculada a uma etapa existente da obra."/>}</Card>
    {sheetOpen&&work&&<Card style={{marginTop:14}}><OperationalSheetGrid key={work} area="cronograma" title="Planilha do cronograma" rows={sheetRows} columns={sheetColumns} filename={'cronograma-obra-'+work} showImport={false} onCommit={commitSheet} disabledReason={sheetDisabled} onRowAction={row=>open(items.data?.find((item:any)=>item.id===Number(row.id)))} rowActionLabel="Detalhes"/></Card>}
    {sheetError&&<p role="alert">{sheetError}</p>}
    <Modal open={!!form} title="Programação da etapa" onClose={() => setForm(null)} size="lg"><form onSubmit={submit}><div className="modal-body form-grid form-grid-3"><Field label="Obra" required><select required value={form?.obra_id || ''} onChange={(event) => { setWork(event.target.value); setForm({ ...form, obra_id: event.target.value, frente_id: '' }) }}><option value="">Selecione</option>{works.data?.map((item: any) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field><Field label="Etapa da obra" required={!form?.id}><select required={!form?.id} value={form?.frente_id || ''} onChange={(event) => setForm({ ...form, frente_id: event.target.value })}><option value="">{fronts.data?.length?'Escolher etapa':'Nenhuma etapa cadastrada nesta obra'}</option>{fronts.data?.map((item: any) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select>{form?.obra_id&&fronts.data&&!fronts.data.length&&<small className="field-hint">Cadastre as etapas da obra em "Etapas e subetapas" antes de programar. <Link to={ROUTES.fronts}>Criar etapa</Link></small>}</Field><Field label="Status"><select value={form?.status || 'pendente'} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="pendente">Pendente</option><option value="em_andamento">Em andamento</option><option value="concluida">Concluida</option><option value="atrasada">Atrasada</option></select></Field><Field label="Nome" wide required><input required value={form?.nome || ''} onChange={(event) => setForm({ ...form, nome: event.target.value })}/></Field><Field label="Responsavel"><input value={form?.responsavel || ''} onChange={(event) => setForm({ ...form, responsavel: event.target.value })}/></Field><Field label="Inicio"><input type="date" value={form?.previsto_inicio || ''} onChange={(event) => setForm({ ...form, previsto_inicio: event.target.value })}/></Field><Field label="Fim"><input type="date" value={form?.previsto_fim || ''} onChange={(event) => setForm({ ...form, previsto_fim: event.target.value })}/></Field><Field label="% previsto"><input type="number" min="0" max="100" value={form?.percentual_previsto || 0} onChange={(event) => setForm({ ...form, percentual_previsto: event.target.value })}/></Field><Field label="% realizado"><input type="number" min="0" max="100" value={form?.percentual_realizado || 0} onChange={(event) => setForm({ ...form, percentual_realizado: event.target.value })}/></Field><Field label="Custo planejado"><input value={form?.custo_planejado || ''} onChange={(event) => setForm({ ...form, custo_planejado: event.target.value })}/></Field><Field label="Custo realizado"><input value={form?.custo_realizado || ''} onChange={(event) => setForm({ ...form, custo_realizado: event.target.value })}/></Field></div><FormActions onCancel={() => setForm(null)}/></form></Modal>
    <Confirm open={!!remove} title="Excluir programação" description="A programação será removida do cronograma. A etapa da obra será preservada." danger onCancel={() => setRemove(null)} onConfirm={async () => { await window.fluxoDre.cronograma.remove(remove.id); setRemove(null); items.reload(); overview.reload() }}/>
  </>
}
