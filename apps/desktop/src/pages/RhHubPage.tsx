import { BriefcaseBusiness, CalendarClock, FileArchive, ReceiptText, UsersRound, WalletCards } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, PageHeader } from '../components/ui'
import { ROUTES } from '../routes/registry'

const cards = [
  {to:ROUTES.rhEmployees,title:'Funcionários',description:'Consulte a equipe, cadastros ativos e dados dos colaboradores.',icon:UsersRound},
  {to:ROUTES.rhAdmissions,title:'Registro de funcionário',description:'Cadastre novos colaboradores ou atualize registros existentes.',icon:BriefcaseBusiness},
  {to:ROUTES.rhCompensation,title:'Cargos e remuneração',description:'Defina salário-base, benefícios por cargo e os valores que alimentam a folha.',icon:WalletCards},
  {to:ROUTES.rhPayroll,title:'Folha e pagamentos',description:'Revise valores fixos e variáveis e confirme pagamentos por competência.',icon:ReceiptText},
  {to:ROUTES.rhTime,title:'Folhas de ponto e recibos',description:'Revise marcações, gere documentos mensais, imprima e reimprima lotes.',icon:CalendarClock},
  {to:ROUTES.rhTemplates,title:'Modelos de documentos',description:'Gerencie os modelos, regras admissionais e kits de EPI por empresa e cargo.',icon:FileArchive},
]

export default function RhHubPage(){
  return <>
    <PageHeader title="RH" description="Gestão dos colaboradores, remuneração, folha, ponto e documentos trabalhistas em um único fluxo."/>
    <ol className="rh-journey" aria-label="Jornada de admissão">
      <li><Link to={ROUTES.rhAdmissions}>1. Cadastrar colaborador</Link><small>Confira CPF, empresa e cargo.</small></li>
      <li><Link to={ROUTES.rhEmployees}>2. Conferir cadastro</Link><small>Revise os dados antes de emitir.</small></li>
      <li><Link to={ROUTES.rhAdmissions}>3. Gerar documentos</Link><small>Selecione o colaborador e gere o kit.</small></li>
      <li><Link to={ROUTES.documents}>4. Conferir arquivos</Link><small>Imprima e confira as assinaturas com o RH.</small></li>
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
