import { ReactNode, useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  BarChart3, CalendarClock, ChevronLeft, ChevronRight, ClipboardCheck,
  ClipboardList, FileArchive, FileSpreadsheet, HardHat, LayoutDashboard,
  PackageSearch, ReceiptText, Settings, Sparkles, UsersRound, WalletCards,
} from 'lucide-react'
import artisysLogo from '../../assets/artisys-logo.svg'
import artisysIcon from '../../assets/artisys-icon.svg'
import { WorkContextBar } from '../../components/WorkContextBar'
import { matchesNavigation } from '../../utils/ux'

const groups = [
  { label: 'Visao geral', items: [
    { to: '/', label: 'Painel', icon: LayoutDashboard },
  ] },
  { label: 'Inteligencia', items: [
    { to: '/assistente-ia', label: 'Assistente IA', icon: Sparkles },
  ] },
  { label: 'Financeiro', items: [
    { to: '/dre', label: 'DRE', icon: BarChart3 },
    { to: '/financeiro', label: 'Contas', icon: WalletCards },
    { to: '/orcamento', label: 'Orcamento', icon: FileSpreadsheet },
    { to: '/medicoes', label: 'Medicoes', icon: ClipboardCheck },
    { to: '/compras-contratos', label: 'Compras e Contratos', icon: PackageSearch },
  ] },
  { label: 'Obras', items: [
    { to: '/obras', label: 'Obras', icon: HardHat },
    { to: '/frentes', label: 'Frentes de servico', icon: ClipboardCheck },
    { to: '/planejamento', label: 'Planejamento', icon: CalendarClock },
    { to: '/rdo', label: 'Diario de obra', icon: ClipboardList },
    { to: '/tarefas', label: 'Tarefas', icon: ClipboardList },
  ] },
  { label: 'Pessoas & RH', items: [
    { to: '/rh', label: 'RH', icon: UsersRound },
    { to: '/folha', label: 'Folha e pagamentos', icon: ReceiptText },
  ] },
  { label: 'Configuracoes', items: [
    { to: '/configuracoes', label: 'Configuracoes', icon: Settings },
  ] },
]

const routeLabels:Record<string,{section:string;label:string}> = {
  '/': {section:'Visao geral', label:'Painel'},
  '/assistente-ia': {section:'Inteligencia', label:'Assistente IA'},
  '/dre': {section:'Financeiro', label:'DRE'},
  '/financeiro': {section:'Financeiro', label:'Contas'},
  '/orcamento': {section:'Financeiro', label:'Orcamento'},
  '/medicoes': {section:'Financeiro', label:'Medicoes'},
  '/compras-contratos': {section:'Financeiro', label:'Compras e Contratos'},
  '/compras': {section:'Financeiro', label:'Compras e materiais'},
  '/contratos': {section:'Financeiro', label:'Contratos e aditivos'},
  '/cadastros': {section:'Financeiro', label:'Empresas e parceiros'},
  '/obras': {section:'Obras', label:'Obras'},
  '/frentes': {section:'Obras', label:'Frentes de servico'},
  '/planejamento': {section:'Obras', label:'Planejamento'},
  '/rdo': {section:'Obras', label:'Diario de obra'},
  '/tarefas': {section:'Obras', label:'Tarefas'},
  '/rh': {section:'Pessoas & RH', label:'RH'},
  '/folha': {section:'Pessoas & RH', label:'Folha e pagamentos'},
  '/funcionarios': {section:'Pessoas & RH', label:'Funcionarios'},
  '/registro-funcionario': {section:'Pessoas & RH', label:'Registro funcionario'},
  '/ponto': {section:'Pessoas & RH', label:'Folhas de ponto'},
  '/rh/modelos': {section:'Pessoas & RH', label:'Modelos de documentos'},
  '/configuracoes': {section:'Configuracoes', label:'Central'},
  '/configuracoes/sistema': {section:'Configuracoes', label:'Configuracoes do sistema'},
  '/documentos': {section:'Configuracoes', label:'Documentos'},
  '/importacao': {section:'Configuracoes', label:'Importar planilha'},
}

export default function CommandCenterShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [search, setSearch] = useState('')
  const [closedGroups, setClosedGroups] = useState<string[]>([])
  const [favorites, setFavorites] = useState<string[]>(() => {
    try { const value = JSON.parse(localStorage.getItem('artisys.commercial.favorites') || '[]'); return Array.isArray(value) ? value.filter(item => typeof item === 'string') : [] } catch { return [] }
  })
  const toggleFavorite = (to: string) => setFavorites(previous => {
    const next = previous.includes(to) ? previous.filter(item => item !== to) : [...previous, to]
    try { localStorage.setItem('artisys.commercial.favorites', JSON.stringify(next)) } catch { /* Keep session preference. */ }
    return next
  })
  const location = useLocation()
  const route = useMemo(() => {
    if (location.pathname.startsWith('/obras/')) return {section:'Obras', label:'Detalhes da obra'}
    return routeLabels[location.pathname] || {section:'ArtiSys', label:'Desktop'}
  }, [location.pathname])
  const routeClass = useMemo(() => {
    const key = location.pathname === '/' ? 'painel' : location.pathname.replace(/^\/+|\/+$/g, '').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()
    return `route-${key || 'painel'}`
  }, [location.pathname])
  const visibleGroups = groups.map(group => ({
    ...group,
    items: group.items.filter(item => matchesNavigation(`${group.label} ${item.label}`, search)),
  })).filter(group => !search || group.items.length)
  const hasSearchResults = visibleGroups.some(group => group.items.length)

  return <div className={`app-shell command-center-shell artisys-desktop-shell ${routeClass} ${collapsed ? 'sidebar-collapsed' : ''}`}>
    <aside className="sidebar command-sidebar">
      <div className="brand artisys-brand">
        <img src={collapsed?artisysIcon:artisysLogo} alt="ArtiSys" style={collapsed?{width:38,height:38}:{}}/>
        <span className="artisys-edition">DESKTOP</span>
      </div>
      {!collapsed && <input className="nav-search" aria-label="Buscar página no menu" placeholder="Buscar página…" value={search} onChange={event => setSearch(event.target.value)}/>}
      <nav aria-label="Menu principal">
        {!collapsed && !search && favorites.length > 0 && <div className="nav-group"><span className="nav-label">Favoritos</span>{groups.flatMap(group => group.items).filter(item => favorites.includes(item.to)).map(({to,label,icon:Icon}) => <NavLink key={to} to={to} end={to === '/'}><Icon size={17}/><span>{label}</span></NavLink>)}</div>}
        {visibleGroups.map((group) => {
          const expanded = collapsed || !!search || !closedGroups.includes(group.label)
          return <div className="nav-group" key={group.label}>
            {!collapsed && <button className="nav-group-toggle" aria-expanded={expanded} onClick={() => setClosedGroups(previous => previous.includes(group.label) ? previous.filter(label => label !== group.label) : [...previous, group.label])}>{group.label}<span aria-hidden="true">{expanded ? '−' : '+'}</span></button>}
            {expanded && group.items.map(({ to, label, icon: Icon }) => <div className="nav-item-row" key={to}>
              <NavLink to={to} end={to === '/'} title={collapsed ? label : undefined}><Icon size={17}/><span>{label}</span></NavLink>
              {!collapsed && <button className="nav-favorite" aria-label={`${favorites.includes(to) ? 'Remover' : 'Adicionar'} ${label} ${favorites.includes(to) ? 'dos' : 'aos'} favoritos`} aria-pressed={favorites.includes(to)} onClick={() => toggleFavorite(to)}>{favorites.includes(to) ? '★' : '☆'}</button>}
            </div>)}
          </div>
        })}
        {search && !hasSearchResults && <p role="status">Nenhuma página encontrada.</p>}
      </nav>
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
      <div className="content-wrap"><WorkContextBar/>{children}</div>
    </main>
  </div>
}
