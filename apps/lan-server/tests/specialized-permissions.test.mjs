import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import test from 'node:test'
import { createLanServer } from '../src/server.mjs'

const TOKEN = 'specialized-permission-token'
const digest = value => createHash('sha256').update(String(value)).digest('hex')
const domains = ['core', 'operation', 'planning', 'finance', 'rh']

function matrix(domain, actions) {
  return Object.fromEntries(domains.map(name => [name, name === domain ? actions : []]))
}

function security(domain, actions) {
  const permissions = matrix(domain, actions)
  return {
    serverState() { return { claimed: true, companyId: 'company-a' } },
    deviceByTokenHash(value) { return value === digest(TOKEN) ? { id: 'device-a', memberId: 'member-a', status: 'active' } : null },
    member(id) {
      return id === 'member-a'
        ? { memberId: id, role: 'employee', modules: ['obra360', 'rdo', 'finance', 'rh'], channels: ['desktop'], permissions, status: 'active' }
        : null
    },
    touchDevice() {}
  }
}

const services = {
  fieldService: { saveDailyReport(body) { return { id: Number(body.id || 1) } } },
  planningService: { overview() { return { ok: true } } },
  financeService: {
    accountPayment() { return { ok: true } },
    dre() { return [] },
    dashboard() { return { ok: true } },
    syncSummary() { return { ok: true } },
    syncObligations() { return [] }
  },
  payrollService: {
    getEmployee() { return { ok: true } },
    saveVariable() { return { ok: true } },
    removeVariable() { return true },
    confirm() { return { ok: true } },
    pending() { return [] }
  },
  timeService: {
    get() { return { ok: true } },
    autoFill() { return { ok: true } },
    save() { return { ok: true } },
    documentContext() { return { ok: true } }
  }
}

async function fixture(domain, actions) {
  const server = createLanServer({ security: security(domain, actions), ...services })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Servidor sem porta TCP.')
  return { server, baseUrl: `http://127.0.0.1:${address.port}` }
}

async function close(f) {
  f.server.close()
  await once(f.server, 'close')
}

const headers = { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' }
async function post(f, path, body = {}) {
  return fetch(`${f.baseUrl}${path}`, { method: 'POST', headers, body: JSON.stringify(body) })
}
async function get(f, path) {
  return fetch(`${f.baseUrl}${path}`, { headers: { authorization: `Bearer ${TOKEN}` } })
}

test('finance payment requires approve rather than generic create', async () => {
  const createOnly = await fixture('finance', ['create'])
  try { assert.equal((await post(createOnly, '/api/v1/finance/accounts/1/payment', { requestId: 'a', payment: {} })).status, 403) }
  finally { await close(createOnly) }

  const approver = await fixture('finance', ['approve'])
  try { assert.equal((await post(approver, '/api/v1/finance/accounts/1/payment', { requestId: 'b', payment: {} })).status, 200) }
  finally { await close(approver) }
})

test('RDO distinguishes create from edit by root id', async () => {
  const creator = await fixture('operation', ['create'])
  try {
    assert.equal((await post(creator, '/api/v1/field/rdo', { obra_id: 1, data: '2026-10-01' })).status, 201)
    assert.equal((await post(creator, '/api/v1/field/rdo', { id: 9, obra_id: 1, data: '2026-10-01' })).status, 403)
  } finally { await close(creator) }

  const editor = await fixture('operation', ['edit'])
  try {
    assert.equal((await post(editor, '/api/v1/field/rdo', { id: 9, obra_id: 1, data: '2026-10-01' })).status, 201)
    assert.equal((await post(editor, '/api/v1/field/rdo', { obra_id: 1, data: '2026-10-01' })).status, 403)
  } finally { await close(editor) }
})

test('planning and finance read endpoints require view', async () => {
  const planningViewer = await fixture('planning', ['view'])
  try { assert.equal((await get(planningViewer, '/api/v1/planning/overview?obra_id=1')).status, 200) }
  finally { await close(planningViewer) }

  const financeViewer = await fixture('finance', ['view'])
  try {
    assert.equal((await get(financeViewer, '/api/v1/finance/dre')).status, 200)
    assert.equal((await get(financeViewer, '/api/v1/finance/dashboard')).status, 200)
  } finally { await close(financeViewer) }
})

test('payroll routes map view, edit and approve independently', async () => {
  const viewer = await fixture('rh', ['view'])
  try {
    assert.equal((await post(viewer, '/api/v1/rh/payroll/employee')).status, 200)
    assert.equal((await post(viewer, '/api/v1/rh/payroll/pending')).status, 200)
    assert.equal((await post(viewer, '/api/v1/rh/payroll/save-variable')).status, 403)
    assert.equal((await post(viewer, '/api/v1/rh/payroll/confirm')).status, 403)
  } finally { await close(viewer) }

  const editor = await fixture('rh', ['edit'])
  try {
    assert.equal((await post(editor, '/api/v1/rh/payroll/save-variable')).status, 200)
    assert.equal((await post(editor, '/api/v1/rh/payroll/remove-variable', { id: 1 })).status, 200)
    assert.equal((await post(editor, '/api/v1/rh/payroll/confirm')).status, 403)
  } finally { await close(editor) }

  const approver = await fixture('rh', ['approve'])
  try {
    assert.equal((await post(approver, '/api/v1/rh/payroll/confirm')).status, 200)
    assert.equal((await post(approver, '/api/v1/rh/payroll/save-variable')).status, 403)
  } finally { await close(approver) }
})

test('time routes map reads to view and mutations to edit', async () => {
  const viewer = await fixture('rh', ['view'])
  try {
    assert.equal((await post(viewer, '/api/v1/rh/time/get')).status, 200)
    assert.equal((await post(viewer, '/api/v1/rh/time/document-context')).status, 200)
    assert.equal((await post(viewer, '/api/v1/rh/time/auto-fill')).status, 403)
    assert.equal((await post(viewer, '/api/v1/rh/time/save')).status, 403)
  } finally { await close(viewer) }

  const editor = await fixture('rh', ['edit'])
  try {
    assert.equal((await post(editor, '/api/v1/rh/time/auto-fill')).status, 200)
    assert.equal((await post(editor, '/api/v1/rh/time/save')).status, 200)
    assert.equal((await post(editor, '/api/v1/rh/time/get')).status, 403)
  } finally { await close(editor) }
})
