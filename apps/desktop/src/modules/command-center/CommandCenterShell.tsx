import { ReactNode, useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  BarChart3, BriefcaseBusiness, Building2, CalendarClock, ChevronLeft,
  ChevronRight, ClipboardCheck, ClipboardList, FileArchive, FileSpreadsheet,
  HardHat, Landmark, LayoutDashboard, PackageSearch, ReceiptText, Settings,
  Sparkles, UsersRound, WalletCards,
} from 'lucide-react'
import artisysLogo from '../../assets/artisys-logo.svg'

const groups = [
  { label: 'Visao geral', items: [
    { to: '/', label: 'Painel', icon: LayoutDashboard },
    { to: '/dre', label: 'DRE', icon: BarChart3 },
  ] },
  { label: 'Inteligencia', items: [
    { to: '/assistente-ia', label: 'Assistente IA', icon: Sparkles },
  ] },
  { label: 'Financeiro', items: [
    { to: '/financeiro', label: 'Contas', icon: WalletCards },
    { to: '/folha', label: 'Folha e pagamentos', icon: ReceiptText },
  ] },
  { label: 'Operacao', items: [
    { to: '/obras', label: 'Obras', icon: HardHat },
    { to: '/frentes', label: 'Frentes de servico', icon: ClipboardCheck },
    { to: '/orcamento', label: 'Orcamento', icon: FileSpreadsheet },
    { to: '/planejamento', label: 'Planejamento', icon: CalendarClock },
    { to: '/rdo', label: 'Diario de obra', icon: ClipboardList },
    { to: '/medicoes', label: 'Medicoes', icon: ClipboardCheck },
    { to: '/compras', label: 'Compras e materiais', icon: PackageSearch },
    { to: '/contratos', label: 'Contratos e aditivos', icon: FileArchive },
    { to: '/tarefas', label: 'Tarefas', icon: ClipboardList },
  ] },
  { label: 'RH', to: '/rh', items: [
    { to: '/funcionarios', label: 'Funcionarios', icon: UsersRound },
    { to: '/registro-funcionario', label: 'Registro funcionario', icon: BriefcaseBusiness },
    { to: '/ponto', label: 'Folhas de ponto', icon: CalendarClock },
    { to: '/rh/modelos', label: 'Modelos de documentos', icon: FileArchive },
  ] },
  { label: 'Arquivo', items: [
    { to: '/documentos', label: 'Documentos', icon: FileArchive },
    { to: '/cadastros', label: 'Empresas e parceiros', icon: Building2 },
  ] },
  { label: 'Sistema', items: [
    { to: '/importacao', label: 'Importar planilha', icon: Landmark },
    { to: '/configuracoes', label: 'Configuracoes', icon: Settings },
  ] },
]

const routeLabels:Record<string,{section:string;label:string}> = {
  '/': {section:'Visao geral', label:'Painel'},
  '/assistente-ia': {section:'Inteligencia', label:'Assistente IA'},
  '/dre': {section:'Visao geral', label:'DRE'},
  '/financeiro': {section:'Financeiro', label:'Contas'},
  '/folha': {section:'Financeiro', label:'Folha e pagamentos'},
  '/obras': {section:'Operacao', label:'Obras'},
  '/frentes': {section:'Operacao', label:'Frentes de servico'},
  '/orcamento': {section:'Operacao', label:'Orcamento'},
  '/planejamento': {section:'Operacao', label:'Planejamento'},
  '/rdo': {section:'Operacao', label:'Diario de obra'},
  '/medicoes': {section:'Operacao', label:'Medicoes'},
  '/compras': {section:'Operacao', label:'Compras e materiais'},
  '/contratos': {section:'Operacao', label:'Contratos e aditivos'},
  '/tarefas': {section:'Operacao', label:'Tarefas'},
  '/rh': {section:'RH', label:'Central de RH'},
  '/funcionarios': {section:'RH', label:'Funcionarios'},
  '/registro-funcionario': {section:'RH', label:'Registro funcionario'},
  '/ponto': {section:'RH', label:'Folhas de ponto'},
  '/rh/modelos': {section:'RH', label:'Modelos de documentos'},
  '/documentos': {section:'Arquivo', label:'Documentos'},
  '/cadastros': {section:'Arquivo', label:'Empresas e parceiros'},
  '/importacao': {section:'Sistema', label:'Importar planilha'},
  '/configuracoes': {section:'Sistema', label:'Configuracoes'},
}

export default function CommandCenterShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const route = useMemo(() => {
    if (location.pathname.startsWith('/obras/')) return {section:'Operacao', label:'Detalhes da obra'}
    return routeLabels[location.pathname] || {section:'ArtiSys', label:'Desktop'}
  }, [location.pathname])

  return <div className={`app-shell command-center-shell artisys-desktop-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
    <aside className="sidebar command-sidebar">
      <div className="brand artisys-brand">
        <img src={artisysLogo} alt="ArtiSys"/>
        <span className="artisys-edition">DESKTOP</span>
      </div>
      <nav>{groups.map((group) => <div className="nav-group" key={group.label}>
        {group.to?<NavLink className="nav-label" to={group.to} title={collapsed?group.label:undefined}>{group.label}</NavLink>:<span className="nav-label">{group.label}</span>}
        {group.items.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'} title={collapsed ? label : undefined}>
          <Icon size={17}/><span>{label}</span>
        </NavLink>)}
      </div>)}</nav>
      <div className="artisys-sidebar-foot">
        <div className="artisys-product-state"><i/><span><strong>Comercial</strong><small>Ambiente local seguro</small></span></div>
        <button className="collapse-button" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}>
          {collapsed ? <ChevronRight size={18}/> : <><ChevronLeft size={18}/><span>Recolher menu</span></>}
        </button>
      </div>
    </aside>
    <main className="main-content">
      <header className="artisys-topbar">
        <div className="artisys-breadcrumb"><span>{route.section}</span><i>/</i><strong>{route.label}</strong></div>
        <div className="artisys-topbar-status"><span className="artisys-sync-dot"/>ArtiSys Desktop <b>Comercial</b></div>
      </header>
      <div className="content-wrap">{children}</div>
    </main>
  </div>
}
