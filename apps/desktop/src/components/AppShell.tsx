import { ReactNode, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { BarChart3, BriefcaseBusiness, Building2, CalendarClock, ChevronLeft, ChevronRight, ClipboardList, FileArchive, FileSpreadsheet, HardHat, Landmark, LayoutDashboard, ReceiptText, Settings, UsersRound, WalletCards } from 'lucide-react'

const groups = [
  { label: 'Visao geral', items: [
    { to: '/', label: 'Painel', icon: LayoutDashboard }, { to: '/dre', label: 'DRE', icon: BarChart3 }
  ]},
  { label: 'Financeiro', items: [
    { to: '/financeiro', label: 'Contas', icon: WalletCards }, { to: '/folha', label: 'Folha e pagamentos', icon: ReceiptText }
  ]},
  { label: 'Operacao', items: [
    { to: '/obras', label: 'Obras', icon: HardHat }, { to: '/orcamento', label: 'Orcamento', icon: FileSpreadsheet }, { to: '/medicoes', label: 'Medicoes', icon: ClipboardList }, { to: '/compras', label: 'Compras e materiais', icon: Landmark }, { to: '/contratos', label: 'Contratos e aditivos', icon: FileArchive }
  ]},
  { label: 'RH', items: [
    { to: '/funcionarios', label: 'Funcionarios', icon: UsersRound }, { to: '/registro-funcionario', label: 'Registro funcionario', icon: BriefcaseBusiness }, { to: '/ponto', label: 'Folhas de ponto', icon: CalendarClock }, { to: '/rh/modelos', label: 'Modelos de documentos', icon: FileArchive }
  ]},
  { label: 'Arquivo', items: [
    { to: '/documentos', label: 'Documentos', icon: FileArchive }, { to: '/cadastros', label: 'Empresas e parceiros', icon: Building2 }
  ]},
  { label: 'Sistema', items: [
    { to: '/importacao', label: 'Importar planilha', icon: Landmark }, { to: '/configuracoes', label: 'Configuracoes', icon: Settings }
  ]}
]

export default function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  return <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><BarChart3 size={20}/></div><div><strong>Fluxo DRE</strong><span>Gestao de obras</span></div></div>
      <nav>{groups.map((group) => <div className="nav-group" key={group.label}><span className="nav-label">{group.label}</span>{group.items.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'} title={collapsed ? label : undefined}><Icon size={18}/><span>{label}</span></NavLink>)}</div>)}</nav>
      <button className="collapse-button" onClick={() => setCollapsed(!collapsed)}>{collapsed ? <ChevronRight size={18}/> : <><ChevronLeft size={18}/><span>Recolher menu</span></>}</button>
    </aside>
    <main className="main-content"><div className="content-wrap">{children}</div></main>
  </div>
}
