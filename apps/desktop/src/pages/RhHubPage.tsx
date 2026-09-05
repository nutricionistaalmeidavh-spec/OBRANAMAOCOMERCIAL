import { BriefcaseBusiness, CalendarClock, FileArchive, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, PageHeader } from '../components/ui'

const cards = [
  {to:'/funcionarios',title:'Funcionários',description:'Consulte a equipe, cadastros ativos e dados dos colaboradores.',icon:UsersRound},
  {to:'/registro-funcionario',title:'Registro de funcionário',description:'Cadastre novos colaboradores ou atualize registros existentes.',icon:BriefcaseBusiness},
  {to:'/ponto',title:'Folhas de ponto e recibos',description:'Revise marcações, gere documentos mensais, imprima e reimprima lotes.',icon:CalendarClock},
  {to:'/rh/modelos',title:'Modelos de documentos',description:'Gerencie os modelos, regras admissionais e kits de EPI por empresa e cargo.',icon:FileArchive},
]

export default function RhHubPage(){
  return <>
    <PageHeader title="RH" description="Gestão dos colaboradores, admissão, ponto e documentos trabalhistas em um único fluxo."/>
    <ol className="rh-journey" aria-label="Jornada de admissão">
      <li><Link to="/registro-funcionario">1. Cadastrar colaborador</Link><small>Confira CPF, empresa e cargo.</small></li>
      <li><Link to="/funcionarios">2. Conferir cadastro</Link><small>Revise os dados antes de emitir.</small></li>
      <li><Link to="/registro-funcionario">3. Gerar documentos</Link><small>Selecione o colaborador e gere o kit.</small></li>
      <li><Link to="/documentos">4. Conferir arquivos</Link><small>Imprima e confira as assinaturas com o RH.</small></li>
    </ol>
    <div className="artisys-rh-hub">
      {cards.map(({to,title,description,icon:Icon})=><Link to={to} key={to} className="rh-card-link"><Card className="artisys-rh-card">
        <div className="artisys-rh-card-body">
          <div className="artisys-rh-card-icon"><Icon size={20}/></div>
          <div className="artisys-rh-card-copy"><h2>{title}</h2><p>{description}</p></div>
        </div>
        <span className="artisys-rh-card-arrow" aria-hidden="true">›</span>
      </Card></Link>)}
    </div>
  </>
}
