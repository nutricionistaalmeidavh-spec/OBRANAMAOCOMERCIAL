import { Edit3, Plus, Trash2, FileSpreadsheet } from 'lucide-react'
import OperationalSheetGrid, { type SheetColumn, type SheetRow } from '../components/OperationalSheetGrid'
import { parseBrDecimal } from '../utils/operational-sheet'
import { FormEvent, useMemo, useState } from 'react'
import { Button, Card, Confirm, Empty, Field, FormActions, Loading, Modal, PageHeader } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { brl, toCents } from '../utils/format'

const blank = { obra_id: '', frente_id: '', subfrente_id: '', etapa_id: '', codigo: '', descricao: '', unidade: 'un', quantidade: '1', valor_unitario: '', tipo: 'material', observacoes: '' }

export default function BudgetPage() {
  const [work, setWork] = useState(''); const [form, setForm] = useState<any>(null); const [remove, setRemove] = useState<any>(null)
  const [sheetOpen,setSheetOpen]=useState(false)
  const sheetStorage=useAsync(()=>window.fluxoDre.storage.moduleState('planning'),[])
  const works = useAsync(() => window.fluxoDre.obras.list(), [])
  const fronts = useAsync(() => work ? window.fluxoDre.frentes.list({ obra_id: Number(work) }) : Promise.resolve([]), [work])
  const substages = useAsync(() => work ? window.fluxoDre.subfrentes.list({ obra_id: Number(work) }) : Promise.resolve([]), [work])
  const stages = useAsync(() => work ? window.fluxoDre.etapas.list({ obra_id: Number(work) }) : Promise.resolve([]), [work])
  const items = useAsync(() => work ? window.fluxoDre.orcamentos.list({ obra_id: Number(work) }) : Promise.resolve([]), [work])
  const total = useMemo(() => items.data?.reduce((sum: number, item: any) => sum + Math.round(Number(item.quantidade) * Number(item.valor_unitario_centavos)), 0) || 0, [items.data])
  const sheetColumns: SheetColumn[] = [
    {key:'descricao',label:'Descrição',edit:true,width:220},
    {key:'codigo',label:'Código',edit:true},
    {key:'tipo',label:'Tipo',edit:true,kind:'select',options:[{value:'material',label:'Material'},{value:'mao_de_obra',label:'Mão de obra'},{value:'equipamento',label:'Equipamento'},{value:'servico',label:'Serviço'}]},
    {key:'frente_id',label:'Etapa',edit:true,kind:'select',options:[{value:'',label:'Sem etapa'},...(fronts.data||[]).map((x:any)=>({value:String(x.id),label:x.nome}))]},
    {key:'subfrente_id',label:'Subetapa',edit:true,kind:'select',options:[{value:'',label:'Sem subetapa'},...(substages.data||[]).map((x:any)=>({value:String(x.id),label:x.nome}))]},
    {key:'etapa_id',label:'Planejamento',edit:true,kind:'select',options:[{value:'',label:'Sem referência'},...(stages.data||[]).map((x:any)=>({value:String(x.id),label:x.nome}))]},
    {key:'unidade',label:'Un.',edit:true},
    {key:'quantidade',label:'Quantidade',edit:true,kind:'decimal'},
    {key:'valor_unitario',label:'Unitário (R$)',edit:true,kind:'money'},
    {key:'total_estimado',label:'Total (R$)',value:row=>{
      const qtd=parseBrDecimal(row.quantidade)||0
      const price=parseBrDecimal(row.valor_unitario)||0
      return (qtd*price).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})
    }}
  ]
  const sheetRows:SheetRow[]=(items.data||[]).map((row:any)=>({
    ...row,
    frente_id:row.frente_id||'',subfrente_id:row.subfrente_id||'',etapa_id:row.etapa_id||'',
    quantidade:String(row.quantidade??0),
    valor_unitario:(Number(row.valor_unitario_centavos||0)/100).toFixed(2).replace('.',',')
  }))
  const commitSheet=async(changed:SheetRow[])=>{
    const updates=changed.map(row=>{
      const qty=parseBrDecimal(row.quantidade)
      const unit=parseBrDecimal(row.valor_unitario)
      if(qty===null||qty<0||unit===null||unit<0)throw new Error('Quantidade e preço unitário devem ser números não negativos.')
      return {
        id:Number(row.id),updated_at:String(row.updated_at||''),
        descricao:String(row.descricao||''),codigo:String(row.codigo||''),tipo:String(row.tipo||'material'),
        frente_id:row.frente_id?Number(row.frente_id):null,
        subfrente_id:row.subfrente_id?Number(row.subfrente_id):null,
        etapa_id:row.etapa_id?Number(row.etapa_id):null,
        unidade:String(row.unidade||'un'),quantidade:qty,valor_unitario_centavos:Math.round(unit*100)
      }
    })
    await window.fluxoDre.operationalSheet.commit({area:'orcamento',obraId:Number(work),rows:updates})
    await items.reload()
  }
  const sheetDisabled=sheetStorage.data&&!['local','migration-required'].includes(sheetStorage.data.state)?'Edição em lote em servidor ainda não homologada; utilize Editar item. Exportação está disponível.':undefined
  const open = (item?: any) => setForm(item ? { ...item, subfrente_id:item.subfrente_id||'', valor_unitario: (item.valor_unitario_centavos / 100).toFixed(2).replace('.', ',') } : { ...blank, obra_id: work })
  async function submit(event: FormEvent) { event.preventDefault(); await window.fluxoDre.orcamentos.save({ ...form, obra_id: Number(form.obra_id), frente_id: form.frente_id ? Number(form.frente_id) : null, subfrente_id: form.subfrente_id ? Number(form.subfrente_id) : null, etapa_id: form.etapa_id ? Number(form.etapa_id) : null, quantidade: Number(form.quantidade), valor_unitario_centavos: toCents(form.valor_unitario), atualizado_em: new Date().toISOString() }); setForm(null); setWork(String(form.obra_id)); items.reload() }
  return <>
    <PageHeader title="Orçamento detalhado" description="Planeje materiais, serviços, equipes e equipamentos por etapa da obra." actions={<div className="row-actions"><Button variant="secondary" icon={<FileSpreadsheet size={16}/>} disabled={!work} onClick={()=>setSheetOpen(value=>!value)}>{sheetOpen?'Ocultar planilha':'Editar em planilha'}</Button><Button icon={<Plus size={16}/>} disabled={!work} onClick={() => open()}>Novo item</Button></div>}/>
    <div className="toolbar"><Field label="Obra"><select value={work} onChange={(event) => setWork(event.target.value)}><option value="">Selecione uma obra</option>{works.data?.map((item: any) => <option value={item.id} key={item.id}>{item.nome}</option>)}</select></Field><Card className="kpi" style={{ minHeight: 60, padding: '10px 15px' } as any}><div><span>Total orçado</span><strong>{brl(total)}</strong></div></Card></div>
    <Card>{items.loading ? <Loading/> : items.data?.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Item</th><th>Etapa da obra</th><th>Subetapa</th><th>Referência do planejamento</th><th>Tipo</th><th className="number">Total</th><th/></tr></thead><tbody>{items.data.map((item: any) => <tr key={item.id}><td><strong>{item.descricao}</strong><small>{item.codigo || item.unidade}</small></td><td>{fronts.data?.find((front: any) => front.id === item.frente_id)?.nome || 'Não classificada'}</td><td>{substages.data?.find((sub: any) => sub.id === item.subfrente_id)?.nome || '—'}</td><td>{stages.data?.find((stage: any) => stage.id === item.etapa_id)?.nome || '—'}</td><td>{item.tipo.replaceAll('_', ' ')}</td><td className="number">{brl(Math.round(item.quantidade * item.valor_unitario_centavos))}</td><td><div className="row-actions"><button className="icon-button" onClick={() => open(item)}><Edit3 size={15}/></button><button className="icon-button" onClick={() => setRemove(item)}><Trash2 size={15}/></button></div></td></tr>)}</tbody></table></div> : <Empty title={work ? 'Ainda não há itens no orçamento' : 'Selecione uma obra'} description={work ? 'Adicione o primeiro item para começar a acompanhar materiais, serviços e custos desta obra.' : 'Escolha uma obra acima para visualizar ou montar o orçamento.'} action={work ? <Button onClick={() => open()}>Adicionar primeiro item</Button> : undefined}/>}</Card>
    {sheetOpen&&work&&<Card><OperationalSheetGrid key={work} area="orcamento" title="Planilha de orçamento" rows={sheetRows} columns={sheetColumns} filename={'orcamento-obra-'+work} importArea="orcamento" allowTemplate companyId={works.data?.find((w:any)=>String(w.id)===work)?.empresa_id} onCommit={commitSheet} disabledReason={sheetDisabled} onRowAction={row=>open(items.data?.find((item:any)=>item.id===Number(row.id)))} rowActionLabel="Editar detalhes"/></Card>}
    <Modal open={!!form} title={form?.id ? 'Editar item' : 'Novo item orçamentário'} onClose={() => setForm(null)} size="lg"><form onSubmit={submit}><div className="modal-body form-grid form-grid-3"><Field label="Obra" required><select required value={form?.obra_id || ''} onChange={(event) => setForm({ ...form, obra_id: event.target.value, frente_id: '', subfrente_id: '', etapa_id: '' })}><option value="">Selecione</option>{works.data?.map((item: any) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field><Field label="Etapa da obra"><select value={form?.frente_id || ''} onChange={(event) => setForm({ ...form, frente_id: event.target.value, subfrente_id:'' })}><option value="">Não classificada</option>{fronts.data?.map((item: any) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field><Field label="Subetapa"><select value={form?.subfrente_id || ''} disabled={!form?.frente_id} onChange={(event) => setForm({ ...form, subfrente_id:event.target.value })}><option value="">Sem subetapa específica</option>{substages.data?.filter((sub: any) => String(sub.frente_id) === String(form?.frente_id)).map((sub: any) => <option key={sub.id} value={sub.id}>{sub.nome}</option>)}</select></Field><Field label="Referência do planejamento"><select value={form?.etapa_id || ''} onChange={(event) => setForm({ ...form, etapa_id: event.target.value })}><option value="">Sem etapa</option>{stages.data?.map((item: any) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field><Field label="Descrição" wide required><input required value={form?.descricao || ''} onChange={(event) => setForm({ ...form, descricao: event.target.value })}/></Field><Field label="Tipo"><select value={form?.tipo || 'material'} onChange={(event) => setForm({ ...form, tipo: event.target.value })}><option value="material">Material</option><option value="mao_de_obra">Mão de obra</option><option value="equipamento">Equipamento</option><option value="servico">Serviço</option></select></Field><Field label="Código"><input value={form?.codigo || ''} onChange={(event) => setForm({ ...form, codigo: event.target.value })}/></Field><Field label="Unidade"><input required value={form?.unidade || ''} onChange={(event) => setForm({ ...form, unidade: event.target.value })}/></Field><Field label="Quantidade"><input required type="number" step="0.001" min="0" value={form?.quantidade || ''} onChange={(event) => setForm({ ...form, quantidade: event.target.value })}/></Field><Field label="Valor unitário"><input required value={form?.valor_unitario || ''} onChange={(event) => setForm({ ...form, valor_unitario: event.target.value })}/></Field><Field label="Observações" wide><textarea value={form?.observacoes || ''} onChange={(event) => setForm({ ...form, observacoes: event.target.value })}/></Field></div><FormActions onCancel={() => setForm(null)}/></form></Modal>
    <Confirm open={!!remove} title="Excluir item" description="O item será removido do orçamento." danger onCancel={() => setRemove(null)} onConfirm={async () => { await window.fluxoDre.orcamentos.remove(remove.id); setRemove(null); items.reload() }}/>
  </>
}
