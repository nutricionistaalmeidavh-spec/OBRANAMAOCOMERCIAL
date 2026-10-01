import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import path from 'node:path'
import test from 'node:test'
import { LanRepository } from '../src/repository.mjs'
import { createLanServer } from '../src/server.mjs'

const migrationsDir = path.resolve(import.meta.dirname, '../migrations')
const TOKENS = { principal: 'f8-f12-principal-token', clientA: 'f8-f12-client-a-token', clientB: 'f8-f12-client-b-token' }
const digest = value => createHash('sha256').update(String(value)).digest('hex')

function security() {
  const devices = new Map([
    [digest(TOKENS.principal), { id: 'device-principal', memberId: 'member-principal', status: 'active' }],
    [digest(TOKENS.clientA), { id: 'device-a', memberId: 'member-a', status: 'active' }],
    [digest(TOKENS.clientB), { id: 'device-b', memberId: 'member-b', status: 'active' }]
  ])
  const members = new Map([
    ['member-principal', { memberId: 'member-principal', role: 'admin', modules: ['obra360', 'rdo', 'finance', 'rh'], channels: ['desktop'], status: 'active' }],
    ['member-a', { memberId: 'member-a', role: 'employee', modules: ['obra360', 'rdo', 'finance', 'rh'], channels: ['desktop'], status: 'active' }],
    ['member-b', { memberId: 'member-b', role: 'employee', modules: ['obra360', 'rdo', 'finance', 'rh'], channels: ['desktop'], status: 'active' }]
  ])
  return {
    serverState() { return { claimed: true, companyId: 'company-f8-f12' } },
    deviceByTokenHash(value) { return devices.get(value) || null },
    member(id) { return members.get(id) || null },
    touchDevice() {}
  }
}

const headers = token => ({ authorization: `Bearer ${token}`, 'content-type': 'application/json' })
const get = (base, route, token) => fetch(base + route, { headers: { authorization: `Bearer ${token}` } })
const post = (base, route, body, token) => fetch(base + route, { method: 'POST', headers: headers(token), body: JSON.stringify(body) })

async function close(server, repository) {
  server.close()
  await once(server, 'close')
  repository.close()
}

test('F8-F12: PC principal e dois clientes compartilham operação, planejamento, financeiro e RH no mesmo banco central', async () => {
  const repository = new LanRepository({ filename: ':memory:' })
  repository.applyMigrations(migrationsDir)
  const server = createLanServer({ repository, security: security() })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Servidor LAN sem porta TCP.')
  const base = `http://127.0.0.1:${address.port}`

  try {
    const capsResponse = await get(base, '/api/v1/sync-source/capabilities', TOKENS.clientA)
    assert.equal(capsResponse.status, 200)
    const caps = await capsResponse.json()
    for (const module of ['operation', 'planning', 'finance', 'rh']) assert.ok(caps.modules.includes(module), `capability ausente: ${module}`)

    const companyResponse = await post(base, '/api/v1/empresas', { razao_social: 'Empresa F8-F12', cnpj: '12345678000195' }, TOKENS.clientA)
    assert.equal(companyResponse.status, 201)
    const company = await companyResponse.json()

    const clientResponse = await post(base, '/api/v1/clientes', { empresa_id: company.id, nome: 'Cliente Central' }, TOKENS.clientA)
    assert.equal(clientResponse.status, 201)
    const client = await clientResponse.json()

    const workResponse = await post(base, '/api/v1/obras', { empresa_id: company.id, cliente_id: client.id, nome: 'Obra F8-F12' }, TOKENS.clientA)
    assert.equal(workResponse.status, 201)
    const work = await workResponse.json()

    const principalWorks = await get(base, `/api/v1/obras?empresa_id=${company.id}`, TOKENS.principal)
    assert.equal(principalWorks.status, 200)
    assert.ok((await principalWorks.json()).some(item => item.id === work.id))

    const frontResponse = await post(base, '/api/v1/frentes_obra', { obra_id: work.id, nome: 'Torre A', status: 'ativa' }, TOKENS.clientA)
    assert.equal(frontResponse.status, 201)
    const front = await frontResponse.json()

    const rdoResponse = await post(base, '/api/v1/field/rdo', {
      obra_id: work.id,
      frente_id: front.id,
      data: '2026-10-01',
      atividades: 'Instalação hidráulica',
      equipe: [{ nome: 'Equipe A', funcao: 'Encanador', horas: 8 }],
      ocorrencias: [{ tipo: 'pendencia', descricao: 'Revisar prumada', status: 'aberta' }]
    }, TOKENS.clientA)
    assert.equal(rdoResponse.status, 201)
    const rdo = await rdoResponse.json()
    const rdosFromB = await get(base, `/api/v1/rdos?obra_id=${work.id}`, TOKENS.clientB)
    assert.equal(rdosFromB.status, 200)
    assert.ok((await rdosFromB.json()).some(item => item.id === rdo.id))

    const stageResponse = await post(base, '/api/v1/etapas_obra', { obra_id: work.id, frente_id: front.id, nome: 'Hidráulica', ordem: 1 }, TOKENS.clientA)
    assert.equal(stageResponse.status, 201)
    const stage = await stageResponse.json()
    const scheduleResponse = await post(base, '/api/v1/cronograma_etapas', {
      obra_id: work.id, etapa_id: stage.id, frente_id: front.id, nome: 'Prumadas', previsto_inicio: '2026-10-01', previsto_fim: '2026-10-10', percentual_previsto: 50, percentual_realizado: 25
    }, TOKENS.clientA)
    assert.equal(scheduleResponse.status, 201)
    const schedule = await scheduleResponse.json()
    const schedulesFromB = await get(base, `/api/v1/cronograma_etapas?obra_id=${work.id}`, TOKENS.clientB)
    assert.equal(schedulesFromB.status, 200)
    assert.ok((await schedulesFromB.json()).some(item => item.id === schedule.id))

    const categoryResponse = await post(base, '/api/v1/categorias_financeiras', { nome: 'QA F8-F12 Materiais', natureza: 'despesa', grupo_dre: 'custos_obra' }, TOKENS.clientA)
    assert.equal(categoryResponse.status, 201)
    const category = await categoryResponse.json()
    const accountResponse = await post(base, '/api/v1/contas', {
      tipo: 'pagar', empresa_id: company.id, obra_id: work.id, frente_id: front.id, categoria_id: category.id,
      descricao: 'Tubos', competencia: '2026-10', vencimento: '2026-10-15', valor_centavos: 25000
    }, TOKENS.clientA)
    assert.equal(accountResponse.status, 201)
    const account = await accountResponse.json()
    const accountsFromB = await get(base, `/api/v1/contas?empresa_id=${company.id}&obra_id=${work.id}`, TOKENS.clientB)
    assert.equal(accountsFromB.status, 200)
    assert.ok((await accountsFromB.json()).some(item => item.id === account.id))

    const cargoResponse = await post(base, '/api/v1/cargos', { empresa_id: company.id, nome: 'Encanador', salario_base_centavos: 300000, ativo: 1 }, TOKENS.clientA)
    assert.equal(cargoResponse.status, 201)
    const cargo = await cargoResponse.json()
    const employeeResponse = await post(base, '/api/v1/funcionarios', {
      empresa_id: company.id, obra_atual_id: work.id, cargo_id: cargo.id, nome: 'Funcionário F8-F12', cpf: '11122233344', status: 'ativo', salario_centavos: 300000,
      jornada_inicio: '07:00', intervalo_inicio: '11:00', intervalo_fim: '12:00', jornada_fim: '17:00'
    }, TOKENS.clientA)
    assert.equal(employeeResponse.status, 201)
    const employee = await employeeResponse.json()

    const fillFromB = await post(base, '/api/v1/rh/time/auto-fill', { funcionario_id: employee.id, competencia: '2026-10' }, TOKENS.clientB)
    assert.equal(fillFromB.status, 200)
    assert.equal((await fillFromB.json()).marks.length, 31)
    const pointFromA = await post(base, '/api/v1/rh/time/get', { funcionario_id: employee.id, competencia: '2026-10' }, TOKENS.clientA)
    assert.equal(pointFromA.status, 200)
    assert.equal((await pointFromA.json()).marks.length, 31)

    const payrollFromA = await post(base, '/api/v1/rh/payroll/employee', { funcionario_id: employee.id, competencia: '2026-10' }, TOKENS.clientA)
    assert.equal(payrollFromA.status, 200)
    assert.ok((await payrollFromA.json()).launches.some(item => item.tipo === 'salario'))
    const pendingFromB = await post(base, '/api/v1/rh/payroll/pending', { competencia: '2026-10' }, TOKENS.clientB)
    assert.equal(pendingFromB.status, 200)
    assert.ok((await pendingFromB.json()).some(item => item.funcionario_id === employee.id))

    assert.equal(repository.connection().prepare('SELECT COUNT(*) AS n FROM rdos WHERE obra_id=? AND deleted_at IS NULL').get(work.id).n, 1)
    assert.equal(repository.connection().prepare('SELECT COUNT(*) AS n FROM cronograma_etapas WHERE obra_id=? AND deleted_at IS NULL').get(work.id).n, 1)
    assert.equal(repository.connection().prepare('SELECT COUNT(*) AS n FROM contas WHERE obra_id=? AND deleted_at IS NULL').get(work.id).n, 1)
    assert.equal(repository.connection().prepare('SELECT COUNT(*) AS n FROM funcionarios WHERE empresa_id=? AND deleted_at IS NULL').get(company.id).n, 1)
  } finally {
    await close(server, repository)
  }
})
