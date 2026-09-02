import { ArrowDownUp, FilePlus, Plus } from 'lucide-react'
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
  const works = useAsync(() => window.fluxoDre.obras.list(), [])
  const suppliers = useAsync(() => window.fluxoDre.fornecedores.list(), [])
  const companies = useAsync(() => window.fluxoDre.empresas.list(), [])
  const fronts = useAsync(() => work ? window.fluxoDre.frentes.list({ obra_id: Number(work) }) : Promise.resolve([]), [work])
  const requests = useAsync(() => work ? window.fluxoDre.compras.list({ obra_id: Number(work) }) : Promise.resolve([]), [work])
  const quotes = useAsync(() => window.fluxoDre.compras.cotacoes.list(), [])
  const orders = useAsync(() => work ? window.fluxoDre.compras.pedidos.list({ obra_id: Number(work) }) : Promise.resolve([]), [work])
  const stock = useAsync(() => work ? window.fluxoDre.compras.estoque.list({ obra_id: Number(work) }) : Promise.resolve([]), [work])
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
  return <>
    <PageHeader title="Compras e materiais" description="Solicitacoes, cotacoes, pedidos, recebimentos e estoque por obra/frente." actions={<><Button variant="secondary" icon={<ArrowDownUp size={16}/>} disabled={!work} onClick={() => setStockMove({ frente_id: '', tipo: 'saida', descricao: '', unidade: 'un', quantidade: '1', data: today(), observacoes: '' })}>Movimentar estoque</Button><Button icon={<Plus size={16}/>} disabled={!work} onClick={() => setRequestForm({ ...requestBlank, obra_id: work })}>Nova solicitacao</Button></>}/>
    <div className="filters"><Field label="Obra"><select value={work} onChange={(event) => setWork(event.target.value)}><option value="">Selecione</option>{works.data?.map((item: any) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field></div>
    {notice && <div className="success-box">{notice}</div>}
    <Card><div className="card-header"><h2>Solicitacoes e cotacoes</h2><Button variant="secondary" disabled={!requestOptions.length} onClick={() => setQuoteForm({ ...quoteBlank, solicitacao_id: requestOptions[0]?.id || '' })}>Nova cotacao</Button></div>{requests.loading ? <Loading/> : requests.data?.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Solicitacao</th><th>Frente</th><th>Prazo</th><th>Status</th><th>Cotacoes</th><th/></tr></thead><tbody>{requests.data.map((item: any) => <tr key={item.id}><td><strong>{item.descricao}</strong><small>{item.solicitante}</small></td><td>{fronts.data?.find((front: any) => front.id === item.frente_id)?.nome || 'Obra geral'}</td><td>{brDate(item.prazo)}</td><td><Status value={item.status}/></td><td>{quotes.data?.filter((quote: any) => quote.solicitacao_id === item.id).length || 0}</td><td><Button variant="secondary" onClick={() => setOrderForm({ ...orderBlank, obra_id: work, frente_id: item.frente_id || '', solicitacao_id: item.id, descricao: item.descricao })}>Virar pedido</Button></td></tr>)}</tbody></table></div> : <Empty title={work ? 'Nenhuma solicitacao' : 'Selecione uma obra'} description="Cadastre a necessidade antes de comprar."/>}</Card>
    <Card style={{ marginTop: 14 }}><div className="card-header"><h2>Pedidos</h2><Button variant="secondary" disabled={!work} onClick={() => setOrderForm({ ...orderBlank, obra_id: work })}>Pedido direto</Button></div>{orders.loading ? <Loading/> : orders.data?.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Pedido</th><th>Frente</th><th>Status</th><th>Valor</th><th/></tr></thead><tbody>{orders.data.map((item: any) => <tr key={item.id}><td><strong>{item.descricao}</strong><small>{item.numero || `#${item.id}`}</small></td><td>{fronts.data?.find((front: any) => front.id === item.frente_id)?.nome || 'Obra geral'}</td><td><Status value={item.status}/></td><td>{brl(item.valor_centavos)}</td><td><div className="row-actions"><Button variant="secondary" onClick={async () => { const list = await window.fluxoDre.compras.itens.list({ pedido_compra_id: item.id }); if (list[0]) setReceive({ item_id: list[0].id, quantidade: Math.max(0, list[0].quantidade_pedida - list[0].quantidade_recebida), data: today(), nota_fiscal: '', observacoes: '' }) }}>Receber</Button><button className="icon-button" onClick={() => attachOrder(item)} title="Anexar nota/documento"><FilePlus size={15}/></button></div></td></tr>)}</tbody></table></div> : <Empty title="Nenhum pedido" description="Converta solicitacoes ou crie pedido direto."/>}</Card>
    <Card style={{ marginTop: 14 }}><div className="card-header"><h2>Estoque da obra</h2></div>{stock.data?.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Item</th><th>Frente</th><th>Tipo</th><th>Data</th><th className="number">Quantidade</th></tr></thead><tbody>{stock.data.map((item: any) => <tr key={item.id}><td><strong>{item.descricao}</strong><small>{item.observacoes}</small></td><td>{fronts.data?.find((front: any) => front.id === item.frente_id)?.nome || 'Obra geral'}</td><td><Status value={item.tipo}/></td><td>{brDate(item.data)}</td><td className="number">{item.quantidade} {item.unidade}</td></tr>)}</tbody></table></div> : <Empty title="Sem movimentacao de estoque" description="Recebimentos de pedidos geram entradas automaticamente."/>}</Card>
    <Modal open={!!requestForm} title="Solicitacao de compra" onClose={() => setRequestForm(null)}><form onSubmit={saveRequest}><div className="modal-body form-grid"><Field label="Frente"><select value={requestForm?.frente_id || ''} onChange={(event) => setRequestForm({ ...requestForm, frente_id: event.target.value })}><option value="">Obra geral</option>{fronts.data?.map((item: any) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field><Field label="Solicitante" required><input required value={requestForm?.solicitante || ''} onChange={(event) => setRequestForm({ ...requestForm, solicitante: event.target.value })}/></Field><Field label="Prazo"><input type="date" value={requestForm?.prazo || ''} onChange={(event) => setRequestForm({ ...requestForm, prazo: event.target.value })}/></Field><Field label="Prioridade"><select value={requestForm?.prioridade || 'normal'} onChange={(event) => setRequestForm({ ...requestForm, prioridade: event.target.value })}><option value="normal">Normal</option><option value="alta">Alta</option><option value="urgente">Urgente</option></select></Field><Field label="Descricao" wide required><textarea required value={requestForm?.descricao || ''} onChange={(event) => setRequestForm({ ...requestForm, descricao: event.target.value })}/></Field></div><FormActions onCancel={() => setRequestForm(null)}/></form></Modal>
    <Modal open={!!quoteForm} title="Cotacao" onClose={() => setQuoteForm(null)}><form onSubmit={saveQuote}><div className="modal-body form-grid"><Field label="Solicitacao"><select value={quoteForm?.solicitacao_id || ''} onChange={(event) => setQuoteForm({ ...quoteForm, solicitacao_id: event.target.value })}>{requestOptions.map((item: any) => <option key={item.id} value={item.id}>{item.descricao}</option>)}</select></Field><Field label="Fornecedor"><select value={quoteForm?.fornecedor_id || ''} onChange={(event) => setQuoteForm({ ...quoteForm, fornecedor_id: event.target.value })}><option value="">Nome livre</option>{suppliers.data?.map((item: any) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field><Field label="Fornecedor livre"><input value={quoteForm?.fornecedor_nome || ''} onChange={(event) => setQuoteForm({ ...quoteForm, fornecedor_nome: event.target.value })}/></Field><Field label="Valor"><input value={quoteForm?.valor || ''} onChange={(event) => setQuoteForm({ ...quoteForm, valor: event.target.value })}/></Field><Field label="Prazo entrega"><input type="date" value={quoteForm?.prazo_entrega || ''} onChange={(event) => setQuoteForm({ ...quoteForm, prazo_entrega: event.target.value })}/></Field><Field label="Justificativa" wide><textarea value={quoteForm?.justificativa || ''} onChange={(event) => setQuoteForm({ ...quoteForm, justificativa: event.target.value })}/></Field></div><FormActions onCancel={() => setQuoteForm(null)}/></form></Modal>
    <Modal open={!!orderForm} title="Pedido de compra" onClose={() => setOrderForm(null)}><form onSubmit={saveOrder}><div className="modal-body form-grid"><Field label="Frente"><select value={orderForm?.frente_id || ''} onChange={(event) => setOrderForm({ ...orderForm, frente_id: event.target.value })}><option value="">Obra geral</option>{fronts.data?.map((item: any) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field><Field label="Cotacao escolhida"><select value={orderForm?.cotacao_id || ''} onChange={(event) => { const quote = quotes.data?.find((item: any) => item.id === Number(event.target.value)); setOrderForm({ ...orderForm, cotacao_id: event.target.value, fornecedor_id: quote?.fornecedor_id || orderForm.fornecedor_id, valor: quote ? String(quote.valor_centavos / 100).replace('.', ',') : orderForm.valor }) }}><option value="">Sem cotacao</option>{quotes.data?.filter((quote: any) => !orderForm?.solicitacao_id || quote.solicitacao_id === Number(orderForm.solicitacao_id)).map((item: any) => <option key={item.id} value={item.id}>{item.fornecedor_nome || suppliers.data?.find((supplier: any) => supplier.id === item.fornecedor_id)?.nome || `Cotacao #${item.id}`} - {brl(item.valor_centavos)}</option>)}</select></Field><Field label="Fornecedor"><select value={orderForm?.fornecedor_id || ''} onChange={(event) => setOrderForm({ ...orderForm, fornecedor_id: event.target.value })}><option value="">Nao informado</option>{suppliers.data?.map((item: any) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field><Field label="Empresa para conta"><select value={orderForm?.empresa_id || ''} onChange={(event) => setOrderForm({ ...orderForm, empresa_id: event.target.value })}><option value="">Nao gerar conta</option>{companies.data?.map((item: any) => <option key={item.id} value={item.id}>{item.nome_fantasia || item.razao_social}</option>)}</select></Field><Field label="Descricao" wide required><textarea required value={orderForm?.descricao || ''} onChange={(event) => setOrderForm({ ...orderForm, descricao: event.target.value })}/></Field><Field label="Quantidade"><input type="number" min="0.001" step="0.001" value={orderForm?.quantidade || ''} onChange={(event) => setOrderForm({ ...orderForm, quantidade: event.target.value })}/></Field><Field label="Unidade"><input value={orderForm?.unidade || ''} onChange={(event) => setOrderForm({ ...orderForm, unidade: event.target.value })}/></Field><Field label="Valor" required><input required value={orderForm?.valor || ''} onChange={(event) => setOrderForm({ ...orderForm, valor: event.target.value })}/></Field></div><FormActions onCancel={() => setOrderForm(null)}/></form></Modal>
    <Modal open={!!receive} title="Receber material" onClose={() => setReceive(null)}><form onSubmit={confirmReceive}><div className="modal-body form-grid"><Field label="Quantidade" required><input required type="number" min="0.001" step="0.001" value={receive?.quantidade || ''} onChange={(event) => setReceive({ ...receive, quantidade: event.target.value })}/></Field><Field label="Data"><input type="date" value={receive?.data || ''} onChange={(event) => setReceive({ ...receive, data: event.target.value })}/></Field><Field label="Nota fiscal"><input value={receive?.nota_fiscal || ''} onChange={(event) => setReceive({ ...receive, nota_fiscal: event.target.value })}/></Field><Field label="Observacoes" wide><textarea value={receive?.observacoes || ''} onChange={(event) => setReceive({ ...receive, observacoes: event.target.value })}/></Field></div><FormActions onCancel={() => setReceive(null)} submitLabel="Confirmar"/></form></Modal>
    <Modal open={!!stockMove} title="Movimentar estoque" onClose={() => setStockMove(null)}><form onSubmit={confirmStockMove}><div className="modal-body form-grid"><Field label="Frente"><select value={stockMove?.frente_id || ''} onChange={(event) => setStockMove({ ...stockMove, frente_id: event.target.value })}><option value="">Obra geral</option>{fronts.data?.map((item: any) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field><Field label="Tipo"><select value={stockMove?.tipo || 'saida'} onChange={(event) => setStockMove({ ...stockMove, tipo: event.target.value })}><option value="saida">Saida</option><option value="ajuste">Ajuste positivo</option></select></Field><Field label="Item" required><input required value={stockMove?.descricao || ''} onChange={(event) => setStockMove({ ...stockMove, descricao: event.target.value })}/></Field><Field label="Unidade"><input value={stockMove?.unidade || ''} onChange={(event) => setStockMove({ ...stockMove, unidade: event.target.value })}/></Field><Field label="Quantidade"><input type="number" min="0.001" step="0.001" value={stockMove?.quantidade || ''} onChange={(event) => setStockMove({ ...stockMove, quantidade: event.target.value })}/></Field><Field label="Data"><input type="date" value={stockMove?.data || ''} onChange={(event) => setStockMove({ ...stockMove, data: event.target.value })}/></Field></div><FormActions onCancel={() => setStockMove(null)} submitLabel="Registrar"/></form></Modal>
  </>
}
