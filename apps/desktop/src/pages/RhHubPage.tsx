import { BriefcaseBusiness, CalendarClock, FileArchive, UsersRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Card, PageHeader } from '../components/ui'

const cards = [
  {to:'/funcionarios',title:'Funcionários',description:'Consulte a equipe, cadastros ativos e dados dos colaboradores.',icon:UsersRound},
  {to:'/registro-funcionario',title:'Registro de funcionário',description:'Cadastre novos colaboradores ou atualize registros existentes.',icon:BriefcaseBusiness},
  {to:'/ponto',title:'Folhas de ponto e recibos',description:'Revise marcações, gere documentos mensais, imprima e reimprima lotes.',icon:CalendarClock},
  {to:'/rh/modelos',title:'Modelos de documentos',description:'Gerencie os modelos usados nos documentos do RH.',icon:FileArchive},
]

export default function RhHubPage(){
  const navigate=useNavigate()
  return <>
    <PageHeader title="RH" description="Gestão dos colaboradores, registros, ponto e documentos trabalhistas."/>
    <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:14}}>
      {cards.map(({to,title,description,icon:Icon})=><Card key={to} style={{cursor:'pointer',padding:18}} onClick={()=>navigate(to)}>
        <div style={{display:'flex',gap:14,alignItems:'flex-start'}}>
          <div style={{width:42,height:42,borderRadius:10,display:'grid',placeItems:'center',background:'var(--surface-2)'}}><Icon size={20}/></div>
          <div><h2 style={{margin:'0 0 6px',fontSize:16}}>{title}</h2><p style={{margin:0,color:'var(--muted)'}}>{description}</p></div>
        </div>
      </Card>)}
    </div>
  </>
}
