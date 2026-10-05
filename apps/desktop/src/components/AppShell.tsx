import { ReactNode, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { BarChart3, ChevronLeft, ChevronRight } from 'lucide-react'
import { CLASSIC_NAVIGATION_GROUPS } from '../routes/registry'

export default function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  return <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><BarChart3 size={20}/></div><div><strong>Fluxo DRE</strong><span>Gestao de obras</span></div></div>
      <nav>{CLASSIC_NAVIGATION_GROUPS.map((group) => <div className="nav-group" key={group.label}><span className="nav-label">{group.label}</span>{group.items.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'} title={collapsed ? label : undefined}><Icon size={18}/><span>{label}</span></NavLink>)}</div>)}</nav>
      <button className="collapse-button" onClick={() => setCollapsed(!collapsed)}>{collapsed ? <ChevronRight size={18}/> : <><ChevronLeft size={18}/><span>Recolher menu</span></>}</button>
    </aside>
    <main className="main-content"><div className="content-wrap">{children}</div></main>
  </div>
}
