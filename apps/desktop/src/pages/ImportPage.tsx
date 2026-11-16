import { CheckCircle2, FileSpreadsheet, ShieldCheck, UploadCloud } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button, Card, Empty, Field, Loading, PageHeader, Segmented } from '../components/ui'
import { brl, competenceLabel } from '../utils/format'
import { useAsync } from '../hooks/useAsync'

const labels:any={financeiro:'Financeiro',obras:'Obras',orcamento:'Orcamento',funcionarios:'Funcionarios',compras:'Compras',contratos:'Contratos',aditivos:'Aditivos',medicoes:'Medicoes',ponto:'Ponto',documentos:'Documentos',estoque:'Estoque'}
export default function ImportPage() {
  const [mode, setMode] = useState('universal')
  const [preview, setPreview] = useState<any>(null)
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [file, setFile] = useState<any>(null)
  const [sheet, setSheet] = useState('')
  const [area, setArea] = useState('financeiro')
  const [mapping, setMapping] = useState<any>({})
  const [companyId, setCompanyId] = useState('')
  const companies = useAsync(() => window.fluxoDre.empresas.list(), [])
  const universal = mode === 'universal'

  const legacyChoose = async () => {
    setLoading(true); setError('')
    try { setPreview(await window.fluxoDre.importacoes.preview()); setResult(null) }
    catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }
  const legacyCommit = async () => {
    setLoading(true); setError('')
    try { setResult(await window.fluxoDre.importacoes.commit(preview.token)); setPreview(null) }
    catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }
  const choose = async () => {
    if (!companyId) { setError('Selecione a empresa de destino antes de importar.'); return }
    setLoading(true); setError(''); setPreview(null)
    try {
      const selected = await window.fluxoDre.importadorUniversal.choose()
      setFile(selected); setResult(null); setMapping({})
      if (selected) {
        const first = selected.sheets[0]
        if (!first) throw new Error('A planilha não possui abas com dados.')
        setSheet(first.name); setArea(first.area)
      }
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => {
    if (!file || !sheet || !companyId || !universal) return
    let active = true
    setPreview(null); setLoading(true); setError('')
    window.fluxoDre.importadorUniversal.preview(file.token, { sheet, area, companyId, mappingOnly: true })
      .then(data => { if (active) setMapping(data.mapping) })
      .catch((e: Error) => { if (active) setError(e.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [file?.token, sheet, area, companyId, universal])

  const universalPreview = async (page = 1) => {
    if (!file || !companyId) { setError('Selecione uma empresa e uma planilha.'); return }
    setLoading(true); setError('')
    try {
      setPreview(await window.fluxoDre.importadorUniversal.preview(file.token, { sheet, area, mapping, companyId, page, pageSize: 25 }))
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }
  const universalCommit = async () => {
    if (!file || !companyId || !preview || preview.missing.length || preview.invalid || !preview.total) return
    setLoading(true); setError('')
    try {
      setResult(await window.fluxoDre.importadorUniversal.commit(file.token, { sheet, area, mapping, companyId }))
      setPreview(null); setFile(null)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }
  return <>
    <PageHeader
      title={universal ? 'Importador universal' : 'Importar planilha 2026'}
      description={universal ? 'Importe Excel ou CSV para a empresa escolhida, com revisão de todas as linhas.' : 'Assistente auditável da planilha histórica com aba 2026.'}
      actions={<Button icon={<UploadCloud size={16}/>} disabled={loading || (universal && !companyId)} onClick={universal ? choose : legacyChoose}>Selecionar planilha</Button>}
    />
    <Segmented options={[{value:'universal',label:'Importador universal'},{value:'legado',label:'Modelo 2026'}]} value={mode} onChange={(value) => {
      setMode(value); setPreview(null); setResult(null); setError('')
    }}/>
    {universal && <Card style={{marginTop:14}}>
      <div className="card-body">
        <Field label="Empresa de destino" required>
          <select value={companyId} disabled={companies.loading || loading} onChange={(event) => {
            setCompanyId(event.target.value); setPreview(null); setResult(null)
          }}>
            <option value="">Selecione a empresa antes de importar</option>
            {companies.data?.filter(company => company.status !== 'inativa').map(company =>
              <option key={company.id} value={company.id}>{company.nome_fantasia || company.razao_social}</option>
            )}
          </select>
        </Field>
        {companies.error && <div className="notice">Não foi possível carregar as empresas: {companies.error.message}</div>}
        <p>Os dados serão gravados somente na empresa selecionada, após validação da prévia.</p>
      </div>
    </Card>}
    {loading ? <Card style={{marginTop:14}}><Loading label="Lendo e validando a planilha..."/></Card>
      : result ? <Result result={result} universal={universal}/>
      : universal ? file
        ? <UniversalSetup file={file} sheet={sheet} area={area} mapping={mapping}
            setSheet={(value: string) => { setSheet(value); setPreview(null) }}
            setArea={(value: string) => { setArea(value); setPreview(null) }}
            setMapping={(value: any) => { setMapping(value); setPreview(null) }}
            onPreview={() => universalPreview(1)}/>
        : <Card style={{marginTop:14}}><Empty title="Pronto para reconhecer sua planilha" description="Selecione uma empresa e depois um Excel ou CSV. Nenhum dado será criado antes da confirmação." action={<Button disabled={!companyId} onClick={choose}>Selecionar arquivo</Button>}/></Card>
      : preview ? <LegacyPreview preview={preview} commit={legacyCommit}/>
      : <Card style={{marginTop:14}}><Empty title="Pronto para importar o modelo 2026" description="O assistente legado continua disponível para a planilha de despesas atual." action={<Button onClick={legacyChoose}>Selecionar arquivo</Button>}/></Card>}
    {preview && universal && !loading && <UniversalPreview preview={preview} mapping={mapping} onCommit={universalCommit} onPage={universalPreview}/>}
    {error && <div className="notice" style={{marginTop:12}}>{error}</div>}
  </>
}
function UniversalSetup({file,sheet,area,mapping,setSheet,setArea,setMapping,onPreview}:any){
  const selectedSheet=file.sheets.find((item:any)=>item.name===sheet)
  return <Card style={{marginTop:14}}>
    <div className="card-header">
      <div><h2>{file.file}</h2><p>Escolha a aba, confirme o destino e associe as colunas da planilha.</p></div>
      <Button onClick={onPreview}>Gerar prévia</Button>
    </div>
    <div className="modal-body form-grid form-grid-3">
      <Field label="Aba"><select value={sheet} onChange={(event)=>setSheet(event.target.value)}>
        {file.sheets.map((item:any)=><option key={item.name} value={item.name}>{item.name} · {item.rows} linhas</option>)}
      </select></Field>
      <Field label="Área de destino"><select value={area} onChange={(event)=>setArea(event.target.value)}>
        {Object.entries(labels).map(([key,label])=><option key={key} value={key}>{String(label)}</option>)}
      </select></Field>
      <Field label="Detecção"><div className="locked-value">{labels[selectedSheet?.area] || 'Sem sugestão'}</div></Field>
    </div>
    <div className="card-body">
      <h3>Mapeamento de colunas</h3>
      <p>Para cada campo do sistema, selecione a coluna correspondente na sua planilha. Campos obrigatórios não mapeados serão apontados na prévia.</p>
      <div className="form-grid form-grid-3">
        {Object.entries(mapping).map(([field])=><Field key={field} label={field.replaceAll('_',' ')}>
          <select aria-label={`Coluna de origem para ${field}`} value={mapping[field] || ''} onChange={(event)=>setMapping({ ...mapping, [field]: event.target.value })}>
            <option value="">Coluna de origem: não mapear</option>
            {selectedSheet.headers.map((header:string)=><option key={header} value={header}>{header}</option>)}
          </select>
        </Field>)}
      </div>
    </div>
  </Card>
}
function UniversalPreview({preview,mapping,onCommit,onPage}:any){
  const headers=Object.values(mapping).filter(Boolean).slice(0,6) as string[]
  const blocked=preview.missing.length>0 || preview.invalid>0 || preview.total===0
  return <>
    <div className="kpi-grid" style={{gridTemplateColumns:'repeat(3,1fr)',marginTop:14}}>
      <Card className="kpi"><FileSpreadsheet/><div><span>Linhas encontradas</span><strong>{preview.total}</strong><small>Conferência de toda a aba</small></div></Card>
      <Card className="kpi"><ShieldCheck/><div><span>Aptas a importar</span><strong>{preview.importable}</strong></div></Card>
      <Card className="kpi"><div><span>Linhas com erro</span><strong>{preview.invalid}</strong></div></Card>
    </div>
    <Card>
      <div className="card-header">
        <div><h2>Prévia — {preview.companyName}</h2><p>Destino: {preview.label} · Página {preview.page} de {preview.pages}.</p></div>
        <Button disabled={blocked} onClick={onCommit}>Confirmar importação</Button>
      </div>
      <div className="card-body">
        <div className="notice">A confirmação processa todas as {preview.total} linhas conferidas, não apenas as exibidas nesta página.</div>
        {preview.missing.length>0 && <div className="notice">Campos obrigatórios sem mapeamento: {preview.missing.join(', ')}.</div>}
        {preview.invalid>0 && <div className="notice">{preview.invalid} linha(s) precisam de correção na planilha original antes de importar. Selecione o arquivo corrigido novamente.</div>}
        {preview.issues?.length>0 && <div className="notice">Primeiras divergências: {preview.issues.map((issue:any) => 'linha '+issue.line+': '+issue.errors.join(', ')).join('; ')}</div>}
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Linha</th>{headers.map((header)=><th key={header}>{header}</th>)}<th>Validação</th></tr></thead>
          <tbody>{preview.rows.map((row:any,index:number)=><tr key={preview.rowNumbers[index]}>
            <td>{preview.rowNumbers[index]}</td>
            {headers.map((header)=><td key={header}>{String(row[header]??'')}</td>)}
            <td>{preview.rowErrors[index]?.length ? preview.rowErrors[index].join('; ') : 'Apta'}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="toolbar" style={{marginTop:14,justifyContent:'flex-end'}}>
        <Button variant="secondary" disabled={preview.page<=1} onClick={()=>onPage(preview.page-1)}>Anterior</Button>
        <Button variant="secondary" disabled={preview.page>=preview.pages} onClick={()=>onPage(preview.page+1)}>Próxima</Button>
      </div>
    </Card>
  </>
}
function LegacyPreview({preview,commit}:any){return <><div className="kpi-grid" style={{gridTemplateColumns:'repeat(3,1fr)',marginTop:14}}><Card className="kpi"><FileSpreadsheet/><div><span>Arquivo</span><strong style={{fontSize:13}}>{preview.file}</strong></div></Card><Card className="kpi"><ShieldCheck/><div><span>Aba validada</span><strong>2026</strong><small>{preview.range}</small></div></Card><Card className="kpi"><div><span>Funcionários encontrados</span><strong>{preview.employees.length}</strong></div></Card></div><Card><div className="card-header"><h2>Prévia dos blocos mensais</h2><Button onClick={commit}>Confirmar importação</Button></div><div className="card-body"><div className="import-months">{preview.months.map((m:any)=><div className="import-month" key={m.competencia}><strong>{competenceLabel(m.competencia)}</strong><span>{m.funcionarios} funcionários · {m.despesas} despesas · {m.receitas} receitas</span></div>)}</div></div></Card></>}
function Result({result,universal}:any){if(universal)return <Card style={{marginTop:14}}><div className="state"><CheckCircle2 style={{color:'#159a76'}}/><strong>Importação concluída</strong><p>{result.imported} linhas de {labels[result.area]} foram processadas e {result.created} cadastros ausentes foram criados.</p></div></Card>;return <Card style={{marginTop:14}}><div className="state"><CheckCircle2 style={{color:'#159a76'}}/><strong>Importação concluída</strong><p>{result.imported} lançamentos e {result.employees} funcionários foram normalizados.</p></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Competência</th><th className="number">Receitas importadas</th><th className="number">Despesas importadas</th></tr></thead><tbody>{result.reconciliation.map((item:any)=><tr key={item.competencia}><td>{competenceLabel(item.competencia)}</td><td className="number">{brl(item.importado_receitas)}</td><td className="number">{brl(item.importado_despesas)}</td></tr>)}</tbody></table></div></Card>}
