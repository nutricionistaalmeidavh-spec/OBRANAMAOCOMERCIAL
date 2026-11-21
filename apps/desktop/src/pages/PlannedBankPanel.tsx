import { useState } from 'react'
import { Button, Card, Empty, ErrorState, Loading } from '../components/ui'
import { useAsync } from '../hooks/useAsync'

type Planned={conta_id:number;obra_id:number|null;tipo:'pagar'|'receber';descricao:string;vencimento:string;valor_centavos:number;pendente_centavos:number;conta_bancaria_id:number|null}
type Bank={id:number;nome:string;banco_nome:string}
const money=(n:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n||0)/100)
export default function PlannedBankPanel({empresaId,obraId,works,onChanged}:{empresaId:number;obraId?:number;works:{id:number;nome:string}[];onChanged:()=>void}){
 const [version,setVersion]=useState(0)
 const [saving,setSaving]=useState<number|null>(null)
 const [error,setError]=useState('')
 const [success,setSuccess]=useState('')
 const planned=useAsync<Planned[]>(()=>window.fluxoDre.bancos.planned({empresaId,obraId}),[empresaId,obraId,version])
 const banks=useAsync<Bank[]>(()=>window.fluxoDre.bancos.list(empresaId),[empresaId])
 const pending=planned.data?.filter(x=>x.pendente_centavos>0)||[]
 const assign=async(contaId:number,value:string)=>{
  setSaving(contaId);setError('');setSuccess('')
  try{
   await window.fluxoDre.bancos.assignPlan({empresaId,contaId,contaBancariaId:value?Number(value):null})
   setVersion(x=>x+1);onChanged();setSuccess('Conta bancária prevista atualizada.')
  }catch(err){setError((err as Error).message)}
  finally{setSaving(null)}
 }
 return <Card className="bank-import-card">
  <h2>Conta bancária prevista para cada obrigação</h2>
  <p>Associe o banco de onde deverá sair ou entrar cada pagamento. Sem esta escolha, a obrigação permanece apenas na visão consolidada da empresa.</p>
  {error&&<p role="alert" className="bank-message bank-error">{error}</p>}
  {success&&<p role="status" className="bank-message bank-success">{success}</p>}
  {planned.loading||banks.loading?<Loading label="Carregando obrigações..."/>:planned.error?<ErrorState error={planned.error} retry={planned.reload}/>:banks.error?<ErrorState error={banks.error} retry={banks.reload}/>:!pending.length?<Empty title="Nenhuma obrigação pendente" description="As contas a pagar e receber pendentes aparecerão aqui para escolha do banco."/>:
  <div className="bank-table cash-table"><table>
   <thead><tr><th>Obrigação</th><th>Obra</th><th>Vencimento</th><th>Pendente</th><th>Banco planejado</th></tr></thead>
   <tbody>{pending.map(item=><tr key={item.conta_id}>
    <td><strong>{item.descricao}</strong><small>{item.tipo==='receber'?'Receber':'Pagar'}</small></td>
    <td>{works.find(w=>w.id===item.obra_id)?.nome||'Administrativo / sem obra'}</td>
    <td>{item.vencimento}</td><td>{money(item.pendente_centavos)}</td>
    <td><label className="sr-only" htmlFor={'bank-plan-'+item.conta_id}>Banco previsto para {item.descricao}</label>
     <select id={'bank-plan-'+item.conta_id} value={item.conta_bancaria_id??''} onChange={e=>void assign(item.conta_id,e.target.value)} disabled={saving!==null}>
      <option value="">Não definido</option>{banks.data?.filter(b=>b.id>0).map(b=><option key={b.id} value={b.id}>{b.nome} · {b.banco_nome}</option>)}
     </select>
    </td>
   </tr>)}</tbody>
  </table></div>}
 </Card>
}
