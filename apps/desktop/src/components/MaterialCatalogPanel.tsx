import { useState, useEffect, useRef } from 'react'
import { Button, Card, Field, Loading, Empty, Modal, FormActions } from './ui'
import { useStockRevision } from '../hooks/useStockRevision'
import { useAsync } from '../hooks/useAsync'
const attrs=[['categoria','Categoria'],['material','Composição'],['aplicacao','Aplicação'],['marca','Marca'],['referencia','Referência'],['diametro','Diâmetro'],['comprimento','Comprimento'],['dimensoes','Dimensões'],['especificacao','Especificação']] as const
const aliasBlank={fornecedor_id:'',codigo:'',unidade_comercial:'',descricao_origem:'',gtin:'',fator_num:'1',fator_den:'1'}
export default function MaterialCatalogPanel({companyId}:{companyId:string}){
 const [query,setQuery]=useState(''),[search,setSearch]=useState(''),[page,setPage]=useState(0),[rev,setRev]=useState(0)
 const [draft,setDraft]=useState<any>(null),[selected,setSelected]=useState<any>(null),[alias,setAlias]=useState<any>(null),[aliasPage,setAliasPage]=useState(0),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 const lock=useRef(false)
 const {version,unavailable}=useStockRevision(companyId)
 useEffect(()=>{const id=setTimeout(()=>{setSearch(query.trim());setPage(0)},250);return()=>clearTimeout(id)},[query])
 const result=useAsync(()=>window.fluxoDre.compras.catalogPage({empresa_id:Number(companyId),q:search,offset:page*50,limit:50}),[companyId,search,page,rev,version])
 const aliases=useAsync(async()=>({materialId:selected?.id??null,page:aliasPage,data:selected?await window.fluxoDre.compras.catalogAliases({empresa_id:Number(companyId),material_id:selected.id,offset:aliasPage*50}):{rows:[],total:0}}),[companyId,selected?.id,aliasPage,rev,version])
 const aliasData=aliases.data?.materialId===selected?.id&&aliases.data?.page===aliasPage?aliases.data.data:null
 const suppliers=useAsync(()=>alias?window.fluxoDre.fornecedores.list({empresa_id:Number(companyId)}):Promise.resolve([]),[companyId,!!alias])
 const run=async(fn:()=>Promise<any>,after:()=>void)=>{if(lock.current)return;lock.current=true;setBusy(true);setMessage('');try{await fn();after();setRev(v=>v+1)}catch(e){setMessage(e instanceof Error?e.message:'Não foi possível salvar.')}finally{lock.current=false;setBusy(false)}}
 const edit=(row:any)=>{let attributes={};try{attributes=JSON.parse(row.atributos_json||'{}')}catch{}setMessage('');setDraft({...row,atributos:attributes})}
 return <Card>
 <div className="card-header"><div><h2>Catálogo de materiais</h2><p>Identidades por empresa, atributos e equivalências confirmadas. O saldo permanece no estoque da obra.</p></div><Button onClick={()=>edit({descricao:'',unidade:''})}>Novo material</Button></div>
 <div className="card-body row-actions"><input aria-label="Pesquisar catálogo" placeholder="Material, unidade ou código" value={query} onChange={e=>setQuery(e.target.value)}/><Button variant="secondary" onClick={()=>void result.reload()}>Atualizar</Button></div>
 {unavailable&&<p role="status" className="card-body">Não foi possível confirmar se o catálogo está atualizado.</p>}
 {message&&!draft&&!alias&&<p className="card-body" role="alert">{message}</p>}
 {result.loading?<Loading/>:result.error?<p className="card-body" role="alert">{result.error.message}</p>:result.data?.rows.length?<div className="table-wrap"><table className="data-table"><thead><tr><th>Material</th><th>Unidade</th><th>Classificação</th><th>Equivalências</th><th/></tr></thead><tbody>{result.data.rows.map(row=><tr key={row.id}><td>{row.descricao}</td><td>{row.unidade}</td><td>{row.origem==='confirmado'?'Confirmado':'Legado — revisar'}</td><td>{row.equivalencias}</td><td><div className="row-actions"><Button variant="secondary" onClick={()=>edit(row)}>Atributos</Button><Button variant="secondary" onClick={()=>{setSelected(row);setAliasPage(0);setMessage('')}}>Equivalências</Button></div></td></tr>)}</tbody></table></div>:<Empty title="Nenhum material encontrado" description="Cadastre um material ou importe uma planilha de estoque."/>}
 {result.data&&<div className="card-body row-actions"><span>{result.data.total} materiais</span><Button variant="secondary" disabled={!page||result.loading} onClick={()=>setPage(p=>p-1)}>Anterior</Button><Button variant="secondary" disabled={result.loading||(page+1)*50>=result.data.total} onClick={()=>setPage(p=>p+1)}>Próxima</Button></div>}
 {selected&&<div className="card-body"><div className="row-actions"><strong>{selected.descricao} — {selected.unidade}</strong><Button onClick={()=>{setMessage('');setAlias({...aliasBlank})}}>Confirmar equivalência</Button><Button variant="ghost" onClick={()=>setSelected(null)}>Fechar</Button></div>
 {aliases.loading?<Loading/>:aliases.error?<p role="alert">{aliases.error.message}</p>:aliasData?.rows.length?<div className="table-wrap"><table className="data-table"><thead><tr><th>Fornecedor</th><th>Código</th><th>Descrição original</th><th>Unidade comercial</th><th>Conversão</th></tr></thead><tbody>{aliasData.rows.map(row=><tr key={row.id}><td>{row.fornecedor_nome}</td><td>{row.codigo}</td><td>{row.descricao_origem}</td><td>{row.unidade_comercial}</td><td>{row.fator_num}/{row.fator_den} {selected.unidade}</td></tr>)}</tbody></table></div>:<p>Nenhuma equivalência confirmada.</p>}
 {aliasData&&<div className="row-actions"><Button variant="secondary" disabled={!aliasPage||aliases.loading} onClick={()=>setAliasPage(p=>p-1)}>Anterior</Button><Button variant="secondary" disabled={aliases.loading||(aliasPage+1)*50>=aliasData.total} onClick={()=>setAliasPage(p=>p+1)}>Próxima</Button></div>}</div>}
 <Modal open={!!draft} title={draft?.id?'Revisar atributos':'Novo material'} onClose={()=>{if(!busy)setDraft(null)}}><form onSubmit={e=>{e.preventDefault();void run(()=>window.fluxoDre.compras.catalogSave({...draft,empresa_id:Number(companyId)}),()=>setDraft(null))}}><div className="modal-body form-grid">
 {message&&<p role="alert">{message}</p>}
 <Field label="Descrição" required><input required maxLength={250} readOnly={!!draft?.id} value={draft?.descricao||''} onChange={e=>setDraft((d:any)=>({...d,descricao:e.target.value}))}/></Field>
 <Field label="Unidade canônica" required><input required maxLength={24} readOnly={!!draft?.id} value={draft?.unidade||''} onChange={e=>setDraft((d:any)=>({...d,unidade:e.target.value}))}/></Field>
 {attrs.map(([key,label])=><Field key={key} label={label}><input maxLength={200} value={draft?.atributos?.[key]||''} onChange={e=>setDraft((d:any)=>({...d,atributos:{...d.atributos,[key]:e.target.value}}))}/></Field>)}
 </div><FormActions loading={busy} onCancel={()=>{if(!busy)setDraft(null)}}/></form></Modal>
 <Modal open={!!alias} title="Confirmar produto do fornecedor" onClose={()=>{if(!busy)setAlias(null)}}><form onSubmit={e=>{e.preventDefault();void run(()=>window.fluxoDre.compras.catalogConfirm({...alias,empresa_id:Number(companyId),material_id:selected.id}),()=>setAlias(null))}}><div className="modal-body form-grid">
 <p>Confirme que o produto corresponde exatamente a {selected?.descricao}. A quantidade comercial será convertida para {selected?.unidade} pelo fator informado.</p>
 {message&&<p role="alert">{message}</p>}
 <Field label="Fornecedor" required><select required disabled={suppliers.loading||!!suppliers.error} value={alias?.fornecedor_id||''} onChange={e=>setAlias((a:any)=>({...a,fornecedor_id:e.target.value}))}><option value="">Selecione</option>{suppliers.data?.map((s:any)=><option key={s.id} value={s.id}>{s.nome} — {s.documento||'sem documento'}</option>)}</select></Field>
 {([['codigo','Código do fornecedor'],['descricao_origem','Descrição original'],['unidade_comercial','Unidade comercial'],['gtin','GTIN (opcional)']] as const).map(([key,label])=><Field key={key} label={label}><input required={key!=='gtin'} value={alias?.[key]||''} onChange={e=>setAlias((a:any)=>({...a,[key]:e.target.value}))}/></Field>)}
 <Field label="Quantidade canônica (numerador)" required><input required type="number" min={1} max={1000000000} step={1} value={alias?.fator_num||''} onChange={e=>setAlias((a:any)=>({...a,fator_num:e.target.value}))}/></Field>
 <Field label="Quantidade comercial (denominador)" required><input required type="number" min={1} max={1000000000} step={1} value={alias?.fator_den||''} onChange={e=>setAlias((a:any)=>({...a,fator_den:e.target.value}))}/></Field>
 <p>Exemplo: 1 caixa com 10 peças → numerador 10, denominador 1. Não estime fatores.</p>
 </div><FormActions loading={busy} submitLabel="Confirmar vínculo" onCancel={()=>{if(!busy)setAlias(null)}}/></form></Modal>
 </Card>
}
