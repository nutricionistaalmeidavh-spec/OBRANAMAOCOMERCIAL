import assert from 'node:assert/strict'
import test from 'node:test'
import {
  actionForCrudMethod,
  domainForTable,
  granularPermissionDecision
} from '../src/business-permissions.mjs'

test('maps every central business table to one permission domain', () => {
  assert.equal(domainForTable('empresas'), 'core')
  assert.equal(domainForTable('rdos'), 'operation')
  assert.equal(domainForTable('rdo_ocorrencias'), 'operation')
  assert.equal(domainForTable('cronograma_etapas'), 'planning')
  assert.equal(domainForTable('contas'), 'finance')
  assert.equal(domainForTable('pagamentos_funcionario'), 'rh')
  assert.equal(domainForTable('unknown'), null)
})

test('maps generic CRUD methods to independent actions', () => {
  assert.equal(actionForCrudMethod('GET'), 'view')
  assert.equal(actionForCrudMethod('POST'), 'create')
  assert.equal(actionForCrudMethod('PUT'), 'edit')
  assert.equal(actionForCrudMethod('PATCH'), 'edit')
  assert.equal(actionForCrudMethod('DELETE'), 'delete')
  assert.equal(actionForCrudMethod('OPTIONS'), null)
})

test('view does not imply edit/create/delete/approve', () => {
  const member = { modules: ['obra360'], permissions: { core: ['view'] } }
  assert.equal(granularPermissionDecision(member, 'core', 'view'), true)
  for (const action of ['create', 'edit', 'delete', 'approve']) {
    assert.equal(granularPermissionDecision(member, 'core', action), false)
  }
})

test('create, edit, delete and approve remain independent', () => {
  const member = { modules: ['rdo'], permissions: { operation: ['create', 'approve'] } }
  assert.equal(granularPermissionDecision(member, 'operation', 'create'), true)
  assert.equal(granularPermissionDecision(member, 'operation', 'approve'), true)
  assert.equal(granularPermissionDecision(member, 'operation', 'edit'), false)
  assert.equal(granularPermissionDecision(member, 'operation', 'delete'), false)
})

test('module entitlement caps a permission even if snapshot action is present', () => {
  const member = { modules: ['obra360'], permissions: { finance: ['view', 'approve'], rh: ['view'] } }
  assert.equal(granularPermissionDecision(member, 'finance', 'view'), false)
  assert.equal(granularPermissionDecision(member, 'finance', 'approve'), false)
  assert.equal(granularPermissionDecision(member, 'rh', 'view'), false)
})

test('dre entitlement permits finance view only, never finance mutations', () => {
  const member = { modules: ['dre'], permissions: { finance: ['view', 'edit', 'approve'] } }
  assert.equal(granularPermissionDecision(member, 'finance', 'view'), true)
  assert.equal(granularPermissionDecision(member, 'finance', 'edit'), false)
  assert.equal(granularPermissionDecision(member, 'finance', 'approve'), false)
})

test('legacy member without permission matrix returns null for fallback policy', () => {
  assert.equal(granularPermissionDecision({ modules: ['obra360'] }, 'core', 'view'), null)
})

test('unknown domain or action never grants access', () => {
  const member = { modules: ['obra360'], permissions: { core: ['view'] } }
  assert.equal(granularPermissionDecision(member, 'unknown', 'view'), false)
  assert.equal(granularPermissionDecision(member, 'core', 'write'), false)
})
