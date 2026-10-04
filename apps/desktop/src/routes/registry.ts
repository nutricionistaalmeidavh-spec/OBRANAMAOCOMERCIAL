import type { LucideIcon } from 'lucide-react'
import {
  BarChart3, BriefcaseBusiness, Building2, CalendarClock, ClipboardCheck, ClipboardList,
  FileArchive, FileSpreadsheet, HardHat, Landmark, LayoutDashboard, PackageSearch,
  ReceiptText, Settings, Sparkles, UsersRound, WalletCards,
} from 'lucide-react'

export const ROUTES = Object.freeze({
  dashboard:'/',
  ai:'/assistente-ia',
  dre:'/dre',
  finance:'/financeiro',
  budget:'/orcamento',
  measurements:'/medicoes',
  procurementContracts:'/compras-contratos',
  procurement:'/compras',
  contracts:'/contratos',
  registries:'/cadastros',
  works:'/obras',
  workDetail:'/obras/:id',
  fronts:'/frentes',
  planning:'/planejamento',
  dailyReport:'/rdo',
  tasks:'/tarefas',
  rh:'/rh',
  rhEmployees:'/rh/funcionarios',
  rhAdmissions:'/rh/admissoes',
  rhCompensation:'/rh/remuneracao',
  rhPayroll:'/rh/folha',
  rhTime:'/rh/ponto',
  rhTemplates:'/rh/modelos',
  documents:'/documentos',
  import:'/importacao',
  settings:'/configuracoes',
  systemSettings:'/configuracoes/sistema',
} as const)

export const LEGACY_ROUTE_ALIASES = Object.freeze([
  {from:'/funcionarios',to:ROUTES.rhEmployees},
  {from:'/registro-funcionario',to:ROUTES.rhAdmissions},
  {from:'/folha',to:ROUTES.rhPayroll},
  {from:'/ponto',to:ROUTES.rhTime},
] as const)

export type NavigationItem={to:string;label:string;icon:LucideIcon}
export type NavigationGroup={label:string;items:NavigationItem[]}

export const COMMAND_NAVIGATION_GROUPS:NavigationGroup[]=[
  {label:'Visao geral',items:[
    {to:ROUTES.dashboard,label:'Painel',icon:LayoutDashboard},
  ]},
  {label:'Financeiro',items:[
    {to:ROUTES.dre,label:'DRE',icon:BarChart3},
    {to:ROUTES.finance,label:'Contas',icon:WalletCards},
    {to:ROUTES.budget,label:'Orcamento',icon:FileSpreadsheet},
    {to:ROUTES.measurements,label:'Medicoes',icon:ClipboardCheck},
    {to:ROUTES.procurementContracts,label:'Compras e Contratos',icon:PackageSearch},
  ]},
  {label:'Obras',items:[
    {to:ROUTES.works,label:'Obras',icon:HardHat},
    {to:ROUTES.registries,label:'Clientes e empresas',icon:Building2},
    {to:ROUTES.fronts,label:'Frentes de servico',icon:ClipboardCheck},
    {to:ROUTES.planning,label:'Planejamento',icon:CalendarClock},
    {to:ROUTES.dailyReport,label:'Diario de obra',icon:ClipboardList},
    {to:ROUTES.tasks,label:'Tarefas',icon:ClipboardList},
  ]},
  {label:'Pessoas & RH',items:[
    {to:ROUTES.rh,label:'RH',icon:UsersRound},
    {to:ROUTES.rhPayroll,label:'Folha e pagamentos',icon:ReceiptText},
  ]},
  {label:'Configuracoes',items:[
    {to:ROUTES.settings,label:'Configuracoes',icon:Settings},
  ]},
]

export const CLASSIC_NAVIGATION_GROUPS:NavigationGroup[]=[
  {label:'Visao geral',items:[
    {to:ROUTES.dashboard,label:'Painel',icon:LayoutDashboard},
    {to:ROUTES.dre,label:'DRE',icon:BarChart3},
  ]},
  {label:'Inteligencia',items:[
    {to:ROUTES.ai,label:'Assistente IA',icon:Sparkles},
  ]},
  {label:'Financeiro',items:[
    {to:ROUTES.finance,label:'Contas',icon:WalletCards},
  ]},
  {label:'Operacao',items:[
    {to:ROUTES.works,label:'Obras',icon:HardHat},
    {to:ROUTES.budget,label:'Orcamento',icon:FileSpreadsheet},
    {to:ROUTES.measurements,label:'Medicoes',icon:ClipboardList},
    {to:ROUTES.procurement,label:'Compras e materiais',icon:Landmark},
    {to:ROUTES.contracts,label:'Contratos e aditivos',icon:FileArchive},
  ]},
  {label:'RH',items:[
    {to:ROUTES.rhEmployees,label:'Funcionarios',icon:UsersRound},
    {to:ROUTES.rhAdmissions,label:'Registro funcionario',icon:BriefcaseBusiness},
    {to:ROUTES.rhCompensation,label:'Cargos e remuneracao',icon:ReceiptText},
    {to:ROUTES.rhPayroll,label:'Folha e pagamentos',icon:ReceiptText},
    {to:ROUTES.rhTime,label:'Folhas de ponto',icon:CalendarClock},
    {to:ROUTES.rhTemplates,label:'Modelos de documentos',icon:FileArchive},
  ]},
  {label:'Arquivo',items:[
    {to:ROUTES.documents,label:'Documentos',icon:FileArchive},
    {to:ROUTES.registries,label:'Empresas e parceiros',icon:Building2},
  ]},
  {label:'Sistema',items:[
    {to:ROUTES.import,label:'Importar planilha',icon:Landmark},
    {to:ROUTES.settings,label:'Configuracoes',icon:Settings},
  ]},
]

const ROUTE_META:Record<string,{section:string;label:string}>={
  [ROUTES.dashboard]:{section:'Visao geral',label:'Painel'},
  [ROUTES.ai]:{section:'Inteligencia',label:'Assistente IA'},
  [ROUTES.dre]:{section:'Financeiro',label:'DRE'},
  [ROUTES.finance]:{section:'Financeiro',label:'Contas'},
  [ROUTES.budget]:{section:'Financeiro',label:'Orcamento'},
  [ROUTES.measurements]:{section:'Financeiro',label:'Medicoes'},
  [ROUTES.procurementContracts]:{section:'Financeiro',label:'Compras e Contratos'},
  [ROUTES.procurement]:{section:'Financeiro',label:'Compras e materiais'},
  [ROUTES.contracts]:{section:'Financeiro',label:'Contratos e aditivos'},
  [ROUTES.registries]:{section:'Obras',label:'Clientes e empresas'},
  [ROUTES.works]:{section:'Obras',label:'Obras'},
  [ROUTES.fronts]:{section:'Obras',label:'Frentes de servico'},
  [ROUTES.planning]:{section:'Obras',label:'Planejamento'},
  [ROUTES.dailyReport]:{section:'Obras',label:'Diario de obra'},
  [ROUTES.tasks]:{section:'Obras',label:'Tarefas'},
  [ROUTES.rh]:{section:'Pessoas & RH',label:'RH'},
  [ROUTES.rhEmployees]:{section:'Pessoas & RH',label:'Funcionarios'},
  [ROUTES.rhAdmissions]:{section:'Pessoas & RH',label:'Registro funcionario'},
  [ROUTES.rhCompensation]:{section:'Pessoas & RH',label:'Cargos e remuneracao'},
  [ROUTES.rhPayroll]:{section:'Pessoas & RH',label:'Folha e pagamentos'},
  [ROUTES.rhTime]:{section:'Pessoas & RH',label:'Folhas de ponto'},
  [ROUTES.rhTemplates]:{section:'Pessoas & RH',label:'Modelos de documentos'},
  [ROUTES.settings]:{section:'Configuracoes',label:'Central'},
  [ROUTES.systemSettings]:{section:'Configuracoes',label:'Configuracoes do sistema'},
  [ROUTES.documents]:{section:'Configuracoes',label:'Documentos'},
  [ROUTES.import]:{section:'Configuracoes',label:'Importar planilha'},
}

const ALIAS_TO_CANONICAL=new Map(LEGACY_ROUTE_ALIASES.map(item=>[item.from,item.to]))

export function canonicalPath(pathname:string){
  return ALIAS_TO_CANONICAL.get(pathname)||pathname
}

export function routeMeta(pathname:string){
  const path=canonicalPath(pathname)
  if(path.startsWith('/obras/'))return{section:'Obras',label:'Detalhes da obra'}
  return ROUTE_META[path]||{section:'ArtiSys',label:'Desktop'}
}

export function routeClassName(pathname:string){
  const canonical=canonicalPath(pathname)
  const visualPath=canonical===ROUTES.systemSettings?ROUTES.settings:canonical
  const key=visualPath===ROUTES.dashboard?'painel':visualPath.replace(/^\/+|\/+$/g,'').replace(/[^a-zA-Z0-9]+/g,'-').toLowerCase()
  return `route-${key||'painel'}`
}
