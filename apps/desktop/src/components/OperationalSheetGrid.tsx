import { useMemo, useState, type ClipboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { Check, Download, FileSpreadsheet, RotateCcw, UploadCloud } from 'lucide-react'
import { Button } from './ui'
import { parseBrDecimal } from '../utils/operational-sheet'

export type SheetRow = { id: string | number; [key:string]: unknown }
export type SheetColumn = {
  key:string
  label:string
  edit?:boolean
  kind?:'text'|'decimal'|'money'|'date'|'select'
  options?:Array<{value:string;label:string}>
  value?:(row:SheetRow)=>string|number
  exportValue?:(row:SheetRow)=>string|number
  render?:(row:SheetRow)=>string
  width?:number
}

export function pasteCells(text:string):string[][] {
  return String(text).replace(/\r\n/g,'\n').replace(/\r/g,'\n').replace(/\n$/,'').split('\n').map(line=>line.split('\t'))
}
function textValue(raw:unknown) { return raw===null||raw===undefined?'':String(raw) }
function asExportRow(row:SheetRow, columns:SheetColumn[]) {
  return Object.fromEntries(columns.map(column=>{
    const value=column.exportValue?column.exportValue(row):column.value?column.value(row):row[column.key]??''
    if(column.kind==='money'||column.kind==='decimal'){
      const number=parseBrDecimal(value)
      if(number!==null)return [column.key,number]
    }
    return [column.key,value]
  }))
}

type Props = {
  title:string
  area:'orcamento'|'estoque'|'compras'|'financeiro'|'folha'|'cronograma'|'etapas'|'subetapas'|'medicoes'|'ponto'
  rows:SheetRow[]
  columns:SheetColumn[]
  companyId?:string|number|null
  importArea?:string
  filename?:string
  onCommit?:(rows:SheetRow[])=>Promise<void>
  onRowAction?:(row:SheetRow)=>void
  rowActionLabel?:string
  onSaved?:()=>void
  allowTemplate?:boolean
  disabledReason?:string
  canEditRow?:(row:SheetRow)=>boolean
  commitLabel?:string
  commitSuccessMessage?:string
  showImport?:boolean
}
export default function OperationalSheetGrid({
  title,area,rows,columns,companyId,importArea,filename,onCommit,onRowAction,
  rowActionLabel='Abrir',onSaved,allowTemplate=false,disabledReason,canEditRow,commitLabel='Salvar',commitSuccessMessage,showImport=true
}:Props) {
  const [drafts,setDrafts]=useState<Record<string,Record<string,string>>>({})
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [message,setMessage]=useState('')
  // Preferência visual por planilha, nunca representa uma cópia dos registros canônicos.
  const filterKey='obranamao:sheet-filter:'+area+':'+(filename||title)
  const [filter,setFilter]=useState(()=>{
    try{return typeof window==='undefined'?'':(window.localStorage.getItem(filterKey)||'')}
    catch{return ''}
  })
  const [page,setPage]=useState(1)
  const pageSize=120
  const changed=Object.keys(drafts).length
  const view=useMemo(()=>rows.map(row=>({...row,...(drafts[String(row.id)]||{})})),[rows,drafts])
  const filtered=useMemo(()=>view.filter(row=>!filter||columns.some(column=>textValue(row[column.key]).toLowerCase().includes(filter.toLowerCase()))),[view,columns,filter])
  const pages=Math.max(1,Math.ceil(filtered.length/pageSize))
  const currentPage=Math.min(page,pages)
  const visibleRows=filtered.slice((currentPage-1)*pageSize,currentPage*pageSize)
  const update=(row:SheetRow,key:string,value:string)=>{
    if(busy)return
    setDrafts(current=>({...current,[String(row.id)]:{...(current[String(row.id)]||{}),[key]:value}}))
    setError('')
    setMessage('')
  }
  const paste=(event:ClipboardEvent<HTMLInputElement>,row:SheetRow,columnIndex:number)=>{
    const matrix=pasteCells(event.clipboardData.getData('text/plain'))
    if(matrix.length===1&&matrix[0].length===1)return
    event.preventDefault()
    const rowIndex=visibleRows.findIndex(item=>item.id===row.id)
    if(rowIndex<0)return
    setDrafts(current=>{
      const next={...current}
      matrix.slice(0,Math.max(0,visibleRows.length-rowIndex)).forEach((line,r)=>{
        const target=visibleRows[rowIndex+r]
        const patch={...(next[String(target.id)]||{})}
        line.forEach((value,c)=>{
          const column=columns[columnIndex+c]
          if(column?.edit && (!canEditRow||canEditRow(target)))patch[column.key]=value
        })
        if(Object.keys(patch).length)next[String(target.id)]=patch
      })
      return next
    })
  }
  const commit=async()=>{
    if(!onCommit||!changed||busy)return
    setBusy(true);setError('');setMessage('')
    try {
      const selected=view.filter(row=>drafts[String(row.id)])
      await onCommit(selected)
      setDrafts({})
      setMessage(commitSuccessMessage||selected.length+' linha(s) atualizada(s).')
      onSaved?.()
    }catch(e){setError(e instanceof Error?e.message:'Não foi possível gravar as alterações. Nenhum sucesso foi confirmado.')}
    finally{setBusy(false)}
  }
  const exportAs=async(format:'xlsx'|'csv')=>{
    setBusy(true);setError('');setMessage('')
    try {
      const out=await window.fluxoDre.operationalSheet.exportFile({
        area,format,filename:filename||area,
        columns:columns.map(({key,label})=>({key,label})),
        rows:view.map(row=>asExportRow(row,columns))
      })
      if(out?.path)setMessage('Arquivo exportado'+(changed?' com alterações de rascunho ainda não gravadas':'')+': '+out.path)
    }catch(e){setError(e instanceof Error?e.message:'Não foi possível exportar.')}
    finally{setBusy(false)}
  }
  const downloadTemplate=async()=>{
    setBusy(true);setError('');setMessage('')
    try{const saved=await window.fluxoDre.importadorUniversal.template(importArea||area);if(saved?.path)setMessage('Modelo salvo: '+saved.path)}
    catch(e){setError(e instanceof Error?e.message:'Falha ao gerar modelo.')}
    finally{setBusy(false)}
  }
  const params=new URLSearchParams({area:importArea||area,...(companyId?{empresa:String(companyId)}:{})}).toString()
  return <section className="operational-sheet" aria-label={title} style={{marginTop:14}}>
    <div className="card-header" style={{gap:10,flexWrap:'wrap'}}>
      <div><h2>{title}</h2><p>Planilha conectada aos registros do sistema · {rows.length} linha(s).</p></div>
      <div className="row-actions" style={{flexWrap:'wrap'}}>
        {showImport&&!disabledReason&&<Link className="button button-secondary" to={'/importacao?'+params}><UploadCloud size={14}/> Importar</Link>}
        {allowTemplate&&<Button type="button" variant="secondary" disabled={busy} onClick={downloadTemplate}><FileSpreadsheet size={14}/> Modelo</Button>}
        <Button type="button" variant="secondary" disabled={busy} onClick={()=>exportAs('xlsx')}><Download size={14}/> Excel</Button>
        <Button type="button" variant="secondary" disabled={busy} onClick={()=>exportAs('csv')}>CSV</Button>
      </div>
    </div>
    <div className="card-body" style={{paddingBottom:8,display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
      <input aria-label={'Filtrar '+title} placeholder="Buscar na planilha..." value={filter} onChange={event=>{
          const value=event.target.value
          setFilter(value);setPage(1)
          try{window.localStorage.setItem(filterKey,value)}catch{/* armazenamento de preferência é opcional */}
        }} style={{minWidth:220,flex:1,maxWidth:460}}/>
      {filter&&<Button type="button" variant="secondary" onClick={()=>{setFilter('');setPage(1);try{window.localStorage.removeItem(filterKey)}catch{/* armazenamento opcional */}}}>Limpar filtro</Button>}
      {onCommit&&<><Button type="button" disabled={!changed||busy||!!disabledReason} onClick={()=>void commit()}><Check size={14}/> {busy?'Processando...':commitLabel+' '+changed+' linha(s)'}</Button><Button type="button" variant="secondary" disabled={!changed||busy} onClick={()=>{setDrafts({});setError('');setMessage('Alterações descartadas.')}}><RotateCcw size={14}/> Descartar</Button></>}
    </div>
    {disabledReason&&<div className="notice" role="status">{disabledReason}</div>}
    {error&&<div className="notice" role="alert">{error}</div>}
    {message&&<div className="success-box" role="status">{message}</div>}
    <div className="table-wrap" style={{maxHeight:510,overflow:'auto'}}>
      <table className="data-table" style={{minWidth:Math.max(720,columns.length*145)}}>
        <thead><tr>{columns.map(column=><th key={column.key} style={{minWidth:column.width||120,position:'sticky',top:0,background:'var(--surface,#fff)',zIndex:1}}>{column.label}{column.edit?' *':''}</th>)}{onRowAction&&<th>Ação</th>}</tr></thead>
        <tbody>{visibleRows.map((row,index)=><tr key={row.id}>
          {columns.map((column,colIndex)=>{
            const raw=column.value?column.value(row):row[column.key]
            const editable=!!onCommit && column.edit && !disabledReason && (!canEditRow||canEditRow(row))
            return <td key={column.key}>
              {editable && column.kind==='select' ?
                <select value={textValue(raw)} disabled={busy} onChange={event=>update(row,column.key,event.target.value)} aria-label={column.label+' linha '+(index+1)}>
                  {(column.options||[]).map(option=><option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              :editable ?
                <input value={textValue(raw)} disabled={busy} type={column.kind==='date'?'date':'text'} inputMode={column.kind==='decimal'||column.kind==='money'?'decimal':'text'} aria-label={column.label+' linha '+(index+1)} onPaste={event=>paste(event,row,colIndex)} onChange={event=>update(row,column.key,event.target.value)} style={{width:'100%',minWidth:96}}/>
              :<span>{column.render?column.render(row):textValue(raw)||'—'}</span>}
            </td>
          })}
          {onRowAction&&<td><Button type="button" variant="secondary" onClick={()=>onRowAction(row)}>{rowActionLabel}</Button></td>}
        </tr>)}</tbody>
      </table>
      {!rows.length&&<p style={{padding:16}}>Nenhuma linha para esta seleção. Importe ou cadastre registros para começar.</p>}
      {rows.length>0&&filtered.length===0&&<p style={{padding:16}}>Nenhuma linha corresponde ao filtro.</p>}
    </div>
    {pages>1&&<div className="row-actions" style={{alignItems:'center',justifyContent:'flex-end',padding:10,gap:10}}><span>Linhas {((currentPage-1)*pageSize)+1}–{Math.min(currentPage*pageSize,filtered.length)} de {filtered.length}</span><Button type="button" variant="secondary" disabled={currentPage===1} onClick={()=>setPage(v=>Math.max(1,v-1))}>Anterior</Button><Button type="button" variant="secondary" disabled={currentPage===pages} onClick={()=>setPage(v=>Math.min(pages,v+1))}>Próxima</Button></div>}
    {onCommit&&<p className="card-body" style={{fontSize:12,paddingTop:8}}>Células marcadas com * podem ser editadas. Alterações são conferidas antes de gravar; campos derivados permanecem protegidos. Cole linhas do Excel em uma célula para preencher várias posições.</p>}
  </section>
}
