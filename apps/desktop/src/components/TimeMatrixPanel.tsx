import {useState} from 'react'
import OperationalSheetGrid,{type SheetColumn,type SheetRow} from './OperationalSheetGrid'
import {Card,Field,Loading} from './ui'
import {useAsync} from '../hooks/useAsync'

const pointTypes=[
  {value:'',label:'Sem registro'},{value:'trabalho',label:'Trabalho'},
  {value:'falta',label:'Falta'},{value:'ferias',label:'Férias'},
  {value:'feriado',label:'Feriado'},{value:'folga',label:'Folga'},
  {value:'afastado',label:'Afastamento'},{value:'sabado',label:'Sábado'},
  {value:'domingo',label:'Domingo'}
]
function hours(row:SheetRow){
  if(row.tipo!=='trabalho')return '—'
  const keys=['entrada','intervalo_saida','intervalo_entrada','saida']
  const values=keys.map(k=>{
    const t=String(row[k]||'')
    if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(t))return null
    const [h,m]=t.split(':').map(Number)
    return h*60+m
  })
  if(values.some(v=>v===null))return '—'
  const [start,morningEnd,afternoonStart,end]=values as number[]
  if(morningEnd<start||afternoonStart<morningEnd||end<afternoonStart)return '—'
  return ((morningEnd-start+end-afternoonStart)/60).toLocaleString('pt-BR',{maximumFractionDigits:2})
}
const columns:SheetColumn[]=[
  {key:'funcionario_nome',label:'Funcionário',width:220},
  {key:'data',label:'Dia'},
  {key:'tipo',label:'Ocorrência',edit:true,kind:'select',options:pointTypes},
  {key:'entrada',label:'Entrada',edit:true},
  {key:'intervalo_saida',label:'Saída almoço',edit:true},
  {key:'intervalo_entrada',label:'Volta almoço',edit:true},
  {key:'saida',label:'Saída',edit:true},
  {key:'horas',label:'Horas reais',value:hours},
  {key:'observacoes',label:'Exceções/observações',edit:true,width:235}
]
export default function TimeMatrixPanel({competencia,refresh}:{competencia:string;refresh:()=>void}){
  const [empresaId,setEmpresaId]=useState('')
  const [obraId,setObraId]=useState('')
  const [revision,setRevision]=useState(0)
  const state=useAsync(()=>window.fluxoDre.storage.moduleState('rh'),[])
  const companies=useAsync(()=>window.fluxoDre.empresas.list(),[])
  const works=useAsync(()=>window.fluxoDre.obras.list(empresaId?{empresa_id:Number(empresaId)}:{}),[empresaId])
  const ready=!!state.data&&state.data.state!=='central-ready'
  const sheet=useAsync(()=>ready?window.fluxoDre.operationalSheet.p1TimeMatrix({
    competencia,...(obraId?{obraId:Number(obraId)}:{}),...(empresaId?{empresaId:Number(empresaId)}:{})
  }):Promise.resolve({rows:[],employeeCount:0,truncated:false}),
  [ready,competencia,empresaId,obraId,revision])
  const save=async(changed:SheetRow[])=>{
    await window.fluxoDre.operationalSheet.p1TimeCommit({competencia,
      ...(empresaId?{empresaId:Number(empresaId)}:{}),
      ...(obraId?{obraId:Number(obraId)}:{}),
      rows:changed.map(row=>({funcionario_id:Number(row.funcionario_id),data:String(row.data),
        tipo:String(row.tipo||''),entrada:String(row.entrada||''),
        intervalo_saida:String(row.intervalo_saida||''),intervalo_entrada:String(row.intervalo_entrada||''),
        saida:String(row.saida||''),observacoes:String(row.observacoes||''),
        updated_at:String(row.updated_at||''),pointRevision:row.pointRevision??null }))
    })
    setRevision(n=>n+1);refresh()
  }
  return <Card style={{marginTop:14}}>
    <div className="card-header"><div><h2>Matriz mensal de ponto e equipe</h2>
      <p>Uma linha por funcionário e dia. Horas são derivadas das quatro marcações; faltas e exceções não recebem horas inventadas.</p></div></div>
    <div className="card-body form-grid">
      <Field label="Empresa"><select value={empresaId} onChange={e=>{setEmpresaId(e.target.value);setObraId('')}}><option value="">Todas</option>{companies.data?.map((c:any)=><option key={c.id} value={c.id}>{c.nome_fantasia||c.razao_social}</option>)}</select></Field>
      <Field label="Obra"><select value={obraId} onChange={e=>setObraId(e.target.value)}><option value="">Todas as obras</option>{works.data?.map((w:any)=><option key={w.id} value={w.id}>{w.nome}</option>)}</select></Field>
    </div>
    {state.loading?<Loading label="Verificando disponibilidade da matriz..."/>:
      !ready?<p className="notice" role="status">Conclua a ativação do armazenamento central antes de usar a matriz de ponto.</p>:
      sheet.loading?<Loading label="Carregando marcações e exceções da competência..."/>:
      sheet.error?<p role="alert" className="notice">{sheet.error.message}</p>:
      <>
        <p className="card-body" style={{fontSize:12}}>{sheet.data?.employeeCount||0} funcionários e {sheet.data?.rows?.length||0} dias na matriz. {sheet.data?.truncated?'A consulta foi limitada aos primeiros 60 funcionários; filtre empresa ou obra para ver os demais.':''}</p>
        <OperationalSheetGrid key={competencia+'-'+empresaId+'-'+obraId} area="ponto" title="Planilha mensal de marcações" rows={sheet.data?.rows||[]} columns={columns}
          filename={'ponto-'+competencia} showImport={false} onCommit={save}
          disabledReason={undefined} canEditRow={row=>['sem_ficha','rascunho','preenchido'].includes(String(row.ponto_status))}/>
      </>}
  </Card>
}
