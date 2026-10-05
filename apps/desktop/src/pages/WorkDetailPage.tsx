import { ArrowLeft, CalendarDays, ClipboardList, FileText, ShoppingCart } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Card, Empty, ErrorState, Kpi, Loading, PageHeader, Status } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { brDate, brl } from '../utils/format'
import { isWorkAreaAvailable } from '../utils/workAvailability'

export default function WorkDetailPage() {
  const { id } = useParams()
  const { data, loading, error, reload } = useAsync(() => window.fluxoDre.obras.overview(Number(id)), [id])
  const edition = useAsync(() => window.fluxoDre.product.getEdition(), [])
  if (loading) return <Card><Loading/></Card>
  if (error) return <Card><ErrorState error={error} retry={reload}/></Card>
  if (!data) return <Card><Empty title="Obra não encontrada"/></Card>
  const empreiteira = edition.data?.edition === 'empreiteira'
  const totalContratado = data.frentes?.reduce((sum: number, item: any) => sum + Number(item.contratado_centavos || 0), 0) || 0
  const totalPago = data.frentes?.reduce((sum: number, item: any) => sum + Number(item.pago_centavos || 0), 0) || 0
  const availability = data.availability || {}
  const partial = data.serverPartial === true
  const areaAvailable = (area: 'operation'|'planning'|'finance'|'medicoes'|'documentos'|'contratos'|'compras') => isWorkAreaAvailable(partial, availability, area)
  const operationAvailable = areaAvailable('operation')
  const planningAvailable = areaAvailable('planning')
  const financeAvailable = areaAvailable('finance')
  const measurementsAvailable = areaAvailable('medicoes')
  const documentsAvailable = areaAvailable('documentos')
  const contractsAvailable = areaAvailable('contratos')
  const purchasesAvailable = areaAvailable('compras')
  return <>
    <PageHeader title={data.obra.nome} description={`Obra 360: ${data.obra.status_operacional || data.obra.status || 'em acompanhamento'}`} actions={<Link className="button button-secondary" to="/obras"><ArrowLeft size={16}/>Obras</Link>}/>
    {partial&&<div className="success-box" style={{ marginBottom: 14 }}><strong>Dados compartilhados da obra.</strong> Cada área abaixo é liberada assim que sua fonte canônica fica ativa no servidor.</div>}
    <div className="kpi-grid work-overview-kpis"><Kpi label="Orçado" value={planningAvailable?brl(data.orcado_centavos):'—'}/><Kpi label="Contratado" value={contractsAvailable?brl(totalContratado):'—'}/><Kpi label="Pago" value={financeAvailable?brl(totalPago):'—'}/><Kpi label={empreiteira ? 'Receita medida' : 'Medido'} value={measurementsAvailable?brl(data.medido_centavos):'—'}/><Kpi label="Pendências" value={operationAvailable?String(data.pendencias?.length || 0):'—'}/></div>
    <Card style={{ marginTop: 16 }}>
      <div className="card-header"><div><h2>Próximas ações</h2><p>O que merece atenção nesta obra agora.</p></div></div>
      <div className="card-body stage-list">
        {!operationAvailable ? <div><div><strong>Operação ainda não centralizada</strong><span>Conclua a fonte canônica de operação para liberar tarefas e ocorrências.</span></div></div> : data.pendencias?.length ? <div><div><strong>{data.pendencias.length} pendência(s) aberta(s)</strong><span>Revise responsáveis e prazos para manter a execução em dia.</span></div><Link to={`/tarefas?obra=${data.obra.id}`}>Ver tarefas</Link></div> : <div><div><strong>Nenhuma pendência aberta</strong><span>A obra não possui tarefas ou ocorrências pendentes neste momento.</span></div></div>}
        {planningAvailable && data.cronograma?.[0] && <div><div><strong>Próxima etapa: {data.cronograma[0].nome}</strong><span>Acompanhe previsto e realizado no planejamento.</span></div><Link to={`/planejamento?obra=${data.obra.id}`}>Abrir planejamento</Link></div>}
        {purchasesAvailable && data.compras?.some((item:any)=>item.status && !['concluida','recebida','cancelada'].includes(item.status)) && <div><div><strong>Há compras em andamento</strong><span>Confira pedidos e recebimentos que ainda exigem acompanhamento.</span></div><Link to={`/compras?obra=${data.obra.id}`}>Ver compras</Link></div>}
      </div>
    </Card>
    <Card style={{ marginTop: 16 }}><div className="card-header"><div><h2>Resultado por frente</h2><p>Orçado, comprometido, contratado, pago, medido e saldo de cada especialidade.</p></div>{planningAvailable&&<Link to={`/planejamento?obra=${data.obra.id}`}><CalendarDays size={16}/>Planejamento</Link>}</div>{data.frentes?.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Frente</th><th className="number">Orçado</th><th className="number">Comprometido</th><th className="number">Contratado</th><th className="number">Pago</th>{empreiteira && <th className="number">Receita medida</th>}<th className="number">Saldo</th><th>Pend.</th></tr></thead><tbody>{data.frentes.map((item: any) => <tr key={item.id}><td><strong>{item.nome}</strong><Status value={item.status}/></td><td className="number">{planningAvailable?brl(item.orcado_centavos):'—'}</td><td className="number">{financeAvailable?brl(item.comprometido_centavos):'—'}</td><td className="number">{contractsAvailable?brl(item.contratado_centavos):'—'}</td><td className="number">{financeAvailable?brl(item.pago_centavos):'—'}</td>{empreiteira && <td className="number">{measurementsAvailable?brl(item.medido_centavos):'—'}</td>}<td className="number">{planningAvailable&&financeAvailable&&contractsAvailable?brl(item.orcado_centavos - Math.max(item.comprometido_centavos, item.contratado_centavos)):'—'}</td><td>{item.pendências_abertas || 0}</td></tr>)}</tbody></table></div> : <Empty title="Nenhuma frente cadastrada" description="Cadastre as frentes e classifique orcamento, compras, planejamento e medições." action={<Link className="button button-primary" to="/frentes">Gerenciar frentes</Link>}/>}</Card>
    <div className="dashboard-grid" style={{ marginTop: 16 }}>
      <Card><div className="card-header"><h2>Pendências abertas</h2>{operationAvailable&&<Link to={`/tarefas?obra=${data.obra.id}`}><ClipboardList size={16}/>Abrir</Link>}</div>{!operationAvailable?<Empty title="Operação ainda não centralizada" description="Tarefas e ocorrências serão liberadas quando a fonte de operação estiver ativa."/>:data.pendencias?.length ? <div className="stage-list">{data.pendencias.map((item: any) => <div key={item.id}><div><strong>{item.titulo}</strong><span>{item.frente_nome || 'Obra geral'} - {item.responsavel || 'sem responsavel'}</span></div><div><Status value={item.status}/><small>{brDate(item.prazo)}</small></div></div>)}</div> : <Empty title="Sem pendências abertas" description="Ocorrencias do RDO e tarefas manuais aparecem aqui."/>}</Card>
      <Card><div className="card-header"><h2>Documentos recentes</h2>{documentsAvailable&&<Link to={`/documentos?obra=${data.obra.id}`}><FileText size={16}/>Central</Link>}</div>{!documentsAvailable?<Empty title="Ainda não centralizado" description="Documentos continuam na fonte local e não são misturados com a obra central."/>:data.documentos?.length ? <div className="stage-list">{data.documentos.map((item: any) => <div key={item.id}><div><strong>{item.titulo}</strong><span>{item.categoria}</span></div><small>{brDate(item.created_at)}</small></div>)}</div> : <Empty title="Sem documentos" description="Contratos, RDOs, medições e notas entram aqui."/>}</Card>
    </div>
    <div className="dashboard-grid" style={{ marginTop: 16 }}>
      <Card><div className="card-header"><h2>Contratos recentes</h2>{contractsAvailable&&<Link to={`/contratos?obra=${data.obra.id}`}><FileText size={16}/>Contratos</Link>}</div>{!contractsAvailable?<Empty title="Ainda não centralizado" description="Contratos continuam na fonte local e não são misturados com a obra central."/>:data.contratos?.length ? <div className="stage-list">{data.contratos.map((item: any) => <div key={item.id}><div><strong>{item.numero || item.descricao}</strong><span>{brl(item.valor_centavos)}</span></div><Status value={item.status}/></div>)}</div> : <Empty title="Sem contratos" description="Cadastre contratos e aditivos para acompanhar o contratado."/>}</Card>
      <Card><div className="card-header"><h2>Compras recentes</h2>{purchasesAvailable&&<Link to={`/compras?obra=${data.obra.id}`}><ShoppingCart size={16}/>Compras</Link>}</div>{!purchasesAvailable?<Empty title="Ainda não centralizado" description="Compras continuam na fonte local e não são misturadas com a obra central."/>:data.compras?.length ? <div className="stage-list">{data.compras.map((item: any) => <div key={item.id}><div><strong>{item.descricao}</strong><span>{brl(item.valor_centavos)}</span></div><Status value={item.status}/></div>)}</div> : <Empty title="Sem compras" description="Solicitações, pedidos e recebimentos aparecem aqui."/>}</Card>
    </div>
    <Card style={{ marginTop: 16 }}><div className="card-header"><h2>RDOs recentes</h2>{operationAvailable&&<Link to={`/rdo?obra=${data.obra.id}`}>Diário de obra</Link>}</div>{!operationAvailable?<Empty title="Operação ainda não centralizada" description="Os RDOs serão liberados quando a fonte de operação estiver ativa."/>:data.rdos?.length ? <div className="stage-list">{data.rdos.map((item: any) => <div key={item.id}><div><strong>{brDate(item.data)}</strong><span>{item.atividades}</span></div><Status value={item.status}/></div>)}</div> : <Empty title="Sem RDO registrado" description="Registre campo, equipe, equipamentos e ocorrências."/>}</Card>
  </>
}
