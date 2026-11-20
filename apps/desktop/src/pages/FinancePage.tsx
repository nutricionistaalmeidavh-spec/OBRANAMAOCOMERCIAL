import { CheckCircle2, Edit3, Plus, RotateCcw, Trash2, FileSpreadsheet } from 'lucide-react'
import OperationalSheetGrid, {type SheetColumn,type SheetRow} from '../components/OperationalSheetGrid'
import {parseBrDecimal} from '../utils/operational-sheet'
import { FormEvent, useMemo, useState } from 'react'
import { Button, Card, Confirm, Empty, Field, FormActions, Loading, Modal, PageHeader, SearchInput, Segmented, Status } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { brDate, brl, currentCompetence, toCents, today } from '../utils/format'

const emptyForm = { tipo:'pagar',empresa_id:'',obra_id:'',categoria_id:'',descricao:'',competencia:currentCompetence(),emissao:today(),vencimento:today(),valor:'',forma_pagamento:'PIX',status:'pendente',observacoes:'' }

export default function FinancePage() {
  const [type, setType] = useState('pagar'), [search,setSearch]=useState(''), [competencia,setCompetencia]=useState(currentCompetence())
  const [sheetOpen,setSheetOpen]=useState(false)
  const sheetStorage=useAsync(()=>window.fluxoDre.storage.moduleState('finance'),[])
  const [form,setForm]=useState<any>(emptyForm),[modal,setModal]=useState(false),[payment,setPayment]=useState<any>(null),[remove,setRemove]=useState<any>(null),[saving,setSaving]=useState(false)
  const accounts = useAsync(()=>window.fluxoDre.contas.list({tipo:type,competencia}),[type,competencia])
  const companies = useAsync(()=>window.fluxoDre.empresas.list(),[]), categories=useAsync(()=>window.fluxoDre.categorias.list({natureza:type==='pagar'?'despesa':'receita'}),[type]), works=useAsync(()=>window.fluxoDre.obras.list(),[])
  const rows=useMemo(()=>accounts.data?.filter((r:any)=>r.descricao.toLowerCase().includes(search.toLowerCase()))||[],[accounts.data,search])
  const openForm=(row?:any)=>{setForm(row?{...row,valor:(row.valor_centavos/100).toFixed(2).replace('.',',')}:{...emptyForm,tipo:type,competencia});setModal(true)}
  const submit=async(e:FormEvent)=>{e.preventDefault();setSaving(true);try{await window.fluxoDre.contas.save({...form,empresa_id:Number(form.empresa_id),obra_id:form.obra_id?Number(form.obra_id):null,categoria_id:form.categoria_id?Number(form.categoria_id):null,valor_centavos:toCents(form.valor),valor_bruto_centavos:toCents(form.valor)});setModal(false);await accounts.reload()}finally{setSaving(false)}}
  const doPayment=async(e:FormEvent)=>{e.preventDefault();setSaving(true);try{await window.fluxoDre.contas.payment(payment.id,{valor_centavos:toCents(payment.paymentValue),data:payment.paymentDate,forma_pagamento:payment.forma_pagamento});setPayment(null);await accounts.reload()}finally{setSaving(false)}}
  const total=rows.reduce((sum:any,r:any)=>sum+r.valor_centavos,0)
  const sheetColumns:SheetColumn[]=[
    {key:'descricao',label:'Descrição',edit:true,width:240},
    {key:'competencia',label:'Competência',edit:true},
    {key:'vencimento',label:'Vencimento',edit:true,kind:'date'},
    {key:'valor',label:'Valor (R$)',edit:true,kind:'money'},
    {key:'status',label:'Situação'},
    {key:'empresa_nome',label:'Empresa'},
    {key:'obra_nome',label:'Obra'},
    {key:'categoria_nome',label:'Categoria'}
  ]
  const sheetRows:SheetRow[]=rows.map((row:any)=>({
    ...row,
    valor:(Number(row.valor_centavos||0)/100).toFixed(2).replace('.',','),
    empresa_nome:companies.data?.find((c:any)=>c.id===row.empresa_id)?.nome_fantasia||companies.data?.find((c:any)=>c.id===row.empresa_id)?.razao_social||'',
    obra_nome:works.data?.find((w:any)=>w.id===row.obra_id)?.nome||'',
    categoria_nome:categories.data?.find((c:any)=>c.id===row.categoria_id)?.nome||''
  }))
  const commitSheet=async(changed:SheetRow[])=>{
    const batch=changed.map(row=>{
      const amount=parseBrDecimal(row.valor)
      if(amount===null||amount<=0)throw new Error('O valor da conta deve ser maior que zero.')
      return {id:Number(row.id),updated_at:String(row.updated_at||''),descricao:String(row.descricao||''),competencia:String(row.competencia||''),vencimento:String(row.vencimento||''),valor_centavos:toCents(String(row.valor))}
    })
    await window.fluxoDre.operationalSheet.commit({area:'financeiro',rows:batch})
    await accounts.reload()
  }
  const sheetDisabled=sheetStorage.data&&!['local','migration-required'].includes(sheetStorage.data.state)?'Edição em lote em servidor ainda não homologada; edite as contas pelo formulário. Exportação disponível.':undefined

  return <>
    <PageHeader title="Contas" description="Contas a pagar e receber com competência, vencimento e baixas parciais." actions={<div className="row-actions"><Button variant="secondary" icon={<FileSpreadsheet size={16}/>} onClick={()=>setSheetOpen(value=>!value)}>{sheetOpen?'Ocultar planilha':'Editar em planilha'}</Button><Button icon={<Plus size={16}/>} onClick={()=>openForm()}>Nova conta</Button></div>}/>
    <div className="toolbar"><div className="toolbar-left"><Segmented value={type} onChange={setType} options={[{value:'pagar',label:'A pagar'},{value:'receber',label:'A receber'}]}/><SearchInput value={search} onChange={setSearch} placeholder="Buscar descrição..."/></div><Field label="Competência"><input type="month" value={competencia} onChange={(e)=>setCompetencia(e.target.value)}/></Field></div>
    <Card><div className="summary-strip"><div><span>Total no período</span><strong className={type==='pagar'?'amount-negative':'amount-positive'}>{brl(total)}</strong></div><div><span>Pendentes</span><strong>{rows.filter((r:any)=>/pendente|vencido|parcial/.test(r.status)).length}</strong></div><div><span>Liquidadas</span><strong>{rows.filter((r:any)=>/pago|recebido/.test(r.status)).length}</strong></div><div><span>Vencidas</span><strong>{rows.filter((r:any)=>r.status==='vencido').length}</strong></div></div>{accounts.loading?<Loading/>:rows.length?<div className="table-wrap"><table className="data-table"><thead><tr><th>Descrição</th><th>Categoria</th><th>Vencimento</th><th>Status</th><th className="number">Valor</th><th></th></tr></thead><tbody>{rows.map((row:any)=><tr key={row.id}><td><strong>{row.descricao}</strong><small style={{display:'block',color:'#8a95a6'}}>Competência {row.competencia}</small></td><td>{categories.data?.find((c:any)=>c.id===row.categoria_id)?.nome||'—'}</td><td>{brDate(row.vencimento)}</td><td><Status value={row.status}/></td><td className={`number ${type==='pagar'?'amount-negative':'amount-positive'}`}>{brl(row.valor_centavos)}</td><td><div className="row-actions">{/pendente|vencido|parcial/.test(row.status)&&<button className="icon-button" title="Registrar baixa" onClick={()=>setPayment({...row,paymentValue:(row.valor_centavos/100).toFixed(2).replace('.',','),paymentDate:today()})}><CheckCircle2 size={16}/></button>}<button className="icon-button" onClick={()=>openForm(row)} title="Editar"><Edit3 size={16}/></button><button className="icon-button" onClick={()=>setRemove(row)} title="Excluir"><Trash2 size={16}/></button></div></td></tr>)}</tbody></table></div>:<Empty title="Sem contas nesta competência" description="Registre uma conta ou importe a planilha de 2026."/>}</Card>
    {sheetOpen&&<Card style={{marginTop:14}}><OperationalSheetGrid key={competencia+'-'+type} area="financeiro" title={'Planilha de contas a '+(type==='pagar'?'pagar':'receber')} rows={sheetRows} columns={sheetColumns} importArea="financeiro" filename={'contas-'+type+'-'+competencia} allowTemplate onCommit={commitSheet} disabledReason={sheetDisabled} onRowAction={row=>openForm(rows.find((item:any)=>item.id===Number(row.id)))} rowActionLabel="Abrir conta" canEditRow={row=>['pendente','vencido'].includes(String(row.status))&&!row.origem_tipo}/></Card>}
    <Modal open={modal} title={form.id?'Editar conta':'Nova conta'} onClose={()=>setModal(false)} size="lg"><form onSubmit={submit}><div className="modal-body form-grid form-grid-3"><Field label="Descrição" required wide><input required value={form.descricao} onChange={(e)=>setForm({...form,descricao:e.target.value})}/></Field><Field label="Empresa" required><select required value={form.empresa_id} onChange={(e)=>setForm({...form,empresa_id:e.target.value})}><option value="">Selecione</option>{companies.data?.map((x:any)=><option key={x.id} value={x.id}>{x.nome_fantasia||x.razao_social}</option>)}</select></Field><Field label="Obra"><select value={form.obra_id||''} onChange={(e)=>setForm({...form,obra_id:e.target.value})}><option value="">Sem obra</option>{works.data?.map((x:any)=><option key={x.id} value={x.id}>{x.nome}</option>)}</select></Field><Field label="Categoria"><select value={form.categoria_id||''} onChange={(e)=>setForm({...form,categoria_id:e.target.value})}><option value="">Sem categoria</option>{categories.data?.map((x:any)=><option key={x.id} value={x.id}>{x.nome}</option>)}</select></Field><Field label="Competência" required><input required type="month" value={form.competencia} onChange={(e)=>setForm({...form,competencia:e.target.value})}/></Field><Field label="Emissão"><input type="date" value={form.emissao||''} onChange={(e)=>setForm({...form,emissao:e.target.value})}/></Field><Field label="Vencimento" required><input required type="date" value={form.vencimento} onChange={(e)=>setForm({...form,vencimento:e.target.value})}/></Field><Field label="Valor" required><input required inputMode="decimal" value={form.valor} onChange={(e)=>setForm({...form,valor:e.target.value})} placeholder="0,00"/></Field><Field label="Forma de pagamento"><select value={form.forma_pagamento||''} onChange={(e)=>setForm({...form,forma_pagamento:e.target.value})}><option>PIX</option><option>Boleto</option><option>Transferência</option><option>Dinheiro</option><option>Cartão</option></select></Field><Field label="Status"><select value={form.status} onChange={(e)=>setForm({...form,status:e.target.value})}><option value="pendente">Pendente</option><option value="vencido">Vencido</option><option value="cancelado">Cancelado</option></select></Field><Field label="Observações" wide><textarea value={form.observacoes||''} onChange={(e)=>setForm({...form,observacoes:e.target.value})}/></Field></div><FormActions loading={saving} onCancel={()=>setModal(false)}/></form></Modal>
    <Modal open={!!payment} title="Registrar pagamento/recebimento" onClose={()=>setPayment(null)} size="sm">{payment&&<form onSubmit={doPayment}><div className="modal-body form-grid"><Field label="Valor" required><input required value={payment.paymentValue} onChange={(e)=>setPayment({...payment,paymentValue:e.target.value})}/></Field><Field label="Data" required><input required type="date" value={payment.paymentDate} onChange={(e)=>setPayment({...payment,paymentDate:e.target.value})}/></Field><Field label="Forma"><select value={payment.forma_pagamento||'PIX'} onChange={(e)=>setPayment({...payment,forma_pagamento:e.target.value})}><option>PIX</option><option>Boleto</option><option>Transferência</option><option>Dinheiro</option></select></Field></div><FormActions loading={saving} onCancel={()=>setPayment(null)} submitLabel="Confirmar baixa"/></form>}</Modal>
    <Confirm open={!!remove} title="Excluir conta" description="O lançamento será removido logicamente e deixará de aparecer nos relatórios." danger onCancel={()=>setRemove(null)} onConfirm={async()=>{await window.fluxoDre.contas.remove(remove.id);setRemove(null);accounts.reload()}}/>
  </>
}
