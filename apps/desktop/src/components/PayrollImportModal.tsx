import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, RotateCcw, UploadCloud } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button, Field, Loading, Modal, Segmented } from './ui'
import { brl, competenceLabel } from '../utils/format'

const fieldLabels:Record<string,string>={
  tipo_linha:'Tipo da linha',funcionario:'Funcionário / despesa',cpf:'CPF',salario:'Salário',
  vale_adiantamento:'Vale / adiantamento',diarias:'Diárias',empreitas:'Empreitas',alimentacao:'Alimentação',
  transporte:'Transporte',outros_beneficios:'Outros benefícios',faltas:'Faltas',outros_descontos:'Outros descontos',
  inss:'INSS',fgts:'FGTS',outros_encargos:'Outros encargos',despesa:'Descrição da despesa',
  categoria:'Categoria',valor_despesa:'Valor da despesa',vencimento:'Vencimento'
}

type Props={
  open:boolean
  onClose:()=>void
  competencia:string
  empresaId:string
  obraId:string
  onImported:()=>void
}

const countValues=(rows:any[]=[])=>rows.filter(row=>row.kind==='employee').reduce((sum,row)=>sum+Object.values(row.values||{}).filter((value:any)=>Number(value)>0).length,0)
const importPayload=(normalized:any,competencia:string,empresaId:string,obraId:string,resolutions:any)=>({
  competencia,
  empresa_id:empresaId?Number(empresaId):null,
  obra_id:obraId?Number(obraId):null,
  mode:normalized.mode,
  file:{name:normalized.file?.name||'',hash:normalized.file?.hash||'',sheet:normalized.file?.sheet||''},
  rows:normalized.rows||[],
  resolutions
})

export default function PayrollImportModal({open,onClose,competencia,empresaId,obraId,onImported}:Props){
  const [mode,setMode]=useState<'template'|'universal'>('template')
  const [file,setFile]=useState<any>(null)
  const [sheet,setSheet]=useState('')
  const [mapping,setMapping]=useState<Record<string,string>>({})
  const [normalized,setNormalized]=useState<any>(null)
  const [preview,setPreview]=useState<any>(null)
  const [resolutions,setResolutions]=useState<Record<string,any>>({})
  const [result,setResult]=useState<any>(null)
  const [history,setHistory]=useState<any[]>([])
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')
  const [templateResult,setTemplateResult]=useState<any>(null)

  const selectedSheet=useMemo(()=>file?.sheets?.find((item:any)=>item.name===sheet)||file?.sheets?.[0],[file,sheet])
  const conflicts=useMemo(()=>preview?.conflicts||[],[preview])
  const unresolvedCount=useMemo(()=>conflicts.filter((item:any)=>!resolutions[item.id]).length,[conflicts,resolutions])
  const canCommit=!!preview&&Number(preview.stats?.values||0)>0&&unresolvedCount===0

  const loadHistory=async()=>{try{setHistory(await window.fluxoDre.importacaoFolha.history(12))}catch{}}
  useEffect(()=>{if(open)void loadHistory()},[open])
  useEffect(()=>{
    if(!selectedSheet)return
    setMapping(selectedSheet.suggestedMapping||{})
    setNormalized(null);setPreview(null);setResolutions({})
  },[selectedSheet?.name,mode])

  const releaseFile=async()=>{if(file?.token){try{await window.fluxoDre.importacaoFolha.release(file.token)}catch{}}}
  const resetFile=async()=>{await releaseFile();setFile(null);setSheet('');setMapping({});setNormalized(null);setPreview(null);setResolutions({});setResult(null);setError('')}
  const close=()=>{void releaseFile();setFile(null);setNormalized(null);setPreview(null);setResolutions({});setError('');onClose()}

  const downloadTemplate=async()=>{
    setError('')
    try{setTemplateResult(await window.fluxoDre.importacaoFolha.template())}catch(e:any){setError(e?.message||String(e))}
  }

  const choose=async()=>{
    setLoading(true);setError('')
    try{
      await releaseFile()
      const selected=await window.fluxoDre.importacaoFolha.choose()
      if(!selected)return
      setFile(selected)
      setSheet(selected.sheets?.[0]?.name||'')
      setMapping(selected.sheets?.[0]?.suggestedMapping||{})
      setNormalized(null);setPreview(null);setResolutions({});setResult(null)
    }catch(e:any){setError(e?.message||String(e))}
    finally{setLoading(false)}
  }

  const generatePreview=async()=>{
    if(!file||!sheet)return
    if(!empresaId){setError('Selecione uma empresa na Visão geral antes de importar.');return}
    setLoading(true);setError('')
    try{
      const parsed=await window.fluxoDre.importacaoFolha.filePreview(file.token,{sheet,mode,mapping})
      const data=await window.fluxoDre.importacaoFolha.preview(importPayload(parsed,competencia,empresaId,obraId,{}))
      setNormalized(parsed)
      setPreview(data)
      setResolutions({})
      setResult(null)
    }catch(e:any){setError(e?.message||String(e))}
    finally{setLoading(false)}
  }

  const applyResolution=(key:string,value:string)=>setResolutions((previous:Record<string,string>)=>{
    const next={...previous}
    if(value)next[key]=value
    else delete next[key]
    return next
  })

  const commit=async()=>{
    if(!normalized||!canCommit)return
    setLoading(true);setError('')
    try{
      const data=await window.fluxoDre.importacaoFolha.commit(importPayload(normalized,competencia,empresaId,obraId,resolutions))
      setResult(data);setPreview(null)
      await releaseFile();setFile(null);setNormalized(null)
      await loadHistory();onImported()
    }catch(e:any){setError(e?.message||String(e))}
    finally{setLoading(false)}
  }

  const undo=async(id:number)=>{
    if(!window.confirm('Desfazer esta importação? Isso só será permitido se os lançamentos e contas ainda não tiverem sido pagos ou alterados.'))return
    setLoading(true);setError('')
    try{await window.fluxoDre.importacaoFolha.undo(id);await loadHistory();onImported()}
    catch(e:any){setError(e?.message||String(e))}
    finally{setLoading(false)}
  }

  const resolutionControl=(conflict:any)=><select value={resolutions[conflict.id]||''} onChange={event=>applyResolution(conflict.id,event.target.value)}><option value="">Escolha o que fazer…</option>{conflict.options?.map((option:any)=><option key={option.value} value={option.value}>{option.label}</option>)}</select>

  return <Modal open={open} title="Importar planilha para a folha" onClose={close}>
    <div className="modal-body payroll-import-modal">
      <div className="payroll-import-context"><div><strong>{competenceLabel(competencia)}</strong><span>Os dados só serão gravados depois da prévia e da resolução dos conflitos.</span></div><FileSpreadsheet size={22}/></div>
      {!empresaId&&<div className="notice"><AlertTriangle size={15}/> Se houver mais de uma empresa, selecione uma empresa específica na Visão geral antes de importar.</div>}
      <Segmented value={mode} onChange={(value)=>{void resetFile();setMode(value as any)}} options={[{value:'template',label:'Modelo Obra na Mão'},{value:'universal',label:'Minha planilha'}]}/>

      {mode==='template'&&<div className="payroll-import-template">
        <div><strong>Modelo padronizado</strong><p>Use a planilha do Obra na Mão para importar funcionários, valores da folha e despesas da empresa com reconhecimento automático.</p></div>
        <Button variant="secondary" icon={<Download size={15}/>} onClick={downloadTemplate}>Salvar modelo Excel</Button>
      </div>}
      {templateResult&&<div className="success-box">Modelo salvo em {templateResult.path}</div>}

      {!file&&<div className="payroll-import-picker"><UploadCloud size={28}/><strong>{mode==='template'?'Selecione o modelo preenchido':'Selecione sua planilha ou CSV'}</strong><span>Nenhum dado será alterado nesta etapa.</span><Button onClick={choose}>Selecionar arquivo</Button></div>}

      {file&&<>
        <div className="payroll-import-filebar"><div><FileSpreadsheet size={17}/><span><strong>{file.file}</strong><small>{selectedSheet?.rows||0} linhas detectadas</small></span></div><Button variant="secondary" onClick={choose}>Trocar arquivo</Button></div>
        <div className="payroll-import-setup">
          <Field label="Aba"><select value={sheet} onChange={event=>setSheet(event.target.value)}>{file.sheets.map((item:any)=><option key={item.name} value={item.name}>{item.name} · {item.rows} linhas</option>)}</select></Field>
          <Field label="Modo"><div className="locked-value">{mode==='template'?'Mapeamento do modelo':'Mapeamento personalizado'}</div></Field>
        </div>

        {mode==='template'&&selectedSheet?.templateScore<10&&<div className="notice"><AlertTriangle size={15}/> Esta aba não parece seguir integralmente o modelo Obra na Mão. Mude para “Minha planilha” para mapear as colunas manualmente.</div>}

        {mode==='universal'&&<div className="payroll-import-mapping"><div className="section-heading"><div><h3>Mapeamento de colunas</h3><p>Confirme de onde vem cada valor. Campos inexistentes podem permanecer como “Não importar”.</p></div></div><div className="form-grid form-grid-3">{Object.keys(fieldLabels).map(field=><Field key={field} label={fieldLabels[field]}><select value={mapping[field]||''} onChange={event=>{setMapping({...mapping,[field]:event.target.value});setNormalized(null);setPreview(null)}}><option value="">Não importar</option>{selectedSheet?.headers?.map((header:string)=><option key={header} value={header}>{header}</option>)}</select></Field>)}</div></div>}

        <div className="payroll-import-actions"><Button variant="secondary" onClick={()=>void resetFile()}>Cancelar arquivo</Button><Button disabled={!empresaId} onClick={generatePreview}>Gerar prévia</Button></div>
      </>}

      {loading&&<div className="payroll-import-loading"><Loading label="Validando planilha e dados existentes..."/></div>}

      {preview&&!loading&&<>
        <div className="payroll-import-stats">
          <div><span>Funcionários</span><strong>{preview.stats?.employee_rows||0}</strong></div>
          <div><span>Despesas da empresa</span><strong>{preview.stats?.expense_rows||0}</strong></div>
          <div><span>Valores encontrados</span><strong>{preview.stats?.values||0}</strong></div>
          <div className={preview.summary?.conflicts?'has-conflicts':''}><span>Conflitos</span><strong>{conflicts.length}</strong></div>
        </div>

        <div className="payroll-import-preview-table"><table><thead><tr><th>Linha</th><th>Destino</th><th>Identificação</th><th>Resumo</th></tr></thead><tbody>{preview.rows.slice(0,10).map((row:any)=><tr key={row.id}><td>{row.row_number}</td><td>{row.kind==='employee'?'Funcionário':'Despesa empresa'}</td><td><strong>{row.kind==='employee'?(row.funcionario||'Sem nome'):row.descricao}</strong>{row.cpf&&<small>CPF {row.cpf}</small>}</td><td>{row.kind==='employee'?<span>{Object.values(row.values||{}).filter((value:any)=>Number(value)>0).length} valores</span>:<span>{brl(row.valor_centavos)}</span>}</td></tr>)}</tbody></table>{preview.rows.length>10&&<small className="payroll-import-more">+ {preview.rows.length-10} linhas na importação</small>}</div>

        {conflicts.length>0&&<div className="payroll-import-conflicts"><div className="section-heading"><div><h3>Resolver antes de importar</h3><p>Nenhuma divergência será sobrescrita silenciosamente.</p></div><span className="status status-warning">{unresolvedCount} pendente(s)</span></div>{conflicts.map((conflict:any,index:number)=><div className="payroll-import-conflict" key={conflict.id||index}><div><strong>{conflict.label}</strong>{conflict.current_centavos!=null&&<small>Atual: {brl(conflict.current_centavos)} · Planilha: {brl(conflict.imported_centavos)}</small>}</div>{resolutionControl(conflict)}</div>)}</div>}

        <div className="payroll-import-confirm"><div><ShieldText/><span><strong>{canCommit?'Prévia validada':'Prévia aguardando revisão'}</strong><small>{canCommit?'A confirmação grava os valores nas fontes canônicas da folha e do Financeiro.':unresolvedCount?('Resolva '+unresolvedCount+' conflito(s) antes de continuar.'):'A planilha precisa conter ao menos um valor válido.'}</small></span></div><Button disabled={!canCommit} onClick={commit}>Confirmar importação</Button></div>
      </>}

      {result&&<div className="payroll-import-result"><CheckCircle2 size={24}/><div><strong>Importação concluída</strong><p>{result.imported_values||0} valor(es) da folha e {result.imported_expenses||0} despesa(s) foram gravados. {result.created_employees?result.created_employees+' funcionário(s) criado(s). ':''}{result.skipped?result.skipped+' linha(s) ignorada(s).':''}</p></div></div>}

      {history.length>0&&<div className="payroll-import-history"><div className="section-heading"><div><h3>Importações recentes</h3><p>É possível desfazer enquanto os registros importados não tiverem sido pagos ou alterados.</p></div></div>{history.map((item:any)=><div className="payroll-import-history-row" key={item.id}><div><strong>{item.summary?.file||item.arquivo?.split(/[\\/]/).pop()||'Planilha'}</strong><small>{item.summary?.competencia?competenceLabel(item.summary.competencia):''} · {item.status==='desfeita'?'Desfeita':'Concluída'}</small></div>{item.can_undo&&<Button variant="secondary" icon={<RotateCcw size={14}/>} onClick={()=>undo(item.id)}>Desfazer</Button>}</div>)}</div>}

      {error&&<div className="notice payroll-import-error">{error}</div>}
    </div>
  </Modal>
}

function ShieldText(){return <span className="payroll-import-shield"><CheckCircle2 size={18}/></span>}
