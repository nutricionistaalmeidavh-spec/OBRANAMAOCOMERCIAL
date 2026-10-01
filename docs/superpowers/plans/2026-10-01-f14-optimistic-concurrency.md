# F14 Optimistic Concurrency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent stale Desktop writes from silently overwriting newer LAN-central data by adding explicit record revisions and conflict handling.

**Architecture:** Use a central sidecar revision table instead of adding columns to every business table. Generic CRUD and compound domain mutations validate `expectedRevision` inside the same write transaction and return an explicit `409 revision_conflict` when stale. Desktop preserves revision metadata and never retries a conflict automatically.

**Tech Stack:** Node.js 22, `node:sqlite`, native HTTP LAN server, Electron main process, Vitest, `node:test`, React/TypeScript Desktop.

**Spec:** `docs/superpowers/specs/2026-10-01-f14-f16-concurrency-permissions-admin-design.md`

## Global Constraints

- Do not modify or duplicate F13 backup/restore or F17 migration work.
- Do not create a second SyncCoordinator.
- Do not change Desktop ↔ Cloudflare/D1 ↔ PWA semantics.
- Do not create silent local fallback when central storage is active.
- `DESKTOP_AUTO_RELEASE_ENABLED=false` remains unchanged.
- No merge, production deploy or GitHub Release.
- Do not resolve conflicts with blind `ours/theirs` after the hardening branch is reconciled.

## Review Focus

1. Two clients saving the same revision: second write must fail with `409` and must not modify business data.
2. Delete with a stale revision: row must remain intact.
3. Compound writes: stale root revision must prevent every child mutation; a failed transaction must not increment revision.
4. Legacy/local mode: local SQLite behavior must remain unchanged and must not require revision metadata.
5. Reconciliation with F13/F17: hardening/migration repository and server changes must survive integration unchanged.

---

## File Structure

### New LAN concurrency unit
- Create `apps/lan-server/migrations/020_record_revisions.sql` — sidecar revision storage.
- Create `apps/lan-server/src/concurrency-service.mjs` — revision read/create/check/bump/conflict contract.
- Create `apps/lan-server/tests/concurrency-service.test.mjs` — unit tests for revision semantics.
- Create `apps/lan-server/tests/concurrency-api.test.mjs` — HTTP contract tests.

### LAN integration after hardening stabilizes
- Modify `apps/lan-server/src/repository.mjs` — generic CRUD revision integration.
- Modify `apps/lan-server/src/server.mjs` — parse `expectedRevision`, serialize `409`, advertise capability.
- Modify `apps/lan-server/src/field-service.mjs` — RDO root revision.
- Modify `apps/lan-server/src/payroll-service.mjs` — payroll root revision.
- Modify `apps/lan-server/src/time-service.mjs` — monthly-time root revision.
- Modify `apps/lan-server/src/finance-service.mjs` only where an existing resource state is mutated.

### Desktop transport/UX
- Modify `apps/desktop/electron/services/lan-data-client.cjs` — send `expectedRevision`, expose structured conflict error.
- Modify `apps/desktop/electron/services/data-access-service.cjs` — preserve returned `revision` on central records.
- Create `apps/desktop/electron/services/revision-conflict-error.cjs` — stable error shape used by central adapters.
- Create `apps/desktop/electron/services/revision-conflict-error.test.ts`.
- Modify `apps/desktop/src/App.tsx` and `apps/desktop/src/vite-env.d.ts` only for a generic user-visible conflict/reload path; do not add field-level merge UI.

---

### Task 1: Create the sidecar revision store and service

**Interfaces:**
- `ConcurrencyService.current(resourceType, resourceId) -> number`
- `ConcurrencyService.initialize(resourceType, resourceId) -> number`
- `ConcurrencyService.assertExpected(resourceType, resourceId, expectedRevision) -> number`
- `ConcurrencyService.bump(resourceType, resourceId) -> number`
- `ConcurrencyService.remove(resourceType, resourceId) -> void`
- `RevisionConflictError` properties: `resourceType`, `resourceId`, `expectedRevision`, `currentRevision`, `current`.

- [ ] **Step 1: Write failing service tests**

Cover: initialize at `1`; current read; successful `assertExpected`; stale assertion throws `revision_conflict`; bump `N→N+1`; remove deletes sidecar state; resource type/id isolation.

- [ ] **Step 2: Run RED**

Run: `node --test apps/lan-server/tests/concurrency-service.test.mjs`
Expected: FAIL because service/migration do not exist.

- [ ] **Step 3: Implement migration and `ConcurrencyService`**

`record_revisions(resource_type TEXT, resource_id TEXT, revision INTEGER NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(resource_type,resource_id))`.

- [ ] **Step 4: Run GREEN**

Run: `node --test apps/lan-server/tests/concurrency-service.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/lan-server/migrations/020_record_revisions.sql apps/lan-server/src/concurrency-service.mjs apps/lan-server/tests/concurrency-service.test.mjs
git commit -m "feat(f14): add central record revision service"
```

---

### Task 2: Version generic LAN CRUD

**Interfaces:**
- Existing list/get responses include transport metadata `revision`.
- POST creates revision `1` and returns it.
- PUT body contract becomes `{ expectedRevision, data }` for versioned central clients.
- DELETE requires `expectedRevision` via query/body contract selected consistently in `server.mjs`; use query `?expectedRevision=N` for DELETE because current DELETE has no JSON body.

- [ ] **Step 1: Write failing repository/API tests**

Test `obras`: two GETs return same revision; first PUT succeeds to N+1; second PUT with N returns 409; persisted row remains from first PUT; stale DELETE returns 409; fresh DELETE succeeds.

- [ ] **Step 2: Add transaction-failure assertion**

Force repository validation/write failure after revision precondition and assert revision remains N.

- [ ] **Step 3: Run RED**

Run: `node --test apps/lan-server/tests/concurrency-api.test.mjs`
Expected: FAIL against current last-write-wins behavior.

- [ ] **Step 4: Integrate revisions into final reconciled `repository.mjs`/`server.mjs`**

Use one `BEGIN IMMEDIATE` around expected-revision check + domain write + bump. Preserve F13 domain-integrity validation and F17 migration hooks.

- [ ] **Step 5: Serialize conflicts exactly**

`409 { error:'revision_conflict', resourceType, resourceId, expectedRevision, currentRevision, current }`.

- [ ] **Step 6: Advertise capability**

Add `optimistic-concurrency-v1` to `/api/v1/sync-source/capabilities.features` without removing existing module/capability fields.

- [ ] **Step 7: Run GREEN**

Run: `node --test apps/lan-server/tests/concurrency-api.test.mjs apps/lan-server/tests/*repository*.test.mjs`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/lan-server/src/repository.mjs apps/lan-server/src/server.mjs apps/lan-server/tests/concurrency-api.test.mjs
git commit -m "feat(f14): enforce revisions on LAN CRUD"
```

---

### Task 3: Protect compound mutations by logical root revision

**Interfaces:**
- RDO root: `rdos:<id>`.
- Payroll root: `folhas_pagamento:<id>`.
- Time root: `pontos_mensais:<id>`.
- Existing finance payment idempotency remains authoritative for duplicate payment requests; revision is only added when changing an existing root state.

- [ ] **Step 1: Add failing RDO compound test**

Two clients read same RDO revision; A saves full RDO; B stale save must return conflict and no child row may change.

- [ ] **Step 2: Add failing payroll/time tests**

Stale payroll confirm and stale monthly-time save must leave root and children untouched.

- [ ] **Step 3: Run RED**

Run focused operation/payroll/time suites.

- [ ] **Step 4: Add root-level concurrency wrappers**

Perform root revision check before child changes and bump only immediately before successful transaction commit.

- [ ] **Step 5: Run GREEN**

Run: `node --test apps/lan-server/tests/operation-api.test.mjs apps/lan-server/tests/payroll-service.test.mjs apps/lan-server/tests/time-service.test.mjs apps/lan-server/tests/concurrency-api.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/lan-server/src/field-service.mjs apps/lan-server/src/payroll-service.mjs apps/lan-server/src/time-service.mjs apps/lan-server/src/finance-service.mjs apps/lan-server/tests
git commit -m "feat(f14): protect compound LAN mutations"
```

---

### Task 4: Add Desktop revision transport and explicit conflict handling

**Interfaces:**
- `RevisionConflictError` is constructed only for HTTP `409/revision_conflict`.
- `LanDataClient` central update/delete methods accept an observed revision and send it unchanged.
- No automatic retry with `currentRevision`.

- [ ] **Step 1: Write failing LAN client tests**

Assert PUT wraps payload as `{ expectedRevision, data }`; DELETE adds expected revision; 409 becomes `RevisionConflictError` with server metadata.

- [ ] **Step 2: Run RED**

Run Desktop focused LAN client tests.

- [ ] **Step 3: Implement error class and client propagation**

Keep non-409 error behavior unchanged.

- [ ] **Step 4: Preserve revision through `DataAccessService`**

Central list/get/save responses retain `revision`; local mode remains byte-for-byte behavior-compatible at the public service boundary.

- [ ] **Step 5: Add generic renderer conflict UX**

On a structured revision conflict, show “Este registro foi alterado em outro computador.” and an explicit “Recarregar versão atual” action. Do not merge or resubmit automatically.

- [ ] **Step 6: Run GREEN**

Run Desktop focused suites plus lint.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/electron/services apps/desktop/src/App.tsx apps/desktop/src/vite-env.d.ts
git commit -m "feat(f14): surface central edit conflicts in Desktop"
```

---

### Task 5: Reconcile with F13/F17 and close F14 gate

- [ ] **Step 1: Compare against final `hardening/pr60-security-migration-docs` head**

Identify overlaps in `repository.mjs`, `server.mjs`, `lan-data-client.cjs` and storage/migration code.

- [ ] **Step 2: Reconcile consciously**

Preserve central backup/restore, migration, tenant-boundary and domain-integrity behavior; do not copy old pre-hardening hotspots wholesale.

- [ ] **Step 3: Run integrated two-client concurrency test**

A and B read N; A saves N→N+1; B stale save gets 409; B reloads N+1 and saves→N+2.

- [ ] **Step 4: Run full gates**

Desktop tests/lint/build, full LAN tests, Web/PWA regression tests. Confirm release publication remains disabled.

- [ ] **Step 5: Commit reconciliation only if needed**

```bash
git commit -m "test(f14): close optimistic concurrency gate"
```
