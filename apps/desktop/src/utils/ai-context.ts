type AnyRow = Record<string, any>

type AiContextInput = {
  question: string
  competence: string
  dashboard?: AnyRow | null
  works?: AnyRow[] | null
  accounts?: AnyRow[] | null
  people?: AnyRow[] | null
  tasks?: AnyRow[] | null
  today?: string
  screen?: string
  pathname?: string
  empresaId?: string
  obraId?: string
}

const DOMAIN_RULES: Array<[string, RegExp]> = [
  ['finance', /finance|conta|pagar|receber|receita|despesa|pagamento|vencid|pix|caixa|dre|saldo/i],
  ['costs', /custo|or[cç]amento|contrato|material|compra|fornecedor/i],
  ['production', /obra|produ[cç][aã]o|frente|rdo|di[aá]rio|execu[cç][aã]o/i],
  ['planning', /planejamento|cronograma|prazo|atras|tarefa|programa[cç][aã]o/i],
  ['rh', /funcion[aá]ri|colaborador|equipe|folha|sal[aá]rio|ponto|\brh\b/i],
  ['measurements', /medi[cç][aã]o|medido|saldo.*medir|avan[cç]o f[ií]sico/i],
  ['documents', /documento|fiscal|nota|arquivo|anexo/i],
]

const numberValue = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const textValue = (value: unknown) => String(value ?? '').trim()

const isSettled = (status: unknown) => /pago|recebido|liquidado|quitado|conclu|cancelado/i.test(textValue(status))

export function inferAiDomains(question: string) {
  const domains = DOMAIN_RULES.filter(([, rule]) => rule.test(question)).map(([domain]) => domain)
  if (!domains.includes('executive')) domains.push('executive')
  return domains.slice(0, 7)
}

export function buildAiAnalysisPayload(input: AiContextInput) {
  const dashboard = input.dashboard || {}
  const works = Array.isArray(input.works) ? input.works : []
  const accounts = Array.isArray(input.accounts) ? input.accounts : []
  const people = Array.isArray(input.people) ? input.people : []
  const tasks = Array.isArray(input.tasks) ? input.tasks : []
  const today = input.today || new Date().toISOString().slice(0, 10)

  const overdueAccounts = accounts
    .filter((row) => !isSettled(row.status) && (textValue(row.status).toLowerCase() === 'vencido' || (textValue(row.vencimento) && textValue(row.vencimento) < today)))
    .sort((a, b) => numberValue(b.valor_centavos) - numberValue(a.valor_centavos))

  const overdueValue = overdueAccounts.reduce((sum, row) => sum + numberValue(row.valor_centavos), 0)
  const openTasks = tasks.filter((row) => !isSettled(row.status))
  const activePeople = people.filter((row) => !/inativo|desligado|demitido|afastado/i.test(textValue(row.status || row.situacao_trabalhista)))

  const facts = [
    { key: 'period.competence', label: 'Competência analisada', value: input.competence },
    { key: 'finance.revenue', label: 'Receitas', value: numberValue(dashboard.receitas), unit: 'centavos' },
    { key: 'finance.expenses', label: 'Despesas', value: numberValue(dashboard.despesas), unit: 'centavos' },
    { key: 'finance.result', label: 'Resultado', value: numberValue(dashboard.resultado), unit: 'centavos' },
    { key: 'finance.payable', label: 'A pagar', value: numberValue(dashboard.a_pagar), unit: 'centavos' },
    { key: 'finance.receivable', label: 'A receber', value: numberValue(dashboard.a_receber), unit: 'centavos' },
    { key: 'finance.overdue_count', label: 'Contas vencidas', value: overdueAccounts.length, unit: 'registros' },
    { key: 'finance.overdue_value', label: 'Valor vencido', value: overdueValue, unit: 'centavos' },
    { key: 'operations.works', label: 'Obras cadastradas', value: works.length, unit: 'obras' },
    { key: 'rh.active_people', label: 'Pessoas ativas', value: activePeople.length, unit: 'pessoas' },
  ]

  const alerts: AnyRow[] = []
  if (numberValue(dashboard.resultado) < 0) {
    alerts.push({ key: 'finance.negative_result', severity: 'high', label: 'Resultado financeiro negativo', value: numberValue(dashboard.resultado), unit: 'centavos' })
  }
  if (overdueAccounts.length) {
    alerts.push({ key: 'finance.overdue_accounts', severity: 'high', label: 'Existem contas vencidas', count: overdueAccounts.length, value: overdueValue, unit: 'centavos' })
  }
  if (numberValue(dashboard.a_pagar) > numberValue(dashboard.a_receber) && numberValue(dashboard.a_pagar) > 0) {
    alerts.push({ key: 'finance.payable_pressure', severity: 'medium', label: 'A pagar supera a receber', payable: numberValue(dashboard.a_pagar), receivable: numberValue(dashboard.a_receber), unit: 'centavos' })
  }
  if (openTasks.length) {
    alerts.push({ key: 'planning.open_tasks', severity: 'info', label: 'Tarefas em aberto', count: openTasks.length })
  }

  const ranking = overdueAccounts.slice(0, 10).map((row, index) => ({
    position: index + 1,
    key: `overdue-${index + 1}`,
    label: textValue(row.descricao) || 'Conta vencida',
    value: numberValue(row.valor_centavos),
    unit: 'centavos',
    dueDate: textValue(row.vencimento) || undefined,
    workId: row.obra_id == null ? undefined : String(row.obra_id),
  }))

  const domains = inferAiDomains(`${input.screen || ''} ${input.question}`)
  const field = [
    `competencia:${input.competence}`,
    input.empresaId ? `empresa:${input.empresaId}` : '',
    input.obraId ? `obra:${input.obraId}` : '',
  ].filter(Boolean).join('|')

  return {
    question: input.question.trim(),
    route: { primary: domains[0] || 'executive', domains },
    context: {
      screen: input.screen || 'Assistente IA',
      field,
      pathname: input.pathname || '/assistente-ia',
    },
    facts,
    alerts,
    ranking,
  }
}
