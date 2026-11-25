import {useRef,useState} from 'react'
import {Button,Field,Modal,Loading} from './ui'
import {useAsync} from '../hooks/useAsync'
import {today} from '../utils/format'
export default function NfeIntegratedDetails({scope,onClose,onChanged}:{scope:{empresa_id:number;nota_id:number};onClose:()=>void;onChanged:()=>void}){
 const details=useAsync(()=>window.fluxoDre.compras.nfeDetails(scope),[scope.empresa_id,scope.nota_id])
 const [item,setItem]=useState(''),[qty,setQty]=useState(''),[date,setDate]=useState(today()),[reason,setReason]=useState(''),[confirm,setConfirm]=useState(false),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 const lock=useRef(false),request=useRef<{key:string;id:string}|null>(null)
 const run=async(kind:'receive'|'reverse')=>{
 if(lock.current||!confirm)return
 const key=JSON.stringify([kind,item,qty,date,reason]);if(request.current?.key!==key)request.current={key,id:crypto.randomUUID()}
 lock.current=true;setBusy(true);setMessage('')
 try{
 if(kind==='receive')await window.fluxoDre.compras.nfeReceive({...scope,nota_item_id:Number(item),quantidade:qty.replace(',','.'),data:date,request_id:request.current.id})
 else await window.fluxoDre.compras.nfeReverse({...scope,motivo:reason,data:date,request_id:request.current.id})
 request.current=null;setConfirm(false);setQty('');setMessage('Operação confirmada.');onChanged();if(kind==='reverse')onClose();else await details.reload()
 }catch(e){setMessage(e instanceof Error?e.message:'Operação não concluída.')}
 finally{lock.current=false;setBusy(false)}
 }
 return <Modal open title="NF-e integrada — recebimentos e estorno" onClose={()=>!busy&&onClose()} size="lg"><div className="modal-body">
 {details.loading?<Loading/>:details.error?<p role="alert">{details.error.message}</p>:details.data&&<>
 <p>Nota {details.data.numero}. Quantidades abaixo em unidade original da nota.</p>
 <div className="table-wrap"><table className="data-table"><thead><tr><th>Material</th><th>Obra</th><th>Destinado</th><th>Recebido</th></tr></thead><tbody>{details.data.itens.map(i=><tr key={i.id}><td>{i.descricao}</td><td>{i.obra_nome}</td><td>{i.quantidade_decimal} {i.unidade}</td><td>{i.recebida} {i.unidade}</td></tr>)}</tbody></table></div>
 <div className="form-grid"><Field label="Destino"><select value={item} onChange={e=>{setItem(e.target.value);setConfirm(false)}}><option value="">Selecione</option>{details.data.itens.filter(i=>Number(i.recebida)<Number(i.quantidade_decimal)).map(i=><option key={i.id} value={i.id}>{i.descricao} — {i.obra_nome}</option>)}</select></Field><Field label="Quantidade adicional (unidade fiscal)"><input inputMode="decimal" value={qty} onChange={e=>{setQty(e.target.value);setConfirm(false)}}/></Field><Field label="Data"><input type="date" value={date} onChange={e=>{setDate(e.target.value);setConfirm(false)}}/></Field><Field label="Motivo do estorno"><input value={reason} onChange={e=>{setReason(e.target.value);setConfirm(false)}}/></Field></div>
 <p>Estorno preserva XML e trilha; não desfaz pagamentos ou compromissos preexistentes sem conciliação.</p>
 <label><input type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)}/> Confirmo a operação selecionada.</label>
 <div className="row-actions"><Button disabled={busy||!confirm||!item||!qty} onClick={()=>void run('receive')}>Registrar recebimento</Button><Button variant="secondary" disabled={busy||!confirm||!reason.trim()} onClick={()=>void run('reverse')}>Estornar integração</Button></div>
 </>}{message&&<p role="alert">{message}</p>}</div></Modal>
}
