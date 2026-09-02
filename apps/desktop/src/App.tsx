import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ReactNode, useEffect, useState } from 'react'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useAsync } from './hooks/useAsync'
import { CommandCenterShell, DashboardPage as CommandCenterDashboardPage, DrePage as CommandCenterDrePage, FinancePage as CommandCenterFinancePage } from './modules/command-center'
import { ClassicAppShell, ClassicDashboardPage, ClassicDrePage, ClassicFinancePage } from './modules/classic-ui'
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
import TimeSheetPage from './pages/TimeSheetPage'
import WorkDetailPage from './pages/WorkDetailPage'
import SchedulePage from './pages/SchedulePage'
import DailyReportPage from './pages/DailyReportPage'
import ProcurementPage from './pages/ProcurementPage'
import HrTemplatesPage from './pages/HrTemplatesPage'
import FrontsPage from './pages/FrontsPage'
import ContractsPage from './pages/ContractsPage'
import TasksPage from './pages/TasksPage'

export default function App() {
  const layoutPreference = useAsync(() => window.fluxoDre.app.getLayout(), [])
  const [commandCenterStylesReady, setCommandCenterStylesReady] = useState(false)

  useEffect(() => {
    let active = true
    if (layoutPreference.data === 'classic') {
      setCommandCenterStylesReady(true)
      return () => { active = false }
    }
    if (layoutPreference.data === 'command-center') {
      setCommandCenterStylesReady(false)
      void import('./modules/command-center/command-center.css').finally(() => {
        if (active) setCommandCenterStylesReady(true)
      })
    }
    return () => { active = false }
  }, [layoutPreference.data])

  if (layoutPreference.error) return <div className="app-loading">Nao foi possivel carregar a preferencia de layout.</div>
  if (layoutPreference.loading || !layoutPreference.data || !commandCenterStylesReady) return <div className="app-loading">Carregando interface...</div>

  const isClassic = layoutPreference.data === 'classic'
  const Shell = isClassic ? ClassicAppShell : CommandCenterShell
  const DashboardPage = isClassic ? ClassicDashboardPage : CommandCenterDashboardPage
  const DrePage = isClassic ? ClassicDrePage : CommandCenterDrePage
  const FinancePage = isClassic ? ClassicFinancePage : CommandCenterFinancePage

  return <ErrorBoundary><Shell><RouteBoundary><Routes>
    <Route path="/" element={<DashboardPage/>}/>
    <Route path="/dre" element={<DrePage/>}/>
    <Route path="/financeiro" element={<FinancePage/>}/>
    <Route path="/folha" element={<PayrollPage/>}/>
    <Route path="/obras" element={<WorksPage/>}/>
    <Route path="/obras/:id" element={<WorkDetailPage/>}/>
    <Route path="/frentes" element={<FrontsPage/>}/>
    <Route path="/orcamento" element={<BudgetPage/>}/>
    <Route path="/planejamento" element={<SchedulePage/>}/>
    <Route path="/rdo" element={<DailyReportPage/>}/>
    <Route path="/compras" element={<ProcurementPage/>}/>
    <Route path="/contratos" element={<ContractsPage/>}/>
    <Route path="/tarefas" element={<TasksPage/>}/>
    <Route path="/medicoes" element={<MeasurementsPage/>}/>
    <Route path="/funcionarios" element={<EmployeesPage/>}/>
    <Route path="/registro-funcionario" element={<EmployeeRegistrationPage/>}/>
    <Route path="/ponto" element={<TimeSheetPage/>}/>
    <Route path="/rh/modelos" element={<HrTemplatesPage/>}/>
    <Route path="/documentos" element={<DocumentsPage/>}/>
    <Route path="/cadastros" element={<RegistriesPage/>}/>
    <Route path="/importacao" element={<ImportPage/>}/>
    <Route path="/configuracoes" element={<SettingsPage/>}/>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes></RouteBoundary></Shell></ErrorBoundary>
}

function RouteBoundary({ children }: { children: ReactNode }) {
  const location = useLocation()
  return <ErrorBoundary key={location.pathname}>{children}</ErrorBoundary>
}
