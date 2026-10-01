# PR #60 LAN Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the LAN server so claim identity, device credentials and domain relationships remain isolated and consistent before PR #60 can merge.

**Architecture:** Keep the current LAN server single-tenant by instance: the Cloud `companyId` remains bound to `lan_server_identity`, while operational `empresas.id` stays an internal integer domain key. Strengthen transactionality around claim/snapshot state and add relationship validation in the central repository so generic CRUD and specialized services enforce the same invariants.

**Tech Stack:** Node.js 22.13+, native `node:http`, `node:sqlite` (`DatabaseSync`), `node:test`, Electron Desktop consumer.

**Spec:** `docs/superpowers/specs/2026-10-01-pr60-security-migration-hardening-design.md`

## Global Constraints

- Preserve operational modes `local`, `lan-host` and `lan-client`.
- The LAN server remains single-tenant per Cloud claim; do not compare textual Cloud `companyId` directly with integer operational `empresa_id`.
- Do not create a public remote-server mode in this plan.
- Do not alter the existing Desktop ↔ Cloudflare/D1 ↔ PWA flow unless compatibility requires it.
- Do not add silent local fallback when central storage is configured.
- Do not expose `serverToken`, token hashes, setup-code hashes or other persisted secrets from public endpoints.
- Do not enable release or auto-update publication.
- Follow TDD: failing test, minimal implementation, passing test, commit.

## Review Focus

1. A valid token from a different LAN instance must be rejected without leaking whether the member exists locally — covered by Task 1.
2. A second claim or mismatched snapshot must leave identity, members and devices exactly unchanged — covered by Task 1.
3. Valid foreign-key IDs from different domain parents must not be combinable into an incoherent record — covered by Task 2.
4. `PUT` must not move an existing record across company/work/employee ownership when child relationships would become invalid — covered by Task 2.
5. Revoked/expired authorization must stop both generic CRUD and specialized Finance/RH/Planning endpoints immediately — covered by Tasks 3 and 4.

---

## File Structure

- Create `apps/lan-server/tests/tenant-boundary.test.mjs` — cross-instance claim/token/snapshot/secret boundary tests.
- Create `apps/lan-server/tests/domain-integrity.test.mjs` — repository relationship validation tests across core, operation, planning, finance and RH.
- Create `apps/lan-server/tests/domain-integrity-api.test.mjs` — HTTP parity tests for generic and specialized routes.
- Modify `apps/lan-server/src/security-repository.mjs` — transactional identity/snapshot invariants only where tests expose a gap.
- Modify `apps/lan-server/src/authorization.mjs` — authentication/authorization behavior only where tests expose a gap.
- Modify `apps/lan-server/src/repository.mjs` — centralized domain relationship assertions used by all persistence paths.
- Modify `apps/lan-server/src/server.mjs` — preserve authorization context and normalize validation/404 behavior.
- Modify specialized services only if a test proves they bypass repository invariants: `planning-service.mjs`, `finance-service.mjs`, `payroll-service.mjs`, `time-service.mjs`, `field-service.mjs`.
- Extend existing tests: `authorization.test.mjs`, `pairing-service.test.mjs`, `full-flow.test.mjs` when the behavior belongs to an existing contract.

---

### Task 1: Lock the LAN instance identity boundary

**Files:**
- Create: `apps/lan-server/tests/tenant-boundary.test.mjs`
- Modify if required: `apps/lan-server/src/security-repository.mjs`
- Modify if required: `apps/lan-server/src/server.mjs`
- Test: `apps/lan-server/tests/tenant-boundary.test.mjs`

**Interfaces:**
- Consumes: `LanRepository`, `LanSecurityRepository`, `ServerIdentity`, `PairingService`, `createLanServer()`.
- Produces: the invariant that a claimed LAN database has one immutable Cloud tenant identity and instance-local device tokens.

- [ ] **Step 1: Write failing cross-instance token test**

Create a test named `token from server B is rejected by server A` that claims two in-memory servers with different Cloud company IDs, creates a device token on B, sends it to A, and asserts HTTP `401 invalid_device_token`; assert the response body does not contain either raw token.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test apps/lan-server/tests/tenant-boundary.test.mjs`
Expected: FAIL if any cross-instance credential is accepted or secret text leaks.

- [ ] **Step 3: Implement the minimal credential-boundary fix**

Keep device lookup local to each `LanSecurityRepository` database and ensure error serialization in `server.mjs` never echoes authorization values.

- [ ] **Step 4: Add second-claim transaction test**

Add `claimed server rejects second company claim without mutation`; snapshot `serverState()`, `members()` and `listDevices()` before the second claim, attempt a claim for another company, assert rejection and deep equality afterward.

- [ ] **Step 5: Add mismatched-snapshot transaction test**

Add `replaceSnapshot rejects another company atomically`; assert the old revision/member cache is preserved after the rejected call.

- [ ] **Step 6: Add secret-surface regression test**

Call `/health`, `/version`, `/api/v1/setup/status`, `/api/v1/admin/status` and a validation error path; assert serialized responses do not contain `serverToken`, `tokenHash`, `setupCodeHash` or known fixture secrets.

- [ ] **Step 7: Run focused tests and verify GREEN**

Run: `node --test apps/lan-server/tests/tenant-boundary.test.mjs apps/lan-server/tests/identity-refresh.test.mjs apps/lan-server/tests/full-flow.test.mjs`
Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/lan-server/tests/tenant-boundary.test.mjs apps/lan-server/src/security-repository.mjs apps/lan-server/src/server.mjs
git commit -m "test(lan): lock tenant identity boundary"
```

---

### Task 2: Centralize domain relationship validation

**Files:**
- Create: `apps/lan-server/tests/domain-integrity.test.mjs`
- Modify: `apps/lan-server/src/repository.mjs`

**Interfaces:**
- Consumes: existing `LanRepository.save(table, data)`, `get`, `list`, `remove` and current table metadata.
- Produces: `validateDomainOwnership(table, data, clean)` called by `save()` before INSERT/UPDATE, composed from focused helpers for core/operation/planning/finance/RH.

- [ ] **Step 1: Write failing core/operation relationship tests**

Cover at minimum: cliente→empresa, obra→empresa/cliente, frente→obra, tarefa→obra/frente, RDO→obra/frente, RDO child→RDO/front. Use valid IDs that belong to different parent records and assert validation failure.

- [ ] **Step 2: Run and verify RED**

Run: `node --test apps/lan-server/tests/domain-integrity.test.mjs`
Expected: at least one cross-parent combination is currently accepted and the suite fails.

- [ ] **Step 3: Implement `validateOperationOwnership(table, data, clean)`**

Resolve the effective value from `clean` or the current row during update; reject a referenced front/RDO/task when it does not belong to the same work/root required by the target row.

- [ ] **Step 4: Add planning regression assertions**

Assert stage/front belong to the same work for `etapas_obra`, `cronograma_etapas`, and `itens_orcamentarios`, including a `PUT` that attempts to change `obra_id` while keeping an incompatible `etapa_id` or `frente_id`.

- [ ] **Step 5: Add finance relationship assertions**

Assert `contas.empresa_id` agrees with referenced obra, frente, fornecedor and cliente; `pagamentos_conta.conta_id` must reference an existing account; reject a `PUT` that moves an account to another company while retaining old relations.

- [ ] **Step 6: Add RH relationship assertions**

Cover employee/company, employee/work assignment, cargo/benefit links, payroll→company/employee, payment→payroll/employee, monthly time→employee, time marks→monthly time, employee PPE→employee/PPE.

- [ ] **Step 7: Implement a single `validateDomainOwnership(table, data, clean)` entry point**

Have `save()` call it once before mutation. Reuse existing planning/finance/RH helpers rather than duplicating SQL; add only the missing core/operation/payment-parent checks.

- [ ] **Step 8: Run focused tests and verify GREEN**

Run: `node --test apps/lan-server/tests/domain-integrity.test.mjs apps/lan-server/tests/*repository.test.mjs`
Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/lan-server/src/repository.mjs apps/lan-server/tests/domain-integrity.test.mjs
git commit -m "fix(lan): enforce central domain integrity"
```

---

### Task 3: Prove generic HTTP CRUD preserves repository invariants

**Files:**
- Create: `apps/lan-server/tests/domain-integrity-api.test.mjs`
- Modify if required: `apps/lan-server/src/server.mjs`

**Interfaces:**
- Consumes: Task 2 `LanRepository.save()` validation and existing authenticated entity routes.
- Produces: stable HTTP behavior: invalid relationships → `400 validation_error`; missing IDs → `404 not_found`; no secret data in either response.

- [ ] **Step 1: Write failing generic-route tests**

Through a claimed test server, create valid parent data and attempt invalid POST/PUT combinations for one operation entity, one finance entity and one RH entity; assert `400 validation_error`.

- [ ] **Step 2: Add 404 regression tests**

For GET/PUT/DELETE of an absent numeric ID, assert `404 not_found` and no stack trace/secret in the body.

- [ ] **Step 3: Run and verify RED**

Run: `node --test apps/lan-server/tests/domain-integrity-api.test.mjs`
Expected: FAIL only where server behavior does not match the contract.

- [ ] **Step 4: Normalize `handleEntityRequest()` only as required**

Do not weaken repository validation. Preserve `404` for missing rows and map relationship exceptions to the existing `validation_error` envelope.

- [ ] **Step 5: Run and verify GREEN**

Run: `node --test apps/lan-server/tests/domain-integrity-api.test.mjs apps/lan-server/tests/operation-api.test.mjs apps/lan-server/tests/finance-api.test.mjs`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/lan-server/src/server.mjs apps/lan-server/tests/domain-integrity-api.test.mjs
git commit -m "test(lan): enforce integrity through HTTP CRUD"
```

---

### Task 4: Make specialized endpoints obey the same authorization lifecycle

**Files:**
- Modify: `apps/lan-server/tests/authorization.test.mjs`
- Modify: `apps/lan-server/tests/pairing-service.test.mjs`
- Modify relevant API tests: `operation-api.test.mjs`, `planning-api.test.mjs`, `finance-api.test.mjs`, RH/payroll/time API tests present on the branch
- Modify specialized service/server code only if the tests expose a bypass.

**Interfaces:**
- Consumes: `authenticateLanRequest()`, `authorizeBusinessRoute()`, repository invariants from Task 2.
- Produces: revocation/member/channel/module checks before every protected specialized operation.

- [ ] **Step 1: Add revoked-device specialized-endpoint tests**

Use one representative endpoint per group: RDO save, planning overview, finance payment/DRE, payroll confirm or time save. Revoke the token after initial success and assert the next request returns `403 device_revoked`.

- [ ] **Step 2: Add member/channel/module refresh tests**

Replace the cached snapshot so the member becomes inactive, loses `desktop`, or loses the required module; assert subsequent generic and specialized calls fail without restarting the server.

- [ ] **Step 3: Add pairing lifecycle tests**

Assert a consumed code cannot be reused and an expired code cannot create a device. Confirm failed redemption does not create a device/audit success event.

- [ ] **Step 4: Run and verify RED**

Run: `node --test apps/lan-server/tests/authorization.test.mjs apps/lan-server/tests/pairing-service.test.mjs apps/lan-server/tests/*api.test.mjs`
Expected: FAIL if any specialized path bypasses current authorization.

- [ ] **Step 5: Apply minimal fixes**

Keep authentication in `server.mjs` before service invocation; do not introduce service-specific duplicate token parsing.

- [ ] **Step 6: Run and verify GREEN**

Run the same command; expected all PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/lan-server/src apps/lan-server/tests
git commit -m "fix(lan): harden authorization lifecycle"
```

---

### Task 5: LAN security regression gate

**Files:**
- Modify only tests/code required by discovered regressions.

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: green LAN-server security gate with no release/deploy action.

- [ ] **Step 1: Run the complete LAN server suite**

Run: `npm run test:lan-server`
Expected: all tests PASS.

- [ ] **Step 2: Run repository-wide tests affected by contracts**

Run: `npm test`
Expected: Web, Desktop and LAN-server tests PASS or any unrelated pre-existing failure is documented before touching it.

- [ ] **Step 3: Inspect diff for accidental scope expansion**

Run: `git diff --stat feat/desktop-lan-server-foundation...HEAD` and `git diff feat/desktop-lan-server-foundation...HEAD -- apps/lan-server`
Expected: only security/integrity/tests plus approved plan/spec changes; no updater/release enablement.

- [ ] **Step 4: Commit any test-only cleanup**

```bash
git add apps/lan-server
git commit -m "test(lan): close security regression gate"
```
