import { FileArchive, FileSpreadsheet, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, PageHeader } from '../components/ui'
import { ROUTES } from '../routes/registry'

const cards = [
  {to:ROUTES.documents,title:'Documentos',description:'Acesse arquivos, modelos e documentos gerados pelo sistema.',icon:FileArchive},
  {to:ROUTES.import,title:'Importar planilha',description:'Importe dados financeiros, operacionais e cadastrais com os fluxos existentes.',icon:FileSpreadsheet},
  {to:ROUTES.systemSettings,title:'Configurações do sistema',description:'Gerencie conectividade, backup, pastas, produto, layout e manutenção do aplicativo.',icon:Settings},
]

export default function SettingsHubPage(){
  return <>
    <PageHeader title="Configurações" description="Documentos, importações e ajustes do sistema reunidos em um único ponto de entrada."/>
    <div className="artisys-hub-grid">
      {cards.map(({to,title,description,icon:Icon})=><Link to={to} key={to} className="artisys-hub-link">
        <Card className="artisys-hub-card">
          <div className="artisys-hub-card-icon"><Icon size={22}/></div>
          <div className="artisys-hub-card-copy"><h2>{title}</h2><p>{description}</p></div>
          <span className="artisys-hub-card-arrow" aria-hidden="true">›</span>
        </Card>
      </Link>)}
    </div>
  </>
}
