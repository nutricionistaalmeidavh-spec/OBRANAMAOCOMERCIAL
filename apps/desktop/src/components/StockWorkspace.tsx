import { useEffect, useState, useRef, memo } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, Empty, Field, FormActions, Loading, Modal } from './ui'
import { useAsync } from '../hooks/useAsync'
import { today, brDate, brl } from '../utils/format'
type Scope={companyId?:string;workId?:string;revision?:number}
type Draft={material_id?:number;obra_id:number;frente_id:number|null;descricao:string;unidade:string;tipo:string;quantidade:string;data:string}
function StockWorkspace({companyId='',workId='',revision=0}:Scope){
  const [mode,setMode]=useState<'saldo'|'historico'>('saldo')
  const [search,setSearch]=useState('')
  const [query,setQuery]=useState('')
  const [page,setPage]=useState(0)
  const [stage,setStage]=useState('')
  const [draft,setDraft]=useState<Draft|null>(null)
  const [error,setError]=useState('')
  const [exportMessage,setExportMessage]=useState('')
  const [exporting,setExporting]=useState(false)
  const [saving,setSaving]=useState(false)
  const savingRef=useRef(false)
  const [version,setVersion]=useState(0)
  const scope=companyId+':'+workId
  const [priorScope,setPriorScope]=useState(scope)
  if(priorScope!==scope){setPriorScope(scope);setPage(0);setStage('');setDraft(null);setError('')}
  useEffect(()=>{const timer=setTimeout(()=>{setQuery(search.trim());setPage(0)},250);return()=>clearTimeout(timer)},[search])
  const stages=useAsync(()=>workId?window.fluxoDre.frentes.list({obra_id:Number(workId)}):Promise.resolve([]),[workId])
  const storage=useAsync(()=>window.fluxoDre.storage.moduleState('finance'),[])
  const result=useAsync(async()=>{
    const data=await window.fluxoDre.compras.stockPage({...(companyId?{empresa_id:Number(companyId)}:{}),...(workId?{obra_id:Number(workId)}:{}),...(stage?{frente_id:Number(stage)}:{}),q:query,history:mode==='historico',limit:50,offset:page*50})
    return {scope,mode,page,query,stage,data}
  },[scope,stage,query,mode,page,revision,version])
  const current=result.data?.scope===scope&&result.data?.mode===mode&&result.data?.page===page&&result.data?.query===query&&result.data?.stage===stage?result.data.data:null
  const open=(row:any)=>{setError('');setDraft({...(row.material_id?{material_id:Number(row.material_id)}:{}),obra_id:Number(row.obra_id),frente_id:row.frente_id?Number(row.frente_id):null,descricao:String(row.descricao),unidade:String(row.unidade),tipo:'saida',quantidade:'1',data:today()})}
  const save=async(e:React.FormEvent)=>{e.preventDefault();if(!draft||savingRef.current)return;savingRef.current=true;setSaving(true);setError('')
    try{await window.fluxoDre.compras.moveStock({...draft,quantidade:Number(draft.quantidade)});setDraft(null);setVersion(v=>v+1)}
    catch(e){setError(e instanceof Error?e.message:'Não foi possível movimentar o estoque.')}
    finally{savingRef.current=false;setSaving(false)}
  }
  const canImport=storage.data?.state==='local'
  const template=async()=>{try{const saved=await window.fluxoDre.importadorUniversal.template('estoque');if(saved?.path)setExportMessage('Modelo salvo.')}catch(e){setExportMessage(e instanceof Error?e.message:'Falha ao gerar modelo.')}}
  const exportPage=async(format:'xlsx'|'csv')=>{if(!current||exporting)return;setExporting(true);setExportMessage('');try{const out=await window.fluxoDre.compras.stockExport({format,filters:{...(companyId?{empresa_id:Number(companyId)}:{}),...(workId?{obra_id:Number(workId)}:{}),...(stage?{frente_id:Number(stage)}:{}),q:query,history:mode==='historico'}});if(out?.path)setExportMessage('Exportação concluída: '+(out.rows??'')+' registros.')}catch(e){setExportMessage(e instanceof Error?e.message:'Não foi possível exportar.')}finally{setExporting(false)}}
  return <Card>
    <div className="card-header"><div><h2>Materiais e movimentações</h2><p>Saldo físico por obra. Etapas classificam entradas e saídas, sem criar estoques separados.</p></div><div className="row-actions">
      {canImport&&<Link className="button button-secondary" to={'/importacao?'+new URLSearchParams({area:'estoque',...(companyId?{empresa:companyId}:{})})}>Importar planilha</Link>}
      {canImport&&<Button variant="secondary" onClick={()=>void template()}>Modelo</Button>}
      <Button variant="secondary" disabled={!current?.rows.length||exporting||result.loading} onClick={()=>void exportPage('xlsx')}>Excel</Button>
      <Button variant="secondary" disabled={!current?.rows.length||exporting||result.loading} onClick={()=>void exportPage('csv')}>CSV</Button>
      {workId&&<Button disabled={saving||stages.loading||!!stages.error} onClick={()=>open({obra_id:workId,descricao:'',unidade:'un'})}>Movimentar estoque</Button>}
    </div></div>
    <div className="card-body"><div className="row-actions">
      <Button variant={mode==='saldo'?'primary':'secondary'} onClick={()=>{setMode('saldo');setPage(0)}}>Saldos</Button>
      <Button variant={mode==='historico'?'primary':'secondary'} onClick={()=>{setMode('historico');setPage(0)}}>Histórico</Button>
      <input aria-label="Pesquisar material" placeholder="Material, unidade, obra ou etapa" value={search} onChange={e=>setSearch(e.target.value)}/>
      {search&&<Button variant="secondary" onClick={()=>{setSearch('');setQuery('');setPage(0)}}>Limpar</Button>}
      {workId&&<Field label="Etapa"><select disabled={stages.loading||!!stages.error} value={stage} onChange={e=>{setStage(e.target.value);setPage(0)}}><option value="">Todas</option>{stages.data?.map((s:any)=><option key={s.id} value={s.id}>{s.nome}</option>)}</select></Field>}
      <Button variant="secondary" onClick={()=>void result.reload()}>Atualizar</Button>
    </div></div>
    {exportMessage&&<p role="status" className="card-body">{exportMessage}</p>}
    {result.loading||!current&&!result.error?<Loading label="Consultando estoque..."/>:result.error?<div className="card-body" role="alert">Não foi possível consultar o estoque. <Button onClick={()=>void result.reload()}>Tentar novamente</Button></div>:current?.rows.length?<div className="table-wrap"><table className="data-table"><thead><tr><th>Empresa</th><th>Obra</th><th>Etapa</th><th>Material</th><th>Unidade</th>{mode==='saldo'?<><th>Entradas</th><th>Saídas</th>{stage&&<th>Líquido da etapa</th>}<th>Saldo da obra</th><th>Custo médio estimado</th><th>Saldo valorizado estimado</th><th/></>:<><th>Tipo</th><th>Quantidade</th><th>Data</th></>}</tr></thead><tbody>{current.rows.map(r=><tr key={r.id}><td>{r.empresa_nome}</td><td>{r.obra_nome}</td><td>{r.etapa_nome}</td><td>{r.descricao}</td><td>{r.unidade}</td>{mode==='saldo'?<><td>{r.entradas}</td><td>{r.saidas}</td>{stage&&<td>{r.liquido_etapa}</td>}<td>{r.saldo}</td><td>{r.custo_medio_centavos===null?'—':brl(r.custo_medio_centavos)}</td><td>{r.saldo_estimado_centavos===null?'—':brl(r.saldo_estimado_centavos)}</td><td>{workId?<Button variant="secondary" onClick={()=>open(r)}>Movimentar</Button>:<Link to={'/estoque?'+new URLSearchParams({empresa:String(r.empresa_id),obra:String(r.obra_id)})}>Abrir obra</Link>}</td></>:<><td>{r.tipo}</td><td>{r.quantidade}</td><td>{brDate(r.data)}</td></>}</tr>)}</tbody></table></div>:<Empty title="Nenhum material nesta seleção" description="Altere os filtros ou importe os materiais."/>}
    {current&&<div className="card-body row-actions"><span>{current.total} registros</span><Button variant="secondary" disabled={!page||result.loading} onClick={()=>setPage(p=>Math.max(0,p-1))}>Anterior</Button><Button variant="secondary" disabled={result.loading||(page+1)*50>=current.total} onClick={()=>setPage(p=>p+1)}>Próxima</Button></div>}
    <Modal open={!!draft} title="Movimentar estoque" onClose={()=>{if(!saving)setDraft(null)}}><form onSubmit={save}><div className="modal-body form-grid">
    {error&&<div role="alert" className="notice">{error}</div>}
    <Field label="Material"><input readOnly={!!draft?.material_id} required value={draft?.descricao||''} onChange={e=>setDraft(d=>d?{...d,descricao:e.target.value}:d)}/></Field>
    <Field label="Unidade"><input readOnly={!!draft?.material_id} required value={draft?.unidade||''} onChange={e=>setDraft(d=>d?{...d,unidade:e.target.value}:d)}/></Field>
    <Field label="Tipo"><select value={draft?.tipo||'saida'} onChange={e=>setDraft(d=>d?{...d,tipo:e.target.value}:d)}><option value="entrada">Entrada</option><option value="saida">Saída</option><option value="ajuste">Ajuste positivo</option></select></Field>
    <Field label="Quantidade"><input required type="number" min="0.000001" step="any" value={draft?.quantidade||''} onChange={e=>setDraft(d=>d?{...d,quantidade:e.target.value}:d)}/></Field>
    <Field label="Data"><input required type="date" value={draft?.data||''} onChange={e=>setDraft(d=>d?{...d,data:e.target.value}:d)}/></Field>
    {workId&&<Field label="Etapa"><select value={draft?.frente_id||''} onChange={e=>setDraft(d=>d?{...d,frente_id:Number(e.target.value)||null}:d)}><option value="">Obra geral</option>{stages.data?.map((s:any)=><option key={s.id} value={s.id}>{s.nome}</option>)}</select></Field>}
    </div><FormActions loading={saving} submitLabel="Registrar movimentação" onCancel={()=>{if(!saving)setDraft(null)}}/></form></Modal>
  </Card>
}

export default memo(StockWorkspace)
