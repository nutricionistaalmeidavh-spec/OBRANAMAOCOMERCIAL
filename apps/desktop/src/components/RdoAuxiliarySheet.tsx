import {useMemo} from 'react'
import OperationalSheetGrid,{type SheetColumn,type SheetRow} from './OperationalSheetGrid'
import {parseBrDecimal} from '../utils/operational-sheet'

type Section='equipe'|'equipamentos'
type Props={
  section:Section
  rows:any[]
  fronts:any[]
  employees:any[]
  rdoId?:number|string|null
  onApply:(patches:Map<number,Record<string,unknown>>)=>void
  onDraftChange:(dirty:boolean)=>void
}
export default function RdoAuxiliarySheet({section,rows,fronts,employees,rdoId,onApply,onDraftChange}:Props){
  // IDs destas linhas são índices temporários: somente o formulário do RDO grava.
  const sheetRows:SheetRow[]=useMemo(()=>rows.map((item,index)=>({...item,id:index+1})),[rows])
  const common:SheetColumn[]=[
    {key:'nome',label:section==='equipe'?'Pessoa':'Equipamento',edit:true,width:200},
    {key:'etapa',label:'Etapa',value:row=>fronts.find(f=>Number(f.id)===Number(row.frente_id))?.nome||'Etapa principal'},
  ]
  const columns:SheetColumn[]=section==='equipe'?
    [...common,
      {key:'vinculo',label:'Cadastro RH',value:row=>employees.find(e=>Number(e.id)===Number(row.funcionario_id))?.nome||'Avulso/terceiro'},
      {key:'funcao',label:'Função',edit:true},
      {key:'horas',label:'Horas',edit:true,kind:'decimal'},
      {key:'custo',label:'Custo (R$)',edit:true,kind:'money'},
      {key:'observacoes',label:'Observações',edit:true,width:230}
    ]:
    [...common,
      {key:'horas_uso',label:'Horas de uso',edit:true,kind:'decimal'},
      {key:'custo',label:'Custo (R$)',edit:true,kind:'money'},
      {key:'observacoes',label:'Observações',edit:true,width:230}
    ]
  const apply=async(changed:SheetRow[])=>{
    const cleaned=await window.fluxoDre.operationalSheet.p2StageRdo({area:section,rows:changed})
    const updates=new Map<number,Record<string,unknown>>()
    for(const row of cleaned){
      const {id,...patch}=row
      updates.set(Number(id),patch)
    }
    onApply(updates)
  }
  const hours=rows.reduce((sum,row)=>sum+(parseBrDecimal(section==='equipe'?row.horas:row.horas_uso)||0),0)
  const cost=rows.reduce((sum,row)=>sum+(parseBrDecimal(row.custo)||0),0)
  return <div style={{marginTop:10}}>
    <p style={{fontSize:12,marginBottom:8}}>Planilha auxiliar do RDO. Alterações serão aplicadas ao formulário; para gravar os registros canônicos, confirme <strong>Salvar RDO</strong>. A escolha do funcionário e da etapa continua no formulário, para manter os vínculos corretos.</p>
    <OperationalSheetGrid key={section+'-'+String(rdoId||'novo')} area="rdo"
      title={section==='equipe'?'Equipe no dia':'Equipamentos no dia'}
      rows={sheetRows} columns={columns} filename={'rdo-'+section+'-'+String(rdoId||'novo')}
      showImport={false} onCommit={apply} onDraftChange={onDraftChange}
      commitLabel="Aplicar" commitSuccessMessage="Rascunho aplicado. Confirme Salvar RDO para gravar."/>
    <p style={{fontSize:12,marginTop:8}}>Total exibido no formulário: {hours.toLocaleString('pt-BR',{maximumFractionDigits:2})} horas · R$ {cost.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}. Valores derivados do rascunho, não lançamentos financeiros adicionais.</p>
  </div>
}
