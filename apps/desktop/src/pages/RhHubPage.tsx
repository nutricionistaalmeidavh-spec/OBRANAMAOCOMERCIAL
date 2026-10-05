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
    <section aria-labelledby="rh-admission-flow-title">\n      <div className="section-heading"><div><h2 id="rh-admission-flow-title">Fluxo de admissão</h2><p>Siga as etapas para cadastrar, gerar e conferir a documentação do colaborador.</p></div></div>\n    <ol className="rh-journey" aria-label="Jornada de admissão">
      <li><Link to={ROUTES.rhAdmissions}>1. Cadastro</Link><small>Dados pessoais e documentos.</small></li>
      <li><Link to={ROUTES.rhAdmissions}>2. Contrato</Link><small>Empresa, cargo, jornada e remuneração.</small></li>
      <li><Link to={ROUTES.rhAdmissions}>3. Benefícios e EPI</Link><small>Confira benefícios e itens entregues.</small></li>
      <li><Link to={ROUTES.rhAdmissions}>4. Documentos</Link><small>Gere o kit admissional.</small></li>
      <li><Link to={`${ROUTES.documents}?context=rh`}>5. Conferência</Link><small>Revise, imprima e acompanhe os documentos de RH.</small></li>
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
