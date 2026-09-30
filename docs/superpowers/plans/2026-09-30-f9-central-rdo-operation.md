# F9 — Central RDO and Field Operation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make RDO, fronts, tasks and related field-operation data authoritative in the LAN server for fresh `lan-host`/`lan-client` installations, while preserving local mode and the existing PWA bridge.

**Architecture:** Extend the LAN SQLite with versioned operational schema, add domain endpoints for atomic RDO saves, route simple CRUD through the existing authenticated LAN client, and make the F8 LAN sync provider read/apply the already-existing bridge entities from the central database.

**Tech Stack:** Node `node:sqlite`, HTTP LAN server, Electron CommonJS, Vitest, node:test.

**Spec:** `docs/superpowers/specs/2026-09-30-centralized-modules-sync-f8-f12-design.md`

## Global Constraints

- No local fallback when a central module is active and the server is unavailable.
- Existing local mode and current UI stay functional.
- RDO save is atomic: RDO + team + equipment + occurrences + attachments metadata + generated tasks.
- Use existing LAN device identity/permissions; no second user model.
- PWA bridge continues through the F8 coordinator only.
- Existing installations with local RDO data become `migration-required`; F17 performs actual migration.

## Review Focus

- Editing an RDO must not leave stale child rows or duplicate tasks.
- A network error during a composite save must leave the central transaction unchanged.
- `rdo_anexos` metadata must not imply that local-only file bytes are available on another PC.
- A user without operational/Obra360 access must receive `403` from the server.
- Two clients must read the same committed RDO immediately from the same central DB.

---

### Task 1: Introduce LAN schema migrations and module capability state

**Files:**
- Create: `apps/lan-server/src/migrations.mjs`
- Create: `apps/lan-server/migrations/002_operation.sql`
- Create: `apps/lan-server/tests/migrations.test.mjs`
- Modify: `apps/lan-server/src/repository.mjs`
- Modify: `apps/lan-server/src/index.mjs`

**Interfaces:**
- Produces idempotent `applyLanMigrations(db, migrationsDir)`.
- Produces central module capability state for `operation` with schema version.

- [ ] **Step 1: Write failing migration tests**

Use a temporary file DB; open existing core schema, apply migrations twice, reopen it, and assert no destructive changes and that F9 tables/indexes exist.

- [ ] **Step 2: Run RED**

`npm --prefix apps/lan-server test`

Expected: FAIL because migration runner/F9 schema do not exist.

- [ ] **Step 3: Implement migration runner and F9 schema**

Create central tables for `frentes_obra`, `tarefas_obra`, `rdos`, `rdo_equipe`, `rdo_equipamentos`, `rdo_ocorrencias`, `rdo_anexos` and only the minimum relation columns required by current RDO behavior. Do not add document-byte storage or RH ownership here.

- [ ] **Step 4: Verify GREEN and persistent reopen**

Run LAN tests; expected PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat(lan): add versioned operation schema"`

---

### Task 2: Add authorized CRUD for field entities

**Files:**
- Modify: `apps/lan-server/src/repository.mjs`
- Modify: `apps/lan-server/src/server.mjs`
- Modify: `apps/lan-server/src/authorization.mjs`
- Create/Modify: `apps/lan-server/tests/operation-api.test.mjs`

**Interfaces:**
- Extend authenticated entity contract to `frentes_obra`, `tarefas_obra`, `rdos`, `rdo_equipe`, `rdo_equipamentos`, `rdo_ocorrencias`, `rdo_anexos` where generic CRUD is safe.
- `authorizeBusinessRoute` (or a new module-specific helper) requires Admin or current operational/Obra360 authorization.

- [ ] **Step 1: Write failing CRUD/auth tests**

Cover authorized reads/writes, unauthorized `403`, revoked device, FK/ownership validation and logical delete where the local schema uses it.

- [ ] **Step 2: Run RED**

`npm --prefix apps/lan-server test`

- [ ] **Step 3: Implement minimal repository fields/routes/authorization**

Keep table and field allowlists explicit.

- [ ] **Step 4: Verify GREEN**

Run LAN tests.

- [ ] **Step 5: Commit**

`git commit -m "feat(lan): expose authorized field operation CRUD"`

---

### Task 3: Port atomic RDO save to the server

**Files:**
- Create: `apps/lan-server/src/field-service.mjs`
- Modify: `apps/lan-server/src/server.mjs`
- Create: `apps/lan-server/tests/field-service.test.mjs`
- Create/Modify: `apps/lan-server/tests/operation-api.test.mjs`

**Interfaces:**
- Produces `FieldService.saveDailyReport(payload)` with behavior equivalent to Desktop `electron/services/field-service.cjs`.
- Produces `POST /api/v1/field/rdo` and `PUT /api/v1/field/rdo/:id` (or one equivalent explicit domain endpoint) under the same LAN auth.

- [ ] **Step 1: Write failing transaction tests**

Assert create, edit replacement of children, old occurrence-task cleanup, new task generation and rollback on an injected child failure.

- [ ] **Step 2: Run RED**

`npm --prefix apps/lan-server test`

- [ ] **Step 3: Implement server-side transaction**

Use one `BEGIN IMMEDIATE`/`COMMIT`/`ROLLBACK` transaction on the central `DatabaseSync`; do not perform the composite operation through multiple HTTP CRUD calls.

- [ ] **Step 4: Verify GREEN**

Run LAN tests.

- [ ] **Step 5: Commit**

`git commit -m "feat(lan): save RDO atomically on central server"`

---

### Task 4: Route Desktop field operations to the central source

**Files:**
- Modify: `apps/desktop/electron/services/lan-data-client.cjs`
- Modify: `apps/desktop/electron/services/data-access-service.cjs`
- Modify: `apps/desktop/electron/services/field-service.cjs` or introduce `field-source-service.cjs`
- Modify: `apps/desktop/electron/main.cjs`
- Modify: `apps/desktop/electron/services/*field*.test.ts`

**Interfaces:**
- `LanDataClient.saveDailyReport(payload)` calls the F9 domain endpoint.
- Generic data access treats F9 field tables as remote only when module state is `central-active`.
- Local mode still uses the current `FieldService` implementation unchanged.

- [ ] **Step 1: Write failing routing/no-fallback tests**

Assert fresh `lan-host` and `lan-client` use LAN; local uses SQLite; server failure rejects and leaves local tables untouched.

- [ ] **Step 2: Run RED**

`npm --prefix apps/desktop test -- field data-access lan-data-client`

- [ ] **Step 3: Implement minimal routing**

Do not duplicate UI or renderer APIs.

- [ ] **Step 4: Verify GREEN + full Desktop suite**

Run focused tests and `npm --prefix apps/desktop test`.

- [ ] **Step 5: Commit**

`git commit -m "feat(desktop): route RDO operation to LAN source"`

---

### Task 5: Activate central bridge for fronts, tasks and RDOs

**Files:**
- Modify: `apps/lan-server/src/server.mjs`
- Modify/Create: LAN sync-source repository/service tests
- Modify: `apps/desktop/electron/services/lan-sync-data-provider.cjs`
- Modify: `apps/desktop/electron/services/sync-coordinator.test.ts`

**Interfaces:**
- F8 sync-source capability now advertises `operation` and bridge entities `frentes_obra`, `tarefas_obra`, `rdos`.
- LAN provider supports list/get/applyRemote for those entities using authenticated server endpoints.

- [ ] **Step 1: Write failing end-to-end provider tests**

Seed central RDO/task/front data, run coordinator against fake OnlineService, assert push payload comes from central DB and a PWA remote edit is applied to central DB, not local DB.

- [ ] **Step 2: Run RED**

Run LAN and Desktop sync tests.

- [ ] **Step 3: Implement central sync-source operations**

Preserve current localId/device/revision/conflict semantics.

- [ ] **Step 4: Verify GREEN**

Run focused, full Desktop and LAN suites.

- [ ] **Step 5: Commit**

`git commit -m "feat(sync): bridge central RDO data through existing pipeline"`

---

### Task 6: Module activation and migration-required guard

**Files:**
- Create/Modify: Desktop storage module-state service/tests
- Modify: storage/settings UI tests only as necessary

- [ ] **Step 1: Write failing tests**

Assert a fresh DB can mark `operation=central-active`; any existing local RDO/front/task data yields `migration-required`; no automatic copy/delete occurs.

- [ ] **Step 2: Run RED**

Run focused Desktop tests.

- [ ] **Step 3: Implement state guard and explicit status copy**

- [ ] **Step 4: Verify GREEN**

Run full Desktop suite.

- [ ] **Step 5: Commit**

`git commit -m "feat(desktop): guard RDO central activation behind migration state"`

---

### Task 7: F9 regression gate

- [ ] Run `npm --prefix apps/desktop run lint`.
- [ ] Run `npm --prefix apps/desktop test`.
- [ ] Run `npm --prefix apps/desktop run build`.
- [ ] Run `npm --prefix apps/lan-server test`.
- [ ] Run existing Web/PWA/Cloudflare regression tests and verify Desktop → Cloud → PWA → Desktop remains green.
- [ ] Test two authenticated LAN clients against one temporary central DB.
- [ ] Keep PR draft; no merge/deploy.
