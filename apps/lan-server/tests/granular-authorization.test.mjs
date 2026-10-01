import assert from 'node:assert/strict'
import test from 'node:test'
import {
  authorizeAction,
  authorizeBusinessRoute,
  LanAuthorizationError
} from '../src/authorization.mjs'

const context = member => ({
  companyId: 'company-a',
  device: { id: 'device-a', status: 'active' },
  member: {
    memberId: 'member-a',
    status: 'active',
    channels: ['desktop'],
    role: 'foreman',
    ...member
  }
})

function denied(work) {
  assert.throws(work, error => error instanceof LanAuthorizationError && error.status === 403)
}

test('generic CRUD uses independent granular actions when snapshot has permissions', () => {
  const viewer = context({ modules: ['obra360'], permissions: { core: ['view'] } })
  assert.doesNotThrow(() => authorizeBusinessRoute(viewer, { table: 'obras', method: 'GET' }))
  denied(() => authorizeBusinessRoute(viewer, { table: 'obras', method: 'PUT' }))
  denied(() => authorizeBusinessRoute(viewer, { table: 'obras', method: 'POST' }))
  denied(() => authorizeBusinessRoute(viewer, { table: 'obras', method: 'DELETE' }))
})

test('explicit specialized action does not inherit an unrelated HTTP write permission', () => {
  const operator = context({ modules: ['rdo'], permissions: { operation: ['create', 'approve'] } })
  assert.doesNotThrow(() => authorizeAction(operator, { domain: 'operation', action: 'create' }))
  assert.doesNotThrow(() => authorizeAction(operator, { domain: 'operation', action: 'approve' }))
  denied(() => authorizeAction(operator, { domain: 'operation', action: 'edit' }))
  denied(() => authorizeAction(operator, { domain: 'finance', action: 'approve' }))
})

test('module entitlement still caps granular actions', () => {
  const member = context({ modules: ['obra360'], permissions: { finance: ['view', 'approve'] } })
  denied(() => authorizeAction(member, { domain: 'finance', action: 'view' }))
  denied(() => authorizeAction(member, { domain: 'finance', action: 'approve' }))
})

test('legacy snapshot keeps the previous role/module policy', () => {
  const legacy = context({ modules: ['obra360'] })
  assert.doesNotThrow(() => authorizeBusinessRoute(legacy, { table: 'obras', method: 'PUT' }))
})
