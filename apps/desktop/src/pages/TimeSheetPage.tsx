import { FileDown, Printer, RotateCcw, Save, Sparkles, UsersRound } from 'lucide-react'
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
  const [batchOpen,setBatchOpen]=useState(false)
  const [marksOpen,setMarksOpen]=useState(true)
  const [printPoint,setPrintPoint]=useState(true)
  const [printReceipts,setPrintReceipts]=useState(true)
  const employees=useAsync(()=>window.fluxoDre.funcionarios.list({status:'ativo'}),[])
  const cargos=useAsync(()=>window.fluxoDre.cargos.list(),[])
  const point=useAsync(()=>employee?window.fluxoDre.ponto.get({funcionario_id:Number(employee),competencia}):Promise.resolve(null),[employee,competencia,version])
  useEffect(()=>setMarks(point.data?.marks||[]),[point.data])
  const selected=employees.data?.find((item:any)=>item.id===Number(employee))
  const cargo=cargos.data?.find((item:any)=>item.id===selected?.cargo_id)
  const update=(id:number,key:string,value:string)=>setMarks((rows)=>rows.map((row)=>{if(row.id!==id)return row;const next={...row,[key]:value};if(key==='tipo'&&value!=='trabalho'){next.entrada='';next.intervalo_saida='';next.intervalo_entrada='';next.saida='';next.observacoes=next.observacoes||typeLabels[value]||''}return next}))
  const autoFill=async()=>{setBusy(true);try{const result=await window.fluxoDre.ponto.autoFill({funcionario_id:Number(employee),competencia});setMarks(result.marks);setMessage('Marcações preenchidas. Revise as exceções antes de gerar documentos.')}finally{setBusy(false)}}
  const save=async()=>{setBusy(true);try{await window.fluxoDre.ponto.save({funcionario_id:Number(employee),competencia,marks});setVersion((v)=>v+1);setMessage('Ficha de ponto salva.')}finally{setBusy(false)}}
  const generate=async()=>{setBusy(true);setMessage('');try{await save();const result=await window.fluxoDre.ponto.generate({funcionario_id:Number(employee),competencia,paymentDate:today()});setMessage('Ficha de ponto e recibos configurados foram gerados na pasta mensal do funcionário.');if(result.point?.path)await window.fluxoDre.documentos.reveal(result.point.path);else if(result.receipt?.path)await window.fluxoDre.documentos.reveal(result.receipt.path)}catch(error:any){setMessage(error?.message||String(error))}finally{setBusy(false)}}
  const summarize=(result:any[])=>{const ok=result.filter((item:any)=>item.ok),failed=result.filter((item:any)=>!item.ok);return failed.length?ok.length+' funcionários processados. '+failed.length+' não foram processados por cadastro incompleto: '+failed.map((item:any)=>item.nome).join(', ')+'.':ok.length+' funcionários processados.'}
  const selectionOk=()=>{if(printPoint||printReceipts)return true;setMessage('Selecione fichas de ponto e/ou recibos para gerar ou imprimir.');return false}
  const generateAll=async()=>{if(!selectionOk())return;setBusy(true);setMessage('');try{const result=await window.fluxoDre.ponto.generateAll({competencia,paymentDate:today(),point:printPoint,receipts:printReceipts});setMessage(summarize(result));setBatchOpen(false)}catch(error:any){setMessage(error?.message||String(error))}finally{setBusy(false)}}
  const printAll=async()=>{if(!selectionOk())return;setBusy(true);setMessage('');try{const result:any=await window.fluxoDre.ponto.generateAll({competencia,paymentDate:today(),print:true,point:printPoint,receipts:printReceipts});const failed=(result.results||[]).filter((item:any)=>!item.ok);const suffix=failed.length?' '+failed.length+' funcionário(s) não entraram no lote: '+failed.map((item:any)=>item.nome).join(', ')+'.':'';setMessage(result.canceled?'Impressão cancelada. Os PDFs já gerados foram mantidos.'+suffix:(result.printed?'Lote enviado para a caixa de impressão com '+result.employees+' funcionário(s).':'Nenhum lote foi impresso.')+suffix);setBatchOpen(false)}catch(error:any){setMessage(error?.message||String(error))}finally{setBusy(false)}}
  const reprintAll=async()=>{if(!selectionOk())return;setBusy(true);setMessage('');try{const result:any=await window.fluxoDre.ponto.generateAll({competencia,paymentDate:today(),reprint:true,point:printPoint,receipts:printReceipts});const failed=(result.results||[]).filter((item:any)=>!item.ok);const suffix=failed.length?' '+failed.length+' funcionário(s) não entraram no lote: '+failed.map((item:any)=>item.nome).join(', ')+'.':'';setMessage(result.canceled?'Reimpressão cancelada. Nenhum PDF duplicado foi criado.'+suffix:(result.printed?'Reimpressão enviada para a caixa de impressão com '+result.employees+' funcionário(s). Nenhum PDF duplicado foi criado.':'Nenhum lote foi reimpresso.')+suffix);setBatchOpen(false)}catch(error:any){setMessage(error?.message||String(error))}finally{setBusy(false)}}
  return <>
    <PageHeader title="Folhas de ponto" description="Controle mensal das marcações e central de geração, impressão e reimpressão dos documentos do período."/>
    <Card className="time-filter"><Field label="Funcionário" wide><select value={employee} onChange={(event)=>setEmployee(event.target.value)}><option value="">Selecione um funcionário...</option>{employees.data?.map((item:any)=><option value={item.id} key={item.id}>{item.nome} · CPF {item.cpf||'não informado'} · {cargos.data?.find((role:any)=>role.id===item.cargo_id)?.nome||'Sem cargo'}</option>)}</select></Field><Field label="Competência"><input type="month" value={competencia} onChange={(event)=>setCompetencia(event.target.value)}/></Field></Card>

    <Card style={{margin:'14px 0',padding:16}}>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:18,flexWrap:'wrap'}}>
        <div><h2 style={{margin:'0 0 5px',fontSize:15}}>Documentos da competência</h2><p style={{margin:0,maxWidth:700}}>Gere os documentos do colaborador selecionado ou abra o lote mensal para gerar, imprimir ou reimprimir todos.</p></div>
        <div className="row-actions" style={{gap:8,flexWrap:'wrap'}}>
          <Button variant="secondary" icon={<UsersRound size={16}/>} onClick={()=>setBatchOpen((value)=>!value)} disabled={busy}>Gerar e imprimir todos</Button>
          <Button icon={<FileDown size={15}/>} onClick={generate} disabled={busy||!employee||!marks.length}>Gerar documentos</Button>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:10,marginTop:14}}>
        <div style={{border:'1px solid var(--border)',borderRadius:8,padding:'12px 14px'}}><strong style={{display:'block',fontSize:12}}>Ficha de ponto</strong><small style={{display:'block',marginTop:4,color:'var(--muted)'}}>Uma ficha mensal por colaborador, usando as marcações revisadas.</small></div>
        <div style={{border:'1px solid var(--border)',borderRadius:8,padding:'12px 14px'}}><strong style={{display:'block',fontSize:12}}>Recibos de benefícios</strong><small style={{display:'block',marginTop:4,color:'var(--muted)'}}>Somente benefícios configurados para assinatura pela empresa, reunidos no PDF mensal do colaborador.</small></div>
      </div>
    </Card>

    {batchOpen&&<Card className="print-batch-card" style={{marginBottom:14,maxWidth:760,marginLeft:'auto'}}>
      <div className="card-header" style={{alignItems:'flex-start'}}><div><h2>Documentos em lote</h2><p>Escolha ficha de ponto, recibos ou ambos. Imprimir gera os PDFs selecionados e abre a caixa do Windows; reimprimir apenas envia novamente o mês selecionado, sem duplicar arquivos.</p></div></div>
      <div style={{display:'grid',gap:10,margin:'14px'}}>
        <label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer'}}><input type="checkbox" checked={printPoint} onChange={(event)=>setPrintPoint(event.target.checked)}/><span><strong>Fichas de ponto</strong><br/><small>Uma ficha mensal para cada colaborador.</small></span></label>
        <label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer'}}><input type="checkbox" checked={printReceipts} onChange={(event)=>setPrintReceipts(event.target.checked)}/><span><strong>Recibos de benefícios</strong><br/><small>Benefícios definidos pela política de recibos da empresa.</small></span></label>
      </div>
      <div className="row-actions" style={{justifyContent:'flex-end',flexWrap:'wrap',padding:'0 14px 14px'}}><Button variant="secondary" onClick={()=>setBatchOpen(false)} disabled={busy}>Cancelar</Button><Button variant="secondary" icon={<FileDown size={15}/>} onClick={generateAll} disabled={busy||(!printPoint&&!printReceipts)}>Somente gerar</Button><Button variant="secondary" icon={<RotateCcw size={15}/>} onClick={reprintAll} disabled={busy||(!printPoint&&!printReceipts)}>Reimprimir</Button><Button icon={<Printer size={15}/>} onClick={printAll} disabled={busy||(!printPoint&&!printReceipts)}>Imprimir</Button></div>
    </Card>}

    {!employee?<Card><Empty title="Selecione um funcionário" description="Escolha um colaborador para revisar as marcações e gerar os documentos da competência."/></Card>:point.loading?<Card><Loading label="Carregando ficha de ponto..."/></Card>:<>
      <div className="time-banner"><div><strong>{selected?.nome}</strong><span>CPF {selected?.cpf||'não informado'} · {cargo?.nome||'Sem cargo'} · {competenceLabel(competencia)}</span></div><div className="time-schedule"><span>Jornada prevista</span><b>{point.data?.point.jornada_inicio} - {point.data?.point.intervalo_inicio} / {point.data?.point.intervalo_fim} - {point.data?.point.jornada_fim}</b></div><Status value={point.data?.point.status||'rascunho'}/></div>
      <Card style={{marginTop:14}}>
        <div className="card-header" style={{cursor:'pointer'}} onClick={()=>setMarksOpen((value)=>!value)}>
          <div><h2>Editar marcações do mês</h2><p style={{margin:'4px 0 0'}}>Preenchimento automático, revisão das exceções e ajuste manual das quatro batidas diárias.</p></div>
          <Button variant="ghost" onClick={(event)=>{event.stopPropagation();setMarksOpen((value)=>!value)}}>{marksOpen?'Recolher':'Expandir'}</Button>
        </div>
        {marksOpen&&<>
          <div style={{display:'flex',justifyContent:'flex-end',gap:8,padding:'12px 16px 0',flexWrap:'wrap'}}><Button variant="secondary" icon={<Sparkles size={15}/>} onClick={autoFill} disabled={busy}>Preencher automaticamente</Button><Button variant="secondary" icon={<Save size={15}/>} onClick={save} disabled={busy||!marks.length}>Salvar</Button></div>
          {marks.length?<div className="table-wrap time-table" style={{marginTop:12}}><table><thead><tr><th>Dia</th><th>Tipo</th><th>Entrada</th><th>Saída almoço</th><th>Retorno almoço</th><th>Saída</th><th>Observações</th></tr></thead><tbody>{marks.map((row:any)=><tr key={row.data} className={row.tipo!=='trabalho'?'non-workday':''}><td><strong>{row.data.slice(-2)}</strong><small>{new Date(row.data+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short'})}</small></td><td><select value={row.tipo} onChange={(event)=>update(row.id,'tipo',event.target.value)}>{Object.entries(typeLabels).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></td>{['entrada','intervalo_saida','intervalo_entrada','saida'].map((key)=><td key={key}><input type="time" value={row[key]||''} disabled={row.tipo!=='trabalho'} onChange={(event)=>update(row.id,key,event.target.value)}/></td>)}<td><input value={row.observacoes||''} onChange={(event)=>update(row.id,'observacoes',event.target.value)} placeholder={row.tipo==='trabalho'?'Opcional':typeLabels[row.tipo]}/></td></tr>)}</tbody></table></div>:<Empty title="Ficha ainda não preenchida" description="Use o preenchimento automático para criar horários naturais em todos os dias úteis." action={<Button icon={<Sparkles size={16}/>} onClick={autoFill}>Preencher mês</Button>}/>} 
        </>}
      </Card>
    </>}
    {message&&<div className="success-box" style={{marginTop:14}}>{message}</div>}
  </>
}
