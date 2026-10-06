import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, RotateCcw, UploadCloud } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button, Field, Loading, Modal, Segmented } from '../components/ui'
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

export default function PayrollImportModal({open,onClose,competencia,empresaId,obraId,onImported}:Props){
  const [mode,setMode]=useState<'template'|'universal'>('template')
  const [file,setFile]=useState<any>(null)
  const [sheet,setSheet]=useState('')
  const [mapping,setMapping]=useState<Record<string,string>>({})
  const [preview,setPreview]=useState<any>(null)
  const [resolutions,setResolutions]=useState<Record<string,string>>({})
  const [result,setResult]=useState<any>(null)
  const [history,setHistory]=useState<any[]>([])
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')
  const [templateResult,setTemplateResult]=useState<any>(null)

  const selectedSheet=useMemo(()=>file?.sheets?.find((item:any)=>item.name===sheet)||file?.sheets?.[0],[file,sheet])
  const unresolved=preview?.conflicts?.filter((item:any)=>!resolutions[item.id])||[]

  const resetFile=()=>{setFile(null);setSheet('');setMapping({});setPreview(null);setResolutions({});setResult(null);setError('')}
  const loadHistory=async()=>{try{setHistory(await window.fluxoDre.importacaoFolha.history(10))}catch{}}

  useEffect(()=>{if(open)void loadHistory()},[open])
  useEffect(()=>{
    if(!selectedSheet)return
    setMapping(selectedSheet.suggestedMapping||{})
    setPreview(null)
    setResolutions({})
  },[selectedSheet?.name,mode])

  const downloadTemplate=async()=>{
    setError('')
    try{setTemplateResult(await window.fluxoDre.importacaoFolha.template())}catch(e:any){setError(e?.message||String(e))}
  }
  const choose=async()=>{
    setLoading(true);setError('')
    try{
      const selected=await window.fluxoDre.importacaoFolha.choose()
      if(!selected)return
      setFile(selected)
      setSheet(selected.sheets?.[0]?.name||'')
      setMapping(selected.sheets?.[0]?.suggestedMapping||{})
      setPreview(null);setResolutions({});setResult(null)
    }catch(e:any){setError(e?.message||String(e))}
    finally{setLoading(false)}
  }
  const generatePreview=async()=>{
    if(!file||!sheet)return
    setLoading(true);setError('')
    try{
      const data=await window.fluxoDre.importacaoFolha.preview({
        token:file.token,sheet,mode,mapping,competencia,
        empresa_id:empresaId?Number(empresaId):null,
        obra_id:obraId?Number(obraId):null
      })
      setPreview(data);setResolutions({});setResult(null)
    }catch(e:any){setError(e?.message||String(e))}
    finally{setLoading(false)}
  }
  const commit=async()=>{
    if(!file||unresolved.length)return
    setLoading(true);setError('')
    try{
      const data=await window.fluxoDre.importacaoFolha.commit({
        token:file.token,sheet,mode,mapping,competencia,
        empresa_id:empresaId?Number(empresaId):null,
        obra_id:obraId?Number(obraId):null,
        resolutions
      })
      setResult(data);setPreview(null);setFile(null)
      await loadHistory()
      onImported()
    }catch(e:any){setError(e?.message||String(e))}
    finally{setLoading(false)}
  }
  const undo=async(id:number)=>{
    setLoading(true);setError('')
    try{
      await window.fluxoDre.importacaoFolha.undo(id)
      await loadHistory()
      onImported()
    }catch(e:any){setError(e?.message||String(e))}
    finally{setLoading(false)}
  }

  return <Modal open={open} title="Importar planilha para a folha" onClose={onClose}>
    <div className="modal-body payroll-import-modal">
      <div className="payroll-import-context"><div><strong>{competenceLabel(competencia)}</strong><span>Os dados só serão gravados depois da prévia e da resolução dos conflitos.</span></div><FileSpreadsheet size={22}/></div>
      <Segmented value={mode} onChange={(value)=>{setMode(value as any);resetFile()}} options={[{value:'template',label:'Modelo Obra na Mão'},{value:'universal',label:'Minha planilha'}]}/>

      {mode==='template'&&<div className="payroll-import-template">
        <div><strong>Modelo padronizado</strong><p>Use a planilha do Obra na Mão para importar funcionários, valores da folha e despesas da empresa com reconhecimento automático.</p></div>
        <Button variant="secondary" icon={<Download size={15}/>} onClick={downloadTemplate}>Baixar modelo Excel</Button>
      </div>}
      {templateResult&&<div className="success-box">Modelo salvo em {templateResult.path}</div>}

      {!file&&<div className="payroll-import-picker"><UploadCloud size={28}/><strong>{mode==='template'?'Selecione o modelo preenchido':'Selecione sua planilha ou CSV'}</strong><span>Nenhum dado será alterado nesta etapa.</span><Button onClick={choose}>Selecionar arquivo</Button></div>}

      {file&&<>
        <div className="payroll-import-filebar"><div><FileSpreadsheet size={17}/><span><strong>{file.file}</strong><small>{selectedSheet?.rows||0} linhas detectadas</small></span></div><Button variant="secondary" onClick={choose}>Trocar arquivo</Button></div>
        <div className="payroll-import-setup">
          <Field label="Aba"><select value={sheet} onChange={event=>setSheet(event.target.value)}>{file.sheets.map((item:any)=><option key={item.name} value={item.name}>{item.name} · {item.rows} linhas</option>)}</select></Field>
          <Field label="Modo"><div className="locked-value">{mode==='template'?'Mapeamento do modelo':'Mapeamento personalizado'}</div></Field>
        </div>

        {mode==='template'&&selectedSheet?.templateScore<10&&<div className="notice"><AlertTriangle size={15}/> Esta aba não parece seguir integralmente o modelo Obra na Mão. Você pode mudar para “Minha planilha” e mapear as colunas.</div>}

        {mode==='universal'&&<div className="payroll-import-mapping"><div className="section-heading"><div><h3>Mapeamento de colunas</h3><p>Confirme de onde vem cada valor. Campos que não existem podem permanecer como “Não importar”.</p></div></div><div className="form-grid form-grid-3">{Object.keys(fieldLabels).map(field=><Field key={field} label={fieldLabels[field]}><select value={mapping[field]||''} onChange={event=>{setMapping({...mapping,[field]:event.target.value});setPreview(null)}}><option value="">Não importar</option>{selectedSheet?.headers?.map((header:string)=><option key={header} value={header}>{header}</option>)}</select></Field>)}</div></div>}

        <div className="payroll-import-actions"><Button variant="secondary" onClick={resetFile}>Cancelar arquivo</Button><Button onClick={generatePreview}>Gerar prévia</Button></div>
      </>}

      {loading&&<div className="payroll-import-loading"><Loading label="Validando planilha e dados existentes..."/></div>}

      {preview&&!loading&&<>
        <div className="payroll-import-stats">
          <div><span>Funcionários</span><strong>{preview.stats.employee_rows}</strong></div>
          <div><span>Despesas da empresa</span><strong>{preview.stats.expense_rows}</strong></div>
          <div><span>Valores encontrados</span><strong>{preview.stats.values}</strong></div>
          <div className={preview.stats.conflicts?'has-conflicts':''}><span>Conflitos</span><strong>{preview.stats.conflicts}</strong></div>
        </div>

        <div className="payroll-import-preview-table"><table><thead><tr><th>Linha</th><th>Destino</th><th>Identificação</th><th>Resumo</th></tr></thead><tbody>{preview.rows.slice(0,10).map((row:any)=><tr key={row.id}><td>{row.row_number}</td><td>{row.kind==='employee'?'Funcionário':'Despesa empresa'}</td><td><strong>{row.kind==='employee'?(row.funcionario||'Sem nome'):row.descricao}</strong>{row.cpf&&<small>CPF {row.cpf}</small>}</td><td>{row.kind==='employee'?<span>{Object.values(row.values||{}).filter((value:any)=>Number(value)>0).length} valores</span>:<span>{brl(row.valor_centavos)}</span>}</td></tr>)}</tbody></table>{preview.rows.length>10&&<small className="payroll-import-more">+ {preview.rows.length-10} linhas na importação</small>}</div>

        {preview.conflicts?.length>0&&<div className="payroll-import-conflicts"><div className="section-heading"><div><h3>Resolver antes de importar</h3><p>Nenhuma divergência será sobrescrita silenciosamente.</p></div><span className="status status-warning">{unresolved.length} pendente(s)</span></div>{preview.conflicts.map((conflict:any)=><div className="payroll-import-conflict" key={conflict.id}><div><strong>{conflict.label}</strong>{conflict.current_centavos!=null&&<small>Atual: {brl(conflict.current_centavos)} · Planilha: {brl(conflict.imported_centavos)}</small>}</div><select value={resolutions[conflict.id]||''} onChange={event=>setResolutions({...resolutions,[conflict.id]:event.target.value})}><option value="">Escolha o que fazer…</option>{conflict.options.map((option:any)=><option key={option.value} value={option.value}>{option.label}</option>)}</select></div>)}</div>}

        <div className="payroll-import-confirm"><div><ShieldText/><span><strong>Prévia validada</strong><small>{unresolved.length?'Resolva os conflitos para liberar a importação.':'A confirmação grava os valores nas fontes canônicas da folha e do Financeiro.'}</small></span></div><Button disabled={unresolved.length>0} onClick={commit}>Confirmar importação</Button></div>
      </>}

      {result&&<div className="payroll-import-result"><CheckCircle2 size={24}/><div><strong>Importação concluída</strong><p>{result.imported_values} valores da folha e {result.imported_expenses} despesas foram gravados. {result.created_employees?result.created_employees+' funcionário(s) criado(s).':''}</p></div></div>}

      {history.length>0&&<div className="payroll-import-history"><div className="section-heading"><div><h3>Importações recentes</h3><p>É possível desfazer enquanto os registros importados não tiverem sido pagos ou alterados.</p></div></div>{history.map((item:any)=><div className="payroll-import-history-row" key={item.id}><div><strong>{item.summary?.file||item.arquivo?.split(/[\\/]/).pop()||'Planilha'}</strong><small>{item.summary?.competencia?competenceLabel(item.summary.competencia):''} · {item.status==='desfeita'?'Desfeita':'Concluída'}</small></div>{item.can_undo&&<Button variant="secondary" icon={<RotateCcw size={14}/>} onClick={()=>undo(item.id)}>Desfazer</Button>}</div>)}</div>}

      {error&&<div className="notice payroll-import-error">{error}</div>}
    </div>
  </Modal>
}

function ShieldText(){return <span className="payroll-import-shield"><CheckCircle2 size={18}/></span>}
