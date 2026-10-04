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
import CompensationPage from './pages/CompensationPage'
import FrontsPage from './pages/FrontsPage'
import ContractsPage from './pages/ContractsPage'
import TasksPage from './pages/TasksPage'
import { DesktopLogin } from './components/DesktopLogin'
import { LEGACY_ROUTE_ALIASES, ROUTES } from './routes/registry'

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
      <Route path={ROUTES.dashboard} element={<DashboardPage/>}/>
      <Route path={ROUTES.ai} element={<AiAssistantPage/>}/>
      <Route path={ROUTES.dre} element={<DrePage/>}/>
      <Route path={ROUTES.finance} element={<FinancePage/>}/>
      <Route path={ROUTES.budget} element={<BudgetPage/>}/>
      <Route path={ROUTES.measurements} element={<MeasurementsPage/>}/>
      <Route path={ROUTES.procurementContracts} element={<ProcurementContractsHubPage/>}/>
      <Route path={ROUTES.procurement} element={<ProcurementPage/>}/>
      <Route path={ROUTES.contracts} element={<ContractsPage/>}/>
      <Route path={ROUTES.registries} element={<RegistriesPage/>}/>
      <Route path={ROUTES.works} element={<WorksPage/>}/>
      <Route path={ROUTES.workDetail} element={<WorkDetailPage/>}/>
      <Route path={ROUTES.fronts} element={<FrontsPage/>}/>
      <Route path={ROUTES.planning} element={<SchedulePage/>}/>
      <Route path={ROUTES.dailyReport} element={<DailyReportPage/>}/>
      <Route path={ROUTES.tasks} element={<TasksPage/>}/>
      <Route path={ROUTES.rh} element={<RhHubPage/>}/>
      <Route path={ROUTES.rhEmployees} element={<EmployeesPage/>}/>
      <Route path={ROUTES.rhAdmissions} element={<EmployeeRegistrationPage/>}/>
      <Route path={ROUTES.rhCompensation} element={<CompensationPage/>}/>
      <Route path={ROUTES.rhPayroll} element={<PayrollPage/>}/>
      <Route path={ROUTES.rhTime} element={<TimeSheetPage/>}/>
      <Route path={ROUTES.rhTemplates} element={<HrTemplatesPage/>}/>
      <Route path={ROUTES.documents} element={<DocumentsPage/>}/>
      <Route path={ROUTES.import} element={<ImportPage/>}/>
      <Route path={ROUTES.settings} element={isClassic ? <SettingsPage/> : <SettingsHubPage/>}/>
      <Route path={ROUTES.systemSettings} element={<SettingsPage/>}/>
      {LEGACY_ROUTE_ALIASES.map(alias=><Route key={alias.from} path={alias.from} element={<Navigate to={alias.to} replace/>}/>)}
      <Route path="*" element={<Navigate to={ROUTES.dashboard} replace/>}/>
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
