import { WorkContextProvider } from './hooks/useWorkContext'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ReactNode, useEffect, useState } from 'react'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useAsync } from './hooks/useAsync'
import { CommandCenterShell, DashboardPage as CommandCenterDashboardPage, DrePage as CommandCenterDrePage, FinancePage as CommandCenterFinancePage } from './modules/command-center'
import { ClassicAppShell, ClassicDashboardPage, ClassicDrePage, ClassicFinancePage } from './modules/classic-ui'
import AiAssistantPage from './pages/AiAssistantPage'
import PayrollPage from './pages/PayrollPage'
import WorksPage from './pages/WorksPage'
import BudgetPage from './pages/BudgetPage'
import MeasurementsPage from './pages/MeasurementsPage'
import EmployeesPage from './pages/EmployeesPage'
import EmployeeRegistrationPage from './pages/EmployeeRegistrationPage'
import DocumentsPage from './pages/DocumentsPage'
import RegistriesPage from './pages/RegistriesPage'
import ImportPage from './pages/ImportPage'
import SettingsPage from './pages/SettingsPage'
import SettingsHubPage from './pages/SettingsHubPage'
import TimeSheetPage from './pages/TimeSheetPage'
import WorkDetailPage from './pages/WorkDetailPage'
import SchedulePage from './pages/SchedulePage'
import DailyReportPage from './pages/DailyReportPage'
import ProcurementPage from './pages/ProcurementPage'
import ProcurementContractsHubPage from './pages/ProcurementContractsHubPage'
import HrTemplatesPage from './pages/HrTemplatesPage'
import RhHubPage from './pages/RhHubPage'
import FrontsPage from './pages/FrontsPage'
import ContractsPage from './pages/ContractsPage'
import TasksPage from './pages/TasksPage'
import { DesktopLogin } from './components/DesktopLogin'

export default function App() {
  const connection = useAsync(() => window.fluxoDre.online.state(), [])
  const layoutPreference = useAsync(() => window.fluxoDre.app.getLayout(), [])
  const [commandCenterStylesReady, setCommandCenterStylesReady] = useState(false)
  const [revisionConflict, setRevisionConflict] = useState<RevisionConflictDetails | null>(null)

  useEffect(() => {
    let active = true
    if (layoutPreference.data === 'classic') {
      setCommandCenterStylesReady(true)
      return () => { active = false }
    }
    if (layoutPreference.data === 'command-center') {
      setCommandCenterStylesReady(false)
      void Promise.all([
        import('./modules/command-center/command-center.css'),
        import('./modules/command-center/artisys-desktop.css'),
        import('./modules/command-center/artisys-rh.css'),
        import('./modules/command-center/artisys-operations.css'),
        import('./modules/command-center/artisys-utilities.css'),
      ]).finally(() => {
        if (active) setCommandCenterStylesReady(true)
      })
    }
    return () => { active = false }
  }, [layoutPreference.data])

  useEffect(() => window.fluxoDre.conflicts.onRevisionConflict(setRevisionConflict), [])

  if (layoutPreference.error) return <div className="app-loading">Nao foi possivel carregar a preferencia de layout.</div>
  if (layoutPreference.loading || !layoutPreference.data || !commandCenterStylesReady) return <div className="app-loading">Carregando interface...</div>

  if (connection.loading) return <div className="app-loading">Carregando acesso...</div>
  if (connection.error) return <div className="app-loading">Não foi possível carregar o acesso. Reinicie o aplicativo.</div>
  if (!connection.data?.linked) return <DesktopLogin onLinked={() => { void connection.reload() }}/>

  const isClassic = layoutPreference.data === 'classic'
  const Shell = isClassic ? ClassicAppShell : CommandCenterShell
  const DashboardPage = isClassic ? ClassicDashboardPage : CommandCenterDashboardPage
  const DrePage = isClassic ? ClassicDrePage : CommandCenterDrePage
  const FinancePage = isClassic ? ClassicFinancePage : CommandCenterFinancePage

  return <>
    <ErrorBoundary><WorkContextProvider><Shell><RouteBoundary><Routes>
      <Route path="/" element={<DashboardPage/>}/>
      <Route path="/assistente-ia" element={<AiAssistantPage/>}/>
      <Route path="/dre" element={<DrePage/>}/>
      <Route path="/financeiro" element={<FinancePage/>}/>
      <Route path="/folha" element={<PayrollPage/>}/>
      <Route path="/orcamento" element={<BudgetPage/>}/>
      <Route path="/medicoes" element={<MeasurementsPage/>}/>
      <Route path="/compras-contratos" element={<ProcurementContractsHubPage/>}/>
      <Route path="/compras" element={<ProcurementPage/>}/>
      <Route path="/contratos" element={<ContractsPage/>}/>
      <Route path="/cadastros" element={<RegistriesPage/>}/>
      <Route path="/obras" element={<WorksPage/>}/>
      <Route path="/obras/:id" element={<WorkDetailPage/>}/>
      <Route path="/frentes" element={<FrontsPage/>}/>
      <Route path="/planejamento" element={<SchedulePage/>}/>
      <Route path="/rdo" element={<DailyReportPage/>}/>
      <Route path="/tarefas" element={<TasksPage/>}/>
      <Route path="/rh" element={<RhHubPage/>}/>
      <Route path="/funcionarios" element={<EmployeesPage/>}/>
      <Route path="/registro-funcionario" element={<EmployeeRegistrationPage/>}/>
      <Route path="/ponto" element={<TimeSheetPage/>}/>
      <Route path="/rh/modelos" element={<HrTemplatesPage/>}/>
      <Route path="/documentos" element={<DocumentsPage/>}/>
      <Route path="/importacao" element={<ImportPage/>}/>
      <Route path="/configuracoes" element={isClassic ? <SettingsPage/> : <SettingsHubPage/>}/>
      <Route path="/configuracoes/sistema" element={<SettingsPage/>}/>
      <Route path="*" element={<Navigate to="/" replace/>}/>
    </Routes></RouteBoundary></Shell></WorkContextProvider></ErrorBoundary>
    {revisionConflict && <RevisionConflictDialog conflict={revisionConflict} onClose={() => setRevisionConflict(null)}/>} 
  </>
}

function RevisionConflictDialog({ conflict, onClose }: { conflict: RevisionConflictDetails; onClose: () => void }) {
  return <div role="alertdialog" aria-modal="true" aria-label="Conflito de edição" style={{ position:'fixed', inset:0, zIndex:10000, display:'grid', placeItems:'center', padding:24, background:'rgba(15,23,42,.48)' }}>
    <div style={{ width:'min(460px, 100%)', borderRadius:14, background:'#fff', padding:24, boxShadow:'0 24px 64px rgba(15,23,42,.24)' }}>
      <h2 style={{ margin:'0 0 10px' }}>Conflito de edição</h2>
      <p style={{ margin:'0 0 8px' }}>Este registro foi alterado em outro computador.</p>
      <p style={{ margin:'0 0 20px', opacity:.72 }}>Sua alteração não foi aplicada. Recarregue a versão atual antes de editar novamente{Number.isFinite(conflict.currentRevision) ? ` (revisão ${conflict.currentRevision})` : ''}.</p>
      <div style={{ display:'flex', gap:10, justifyContent:'flex-end', flexWrap:'wrap' }}>
        <button type="button" onClick={onClose}>Fechar</button>
        <button type="button" onClick={() => window.location.reload()}>Recarregar versão atual</button>
      </div>
    </div>
  </div>
}

function RouteBoundary({ children }: { children: ReactNode }) {
  const location = useLocation()
  return <ErrorBoundary key={location.pathname}>{children}</ErrorBoundary>
}
