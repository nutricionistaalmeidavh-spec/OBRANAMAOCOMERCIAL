import OperationalSheetGrid,{type SheetColumn,type SheetRow} from './OperationalSheetGrid'
import {Card} from './ui'
import {brl} from '../utils/format'

type Progress={items:any[];contracts:any[];competencia:string}
export default function MeasurementsProgressPanel({progress,obraId}:{progress:Progress;obraId:number}){
  const items:SheetRow[]=progress.items||[]
  const contracts:SheetRow[]=(progress.contracts||[]).map(c=>({...c,id:c.contrato_id}))
  const itemColumns:SheetColumn[]=[
    {key:'descricao',label:'Item do orçamento',width:240},
    {key:'unidade',label:'Unidade'},
    {key:'quantidade_prevista',label:'Quantidade orçada'},
    {key:'quantidade_periodo',label:'Medido no mês'},
    {key:'quantidade_acumulada',label:'Acumulado'},
    {key:'saldo_a_medir',label:'Saldo a medir'},
    {key:'valor_a_faturar',label:'Aprovado a faturar',value:row=>brl(Number(row.valor_a_faturar_centavos||0))}
  ]
  const contractColumns:SheetColumn[]=[
    {key:'numero',label:'Contrato',width:200},
    {key:'total_contratado',label:'Contrato + aditivos aprovados',value:row=>brl(Number(row.total_contratado_centavos||0))},
    {key:'faturado',label:'Faturado',value:row=>brl(Number(row.faturado_centavos||0))},
    {key:'saldo_contratual',label:'Saldo contratual',value:row=>brl(Number(row.saldo_contratual_centavos||0))},
    {key:'aprovado_a_faturar',label:'Aprovado a faturar',value:row=>brl(Number(row.aprovado_a_faturar_centavos||0))}
  ]
  return <div style={{marginTop:14,display:'grid',gap:14}}>
    <Card><div className="card-body"><strong>Mapa de medição — {progress.competencia}</strong><p>Quantidade do período, acumulado e saldo a medir vêm dos itens orçamentários e das medições canônicas não canceladas. O saldo a medir não é saldo contratual.</p></div>
      <OperationalSheetGrid area="medicoes" title="Quantitativos e valores pendentes de faturamento" rows={items} columns={itemColumns} filename={'medicoes-itens-'+obraId} showImport={false}/>
    </Card>
    <Card><div className="card-body"><strong>Saldo contratual por contrato</strong><p>Saldo = contrato + aditivos aprovados menos medições faturadas ou recebidas. Valores de medições aprovadas aguardando faturamento são apresentados separadamente.</p></div>
      <OperationalSheetGrid area="medicoes" title="Contratos e faturamento" rows={contracts} columns={contractColumns} filename={'medicoes-contratos-'+obraId} showImport={false}/>
    </Card>
  </div>
}
