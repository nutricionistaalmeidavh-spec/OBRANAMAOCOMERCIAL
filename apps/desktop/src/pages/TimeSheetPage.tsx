import { FileDown, Save, Sparkles, UsersRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button, Card, Empty, Field, Loading, PageHeader, Status } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { competenceLabel, currentCompetence, today } from '../utils/format'

const typeLabels:Record<string,string>={trabalho:'Trabalho',falta:'Falta',ferias:'Férias',feriado:'Feriado',folga:'Folga',afastado:'Afastado',sabado:'Sábado',domingo:'Domingo'}

export default function TimeSheetPage(){
  const [competencia,setCompetencia]=useState(currentCompetence())
  const [employee,setEmployee]=useState('')
  const [version,setVersion]=useState(0)
  const [marks,setMarks]=useState<any[]>([])
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const employees=useAsync(()=>window.fluxoDre.funcionarios.list({status:'ativo'}),[])
  const cargos=useAsync(()=>window.fluxoDre.cargos.list(),[])
  const point=useAsync(()=>employee?window.fluxoDre.ponto.get({funcionario_id:Number(employee),competencia}):Promise.resolve(null),[employee,competencia,version])
  useEffect(()=>setMarks(point.data?.marks||[]),[point.data])
  const selected=employees.data?.find((item:any)=>item.id===Number(employee))
  const cargo=cargos.data?.find((item:any)=>item.id===selected?.cargo_id)
  const update=(id:number,key:string,value:string)=>setMarks((rows)=>rows.map((row)=>{if(row.id!==id)return row;const next={...row,[key]:value};if(key==='tipo'&&value!=='trabalho'){next.entrada='';next.intervalo_saida='';next.intervalo_entrada='';next.saida='';next.observacoes=next.observacoes||typeLabels[value]||''}return next}))
  const autoFill=async()=>{setBusy(true);try{const result=await window.fluxoDre.ponto.autoFill({funcionario_id:Number(employee),competencia});setMarks(result.marks);setMessage('Marcações realistas preenchidas. Revise exceções antes de imprimir.')}finally{setBusy(false)}}
  const save=async()=>{setBusy(true);try{await window.fluxoDre.ponto.save({funcionario_id:Number(employee),competencia,marks});setVersion((v)=>v+1);setMessage('Ficha de ponto salva.')}finally{setBusy(false)}}
  const generate=async()=>{setBusy(true);try{await save();const result=await window.fluxoDre.ponto.generate({funcionario_id:Number(employee),competencia,paymentDate:today()});setMessage('Ficha de ponto e recibos gerados na pasta mensal do funcionário.');await window.fluxoDre.documentos.reveal(result.point.path)}finally{setBusy(false)}}
  const generateAll=async()=>{setBusy(true);try{const result=await window.fluxoDre.ponto.generateAll({competencia,paymentDate:today()});setMessage(result.length+' funcionários processados.')}finally{setBusy(false)}}
  return <>
    <PageHeader title="Folhas de ponto" description="Controle mensal com quatro marcações diárias e geração dos recibos de benefícios." actions={<Button variant="secondary" icon={<UsersRound size={16}/>} onClick={generateAll} disabled={busy}>Gerar para todos</Button>}/>
    <Card className="time-filter"><Field label="Funcionário" wide><select value={employee} onChange={(event)=>setEmployee(event.target.value)}><option value="">Selecione um funcionário...</option>{employees.data?.map((item:any)=><option value={item.id} key={item.id}>{item.nome} - {cargos.data?.find((role:any)=>role.id===item.cargo_id)?.nome||'Sem cargo'}</option>)}</select></Field><Field label="Competência"><input type="month" value={competencia} onChange={(event)=>setCompetencia(event.target.value)}/></Field></Card>
    {!employee?<Card><Empty title="Selecione um funcionário" description="A ficha será criada para a competência escolhida."/></Card>:point.loading?<Card><Loading label="Carregando ficha de ponto..."/></Card>:<>
      <div className="time-banner"><div><strong>{selected?.nome}</strong><span>{cargo?.nome||'Sem cargo'} - {competenceLabel(competencia)}</span></div><div className="time-schedule"><span>Jornada prevista</span><b>{point.data?.point.jornada_inicio} - {point.data?.point.intervalo_inicio} / {point.data?.point.intervalo_fim} - {point.data?.point.jornada_fim}</b></div><Status value={point.data?.point.status||'rascunho'}/></div>
      <Card>
        <div className="card-header"><div><h2>Marcações diárias</h2><p>O preenchimento automático varia alguns minutos em cada batida e nunca substitui marcações já revisadas.</p></div><div className="row-actions"><Button variant="secondary" icon={<Sparkles size={15}/>} onClick={autoFill} disabled={busy}>Preencher automaticamente</Button><Button variant="secondary" icon={<Save size={15}/>} onClick={save} disabled={busy||!marks.length}>Salvar</Button><Button icon={<FileDown size={15}/>} onClick={generate} disabled={busy||!marks.length}>Gerar documentos</Button></div></div>
        {marks.length?<div className="table-wrap time-table"><table><thead><tr><th>Dia</th><th>Tipo</th><th>Entrada</th><th>Saída almoço</th><th>Retorno almoço</th><th>Saída</th><th>Observações</th></tr></thead><tbody>{marks.map((row:any)=><tr key={row.data} className={row.tipo!=='trabalho'?'non-workday':''}><td><strong>{row.data.slice(-2)}</strong><small>{new Date(row.data+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short'})}</small></td><td><select value={row.tipo} onChange={(event)=>update(row.id,'tipo',event.target.value)}>{Object.entries(typeLabels).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></td>{['entrada','intervalo_saida','intervalo_entrada','saida'].map((key)=><td key={key}><input type="time" value={row[key]||''} disabled={row.tipo!=='trabalho'} onChange={(event)=>update(row.id,key,event.target.value)}/></td>)}<td><input value={row.observacoes||''} onChange={(event)=>update(row.id,'observacoes',event.target.value)} placeholder={row.tipo==='trabalho'?'Opcional':typeLabels[row.tipo]}/></td></tr>)}</tbody></table></div>:<Empty title="Ficha ainda não preenchida" description="Use o preenchimento automático para criar horários naturais em todos os dias úteis." action={<Button icon={<Sparkles size={16}/>} onClick={autoFill}>Preencher mês</Button>}/>}
      </Card>
    </>}
    {message&&<div className="success-box" style={{marginTop:14}}>{message}</div>}
  </>
}
