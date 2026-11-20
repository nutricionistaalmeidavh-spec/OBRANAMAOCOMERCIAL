import { ArrowDownUp, FilePlus, Plus } from 'lucide-react'
import OperationalSheetGrid, {type SheetColumn,type SheetRow} from '../components/OperationalSheetGrid'
import { groupStockMovements } from '../utils/operational-sheet'
import ReceivedNotesSection from '../components/ReceivedNotesSection'
import { FormEvent, useState } from 'react'
import { Button, Card, Empty, Field, FormActions, Loading, Modal, PageHeader, Status } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { brDate, brl, toCents, today } from '../utils/format'

const requestBlank = { obra_id: '', frente_id: '', solicitante: '', descricao: '', prazo: today(), prioridade: 'normal', status: 'solicitada', observacoes: '' }
const quoteBlank = { solicitacao_id: '', fornecedor_id: '', fornecedor_nome: '', valor: '', prazo_entrega: '', condicoes: '', justificativa: '', escolhida: 0, status: 'recebida' }
const orderBlank = { obra_id: '', frente_id: '', solicitacao_id: '', cotacao_id: '', fornecedor_id: '', empresa_id: '', descricao: '', valor: '', quantidade: '1', unidade: 'un', vencimento: today(), competencia: today().slice(0, 7) }

export default function ProcurementPage() {
  const [work, setWork] = useState(new URLSearchParams(location.search).get('obra') || '')
  const [requestForm, setRequestForm] = useState<any>(null)
  const [quoteForm, setQuoteForm] = useState<any>(null)
  const [orderForm, setOrderForm] = useState<any>(null)
  const [receive, setReceive] = useState<any>(null)
  const [stockMove, setStockMove] = useState<any>(null)
  const [notice, setNotice] = useState('')
  const [receiveBatch,setReceiveBatch]=useState<any>(null)
  const [receivingBatch,setReceivingBatch]=useState(false)
  const works = useAsync(() => window.fluxoDre.obras.list(), [])
  const storage = useAsync(() => window.fluxoDre.storage.state(), [])
  const financeStorage=useAsync(()=>window.fluxoDre.storage.moduleState('finance'),[])
  const documentsStorage = useAsync(() => window.fluxoDre.storage.moduleState('documents'), [])
  const serverMode = storage.data?.mode === 'server'
  const importBlocked=financeStorage.data&&!['local','migration-required'].includes(financeStorage.data.state)?'Dados centrais: exportação disponível; importação universal local bloqueada até a operação homologada no servidor.':undefined
  const documentsActive = !serverMode || documentsStorage.data?.state === 'central-active'
  const suppliers = useAsync(() => window.fluxoDre.fornecedores.list(), [])
  const companies = useAsync(() => window.fluxoDre.empresas.list(), [])
  const fronts = useAsync(() => work ? window.fluxoDre.frentes.list({ obra_id: Number(work) }) : Promise.resolve([]), [work])
  const requests = useAsync(() => work ? window.fluxoDre.compras.list({ obra_id: Number(work) }) : Promise.resolve([]), [work])
  const quotes = useAsync(() => window.fluxoDre.compras.cotacoes.list(), [])
  const orders = useAsync(() => work ? window.fluxoDre.compras.pedidos.list({ obra_id: Number(work) }) : Promise.resolve([]), [work])
  const stock = useAsync(() => work ? window.fluxoDre.compras.estoque.list({ obra_id: Number(work) }) : Promise.resolve([]), [work])
  const stockOrderItems=useAsync(()=>work?window.fluxoDre.compras.itens.list():Promise.resolve([]),[work])
  async function saveRequest(event: FormEvent) {
    event.preventDefault()
    await window.fluxoDre.compras.save({ ...requestForm, obra_id: Number(requestForm.obra_id), frente_id: requestForm.frente_id ? Number(requestForm.frente_id) : null })
    setRequestForm(null)
    requests.reload()
  }
  async function saveQuote(event: FormEvent) {
    event.preventDefault()
    await window.fluxoDre.compras.cotacoes.save({ ...quoteForm, solicitacao_id: Number(quoteForm.solicitacao_id), fornecedor_id: quoteForm.fornecedor_id ? Number(quoteForm.fornecedor_id) : null, valor_centavos: toCents(quoteForm.valor), escolhida: quoteForm.escolhida ? 1 : 0 })
    setQuoteForm(null)
    quotes.reload()
  }
  async function saveOrder(event: FormEvent) {
    event.preventDefault()
    await window.fluxoDre.compras.createOrder({
      obra_id: Number(orderForm.obra_id),
      frente_id: orderForm.frente_id ? Number(orderForm.frente_id) : null,
      solicitacao_id: orderForm.solicitacao_id ? Number(orderForm.solicitacao_id) : null,
      cotacao_id: orderForm.cotacao_id ? Number(orderForm.cotacao_id) : null,
      fornecedor_id: orderForm.fornecedor_id ? Number(orderForm.fornecedor_id) : null,
      descricao: orderForm.descricao,
      valor_centavos: toCents(orderForm.valor),
      status: 'emitido',
      itens: [{ descricao: orderForm.descricao, unidade: orderForm.unidade, quantidade_pedida: Number(orderForm.quantidade), valor_centavos: toCents(orderForm.valor) }],
      conta: orderForm.empresa_id ? { empresa_id: Number(orderForm.empresa_id), competencia: orderForm.competencia, vencimento: orderForm.vencimento } : null
    })
    setOrderForm(null)
    requests.reload()
    quotes.reload()
    orders.reload()
  }
  async function confirmReceive(event: FormEvent) {
    event.preventDefault()
    await window.fluxoDre.compras.receiveMaterial({ pedido_item_id: receive.item_id, quantidade_recebida: Number(receive.quantidade), data: receive.data, nota_fiscal: receive.nota_fiscal, observacoes: receive.observacoes })
    setReceive(null)
    orders.reload()
    stock.reload()
  }
  async function confirmStockMove(event: FormEvent) {
    event.preventDefault()
    await window.fluxoDre.compras.moveStock({ ...stockMove, obra_id: Number(work), frente_id: stockMove.frente_id ? Number(stockMove.frente_id) : null, quantidade: Number(stockMove.quantidade), data: stockMove.data })
    setStockMove(null)
    stock.reload()
  }
  async function attachOrder(order: any) {
    const result = await window.fluxoDre.documentos.importForWork({ obra_id: order.obra_id, frente_id: order.frente_id || null, pedido_compra_id: order.id, categoria: 'compra', title: `Pedido ${order.numero || order.id}` })
    if (result) setNotice('Documento vinculado ao pedido.')
  }
  const requestOptions = (requests.data || []).filter((item: any) => !['cancelada', 'concluida', 'convertida_pedido'].includes(item.status))
  const stockBalance:SheetRow[]=groupStockMovements(stock.data||[],stockOrderItems.data||[])
  const stockColumns:SheetColumn[]=[
    {key:'descricao',label:'Material',width:210},
    {key:'unidade',label:'Unidade'},
    {key:'etapa_nome',label:'Etapa',value:row=>fronts.data?.find((f:any)=>f.id===row.frente_id)?.nome||'Obra geral'},
    {key:'entradas',label:'Entradas'},
    {key:'saidas',label:'Saídas'},
    {key:'saldo',label:'Saldo atual'},
    {key:'custo_medio',label:'Custo médio estimado',value:row=>row.custo_medio_centavos===null?'—':brl(Number(row.custo_medio_centavos))},
    {key:'saldo_estimado',label:'Saldo valorizado estimado',value:row=>row.saldo_estimado_centavos===null?'—':brl(Number(row.saldo_estimado_centavos))}
  ]
  const quotesForWork:SheetRow[]=(quotes.data||[]).filter((q:any)=>(requests.data||[]).some((r:any)=>r.id===q.solicitacao_id)).map((q:any)=>({
    ...q,
    solicitacao_nome:requests.data?.find((r:any)=>r.id===q.solicitacao_id)?.descricao||'',
    fornecedor_nome:q.fornecedor_nome||suppliers.data?.find((supplier:any)=>supplier.id===q.fornecedor_id)?.nome||'Não informado',
    valor_reais:(Number(q.valor_centavos||0)/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})
  }))
  const quoteColumns:SheetColumn[]=[
    {key:'solicitacao_nome',label:'Solicitação',width:200},
    {key:'fornecedor_nome',label:'Fornecedor',width:160},
    {key:'valor_reais',label:'Proposta (R$)'},
    {key:'prazo_entrega',label:'Entrega'},
    {key:'status',label:'Situação'},
    {key:'escolhida',label:'Escolhida',value:row=>row.escolhida?'Sim':'Não'}
  ]
  const openBatch=async(order:any)=>{
    setNotice('')
    try{
      const items=await window.fluxoDre.compras.itens.list({pedido_compra_id:order.id})
      const pending=items.filter((item:any)=>Number(item.quantidade_pedida)>Number(item.quantidade_recebida))
      if(!pending.length)throw new Error('Este pedido não possui itens pendentes.')
      setReceiveBatch({order,data:today(),nota_fiscal:'',items:pending.map((item:any)=>({...item,quantidade:String(Math.max(0,Number(item.quantidade_pedida)-Number(item.quantidade_recebida)))}))})
    }catch(e){setNotice(e instanceof Error?e.message:'Falha ao carregar itens.')}
  }
  const commitBatch=async(event:FormEvent)=>{
    event.preventDefault()
    if(!receiveBatch||receivingBatch)return
    setReceivingBatch(true)
    try{
      await window.fluxoDre.compras.receiveMany({data:receiveBatch.data,nota_fiscal:receiveBatch.nota_fiscal,
        items:receiveBatch.items.filter((item:any)=>Number(item.quantidade)>0).map((item:any)=>({pedido_item_id:item.id,quantidade_recebida:Number(item.quantidade)}))})
      setReceiveBatch(null);setNotice('Itens recebidos e saldos atualizados em transação única.')
      orders.reload();stock.reload()
    }catch(e){setNotice(e instanceof Error?e.message:'Falha no recebimento em lote.')}
    finally{setReceivingBatch(false)}
  }
  return <>
    <PageHeader title="Compras e materiais" description="Organize compras, notas recebidas, pedidos e estoque por obra e etapa." actions={<><Button variant="secondary" icon={<ArrowDownUp size={16}/>} disabled={!work} onClick={() => setStockMove({ frente_id: '', tipo: 'saida', descricao: '', unidade: 'un', quantidade: '1', data: today(), observacoes: '' })}>Movimentar estoque</Button><Button icon={<Plus size={16}/>} disabled={!work} onClick={() => setRequestForm({ ...requestBlank, obra_id: work })}>Nova solicitacao</Button></>}/>
    <div className="filters"><Field label="Obra"><select value={work} onChange={(event) => setWork(event.target.value)}><option value="">Selecione</option>{works.data?.map((item: any) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field></div>
    {notice && <div className="success-box">{notice}</div>}
    <Card><div className="card-header"><h2>Solicitacoes e cotacoes</h2><Button variant="secondary" disabled={!requestOptions.length} onClick={() => setQuoteForm({ ...quoteBlank, solicitacao_id: requestOptions[0]?.id || '' })}>Nova cotacao</Button></div>{requests.loading ? <Loading/> : requests.data?.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Solicitacao</th><th>Etapa</th><th>Prazo</th><th>Status</th><th>Cotacoes</th><th/></tr></thead><tbody>{requests.data.map((item: any) => <tr key={item.id}><td><strong>{item.descricao}</strong><small>{item.solicitante}</small></td><td>{fronts.data?.find((front: any) => front.id === item.frente_id)?.nome || 'Obra geral'}</td><td>{brDate(item.prazo)}</td><td><Status value={item.status}/></td><td>{quotes.data?.filter((quote: any) => quote.solicitacao_id === item.id).length || 0}</td><td><Button variant="secondary" onClick={() => setOrderForm({ ...orderBlank, obra_id: work, frente_id: item.frente_id || '', solicitacao_id: item.id, descricao: item.descricao })}>Virar pedido</Button></td></tr>)}</tbody></table></div> : <Empty title={work ? 'Nenhuma solicitação de compra' : 'Selecione uma obra'} description={work ? 'Registre a necessidade antes de cotar ou emitir um pedido.' : 'Escolha uma obra para acompanhar solicitações, pedidos e estoque.'} action={work ? <Button onClick={() => setRequestForm({ ...requestBlank, obra_id: work })}>Nova solicitação</Button> : undefined}/>}</Card>
    <Card style={{ marginTop: 14 }}><div className="card-header"><h2>Pedidos</h2><Button variant="secondary" disabled={!work} onClick={() => setOrderForm({ ...orderBlank, obra_id: work })}>Pedido direto</Button></div>{orders.loading ? <Loading/> : orders.data?.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Pedido</th><th>Etapa</th><th>Status</th><th>Valor</th><th/></tr></thead><tbody>{orders.data.map((item: any) => <tr key={item.id}><td><strong>{item.descricao}</strong><small>{item.numero || `#${item.id}`}</small></td><td>{fronts.data?.find((front: any) => front.id === item.frente_id)?.nome || 'Obra geral'}</td><td><Status value={item.status}/></td><td>{brl(item.valor_centavos)}</td><td><div className="row-actions"><Button variant="secondary" onClick={()=>void openBatch(item)}>Receber itens</Button><button className="icon-button" disabled={!documentsActive} onClick={() => attachOrder(item)} title={documentsActive ? "Anexar nota/documento" : "Documentos ainda não estão ativos no servidor"}><FilePlus size={15}/></button></div></td></tr>)}</tbody></table></div> : <Empty title="Nenhum pedido" description="Converta solicitacoes ou crie pedido direto."/>}</Card>
    <ReceivedNotesSection obraId={work ? Number(work) : null}/>
    {work&&<Card style={{marginTop:14}}><OperationalSheetGrid key={'quotes-'+work} area="compras" title="Comparativo de cotações" rows={quotesForWork} columns={quoteColumns} filename={'cotacoes-obra-'+work} importArea="compras" companyId={works.data?.find((w:any)=>String(w.id)===work)?.empresa_id} disabledReason={importBlocked}/></Card>}
    <Card style={{marginTop:14}}><OperationalSheetGrid key={'stock-'+work} area="estoque" title="Estoque da obra — saldos e movimentações" rows={stockBalance} columns={stockColumns} filename={'estoque-obra-'+work} importArea="estoque" allowTemplate companyId={works.data?.find((w:any)=>String(w.id)===work)?.empresa_id} disabledReason={importBlocked} onRowAction={row=>setStockMove({frente_id:row.frente_id||'',tipo:'saida',descricao:row.descricao,unidade:row.unidade,quantidade:'1',data:today(),observacoes:''})} rowActionLabel="Movimentar"/></Card>
    <Card><div className="card-header"><h2>Histórico de estoque</h2><p>Movimentações originais — saldos calculados, não editáveis diretamente.</p></div>{stock.data?.length?<div className="table-wrap"><table className="data-table"><thead><tr><th>Item</th><th>Tipo</th><th>Data</th><th>Qtd.</th></tr></thead><tbody>{stock.data.map((m:any)=><tr key={m.id}><td>{m.descricao}</td><td><Status value={m.tipo}/></td><td>{brDate(m.data)}</td><td>{m.quantidade} {m.unidade}</td></tr>)}</tbody></table></div>:<Empty title="Sem movimentações" description="Recebimentos e entradas aparecem aqui após a confirmação."/>}</Card>
    <Modal open={!!receiveBatch} title="Receber itens do pedido em lote" onClose={()=>!receivingBatch&&setReceiveBatch(null)} size="lg"><form onSubmit={commitBatch}><div className="modal-body"><p>Confirme as quantidades de cada item. A operação será atômica no armazenamento canônico ativo, sem criar entradas duplicadas.</p><div className="form-grid"><Field label="Data"><input type="date" value={receiveBatch?.data||''} onChange={e=>setReceiveBatch({...receiveBatch,data:e.target.value})}/></Field><Field label="Número da nota"><input value={receiveBatch?.nota_fiscal||''} onChange={e=>setReceiveBatch({...receiveBatch,nota_fiscal:e.target.value})}/></Field></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Item</th><th>Restante</th><th>Receber agora</th></tr></thead><tbody>{receiveBatch?.items.map((row:any,index:number)=><tr key={row.id}><td>{row.descricao}</td><td>{Number(row.quantidade_pedida)-Number(row.quantidade_recebida)}</td><td><input type="number" min="0" max={Number(row.quantidade_pedida)-Number(row.quantidade_recebida)} step="any" value={row.quantidade} onChange={e=>setReceiveBatch((old:any)=>({...old,items:old.items.map((item:any,i:number)=>i===index?{...item,quantidade:e.target.value}:item)}))}/></td></tr>)}</tbody></table></div></div><FormActions loading={receivingBatch} onCancel={()=>setReceiveBatch(null)} submitLabel="Registrar recebimento em lote"/></form></Modal>
    <Modal open={!!requestForm} title="Solicitacao de compra" onClose={() => setRequestForm(null)}><form onSubmit={saveRequest}><div className="modal-body form-grid"><Field label="Etapa"><select value={requestForm?.frente_id || ''} onChange={(event) => setRequestForm({ ...requestForm, frente_id: event.target.value })}><option value="">Obra geral</option>{fronts.data?.map((item: any) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field><Field label="Solicitante" required><input required value={requestForm?.solicitante || ''} onChange={(event) => setRequestForm({ ...requestForm, solicitante: event.target.value })}/></Field><Field label="Prazo"><input type="date" value={requestForm?.prazo || ''} onChange={(event) => setRequestForm({ ...requestForm, prazo: event.target.value })}/></Field><Field label="Prioridade"><select value={requestForm?.prioridade || 'normal'} onChange={(event) => setRequestForm({ ...requestForm, prioridade: event.target.value })}><option value="normal">Normal</option><option value="alta">Alta</option><option value="urgente">Urgente</option></select></Field><Field label="Descricao" wide required><textarea required value={requestForm?.descricao || ''} onChange={(event) => setRequestForm({ ...requestForm, descricao: event.target.value })}/></Field></div><FormActions onCancel={() => setRequestForm(null)}/></form></Modal>
    <Modal open={!!quoteForm} title="Cotacao" onClose={() => setQuoteForm(null)}><form onSubmit={saveQuote}><div className="modal-body form-grid"><Field label="Solicitacao"><select value={quoteForm?.solicitacao_id || ''} onChange={(event) => setQuoteForm({ ...quoteForm, solicitacao_id: event.target.value })}>{requestOptions.map((item: any) => <option key={item.id} value={item.id}>{item.descricao}</option>)}</select></Field><Field label="Fornecedor"><select value={quoteForm?.fornecedor_id || ''} onChange={(event) => setQuoteForm({ ...quoteForm, fornecedor_id: event.target.value })}><option value="">Nome livre</option>{suppliers.data?.map((item: any) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field><Field label="Fornecedor livre"><input value={quoteForm?.fornecedor_nome || ''} onChange={(event) => setQuoteForm({ ...quoteForm, fornecedor_nome: event.target.value })}/></Field><Field label="Valor"><input value={quoteForm?.valor || ''} onChange={(event) => setQuoteForm({ ...quoteForm, valor: event.target.value })}/></Field><Field label="Prazo entrega"><input type="date" value={quoteForm?.prazo_entrega || ''} onChange={(event) => setQuoteForm({ ...quoteForm, prazo_entrega: event.target.value })}/></Field><Field label="Justificativa" wide><textarea value={quoteForm?.justificativa || ''} onChange={(event) => setQuoteForm({ ...quoteForm, justificativa: event.target.value })}/></Field></div><FormActions onCancel={() => setQuoteForm(null)}/></form></Modal>
    <Modal open={!!orderForm} title="Pedido de compra" onClose={() => setOrderForm(null)}><form onSubmit={saveOrder}><div className="modal-body form-grid"><Field label="Etapa"><select value={orderForm?.frente_id || ''} onChange={(event) => setOrderForm({ ...orderForm, frente_id: event.target.value })}><option value="">Obra geral</option>{fronts.data?.map((item: any) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field><Field label="Cotacao escolhida"><select value={orderForm?.cotacao_id || ''} onChange={(event) => { const quote = quotes.data?.find((item: any) => item.id === Number(event.target.value)); setOrderForm({ ...orderForm, cotacao_id: event.target.value, fornecedor_id: quote?.fornecedor_id || orderForm.fornecedor_id, valor: quote ? String(quote.valor_centavos / 100).replace('.', ',') : orderForm.valor }) }}><option value="">Sem cotacao</option>{quotes.data?.filter((quote: any) => !orderForm?.solicitacao_id || quote.solicitacao_id === Number(orderForm.solicitacao_id)).map((item: any) => <option key={item.id} value={item.id}>{item.fornecedor_nome || suppliers.data?.find((supplier: any) => supplier.id === item.fornecedor_id)?.nome || `Cotacao #${item.id}`} - {brl(item.valor_centavos)}</option>)}</select></Field><Field label="Fornecedor"><select value={orderForm?.fornecedor_id || ''} onChange={(event) => setOrderForm({ ...orderForm, fornecedor_id: event.target.value })}><option value="">Nao informado</option>{suppliers.data?.map((item: any) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field><Field label="Empresa para conta"><select value={orderForm?.empresa_id || ''} onChange={(event) => setOrderForm({ ...orderForm, empresa_id: event.target.value })}><option value="">Nao gerar conta</option>{companies.data?.map((item: any) => <option key={item.id} value={item.id}>{item.nome_fantasia || item.razao_social}</option>)}</select></Field><Field label="Descricao" wide required><textarea required value={orderForm?.descricao || ''} onChange={(event) => setOrderForm({ ...orderForm, descricao: event.target.value })}/></Field><Field label="Quantidade"><input type="number" min="0.001" step="0.001" value={orderForm?.quantidade || ''} onChange={(event) => setOrderForm({ ...orderForm, quantidade: event.target.value })}/></Field><Field label="Unidade"><input value={orderForm?.unidade || ''} onChange={(event) => setOrderForm({ ...orderForm, unidade: event.target.value })}/></Field><Field label="Valor" required><input required value={orderForm?.valor || ''} onChange={(event) => setOrderForm({ ...orderForm, valor: event.target.value })}/></Field></div><FormActions onCancel={() => setOrderForm(null)}/></form></Modal>
    <Modal open={!!receive} title="Receber material" onClose={() => setReceive(null)}><form onSubmit={confirmReceive}><div className="modal-body form-grid"><Field label="Quantidade" required><input required type="number" min="0.001" step="0.001" value={receive?.quantidade || ''} onChange={(event) => setReceive({ ...receive, quantidade: event.target.value })}/></Field><Field label="Data"><input type="date" value={receive?.data || ''} onChange={(event) => setReceive({ ...receive, data: event.target.value })}/></Field><Field label="Nota fiscal"><input value={receive?.nota_fiscal || ''} onChange={(event) => setReceive({ ...receive, nota_fiscal: event.target.value })}/></Field><Field label="Observacoes" wide><textarea value={receive?.observacoes || ''} onChange={(event) => setReceive({ ...receive, observacoes: event.target.value })}/></Field></div><FormActions onCancel={() => setReceive(null)} submitLabel="Confirmar"/></form></Modal>
    <Modal open={!!stockMove} title="Movimentar estoque" onClose={() => setStockMove(null)}><form onSubmit={confirmStockMove}><div className="modal-body form-grid"><Field label="Etapa"><select value={stockMove?.frente_id || ''} onChange={(event) => setStockMove({ ...stockMove, frente_id: event.target.value })}><option value="">Obra geral</option>{fronts.data?.map((item: any) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field><Field label="Tipo"><select value={stockMove?.tipo || 'saida'} onChange={(event) => setStockMove({ ...stockMove, tipo: event.target.value })}><option value="saida">Saida</option><option value="ajuste">Ajuste positivo</option></select></Field><Field label="Item" required><input required value={stockMove?.descricao || ''} onChange={(event) => setStockMove({ ...stockMove, descricao: event.target.value })}/></Field><Field label="Unidade"><input value={stockMove?.unidade || ''} onChange={(event) => setStockMove({ ...stockMove, unidade: event.target.value })}/></Field><Field label="Quantidade"><input type="number" min="0.001" step="0.001" value={stockMove?.quantidade || ''} onChange={(event) => setStockMove({ ...stockMove, quantidade: event.target.value })}/></Field><Field label="Data"><input type="date" value={stockMove?.data || ''} onChange={(event) => setStockMove({ ...stockMove, data: event.target.value })}/></Field></div><FormActions onCancel={() => setStockMove(null)} submitLabel="Registrar"/></form></Modal>
  </>
}
