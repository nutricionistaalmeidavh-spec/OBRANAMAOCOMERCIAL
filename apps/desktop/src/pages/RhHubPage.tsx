import { BriefcaseBusiness, CalendarClock, FileArchive, UsersRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Card, PageHeader } from '../components/ui'

const cards = [
  {to:'/funcionarios',title:'Funcionários',description:'Consulte a equipe, cadastros ativos e dados dos colaboradores.',icon:UsersRound},
  {to:'/registro-funcionario',title:'Registro de funcionário',description:'Cadastre novos colaboradores ou atualize registros existentes.',icon:BriefcaseBusiness},
  {to:'/ponto',title:'Folhas de ponto e recibos',description:'Revise marcações, gere documentos mensais, imprima e reimprima lotes.',icon:CalendarClock},
  {to:'/rh/modelos',title:'Modelos de documentos',description:'Gerencie os modelos, regras admissionais e kits de EPI por empresa e cargo.',icon:FileArchive},
]

export default function RhHubPage(){
  const navigate=useNavigate()
  return <>
    <PageHeader title="RH" description="Gestão dos colaboradores, admissão, ponto e documentos trabalhistas em um único fluxo."/>
    <div className="artisys-rh-hub">
      {cards.map(({to,title,description,icon:Icon})=><Card className="artisys-rh-card" key={to} onClick={()=>navigate(to)}>
        <div className="artisys-rh-card-body">
          <div className="artisys-rh-card-icon"><Icon size={20}/></div>
          <div className="artisys-rh-card-copy"><h2>{title}</h2><p>{description}</p></div>
        </div>
        <span className="artisys-rh-card-arrow" aria-hidden="true">›</span>
      </Card>)}
    </div>
  </>
}
