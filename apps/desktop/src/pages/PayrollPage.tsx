import { CalendarDays, CheckCircle2, Clock3, Edit3, Plus, Save, Trash2, UserRound, WalletCards } from 'lucide-react'
import { FormEvent, useMemo, useState } from 'react'
import { brl, competenceLabel, currentCompetence, toCents, today } from '../utils/format'
import { useAsync } from '../hooks/useAsync'
import { Button, Card, Empty, Field, FormActions, Loading, Modal, PageHeader, Segmented, Status } from '../components/ui'

const variables=[
  {tipo:'diaria',descricao:'Diária',natureza:'credito'},
  {tipo:'permuta',descricao:'Permuta',natureza:'credito'},
  {tipo:'vale_salario',descricao:'Vale / adiantamento',natureza:'credito',quinzena:2},
  {tipo:'empreita',descricao:'Empreita',natureza:'credito'},
  {tipo:'ajuste',descricao:'Ajuste',natureza:'credito'},
  {tipo:'falta',descricao:'Falta',natureza:'desconto'},
  {tipo:'outro_desconto',descricao:'Outro desconto',natureza:'desconto'}
]

export default function PayrollPage(){
  const [tab,setTab]=useState('funcionarios')
  const [competencia,setCompetencia]=useState(currentCompetence())
  const [employee,setEmployee]=useState('')
  const [version,setVersion]=useState(0)
  const [modal,setModal]=useState(false)
  const [message,setMessage]=useState('')
  const [form,setForm]=useState<any>({tipo:'diaria',descricao:'Diária',natureza:'credito',quinzena:1,valor:''})
  const employees=useAsync(()=>window.fluxoDre.funcionarios.list({status:'ativo'}),[])
  const cargos=useAsync(()=>window.fluxoDre.cargos.list(),[])
  const pending=useAsync(()=>window.fluxoDre.folha.pending(competencia),[competencia,version])
  const payroll=useAsync(()=>employee?window.fluxoDre.folha.employee({funcionario_id:Number(employee),competencia}):Promise.resolve(null),[employee,competencia,version])
  const rows=payroll.data?.launches||[]
  const first=rows.filter((row:any)=>row.quinzena===1)
  const second=rows.filter((row:any)=>row.quinzena===2)
  const payment=(quinzena:number)=>payroll.data?.payments.find((item:any)=>item.quinzena===quinzena&&item.status==='pago')
  const totals=(items:any[])=>items.reduce((result,row)=>{result[row.natureza]+=row.valor_centavos;return result},{credito:0,desconto:0})
  const firstTotals=totals(first),secondTotals=totals(second)
  const totalAll={credito:firstTotals.credito+secondTotals.credito,desconto:firstTotals.desconto+secondTotals.desconto}
  const selectedEmployee=employees.data?.find((item:any)=>item.id===Number(employee))
  const selectedCargo=cargos.data?.find((item:any)=>item.id===selectedEmployee?.cargo_id)

  const openVariable=(row?:any,quinzena=1)=>{setForm(row?{...row,valor:(row.valor_centavos/100).toFixed(2).replace('.',',')}:{tipo:quinzena===2?'vale_salario':'diaria',descricao:quinzena===2?'Vale / adiantamento':'Diária',natureza:'credito',quinzena,valor:''});setModal(true)}
  const submit=async(event:FormEvent)=>{event.preventDefault();await window.fluxoDre.folha.saveVariable({...form,funcionario_id:Number(employee),competencia,valor_centavos:toCents(form.valor)});setModal(false);setVersion(v=>v+1);setMessage('Lançamento salvo.')}
  const selectType=(event:React.ChangeEvent<HTMLSelectElement>)=>{const item=variables.find(x=>x.tipo===event.target.value)!;setForm({...form,...item,quinzena:item.quinzena||form.quinzena})}
  const confirm=async(quinzena:number)=>{setMessage('');try{const result:any=await window.fluxoDre.folha.confirm({funcionario_id:Number(employee),competencia,quinzena,data:today(),forma_pagamento:'PIX'});setVersion(v=>v+1);if(quinzena===1)setMessage(result?.documentError?'Pagamento confirmado, mas os documentos mensais não foram gerados: '+result.documentError:'Pagamento confirmado. A ficha de ponto e os recibos mensais foram gerados juntos na pasta do mês.');else setMessage(`${quinzena}ª quinzena confirmada e registrada.`)}catch(error:any){setMessage(error?.message||String(error))}}
  const VariableRows=({items}:{items:any[]})=><div className="variable-list">{items.filter(row=>row.editavel).map((row:any)=><div className="variable-row" key={row.id}><div><strong>{row.descricao}</strong><small>{row.natureza==='desconto'?'Desconto variável':'Crédito variável'}</small></div><span className={row.natureza==='desconto'?'amount-negative':'amount-positive'}>{brl(row.valor_centavos)}</span>{row.status!=='pago'&&<div className="row-actions"><button className="icon-button" onClick={()=>{openVariable(row);setModal(true)}}><Edit3 size={14}/></button><button className="icon-button danger-icon" onClick={async()=>{await window.fluxoDre.folha.removeVariable(row.id);setVersion(v=>v+1)}}><Trash2 size={14}/></button></div>}</div>)}</div>

  return <>
    <PageHeader title="Controle de pagamento" description="Valores fixos por função, lançamentos variáveis e confirmação por quinzena." actions={employee&&<Button icon={<Plus size={16}/>} onClick={()=>{openVariable();setModal(true)}}>Novo variável</Button>}/>
    <div className="toolbar payroll-tabs"><Segmented value={tab} onChange={setTab} options={[{value:'funcionarios',label:'Funcionários'},{value:'empresa',label:'Encargos da empresa'},{value:'pendentes',label:'Pendentes'}]}/></div>
    <Card className="payroll-filter"><Field label="Funcionário" wide><select value={employee} onChange={event=>setEmployee(event.target.value)}><option value="">Selecione um funcionário...</option>{employees.data?.map((item:any)=><option key={item.id} value={item.id}>{item.nome} · CPF {item.cpf||'não informado'} · {cargos.data?.find((cargo:any)=>cargo.id===item.cargo_id)?.nome||'Sem cargo'}</option>)}</select></Field><Field label="Competência"><input type="month" value={competencia} onChange={event=>setCompetencia(event.target.value)}/></Field></Card>

    {tab==='empresa'?<Card><Empty title="Encargos da empresa" description="Os encargos continuam vinculados à DRE e à folha fechada."/></Card>:tab==='pendentes'?<Card className="pending-card"><div className="section-heading"><div><h2>Pagamentos pendentes</h2><p>Quinzenas aguardando confirmação em {competenceLabel(competencia)}.</p></div><Status value="pendente"/></div>{pending.loading?<Loading label="Preparando pagamentos fixos..."/>:pending.data?.length?<div className="table-wrap"><table><thead><tr><th>Funcionário</th><th>Cargo</th><th>Quinzena</th><th>Valor previsto</th><th>Status</th><th></th></tr></thead><tbody>{pending.data.map((item:any)=><tr key={`${item.funcionario_id}-${item.quinzena}`}><td><strong>{item.funcionario_nome}</strong></td><td>{item.cargo_nome||'Sem cargo'}</td><td>{item.quinzena}ª quinzena</td><td className="money-cell">{brl(item.valor_centavos)}</td><td><Status value="pendente"/></td><td><Button variant="secondary" onClick={()=>{setEmployee(String(item.funcionario_id));setTab('funcionarios')}}>Revisar</Button></td></tr>)}</tbody></table></div>:<Empty title="Tudo confirmado" description="Não há pagamentos pendentes nesta competência."/>}</Card>:!employee?<Card><Empty title="Selecione um funcionário" description="Os valores fixos do cargo serão preparados automaticamente para a competência escolhida."/></Card>:payroll.loading?<Card><Loading label="Preparando valores fixos e pagamentos..."/></Card>:payroll.data&&<>
      <div className="employee-payroll-banner"><span className="employee-banner-avatar">{selectedEmployee?.nome?.slice(0,1).toUpperCase()}</span><div><strong>{selectedEmployee?.nome}</strong><span>{selectedCargo?.nome||'Sem cargo'} · {competenceLabel(competencia)}</span></div><div className="banner-total"><small>Total previsto</small><b>{brl(totalAll.credito-totalAll.desconto)}</b></div></div>
      <div className="payroll-summary-grid"><Card><span>Proventos</span><strong className="amount-positive">{brl(totalAll.credito)}</strong></Card><Card><span>Descontos</span><strong className="amount-negative">{brl(totalAll.desconto)}</strong></Card><Card><span>Líquido</span><strong>{brl(totalAll.credito-totalAll.desconto)}</strong></Card></div>

      <Card className="payroll-period-card">
        <div className="payroll-period-header"><div><h2>1ª Quinzena — Pagamento mensal</h2><p>Salário e benefícios fixos vinculados ao cargo.</p></div>{payment(1)?<Status value="pago"/>:<span className="status status-warning"><Clock3 size={12}/> Pendente</span>}</div>
        <div className="payroll-period-body"><h3>Valores fixos</h3><div className="fixed-values-grid">{first.filter((row:any)=>!row.editavel).map((row:any)=><label key={row.id}><span>{row.descricao}</span><div className="locked-value">{brl(row.valor_centavos)}<small>Vinculado ao cargo</small></div></label>)}</div>
        <div className="variable-heading"><h3>Variáveis da competência</h3>{!payment(1)&&<Button variant="secondary" icon={<Plus size={14}/>} onClick={()=>{openVariable(undefined,1);setModal(true)}}>Adicionar</Button>}</div><VariableRows items={first}/></div>
        <div className="payroll-total-bar"><div><span>Total bruto</span><strong className="amount-positive">{brl(firstTotals.credito)}</strong></div><div><span>Descontos</span><strong className="amount-negative">{brl(firstTotals.desconto)}</strong></div><div className="payroll-payable"><span>A pagar</span><strong>{brl(Math.max(0,firstTotals.credito-firstTotals.desconto))}</strong></div><div className="payroll-actions">{payment(1)?<span className="paid-confirmation"><CheckCircle2 size={17}/> Pago em {payment(1).data}</span>:<><Button variant="secondary" icon={<Save size={15}/>} onClick={()=>setMessage('Valores preservados como pendentes.')}>Salvar</Button><Button icon={<CheckCircle2 size={16}/>} onClick={()=>confirm(1)}>Confirmar pagamento</Button></>}</div></div>
      </Card>

      <Card className="payroll-period-card second-period">
        <div className="payroll-period-header"><div><h2>2ª Quinzena — Vale / adiantamento</h2><p>Este valor pode ser alterado e será considerado no fechamento.</p></div>{payment(2)?<Status value="pago"/>:<span className="status status-warning"><Clock3 size={12}/> Pendente</span>}</div>
        <div className="payroll-period-body"><VariableRows items={second}/>{!second.length&&!payment(2)&&<Empty title="Nenhum adiantamento lançado" description="Adicione somente quando houver vale, permuta ou outro valor variável." action={<Button variant="secondary" icon={<Plus size={14}/>} onClick={()=>{openVariable(undefined,2);setModal(true)}}>Adicionar vale</Button>}/>}</div>
        <div className="payroll-total-bar compact"><div className="payroll-payable"><span>A pagar</span><strong>{brl(Math.max(0,secondTotals.credito-secondTotals.desconto))}</strong></div><div className="payroll-actions">{payment(2)?<span className="paid-confirmation"><CheckCircle2 size={17}/> Pago em {payment(2).data}</span>:<Button icon={<CheckCircle2 size={16}/>} disabled={!second.length} onClick={()=>confirm(2)}>Confirmar pagamento</Button>}</div></div>
      </Card>
    </>}
    {message&&<div className="success-box" style={{marginTop:14}}>{message}</div>}
    <Modal open={modal} title={form.id?'Editar lançamento variável':'Novo lançamento variável'} onClose={()=>setModal(false)}><form onSubmit={submit}><div className="modal-body form-grid"><Field label="Funcionário" wide><div className="readonly-person"><UserRound size={17}/>{selectedEmployee?.nome} · CPF {selectedEmployee?.cpf||'não informado'}</div></Field><Field label="Rubrica" required><select value={form.tipo} onChange={selectType}>{variables.map(item=><option value={item.tipo} key={item.tipo}>{item.descricao}</option>)}</select></Field><Field label="Natureza"><select value={form.natureza} onChange={event=>setForm({...form,natureza:event.target.value})}><option value="credito">Crédito</option><option value="desconto">Desconto</option></select></Field><Field label="Quinzena"><select value={form.quinzena} onChange={event=>setForm({...form,quinzena:Number(event.target.value)})}><option value="1">1ª quinzena</option><option value="2">2ª quinzena</option></select></Field><Field label="Valor" required><input required value={form.valor} onChange={event=>setForm({...form,valor:event.target.value})} placeholder="0,00"/></Field><Field label="Data"><input type="date" value={form.data||today()} onChange={event=>setForm({...form,data:event.target.value})}/></Field></div><FormActions onCancel={()=>setModal(false)} submitLabel="Salvar lançamento"/></form></Modal>
  </>
}




