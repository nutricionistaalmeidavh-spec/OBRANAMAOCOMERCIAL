const test = require('node:test')
const assert = require('node:assert/strict')
const {
  PAYROLL_OVERVIEW_COLUMNS,
  payrollAmount,
  payrollPendingRows,
  payrollOverviewEmployeeRow,
  payrollOverviewCompanyExpenseRows,
  buildPayrollOverview,
  planningCurve,
  planningCash,
  rdoChildRows,
  rdoOccurrenceTask,
  paymentStatus
} = require('./index.cjs')

test('folha calcula líquido sem permitir resultado negativo', () => {
  assert.equal(payrollAmount([{ natureza: 'credito', valor_centavos: 10000 }, { natureza: 'desconto', valor_centavos: 2500 }]), 7500)
  assert.equal(payrollAmount([{ natureza: 'desconto', valor_centavos: 2500 }]), 0)
})

test('pendências da folha preservam regra da segunda quinzena', () => {
  const rows = payrollPendingRows({
    employee: { id: 1, nome: 'Ana' },
    cargo: { nome: 'Encanadora' },
    competencia: '2026-10',
    launches: [{ quinzena: 1, natureza: 'credito', valor_centavos: 1000 }],
    payments: []
  })
  assert.deepEqual(rows.map(row => row.quinzena), [1])
})

test('contrato da visão geral da folha expõe os grupos e colunas canônicos', () => {
  assert.deepEqual(PAYROLL_OVERVIEW_COLUMNS.map(item => [item.key,item.group]), [
    ['remuneracao.salario','remuneracao'],
    ['remuneracao.vale_adiantamento','remuneracao'],
    ['remuneracao.diarias','remuneracao'],
    ['remuneracao.empreitas','remuneracao'],
    ['remuneracao.outros','remuneracao'],
    ['beneficios.alimentacao','beneficios'],
    ['beneficios.transporte','beneficios'],
    ['beneficios.outros','beneficios'],
    ['descontos.faltas','descontos'],
    ['descontos.outros','descontos'],
    ['encargos.inss','encargos'],
    ['encargos.fgts','encargos'],
    ['encargos.outros','encargos']
  ])
})

test('visão geral classifica lançamentos por origem e preserva rastreabilidade por célula', () => {
  const row = payrollOverviewEmployeeRow({
    employee: { id: 7, nome: 'João da Silva' },
    cargo: { id: 2, nome: 'Encanador' },
    benefits: [
      { id: 10, nome: 'Vale-alimentação', tipo: 'alimentacao' },
      { id: 11, nome: 'Vale-transporte', tipo: 'transporte' },
      { id: 12, nome: 'Plano odontológico', tipo: 'saude' }
    ],
    launches: [
      { id: 1, tipo: 'salario', descricao: 'Salário base', natureza: 'credito', valor_centavos: 280000, origem: 'cargo' },
      { id: 2, tipo: 'vale_salario', descricao: 'Vale / adiantamento', natureza: 'credito', valor_centavos: 60000, origem: 'variavel' },
      { id: 3, tipo: 'diaria', descricao: 'Diária', natureza: 'credito', valor_centavos: 18000, origem: 'variavel' },
      { id: 4, tipo: 'empreita', descricao: 'Empreita', natureza: 'credito', valor_centavos: 30000, origem: 'variavel' },
      { id: 5, tipo: 'beneficio_10', descricao: 'Vale-alimentação', natureza: 'credito', valor_centavos: 35000, origem: 'cargo' },
      { id: 6, tipo: 'beneficio_11', descricao: 'Vale-transporte', natureza: 'credito', valor_centavos: 12000, origem: 'cargo' },
      { id: 7, tipo: 'beneficio_12', descricao: 'Plano odontológico', natureza: 'credito', valor_centavos: 8000, origem: 'cargo' },
      { id: 8, tipo: 'falta', descricao: 'Falta', natureza: 'desconto', valor_centavos: 9000, origem: 'variavel' },
      { id: 9, tipo: 'outro_desconto', descricao: 'Outro desconto', natureza: 'desconto', valor_centavos: 4000, origem: 'variavel' },
      { id: 10, tipo: 'inss', descricao: 'INSS', natureza: 'credito', valor_centavos: 22400, origem: 'importacao', importacao_linha_id: 50 },
      { id: 11, tipo: 'fgts', descricao: 'FGTS', natureza: 'credito', valor_centavos: 22400, origem: 'importacao', importacao_linha_id: 51 },
      { id: 12, tipo: 'seconci', descricao: 'SECONCI', natureza: 'credito', valor_centavos: 5000, origem: 'importacao', importacao_linha_id: 52 },
      { id: 13, tipo: 'ajuste', descricao: 'Ajuste positivo', natureza: 'credito', valor_centavos: 2000, origem: 'variavel' }
    ]
  })

  assert.deepEqual(row.remuneracao, {
    salario_centavos: 280000,
    vale_adiantamento_centavos: 60000,
    diarias_centavos: 18000,
    empreitas_centavos: 30000,
    outros_centavos: 2000
  })
  assert.deepEqual(row.beneficios, {
    alimentacao_centavos: 35000,
    transporte_centavos: 12000,
    outros_centavos: 8000
  })
  assert.deepEqual(row.descontos, { faltas_centavos: 9000, outros_centavos: 4000 })
  assert.deepEqual(row.encargos, { inss_centavos: 22400, fgts_centavos: 22400, outros_centavos: 5000 })
  assert.equal(row.total_funcionario_centavos, 432000)
  assert.equal(row.custo_empresa_centavos, 481800)
  assert.deepEqual(row.sources['remuneracao.salario'].map(source => source.id), [1])
  assert.deepEqual(row.sources['encargos.inss'][0], {
    kind: 'folha_lancamento',
    id: 10,
    origem: 'importacao',
    importacao_linha_id: 50
  })
})

test('lançamento desconhecido respeita a natureza e não transforma desconto em vale positivo', () => {
  const row = payrollOverviewEmployeeRow({
    employee: { id: 1, nome: 'Ana' },
    benefits: [],
    launches: [
      { id: 1, tipo: 'vale_importado', descricao: 'Vale antigo', natureza: 'desconto', valor_centavos: 15000 },
      { id: 2, tipo: 'credito_extra', descricao: 'Bônus', natureza: 'credito', valor_centavos: 20000 }
    ]
  })
  assert.equal(row.remuneracao.vale_adiantamento_centavos, 0)
  assert.equal(row.remuneracao.outros_centavos, 20000)
  assert.equal(row.descontos.outros_centavos, 15000)
})

test('despesas empresariais vêm de contas a pagar e excluem a própria folha para não duplicar salário', () => {
  const rows = payrollOverviewCompanyExpenseRows([
    { id: 1, tipo: 'pagar', descricao: 'Folha João', categoria_nome: 'Folha de pagamento', valor_centavos: 430000 },
    { id: 2, tipo: 'pagar', descricao: 'DAS Simples Nacional', categoria_nome: 'Impostos', valor_centavos: 435000, recorrencia: 'mensal' },
    { id: 3, tipo: 'pagar', descricao: 'Contabilidade', categoria_nome: 'Serviços', valor_centavos: 85000, recorrencia: 'mensal' },
    { id: 4, tipo: 'receber', descricao: 'Medição', categoria_nome: 'Receita', valor_centavos: 900000 },
    { id: 5, tipo: 'pagar', descricao: 'Seguro da empresa', categoria_nome: 'Seguros', valor_centavos: 120000, recorrencia: 'mensal', deleted_at: '2026-10-01' },
    { id: 6, tipo: 'pagar', descricao: 'Conta cancelada', categoria_nome: 'Outras despesas', valor_centavos: 99000, status: 'cancelado' }
  ])
  assert.deepEqual(rows.map(row => [row.id,row.group,row.valor_centavos]), [
    [2,'impostos',435000],
    [3,'contabilidade',85000]
  ])
  assert.equal(rows[0].sources[0].kind, 'conta')
})

test('visão geral consolida funcionário, encargos e despesas sem segunda fonte de verdade', () => {
  const overview = buildPayrollOverview({
    competencia: '2026-10',
    empresa_id: 3,
    obra_id: null,
    benefits: [],
    employeeEntries: [{
      employee: { id: 1, nome: 'Ana' },
      cargo: { nome: 'Ajudante' },
      launches: [
        { id: 1, tipo: 'salario', descricao: 'Salário', natureza: 'credito', valor_centavos: 200000 },
        { id: 2, tipo: 'inss', descricao: 'INSS', natureza: 'credito', valor_centavos: 16000 }
      ]
    }],
    accounts: [
      { id: 2, tipo: 'pagar', descricao: 'DAS Simples Nacional', categoria_nome: 'Impostos', valor_centavos: 50000 }
    ]
  })
  assert.equal(overview.contract_version, 1)
  assert.equal(overview.totals.total_funcionarios_centavos, 200000)
  assert.equal(overview.totals.custo_funcionarios_centavos, 216000)
  assert.equal(overview.totals.despesas_empresa_centavos, 50000)
  assert.equal(overview.totals.custo_competencia_centavos, 266000)
})

test('planejamento calcula curva e caixa acumulados deterministicamente', () => {
  assert.deepEqual(planningCurve([
    { id: 1, nome: 'A', previsto_fim: '2026-10-01', custo_planejado_centavos: 100, custo_realizado_centavos: 40, percentual_previsto: 50, percentual_realizado: 20 },
    { id: 2, nome: 'B', previsto_fim: '2026-10-02', custo_planejado_centavos: 200, custo_realizado_centavos: 60, percentual_previsto: 100, percentual_realizado: 50 }
  ]).map(x => [x.previsto_centavos, x.realizado_centavos]), [[100,40],[300,100]])
  assert.deepEqual(planningCash([
    { tipo: 'pagar', competencia: '2026-10', valor: 30 },
    { tipo: 'receber', competencia: '2026-10', valor: 100 },
    { tipo: 'pagar', competencia: '2026-11', valor: 20 }
  ]).map(x => [x.competencia,x.saldo_acumulado_centavos]), [['2026-10',70],['2026-11',50]])
})

test('RDO normaliza filhos e gera tarefa somente para ocorrência aberta', () => {
  assert.deepEqual(rdoChildRows([{ horas: '8', custo_centavos: '1200' }], 9, 3, 'equipe')[0], {
    horas: 8, custo_centavos: 1200, rdo_id: 9, frente_id: 3, funcionario_id: null
  })
  assert.equal(rdoOccurrenceTask({ status: 'resolvida' }, { obra_id: 1, data: '2026-10-05' }, 1), null)
  assert.match(rdoOccurrenceTask({ tipo: 'pendencia', descricao: 'Teste' }, { obra_id: 1, data: '2026-10-05' }, 7).titulo, /Teste/)
})

test('financeiro deriva status de pagamento por valor acumulado', () => {
  assert.equal(paymentStatus({ tipo: 'pagar', valor_centavos: 10000 }, 4000), 'parcialmente_pago')
  assert.equal(paymentStatus({ tipo: 'pagar', valor_centavos: 10000 }, 10000), 'pago')
  assert.equal(paymentStatus({ tipo: 'receber', valor_centavos: 10000 }, 10000), 'recebido')
})
