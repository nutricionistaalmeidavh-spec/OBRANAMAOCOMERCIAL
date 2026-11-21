import {useState} from 'react'
import {Plus} from 'lucide-react'
import OperationalSheetGrid,{type SheetColumn,type SheetRow} from './OperationalSheetGrid'
import {Button,Card} from './ui'

type Props={
  obraId:number
  selectedFront:number|null
  fronts:any[]
  subfronts:any[]
  operationState?:string
  onSaved:()=>void
  onSubSaved:()=>void
}
const stageStatuses=[{value:'ativa',label:'Ativa'},{value:'pausada',label:'Pausada'},{value:'concluida',label:'Concluída'}]
const frontColumns:SheetColumn[]=[
  {key:'nome',label:'Etapa',edit:true,width:200},{key:'codigo',label:'Código',edit:true},
  {key:'ordem',label:'Ordem',edit:true,kind:'decimal'},
  {key:'status',label:'Situação',edit:true,kind:'select',options:stageStatuses},
  {key:'observacoes',label:'Observações',edit:true,width:240}
]
const subColumns:SheetColumn[]=[
  {key:'nome',label:'Subetapa',edit:true,width:210},
  {key:'codigo',label:'Código',edit:true},{key:'pavimento',label:'Pavimento',edit:true},
  {key:'escopo',label:'Escopo',edit:true,width:250},
  {key:'ordem',label:'Ordem',edit:true,kind:'decimal'},
  {key:'status',label:'Situação',edit:true,kind:'select',options:stageStatuses}
]
const isNew=(id:unknown)=>String(id).startsWith('novo-')
const convertId=(id:unknown)=>isNew(id)?null:Number(id)
export default function StagesSheetPanel({obraId,selectedFront,fronts,subfronts,operationState,onSaved,onSubSaved}:Props){
  const [newFronts,setNewFronts]=useState<SheetRow[]>([])
  const [newSubs,setNewSubs]=useState<SheetRow[]>([])
  const disabledReason=operationState&&!['local','migration-required'].includes(operationState)
    ?'Edição coletiva disponível somente no modo local homologado. Utilize o cadastro individual no servidor.':undefined
  const addFront=()=>setNewFronts(rows=>[...rows,{id:'novo-etapa-'+(rows.length+1),nome:'',codigo:'',ordem:fronts.length+rows.length+1,status:'ativa',observacoes:''}])
  const addSub=()=>setNewSubs(rows=>[...rows,{id:'novo-sub-'+(rows.length+1),nome:'',codigo:'',pavimento:'Geral',escopo:'',ordem:subfronts.length+rows.length+1,status:'ativa',frente_id:selectedFront}])
  const saveFronts=async(changed:SheetRow[])=>{
    const rows=changed.map(row=>({id:convertId(row.id),nome:String(row.nome||''),codigo:String(row.codigo||''),
      ordem:Number(row.ordem),status:String(row.status),observacoes:String(row.observacoes||''),
      updated_at:String(row.updated_at||'')}))
    await window.fluxoDre.operationalSheet.p1Commit({area:'etapas',obraId,rows})
    setNewFronts([]);onSaved()
  }
  const saveSubs=async(changed:SheetRow[])=>{
    if(!selectedFront)throw new Error('Selecione a etapa de origem.')
    const rows=changed.map(row=>({id:convertId(row.id),frente_id:selectedFront,nome:String(row.nome||''),
      codigo:String(row.codigo||''),pavimento:String(row.pavimento||''),
      escopo:String(row.escopo||''),ordem:Number(row.ordem),status:String(row.status),
      updated_at:String(row.updated_at||'')}))
    await window.fluxoDre.operationalSheet.p1Commit({area:'subetapas',obraId,rows})
    setNewSubs([]);onSubSaved()
  }
  return <div style={{display:'grid',gap:14,marginTop:14}}>
    <Card>
      <div className="card-header"><div><h2>Cadastro de etapas em lote</h2><p>As linhas novas e as alterações são confirmadas em uma única transação local.</p></div>
        <Button type="button" variant="secondary" icon={<Plus size={15}/>} disabled={!!disabledReason} onClick={addFront}>Adicionar etapa</Button>
      </div>
      <OperationalSheetGrid area="etapas" title="Planilha de etapas" rows={[...fronts,...newFronts]}
        columns={frontColumns} filename={'etapas-obra-'+obraId} showImport={false}
        onCommit={saveFronts} disabledReason={disabledReason}/>
    </Card>
    {selectedFront&&<Card key={selectedFront}>
      <div className="card-header"><div><h2>Subetapas da etapa selecionada</h2><p>A etapa de origem permanece protegida para preservar os vínculos existentes.</p></div>
        <Button type="button" variant="secondary" icon={<Plus size={15}/>} disabled={!!disabledReason} onClick={addSub}>Adicionar subetapa</Button>
      </div>
      <OperationalSheetGrid key={selectedFront} area="subetapas" title="Planilha de subetapas"
        rows={[...subfronts,...newSubs.filter(row=>Number(row.frente_id)===selectedFront)]}
        columns={subColumns} filename={'subetapas-'+selectedFront} showImport={false}
        onCommit={saveSubs} disabledReason={disabledReason}/>
    </Card>}
  </div>
}
