import {useEffect,useState,useRef} from 'react'
import {Button,Field,Modal,FormActions,Loading} from './ui'
import {useAsync} from '../hooks/useAsync'
type Material={id:number;descricao:string;unidade:string}
export default function MaterialReclassificationDialog({companyId,origin,onClose,onSaved}:{companyId:string;origin:Material;onClose:()=>void;onSaved:()=>void}){
 const [search,setSearch]=useState(''),[q,setQ]=useState(''),[page,setPage]=useState(0),[target,setTarget]=useState<Material|null>(null),[impact,setImpact]=useState<any>(null),[reason,setReason]=useState(''),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const lock=useRef(false)
 useEffect(()=>{const timer=setTimeout(()=>{setQ(search.trim());setPage(0)},250);return()=>clearTimeout(timer)},[search])
 const candidates=useAsync(()=>window.fluxoDre.compras.catalogPage({empresa_id:Number(companyId),q,offset:page*50,limit:50}),[companyId,q,page])
 const payload=()=>({empresa_id:Number(companyId),origem_id:origin.id,destino_id:target!.id})
 const act=async(commit:boolean)=>{if(lock.current)return;if(!target){setError('Selecione o material de destino.');return}lock.current=true;setBusy(true);setError('');try{if(commit){await window.fluxoDre.compras.reclassificationConfirm({...payload(),revision:impact.revision,motivo:reason,confirmado:confirmed});onSaved()}else setImpact(await window.fluxoDre.compras.reclassificationPreview(payload()))}catch(e){setError(e instanceof Error?e.message:'Não foi possível reclassificar.');if(commit)setImpact(null)}finally{lock.current=false;setBusy(false)}}
 return <Modal open title="Reclassificar material histórico" onClose={()=>{if(!busy)onClose()}}><form onSubmit={e=>{e.preventDefault();void act(!!impact)}}><div className="modal-body form-grid">
 <p><strong>Origem:</strong> {origin.descricao} — {origin.unidade}. Escolha somente o mesmo produto físico. A unidade e os registros originais serão preservados; os saldos passam a usar o destino.</p>
 {error&&<p role="alert">{error}</p>}
 {!impact?<><Field label="Buscar material de destino"><input value={search} onChange={e=>{setSearch(e.target.value);setTarget(null)}}/></Field>
 {candidates.loading?<Loading/>:candidates.error?<p role="alert">{candidates.error.message}</p>:<Field label="Destino"><select required value={target?.id||''} onChange={e=>{setTarget(candidates.data?.rows.find(r=>String(r.id)===e.target.value)||null);setImpact(null)}}><option value="">Selecione</option>{candidates.data?.rows.filter(r=>r.id!==origin.id&&String(r.unidade).trim().toLowerCase()===origin.unidade.trim().toLowerCase()).map(r=><option key={r.id} value={r.id}>{r.descricao} — {r.unidade}</option>)}</select></Field>}
 <div className="row-actions"><Button type="button" variant="secondary" disabled={!page||candidates.loading} onClick={()=>{setTarget(null);setPage(p=>p-1)}}>Anterior</Button><Button type="button" variant="secondary" disabled={candidates.loading||(page+1)*50>=(candidates.data?.total||0)} onClick={()=>{setTarget(null);setPage(p=>p+1)}}>Próxima</Button></div></>:<>
 <p><strong>Destino:</strong> {impact.destino.descricao} — {impact.destino.unidade}. {impact.movimentacoes} movimentações e {impact.pedidos} itens de pedido serão reclassificados. Nenhuma quantidade será lançada novamente.</p>
 <Field label="Motivo" required><input required maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></Field>
 <label><input type="checkbox" required checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> Confirmo que representam exatamente o mesmo material e unidade.</label>
 <Button type="button" variant="secondary" disabled={busy} onClick={()=>{setImpact(null);setConfirmed(false)}}>Alterar destino</Button></>}
 </div><FormActions loading={busy} submitLabel={impact?'Confirmar reclassificação':'Conferir impacto'} onCancel={()=>{if(!busy)onClose()}}/></form></Modal>
}
