import { BarChart3, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Button, Card, Empty, Field, Loading } from './ui'
import { useAsync } from '../hooks/useAsync'
import { brDate, brl, today } from '../utils/format'

type Filters={data_inicio:string;data_fim:string;frente_id:string;subfrente_id:string;fornecedor_id:string}
const initialFilters=():Filters=>({data_inicio:today().slice(0,7)+'-01',data_fim:today(),frente_id:'',subfrente_id:'',fornecedor_id:''})
const money=(cents:number|null|undefined)=>cents===null||cents===undefined?'—':brl(cents)
const alertText=(state:string)=>({
  acima_do_orcamento:'Notas acima do orçamento',
  sem_previsao:'Sem orçamento cadastrado',
  dentro_do_orcamento:'Dentro da referência',
  comparacao_indisponivel:'Comparação indisponível',
  sem_previsao_especifica:'Sem orçamento específico'
} as Record<string,string>)[state]||'—'

/** Report on recorded RECEIVED invoices only, not payments, cash flow or stock consumption. */
export default function ReceivedCostsReport({obraId,revision=0}:{obraId:number|null;revision?:number}) {
  const [opened,setOpened]=useState(false)
  const [filters,setFilters]=useState<Filters>(initialFilters)
  const [offset,setOffset]=useState(0)
  const limit=25
  const update=(patch:Partial<Filters>)=>{
    setFilters(previous=>({...previous,...patch}))
    setOffset(0)
  }
  const works=useAsync(()=>opened&&obraId?window.fluxoDre.obras.list():Promise.resolve([]),[opened,obraId])
  const obra=works.data?.find((item:any)=>Number(item.id)===obraId)
  const stages=useAsync(()=>opened&&obraId?window.fluxoDre.frentes.list({obra_id:obraId}):Promise.resolve([]),[opened,obraId])
  const substages=useAsync(()=>opened&&obraId?window.fluxoDre.subfrentes.list({obra_id:obraId}):Promise.resolve([]),[opened,obraId])
  const suppliers=useAsync(()=>opened?window.fluxoDre.fornecedores.list():Promise.resolve([]),[opened])
  const report=useAsync(()=>opened&&obraId?window.fluxoDre.compras.notas.report({
    obra_id:obraId,data_inicio:filters.data_inicio||undefined,data_fim:filters.data_fim||undefined,
    frente_id:filters.frente_id?Number(filters.frente_id):null,
    subfrente_id:filters.subfrente_id?Number(filters.subfrente_id):null,
    fornecedor_id:filters.fornecedor_id?Number(filters.fornecedor_id):null,
    limit,offset
  }):Promise.resolve(null),[opened,obraId,filters.data_inicio,filters.data_fim,filters.frente_id,filters.subfrente_id,filters.fornecedor_id,offset,revision])
  const result=report.data

  return <Card style={{marginTop:14}}>
    <div className="card-header">
      <div>
        <h2>Relatório gerencial de notas e orçamento</h2>
        <span>Compare o orçamento das etapas com os valores documentados em notas recebidas.</span>
      </div>
      <Button icon={<BarChart3 size={16}/>} variant="secondary" disabled={!obraId} onClick={()=>setOpened(v=>!v)}>{opened?'Ocultar relatório':'Abrir relatório'}</Button>
    </div>
    {opened&&<div className="card-body">
      <p style={{color:'#64748b',fontSize:13,marginBottom:12}}>
        O histórico é filtrado pela <strong>data de emissão da nota</strong>. O orçamento é o total cadastrado da etapa;
        a comparação considera notas acumuladas até a data final selecionada, inclusive anteriores ao início do período.
        Notas não representam necessariamente pagamentos ou materiais consumidos.
      </p>
      <div className="form-grid">
        <Field label="De (emissão)"><input type="date" value={filters.data_inicio} max={filters.data_fim||undefined} onChange={e=>update({data_inicio:e.target.value})}/></Field>
        <Field label="Até (emissão)"><input type="date" value={filters.data_fim} min={filters.data_inicio||undefined} onChange={e=>update({data_fim:e.target.value})}/></Field>
        <Field label="Etapa"><select value={filters.frente_id} onChange={e=>update({frente_id:e.target.value,subfrente_id:''})}>
          <option value="">Todas as etapas</option>
          {stages.data?.map((item:any)=><option key={item.id} value={item.id}>{item.nome}</option>)}
        </select></Field>
        <Field label="Subetapa"><select value={filters.subfrente_id} disabled={!filters.frente_id} onChange={e=>update({subfrente_id:e.target.value})}>
          <option value="">Todas as subetapas</option>
          {substages.data?.filter((item:any)=>String(item.frente_id)===filters.frente_id).map((item:any)=><option key={item.id} value={item.id}>{item.nome}</option>)}
        </select></Field>
        <Field label="Fornecedor"><select value={filters.fornecedor_id} onChange={e=>update({fornecedor_id:e.target.value})}>
          <option value="">Todos os fornecedores</option>
          {suppliers.data?.filter((item:any)=>!item.empresa_id||Number(item.empresa_id)===Number(obra?.empresa_id)).map((item:any)=><option key={item.id} value={item.id}>{item.nome}</option>)}
        </select></Field>
        <div style={{display:'flex',alignItems:'end',paddingBottom:3}}>
          <Button variant="secondary" onClick={()=>{setFilters(initialFilters());setOffset(0)}}>Limpar filtros</Button>
        </div>
      </div>
      {report.error&&<p role="alert" style={{color:'#b42318',marginTop:12}}>Não foi possível carregar o relatório: {report.error.message}</p>}
      {report.loading?<Loading/>:result&&<div style={{marginTop:16}}>
        <div className="metrics" aria-label="Indicadores de notas e orçamento">
          <div className="metric"><span>Notas emitidas no período</span><strong>{money(result.indicadores.documentado_periodo_centavos)}</strong></div>
          <div className="metric"><span>Notas acumuladas até a data final</span><strong>{money(result.indicadores.documentado_ate_fim_centavos)}</strong></div>
          <div className="metric"><span>Orçamento total das etapas</span><strong>{money(result.indicadores.orcamento_total_centavos)}</strong></div>
        </div>
        {!result.indicadores.comparavel&&<p role="status" style={{fontSize:13,marginTop:12,color:'#64748b'}}>
          A comparação com o orçamento foi desabilitada: o filtro seleciona parte dos serviços sem previsão específica comparável,
          ou está restrito a um fornecedor. Não há rateio automático do orçamento entre subetapas.
        </p>}
        <h3 style={{marginTop:18}}>Planejado x documentado por etapa</h3>
        {result.etapas.length?<div className="table-wrap"><table className="data-table">
          <thead><tr><th>Etapa</th><th>Orçamento total</th><th>Notas acumuladas</th><th>Notas do período</th><th>Diferença</th><th>Leitura</th></tr></thead>
          <tbody>{result.etapas.map((item:any)=><tr key={String(item.frente_id??'sem-etapa')}>
            <td><strong>{item.nome}</strong></td>
            <td>{result.indicadores.comparavel?money(item.orcamento_centavos):'—'}</td>
            <td>{money(item.documentado_ate_fim_centavos)}</td>
            <td>{money(item.documentado_periodo_centavos)}</td>
            <td>{money(item.desvio_centavos)}</td>
            <td>{alertText(item.alerta)}</td>
          </tr>)}</tbody>
        </table></div>:<Empty title="Nenhuma etapa com dados" description="Cadastre itens orçamentários ou notas recebidas para obter o comparativo."/>}
        <h3 style={{marginTop:18}}>Valores documentados por subetapa</h3>
        <p style={{fontSize:12,color:'#64748b'}}>O orçamento da subetapa aparece somente quando há itens orçamentários vinculados diretamente a ela. Orçamentos antigos sem subetapa permanecem na etapa.</p>
        {result.subetapas.length?<div className="table-wrap"><table className="data-table">
          <thead><tr><th>Etapa</th><th>Subetapa</th><th>Itens</th><th>Orçado</th><th>Acumulado</th><th>No período</th><th>Diferença</th><th>Leitura</th></tr></thead>
          <tbody>{result.subetapas.map((item:any)=><tr key={String(item.frente_id??'geral')+':'+String(item.subfrente_id??'geral')}>
            <td>{item.etapa_nome}</td><td>{item.subetapa_nome}</td><td>{item.quantidade_itens}</td><td>{result.indicadores.comparavel?money(item.orcamento_centavos):'—'}</td>
            <td>{money(item.documentado_ate_fim_centavos)}</td><td>{money(item.documentado_periodo_centavos)}</td><td>{money(item.desvio_centavos)}</td><td>{alertText(item.alerta)}</td>
          </tr>)}</tbody>
        </table></div>:<Empty title="Sem itens documentados" description="Não há itens de notas recebidas com essa classificação."/>}
        <h3 style={{marginTop:18}}>Compromissos e pagamentos por destino</h3>
        <p style={{fontSize:12,color:'#64748b'}}>Comprometido é o valor das contas a pagar ativas hoje, inclusive já pagas, sem filtro de emissão. Pago usa a data da baixa no período selecionado. Os valores não são somados aos documentos; são dimensões distintas. Sem subetapa significa que não existe rateio explícito.</p>
        {Array.isArray(result.financeiro_por_destino)?result.financeiro_por_destino.length?<div className="table-wrap"><table className="data-table">
          <thead><tr><th>Etapa</th><th>Subetapa</th><th>Comprometido atual</th><th>Pago no período</th></tr></thead>
          <tbody>{result.financeiro_por_destino.map((item:any)=><tr key={String(item.frente_id??'geral')+':'+String(item.subfrente_id??'geral')}>
            <td>{item.etapa_nome}</td><td>{item.subetapa_nome}</td><td>{money(item.comprometido_atual_centavos)}</td><td>{money(item.pago_periodo_centavos)}</td>
          </tr>)}</tbody>
        </table></div>:<Empty title="Sem contas classificadas" description="Nenhuma obrigação financeira ativa neste destino."/>:<p>Indicadores financeiros indisponíveis nesta versão do servidor.</p>}
        <h3 style={{marginTop:18}}>Consumo físico registrado no RDO</h3>
        <p style={{fontSize:12,color:'#64748b'}}>Quantidades atuais dos RDOs datados no período, por material e unidade. Não representam custo monetário nem todas as saídas de estoque.</p>
        {Array.isArray(result.consumo_rdo)?result.consumo_rdo.length?<><div className="table-wrap"><table className="data-table">
          <thead><tr><th>Etapa</th><th>Material</th><th>Quantidade</th><th>Unidade</th></tr></thead>
          <tbody>{result.consumo_rdo.map((item:any,index:number)=><tr key={String(item.frente_id??'geral')+':'+String(item.material_id??'')+':'+index}><td>{item.etapa_nome}</td><td>{item.descricao}</td><td>{Number(item.quantidade).toLocaleString('pt-BR',{maximumFractionDigits:6})}</td><td>{item.unidade}</td></tr>)}</tbody>
        </table></div>{result.consumo_rdo_total>100&&<p>Mostrando os primeiros 100 de {result.consumo_rdo_total} grupos. Refine a etapa ou o período para consultar os demais.</p>}</>:<Empty title="Sem consumo de RDO" description="Não há consumo registrado neste período."/>:<p>Consumo indisponível com filtro de fornecedor ou subetapa, ou nesta versão do servidor.</p>}
        <h3 style={{marginTop:18}}>Histórico dos itens de notas recebidas</h3>
        <p style={{fontSize:12,color:'#64748b'}}>{result.historico_total} item(ns) no período e filtros selecionados. Uma nota com vários itens aparece em várias linhas.</p>
        {result.historico.length?<div className="table-wrap"><table className="data-table">
          <thead><tr><th>Emissão</th><th>Nota / fornecedor</th><th>Descrição</th><th>Etapa / subetapa</th><th>Quantidade</th><th>Total</th></tr></thead>
          <tbody>{result.historico.map((item:any)=><tr key={item.item_id}>
            <td>{brDate(item.emissao)}</td>
            <td><strong>{item.numero}</strong><small>{item.fornecedor_nome}</small></td>
            <td>{item.descricao}</td>
            <td>{item.etapa_nome} / {item.subetapa_nome}</td>
            <td>{item.quantidade} {item.unidade}</td>
            <td>{money(item.valor_total_centavos)}</td>
          </tr>)}</tbody>
        </table></div>:<Empty title="Sem lançamentos neste período" description="Altere o período ou os filtros para consultar outros registros."/>}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap',marginTop:12}}>
          <span style={{fontSize:13,color:'#64748b'}}>Exibindo {result.historico_total?offset+1:0}–{Math.min(offset+limit,result.historico_total)} de {result.historico_total}</span>
          <div style={{display:'flex',gap:8}}>
            <Button variant="secondary" disabled={offset===0} icon={<ChevronLeft size={15}/>} onClick={()=>setOffset(v=>Math.max(0,v-limit))}>Anterior</Button>
            <Button variant="secondary" disabled={!result.paginacao.has_more} onClick={()=>setOffset(v=>v+limit)}>Próxima <ChevronRight size={15}/></Button>
          </div>
        </div>
      </div>}
    </div>}
  </Card>
}
