import { Building2, FileArchive, PackageSearch } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, PageHeader } from '../components/ui'

const cards = [
  {to:'/compras',title:'Compras e materiais',description:'Pedidos, materiais, recebimentos, estoque e custos vinculados às obras.',icon:PackageSearch},
  {to:'/contratos',title:'Contratos e aditivos',description:'Contratos, aditivos, vigências, valores e documentos relacionados.',icon:FileArchive},
  {to:'/cadastros',title:'Empresas e parceiros',description:'Fornecedores, clientes, construtoras e demais parceiros comerciais.',icon:Building2},
]

export default function ProcurementContractsHubPage(){
  return <>
    <PageHeader title="Compras e Contratos" description="Centralize compras, contratos e parceiros dentro do fluxo financeiro sem alterar os módulos existentes."/>
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
