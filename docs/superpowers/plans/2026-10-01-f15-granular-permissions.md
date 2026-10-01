# F15 Granular Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one Cloud-authoritative business authorization model based on domain × action and enforce it consistently across LAN generic and specialized routes.

**Architecture:** Cloud computes effective permissions from role, member overrides, company entitlements, modules and channels. LAN stores only the resulting snapshot and evaluates actions locally while offline. Legacy snapshots without granular permissions keep the current role/modules/channels policy during rollout.

**Tech Stack:** Cloudflare backend TypeScript, LAN Node.js 22, `node:sqlite`, native HTTP, Web/Cloud tests, LAN `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-01-f14-f16-concurrency-permissions-admin-design.md`

## Global Constraints

- Cloudflare/D1 remains the only authority for member permissions.
- Do not create an editable ACL inside the LAN server.
- Universal actions are exactly `view`, `create`, `edit`, `delete`, `approve`.
- Domains are exactly `core`, `operation`, `planning`, `finance`, `rh`.
- Module/channel entitlement always caps granular permissions.
- Desktop channel remains mandatory for LAN use.
- Existing device revocation executes before granular business authorization.
- Preserve legacy snapshots during rollout.
- Do not touch F13/F17 implementation except during final branch reconciliation.
- No merge/deploy/release; automatic Desktop release remains disabled.

## Review Focus

1. A permission action must never grant access to a domain whose module entitlement is absent.
2. `create`, `edit`, `delete` and `approve` must remain independent; no implicit write umbrella.
3. Specialized endpoints must map to explicit actions rather than inheriting HTTP verb accidentally.
4. Snapshot refresh must change authorization without server restart or device re-pairing.
5. A legacy snapshot must keep the pre-F15 policy until a granular snapshot arrives.

---

## File Structure

### Shared permission contract / Cloud calculation
- Create `apps/web/backend/member-permissions.ts` — domain/action types, role templates, normalization and effective permission calculation.
- Create `apps/web/backend/member-permissions.test.ts`.
- Modify `apps/web/backend/index.ts` — extend `Member`, member entitlements and LAN snapshot payload generation with `permissions`/`permissionsRevision`.

### LAN snapshot/cache
- Create `apps/lan-server/migrations/021_permissions_cache.sql` — additive permission cache columns where needed.
- Modify `apps/lan-server/src/security-repository.mjs` — persist/read permissions and revision from snapshot.
- Create/modify `apps/lan-server/tests/permissions-snapshot.test.mjs`.

### LAN authorization
- Create `apps/lan-server/src/business-permissions.mjs` — table→domain and action evaluator.
- Create `apps/lan-server/tests/business-permissions.test.mjs`.
- Modify `apps/lan-server/src/authorization.mjs` — use granular policy when snapshot provides it; retain legacy fallback.
- Modify `apps/lan-server/src/server.mjs` after F13/F17 reconciliation to pass explicit domain/action for specialized routes.
- Extend API tests covering operation, planning, finance, payroll/time.

---

### Task 1: Define the single permission contract in Cloud code

**Interfaces:**
- `PermissionDomain = 'core'|'operation'|'planning'|'finance'|'rh'`
- `PermissionAction = 'view'|'create'|'edit'|'delete'|'approve'`
- `PermissionMatrix = Record<PermissionDomain, PermissionAction[]>`
- `roleTemplate(role) -> PermissionMatrix`
- `effectivePermissions({ role, customPermissions, modules, channels, companyModules, companyChannels }) -> PermissionMatrix`
- `permissionsRevision(matrix) -> string`

- [ ] **Step 1: Write failing contract tests**

Cover admin full access inside entitled domains; foreman/employee templates; custom restriction; custom expansion only inside entitlement; no Desktop channel does not fabricate LAN access; invalid actions/domains are removed.

- [ ] **Step 2: Run RED**

Run the focused backend test command for `member-permissions.test.ts`.
Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement normalization/templates/effective calculation**

Do not introduce alternate engine action names such as `write`, `update`, `confirm`, `pay`.

- [ ] **Step 4: Run GREEN**

Expected: focused tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/backend/member-permissions.ts apps/web/backend/member-permissions.test.ts
git commit -m "feat(f15): define granular business permission model"
```

---

### Task 2: Extend member/snapshot payloads with effective permissions

**Interfaces:**
- `Member` gains optional stored `permissions?: PermissionMatrix` for explicit customization.
- LAN member snapshot gains `permissions?: PermissionMatrix` and `permissionsRevision?: string`.
- Existing global snapshot/identity revision must change when effective permissions change.

- [ ] **Step 1: Write failing Cloud snapshot tests**

Assert: member with custom permissions returns capped effective permissions; removed company module removes the domain from effective permissions even if stored custom permission still contains actions; snapshot revision changes after effective permission change.

- [ ] **Step 2: Run RED**

Run focused backend snapshot/member tests.

- [ ] **Step 3: Wire `effectivePermissions` into current membership/entitlement and LAN snapshot construction**

Keep existing `role`, `modules`, `channels` fields for compatibility.

- [ ] **Step 4: Add legacy-member regression**

Member without stored permission matrix receives role template capped by current entitlements; no existing account is blocked solely because the new field is absent.

- [ ] **Step 5: Run GREEN**

Run backend critical auth/member/LAN claim snapshot suites.

- [ ] **Step 6: Commit**

```bash
git add apps/web/backend/index.ts apps/web/backend/member-permissions.ts apps/web/backend/*test.ts
git commit -m "feat(f15): publish effective permissions in LAN snapshots"
```

---

### Task 3: Persist granular snapshot data in LAN security cache

**Interfaces:**
- `security.member(memberId)` returns `permissions` and `permissionsRevision` when present.
- `replaceSnapshot()` atomically replaces permission data with the rest of the member snapshot.
- Older snapshots lacking fields remain valid.

- [ ] **Step 1: Write failing snapshot cache tests**

Test granular round-trip, legacy round-trip, refreshed permission replacement, and transaction rollback on a mismatched tenant snapshot.

- [ ] **Step 2: Run RED**

Run `node --test apps/lan-server/tests/permissions-snapshot.test.mjs`.

- [ ] **Step 3: Add additive cache migration and repository mapping**

Persist JSON only; do not add LAN mutation methods for permissions.

- [ ] **Step 4: Run GREEN**

Run permission snapshot + tenant boundary + identity refresh tests.

- [ ] **Step 5: Commit**

```bash
git add apps/lan-server/migrations/021_permissions_cache.sql apps/lan-server/src/security-repository.mjs apps/lan-server/tests/permissions-snapshot.test.mjs
git commit -m "feat(f15): cache Cloud permission snapshots on LAN"
```

---

### Task 4: Build the single LAN business authorization evaluator

**Interfaces:**
- `domainForTable(table) -> PermissionDomain|null`
- `actionForCrudMethod(method) -> PermissionAction|null`
- `authorizeAction(context, { domain, action, resource? }) -> { ok:true }` or throws `LanAuthorizationError`.
- Granular path is used when `context.member.permissions` exists; otherwise use current legacy policy.

- [ ] **Step 1: Write failing evaluator tests**

Cover `view` without edit; create without edit; edit without delete; approve independent; module missing overrides action; Desktop channel missing is blocked earlier; revoked device is blocked earlier; admin stays tenant-bound.

- [ ] **Step 2: Run RED**

Run `node --test apps/lan-server/tests/business-permissions.test.mjs`.

- [ ] **Step 3: Implement mappings and evaluator**

Table domains:
- `core`: empresas, clientes, obras.
- `operation`: frentes_obra, tarefas_obra, rdos and RDO child tables.
- `planning`: etapas_obra, cronograma_etapas, itens_orcamentarios.
- `finance`: fornecedores, categorias_financeiras, contas, pagamentos_conta.
- `rh`: funcionarios and existing RH catalog/payroll/time tables.

- [ ] **Step 4: Preserve legacy fallback**

Legacy path must exactly preserve current `authorizeBusinessRoute()` role/modules behavior until snapshot has granular permissions.

- [ ] **Step 5: Run GREEN**

Run evaluator + current authorization suites.

- [ ] **Step 6: Commit**

```bash
git add apps/lan-server/src/business-permissions.mjs apps/lan-server/src/authorization.mjs apps/lan-server/tests/business-permissions.test.mjs apps/lan-server/tests/authorization.test.mjs
git commit -m "feat(f15): enforce granular actions in LAN authorization"
```

---

### Task 5: Map every existing specialized endpoint to an explicit action

**Required mapping:**

- `GET /api/v1/sync-source/summary` → `finance:view`
- `GET /api/v1/sync-source/obligations` → `finance:view`
- `POST /api/v1/field/rdo` → `operation:create` for new root; `operation:edit` when updating an existing root; approval/finalization route, if present after reconciliation, → `operation:approve`
- `GET /api/v1/planning/overview` → `planning:view`
- `POST /api/v1/finance/accounts/:id/payment` → `finance:approve`
- `GET /api/v1/finance/dre` → `finance:view`
- `GET /api/v1/finance/dashboard` → `finance:view`
- `POST /api/v1/rh/payroll/employee` → `rh:view`
- `POST /api/v1/rh/payroll/save-variable` → `rh:edit`
- `POST /api/v1/rh/payroll/remove-variable` → `rh:edit`
- `POST /api/v1/rh/payroll/confirm` → `rh:approve`
- `POST /api/v1/rh/payroll/pending` → `rh:view`
- `POST /api/v1/rh/time/get` → `rh:view`
- `POST /api/v1/rh/time/auto-fill` → `rh:edit`
- `POST /api/v1/rh/time/save` → `rh:edit`
- `POST /api/v1/rh/time/document-context` → `rh:view`
- Admin LAN identity/pairing/device endpoints remain governed by Admin/device rules and are not business-domain permissions.

- [ ] **Step 1: Write failing specialized API permission matrix tests**

Use members with narrowly-scoped permissions and assert each route above allows only its declared action.

- [ ] **Step 2: Run RED**

Run specialized API test files.

- [ ] **Step 3: Replace implicit table/method authorization at specialized routes with explicit `authorizeAction` calls**

Keep generic CRUD method mapping in one shared place.

- [ ] **Step 4: Run GREEN**

Run all LAN API suites.

- [ ] **Step 5: Commit**

```bash
git add apps/lan-server/src/server.mjs apps/lan-server/tests
git commit -m "feat(f15): map specialized LAN routes to permission actions"
```

---

### Task 6: Prove live refresh and compatibility

- [ ] **Step 1: Add refresh test**

Member initially has `core:view,edit`; after `security.replaceSnapshot()` with `core:view` only, next request reads successfully and save returns 403 without restart.

- [ ] **Step 2: Add legacy rollout test**

Snapshot without `permissions` continues to pass current role/modules authorization.

- [ ] **Step 3: Run full LAN + Cloud auth gates**

Expected: all PASS.

- [ ] **Step 4: Confirm capability/policy version reporting**

Expose permission-policy version without removing existing capability fields.

- [ ] **Step 5: Commit**

```bash
git commit -am "test(f15): close granular permission rollout gate"
```
