import { useRef,useState } from 'react'
import { Button,Card,Field } from './ui'
import type { IntegrationPreview,ManualNoteSource } from '../utils/nfe-preview'
type Recognition=Awaited<ReturnType<typeof window.fluxoDre.compras.nfeRecognize>>
type Destination={key:number;nfe_item_numero:string;obra_id:string;frente_id:string;subfrente_id:string;quantidade:string;quantidade_recebida:string;valor_alocado:string;pedido_item_id:string;recebimento_existente_id:string}
type Part={valor:string;vencimento:string;conta_id:string}
const amount=(value:string)=>/^\d+(?:\.\d{1,2})?$/.test(value)?Math.round(Number(value)*100):NaN
const num=(s:string)=>s?Number(s):null
export default function NfeCommitPanel({obraId,preview,recognition,source,manual,initialScopes,onBusyChange,onImported}:{obraId:number;preview:IntegrationPreview;recognition:Recognition;source?:string;manual?:ManualNoteSource;initialScopes?:Array<{frente_id:string;subfrente_id:string}>;onBusyChange?:(busy:boolean)=>void;onImported:(result?:{nota_id:number})=>void|Promise<void>}){
 const [open,setOpen]=useState(!!manual),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[confirmed,setConfirmed]=useState(false),[date,setDate]=useState(''),[category,setCategory]=useState(''),[page,setPage]=useState(0)
 const lock=useRef(false),next=useRef(preview.itens.length+1)
 const [destinations,setDestinations]=useState<Destination[]>(()=>preview.itens.map((i,k)=>({key:k+1,nfe_item_numero:i.numero,obra_id:String(obraId),frente_id:initialScopes?.[k]?.frente_id||'',subfrente_id:initialScopes?.[k]?.subfrente_id||'',quantidade:i.quantidade,quantidade_recebida:'0',valor_alocado:i.valor_produto,pedido_item_id:'',recebimento_existente_id:''})))
 const [parts,setParts]=useState<Part[]>(()=>preview.parcelas.length?preview.parcelas.map(p=>({valor:p.valor,vencimento:p.vencimento,conta_id:''})):[{valor:preview.total,vencimento:'',conta_id:''}])
 const options=recognition.opcoes
 const patch=(key:number,change:Partial<Destination>)=>{setConfirmed(false);setDestinations(rows=>rows.map(r=>r.key===key?{...r,...change}:r))}
 const partPatch=(index:number,change:Partial<Part>)=>{setConfirmed(false);setParts(rows=>rows.map((r,i)=>i===index?{...r,...change}:r))}
 const total=amount(preview.total),allocated=destinations.reduce((sum,d)=>sum+amount(d.valor_alocado),0),scheduled=parts.reduce((sum,p)=>sum+amount(p.valor),0)
 const submit=async()=>{
  if(lock.current||!confirmed||!category||allocated!==total||scheduled!==total)return
  lock.current=true;setBusy(true);onBusyChange?.(true);setMessage('')
  try{
   const result=await window.fluxoDre.compras.nfeCommit({...(manual?{manual}:{xml_base64:source}),empresa_id:recognition.empresa_id,fornecedor_id:recognition.fornecedor_id,categoria_id:Number(category),data_recebimento:date,destinos:destinations.map(({key,...d})=>({...d,obra_id:Number(d.obra_id),frente_id:num(d.frente_id),subfrente_id:num(d.subfrente_id),pedido_item_id:num(d.pedido_item_id),recebimento_existente_id:num(d.recebimento_existente_id)})),parcelas:parts.map(p=>({...p,conta_id:num(p.conta_id)}))})
   setMessage('Nota #'+result.nota_id+' integrada. Estoque e financeiro atualizados conforme a conferência.');await onImported(result)
  }catch(e){setMessage(e instanceof Error?e.message:'Não foi possível confirmar a importação.')}
  finally{lock.current=false;setBusy(false);onBusyChange?.(false)}
 }
 if(!open)return <Button onClick={()=>setOpen(true)}>Preparar importação integrada</Button>
 return <Card><div className="card-header"><div><h3>Destinos e financeiro</h3><p>Quantidades em unidade fiscal. O estoque recebe a conversão confirmada. Nenhuma entrada é presumida.</p></div></div>
 <div className="card-body">
 <div className="form-grid"><Field label="Categoria financeira" required><select value={category} onChange={e=>{setCategory(e.target.value);setConfirmed(false)}}><option value="">Selecione</option>{options.categorias.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select></Field><Field label="Data de recebimento físico"><input type="date" value={date} onChange={e=>{setDate(e.target.value);setConfirmed(false)}}/></Field></div>
 <p>Rateio: R$ {(allocated/100).toFixed(2)} de R$ {preview.total}. Distribua frete, descontos e outros componentes no custo dos destinos antes de confirmar.</p>
 {destinations.slice(page*15,page*15+15).map(d=>{
 const sourceItem=preview.itens.find(i=>i.numero===d.nfe_item_numero)!
 const material=recognition.itens.find(i=>i.numero===d.nfe_item_numero)!
 const orders=options.pedidos.filter(p=>p.material_id===material.material_id&&String(p.obra_id)===d.obra_id&&String(p.frente_id||'')===d.frente_id)
 return <section key={d.key} style={{border:'1px solid var(--border)',borderRadius:8,padding:12,marginBottom:8}}>
 <strong>Item {d.nfe_item_numero} — {sourceItem.descricao} ({sourceItem.quantidade} {sourceItem.unidade})</strong>
 <p>{material.servico?'Serviço — sem movimentação física':<>Material: {material.descricao} · 1 {sourceItem.unidade} = {material.fator_num}/{material.fator_den} {material.unidade}</>}</p>
 <div className="form-grid">
 <Field label="Obra"><select value={d.obra_id} onChange={e=>patch(d.key,{obra_id:e.target.value,frente_id:'',subfrente_id:'',pedido_item_id:'',recebimento_existente_id:''})}>{options.obras.map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}</select></Field>
 <Field label="Etapa"><select value={d.frente_id} onChange={e=>patch(d.key,{frente_id:e.target.value,subfrente_id:'',pedido_item_id:'',recebimento_existente_id:''})}><option value="">Obra geral</option>{options.etapas.filter(o=>String(o.obra_id)===d.obra_id).map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}</select></Field>
 <Field label="Subetapa"><select value={d.subfrente_id} onChange={e=>patch(d.key,{subfrente_id:e.target.value})}><option value="">Sem subetapa</option>{options.subetapas.filter(o=>String(o.obra_id)===d.obra_id&&String(o.frente_id)===d.frente_id).map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}</select></Field>
 <Field label={'Quantidade destinada ('+sourceItem.unidade+')'}><input inputMode="decimal" value={d.quantidade} onChange={e=>patch(d.key,{quantidade:e.target.value.replace(',','.')})}/></Field>
 <Field label={'Quantidade recebida ('+sourceItem.unidade+')'}><input disabled={!!material.servico} inputMode="decimal" value={d.quantidade_recebida} onChange={e=>patch(d.key,{quantidade_recebida:e.target.value.replace(',','.')})}/></Field>
 <Field label="Custo apropriado (R$)"><input inputMode="decimal" value={d.valor_alocado} onChange={e=>patch(d.key,{valor_alocado:e.target.value.replace(',','.')})}/></Field>
 <Field label="Item de pedido"><select disabled={!!material.servico} value={d.pedido_item_id} onChange={e=>patch(d.key,{pedido_item_id:e.target.value,recebimento_existente_id:''})}><option value="">Sem pedido</option>{orders.map(o=><option key={o.id} value={o.id}>{o.numero||'#'+o.pedido_id} — {o.descricao} ({o.quantidade_recebida}/{o.quantidade_pedida} {o.unidade})</option>)}</select></Field>
 {!!d.pedido_item_id&&<Field label="Conciliar recebimento anterior"><select value={d.recebimento_existente_id} onChange={e=>patch(d.key,{recebimento_existente_id:e.target.value})}><option value="">Novo recebimento / sem entrada</option>{options.recebimentos.filter(r=>String(r.pedido_item_id)===d.pedido_item_id).map(r=><option key={r.id} value={r.id}>#{r.id} — {r.data} — {r.quantidade_recebida} {material.unidade}</option>)}</select></Field>}
 </div><div className="row-actions"><Button variant="secondary" disabled={busy} onClick={()=>{setConfirmed(false);setDestinations(rows=>[...rows,{...d,key:next.current++,quantidade:'',quantidade_recebida:'0',valor_alocado:'',pedido_item_id:'',recebimento_existente_id:''}]);setPage(Math.floor(destinations.length/15))}}>Dividir destino</Button>{destinations.filter(r=>r.nfe_item_numero===d.nfe_item_numero).length>1&&<Button variant="secondary" onClick={()=>{setConfirmed(false);setDestinations(rows=>rows.filter(r=>r.key!==d.key));setPage(0)}}>Remover divisão</Button>}</div>
 </section>})}
 <div className="row-actions"><Button variant="secondary" disabled={!page} onClick={()=>setPage(p=>p-1)}>Anterior</Button><span>{page+1}/{Math.ceil(destinations.length/15)}</span><Button variant="secondary" disabled={(page+1)*15>=destinations.length} onClick={()=>setPage(p=>p+1)}>Próxima</Button></div>
 <h3>Contas a pagar</h3><p>Parcelas: R$ {(scheduled/100).toFixed(2)} de R$ {preview.total}. Concilie contas existentes em vez de duplicá-las.</p>
 {parts.map((p,i)=><div className="form-grid" key={i}><Field label={'Parcela '+(i+1)+' (R$)'}><input inputMode="decimal" readOnly={!!preview.parcelas.length} value={p.valor} onChange={e=>partPatch(i,{valor:e.target.value.replace(',','.'),conta_id:''})}/></Field><Field label="Vencimento"><input type="date" readOnly={!!preview.parcelas[i]?.vencimento} value={p.vencimento} onChange={e=>partPatch(i,{vencimento:e.target.value,conta_id:''})}/></Field><Field label="Conciliar conta"><select value={p.conta_id} onChange={e=>partPatch(i,{conta_id:e.target.value})}><option value="">Criar conta</option>{options.contas.filter(c=>c.valor_centavos===amount(p.valor)&&c.vencimento===p.vencimento).map(c=><option key={c.id} value={c.id}>#{c.id} — {c.descricao}</option>)}</select></Field>{!preview.parcelas.length&&parts.length>1&&<Button variant="secondary" onClick={()=>{setConfirmed(false);setParts(rows=>rows.filter((_,j)=>j!==i))}}>Remover parcela</Button>}</div>)}
 {!preview.parcelas.length&&<Button variant="secondary" onClick={()=>{setConfirmed(false);setParts(rows=>[...rows,{valor:'',vencimento:'',conta_id:''}])}}>Adicionar parcela</Button>}
 <p><label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> Conferi destinos, recebimentos, custos e parcelas. Confirmo a criação ou conciliação dos registros canônicos.</label></p>
 {message&&<p role="alert">{message}</p>}
 <div className="row-actions"><Button disabled={busy||!confirmed||!category||allocated!==total||scheduled!==total||parts.some(p=>!p.vencimento)} onClick={()=>void submit()}>{busy?'Integrando...':'Confirmar importação'}</Button>{!manual&&<Button variant="secondary" disabled={busy} onClick={()=>setOpen(false)}>Voltar</Button>}</div>
 </div></Card>
}
