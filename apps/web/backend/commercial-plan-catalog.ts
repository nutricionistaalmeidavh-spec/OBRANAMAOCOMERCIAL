export type CommercialPlan={
  code:string
  tier:'essencial'|'pro'|'empresa'
  name:'Essencial'|'Pro'|'Empresa'
  interval:'monthly'|'yearly'
  priceCents:number
  modules:string[]
  channels:['desktop','mobile']
  limits:{users:number;projects:number;devices:number}
}

const CORE_MODULES=['obra360','rdo','documents','universidade']
const COMPLETE_MODULES=['finance','rh','contracts','rdo','obra360','dre','procurement','measurements','documents','universidade','ai']

const tiers={
  essencial:{name:'Essencial' as const,modules:CORE_MODULES,limits:{users:5,projects:3,devices:2}},
  pro:{name:'Pro' as const,modules:COMPLETE_MODULES,limits:{users:20,projects:10,devices:5}},
  empresa:{name:'Empresa' as const,modules:COMPLETE_MODULES,limits:{users:60,projects:30,devices:15}}
}

function plan(tier:keyof typeof tiers,interval:'monthly'|'yearly',priceCents:number):CommercialPlan{
  const base=tiers[tier]
  return{code:`${tier}_${interval}`,tier,name:base.name,interval,priceCents,modules:[...base.modules],channels:['desktop','mobile'],limits:{...base.limits}}
}

export const COMMERCIAL_PLANS:CommercialPlan[]=[
  plan('essencial','monthly',14900),plan('essencial','yearly',149000),
  plan('pro','monthly',29900),plan('pro','yearly',299000),
  plan('empresa','monthly',49900),plan('empresa','yearly',499000)
]

const TIER_FEATURES:Record<CommercialPlan['tier'],string[]>={
  essencial:[
    'Gestão de obras, frentes e tarefas',
    'Cronograma operacional',
    'RDO e operação de campo',
    'Documentos da obra',
    'Universidade Empresarial',
    'Acesso Desktop e PWA/mobile'
  ],
  pro:[
    'Tudo do Essencial',
    'Financeiro, DRE e medições',
    'RH e gestão de colaboradores',
    'Compras, materiais, contratos e aditivos',
    'Empresas e parceiros',
    'Orçamentos e controles administrativos',
    'IA do ArtiSys',
    'Acesso Desktop e PWA/mobile'
  ],
  empresa:[
    'Tudo do Pro',
    'Financeiro, DRE e medições',
    'RH e gestão de colaboradores',
    'Compras, materiais, contratos e aditivos',
    'Empresas e parceiros',
    'Orçamentos e controles administrativos',
    'IA do ArtiSys',
    'Limites ampliados de usuários, obras e computadores',
    'Acesso Desktop e PWA/mobile'
  ]
}

export function commercialPlan(code:string){return COMMERCIAL_PLANS.find(p=>p.code===code)||null}
export function featuresForPlan(code:string){const found=commercialPlan(code);return found?[...TIER_FEATURES[found.tier]]:[]}
export function catalogPublicView(plan:CommercialPlan){return{code:plan.code,tier:plan.tier,name:plan.name,interval:plan.interval,priceCents:plan.priceCents,currency:'BRL',features:featuresForPlan(plan.code),limits:{maxUsers:plan.limits.users,maxProjects:plan.limits.projects,maxDevices:plan.limits.devices},desktopIncluded:true,mobileIncluded:true}}
