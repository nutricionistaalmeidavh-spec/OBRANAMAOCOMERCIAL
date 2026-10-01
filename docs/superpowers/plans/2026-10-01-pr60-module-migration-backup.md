# PR #60 Module Migration and Backup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an explicit, safe, retryable local→central migration path for core, operation, planning, finance and RH, with mandatory backup, validation and rollback evidence.

**Architecture:** Introduce `core` as a first-class storage module so existing empresas/clientes/obras never disappear when LAN mode is selected. Add a migration protocol on the LAN server keyed by `migrationId` + `(sourceTable, sourceId)`, a Desktop `ModuleMigrationService` that performs preflight/backup/export/import/validate/commit, and hardened backup/restore primitives that never replace the active database before integrity/schema validation succeeds.

**Tech Stack:** Electron 43, Node.js 22, CommonJS services in Desktop main process, `better-sqlite3` locally, native `node:sqlite` on LAN server, Vitest 4 for Desktop services, `node:test` for LAN server.

**Spec:** `docs/superpowers/specs/2026-10-01-pr60-security-migration-hardening-design.md`

## Global Constraints

- Migration is never automatic when changing to `lan-host` or `lan-client`.
- Module order is exactly: `core` → `operation` → `planning` → `finance` → `rh`.
- Existing local data remains readable/writable locally while that module is `migration-required`; do not route it centrally until commit succeeds.
- New installations with no local records may move `central-ready` → `central-active` only when the server advertises the module capability.
- No silent local fallback from `central-ready`/`central-active` if the central source is unavailable.
- Backup is mandatory before the first remote write of each migration attempt.
- Retry must not duplicate central rows.
- A failed migration keeps the module `migration-required` and preserves the original local database.
- Do not enable public remote mode, release publishing or auto-update.

## Review Focus

1. Switching an existing installation to LAN mode must not make empresas/clientes/obras disappear before core migration — covered by Task 1.
2. Retrying after a timeout between remote write and client acknowledgement must resolve to the same central target row, not duplicate it — covered by Tasks 2 and 4.
3. A restore file that is valid SQLite but belongs to another schema/product must be rejected before the active DB is replaced — covered by Task 3.
4. Failure after some tables were imported must never set `central-active`; explicit rollback must affect only the current `migrationId` batch — covered by Tasks 2 and 4.
5. Dependency blocking must survive restart because module states/migration evidence are persisted rather than only held in memory — covered by Tasks 1, 2 and 4.

---

## File Structure

### Desktop storage/migration
- Modify `apps/desktop/electron/services/module-storage-state-service.cjs` — add `core`, dependency gates and an explicit promotion API used only by migration/new-install capability refresh.
- Modify `apps/desktop/electron/services/module-storage-state-service.test.ts` — core state and dependency tests.
- Modify `apps/desktop/electron/services/data-access-service.cjs` — route core through module state instead of transport readiness alone.
- Modify/create its existing test file for routing assertions.
- Create `apps/desktop/electron/services/module-migration-service.cjs` — orchestration only.
- Create `apps/desktop/electron/services/module-migration-service.test.ts` — orchestration tests with fake LAN/backup dependencies.
- Modify `apps/desktop/electron/services/lan-data-client.cjs` — migration protocol calls.
- Modify its existing tests.

### Backup/restore
- Modify `apps/desktop/electron/services/backup-service.cjs`.
- Create `apps/desktop/electron/services/backup-service.test.ts` if absent; otherwise extend the existing test.
- Create `apps/desktop/electron/services/backup-manifest.cjs` only if keeping manifest/integrity helpers separate materially reduces `BackupService` complexity.

### LAN migration protocol
- Create `apps/lan-server/migrations/006_module_migrations.sql`.
- Create `apps/lan-server/src/migration-service.mjs`.
- Create `apps/lan-server/tests/migration-service.test.mjs`.
- Modify `apps/lan-server/src/server.mjs` for authenticated migration endpoints.
- Modify `apps/lan-server/src/repository.mjs` only for the import primitives needed by `MigrationService`.

### Desktop wiring/UI
- Modify `apps/desktop/electron/main.cjs`.
- Modify `apps/desktop/electron/preload.cjs`.
- Modify `apps/desktop/src/vite-env.d.ts`.
- Modify `apps/desktop/src/components/StorageServerSettings.tsx`.
- Add/extend a component or IPC contract test rather than adding browser E2E solely for this feature.

---

### Task 1: Add the `core` storage gate

**Files:**
- Modify: `apps/desktop/electron/services/module-storage-state-service.cjs`
- Modify: `apps/desktop/electron/services/module-storage-state-service.test.ts`
- Modify: `apps/desktop/electron/services/data-access-service.cjs`
- Modify: existing `data-access-service` tests

**Interfaces:**
- Consumes: current storage modes and `lanClient.syncSourceCapabilities()`.
- Produces: `ModuleStorageStateService.state('core')`, `refreshCapabilities().core`, and routing where `empresas|clientes|obras` obey the core state.

- [ ] **Step 1: Write failing core-state tests**

Add tests asserting: local mode → `core: local`; LAN with local empresa/cliente/obra → `migration-required`; LAN without core rows + capability `core` → `central-active`; `migration-required` remains sticky.

- [ ] **Step 2: Write failing dependency tests**

Assert `operation`, `planning`, `finance`, and `rh` cannot become `central-active` while core is not `central-active`; include the empty-new-install case where core activates first during the same `refreshCapabilities()` call.

- [ ] **Step 3: Run and verify RED**

Run: `npm --workspace apps/desktop test -- module-storage-state-service.test.ts`
Expected: FAIL because `core` is not recognized and dependent modules can currently activate independently.

- [ ] **Step 4: Implement core in `ModuleStorageStateService`**

Add `core` to the module set; count active `empresas`, `clientes`, `obras`; expose a dependency check so non-core modules report `central-ready` with `coreDependencyBlocked: true` until core is active.

- [ ] **Step 5: Add explicit state transition method**

Add `activateAfterMigration(moduleName)` that only accepts a known module currently `migration-required` or `central-ready`, verifies dependencies from current persisted state, writes `central-active`, and returns the new state. Do not expose a generic arbitrary-state setter to renderer code.

- [ ] **Step 6: Write failing DataAccess routing tests**

Assert in LAN mode: core `migration-required` routes to local; core `central-ready` blocks with no fallback; core `central-active` routes remote.

- [ ] **Step 7: Implement core-aware routing**

Update `moduleForTable()` so `CORE_REMOTE_TABLES` maps to `core`; remove the special direct-remote core branch from `route()`.

- [ ] **Step 8: Run and verify GREEN**

Run: `npm --workspace apps/desktop test -- module-storage-state-service.test.ts data-access-service`
Expected: all focused tests PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/desktop/electron/services/module-storage-state-service.cjs apps/desktop/electron/services/module-storage-state-service.test.ts apps/desktop/electron/services/data-access-service.cjs apps/desktop/electron/services/*data-access*.test.*
git commit -m "feat(desktop): gate core data before LAN activation"
```

---

### Task 2: Add idempotent migration batches to the LAN server

**Files:**
- Create: `apps/lan-server/migrations/006_module_migrations.sql`
- Create: `apps/lan-server/src/migration-service.mjs`
- Create: `apps/lan-server/tests/migration-service.test.mjs`
- Modify: `apps/lan-server/src/server.mjs`
- Modify: `apps/lan-server/src/repository.mjs` only for import/remap support

**Interfaces:**
- Produces these authenticated endpoints:
  - `POST /api/v1/migrations/start`
  - `POST /api/v1/migrations/:migrationId/record`
  - `GET /api/v1/migrations/:migrationId/status`
  - `POST /api/v1/migrations/:migrationId/validate`
  - `POST /api/v1/migrations/:migrationId/commit`
  - `POST /api/v1/migrations/:migrationId/rollback`
- `start` body: `{ migrationId, module, sourceFingerprint, expectedCounts }`.
- `record` body: `{ sourceTable, sourceId, data }`; returns `{ sourceTable, sourceId, targetId, reused }`.
- Status returns per-table imported counts and migration state.
- Only Admin Desktop members may start/commit/rollback migrations; ordinary authorized users cannot mutate migration state.

- [ ] **Step 1: Write migration schema/service tests first**

Test valid module values (`core|operation|planning|finance|rh`), duplicate `start` with same fingerprint is idempotent, same `migrationId` with a different fingerprint is rejected, and migration records are unique by `(migration_id, source_table, source_id)`.

- [ ] **Step 2: Run and verify RED**

Run: `node --test apps/lan-server/tests/migration-service.test.mjs`
Expected: FAIL because migration schema/service does not exist.

- [ ] **Step 3: Implement migration tables**

`006_module_migrations.sql` must persist migration id, module, source fingerprint, expected-counts JSON, status (`started|validated|committed|rolled_back|failed`), timestamps, and a mapping table with source table/id, target table/id and import metadata sufficient for rollback.

- [ ] **Step 4: Implement `MigrationService.start(input, actor)` and `status(migrationId)`**

Reject unknown modules, mismatched retry fingerprints, and mutation of a committed/rolled-back migration. Return existing state for an exact retry.

- [ ] **Step 5: Write failing import-idempotency test**

Import the same source record twice and assert the same `targetId`, second response `reused: true`, and one central row.

- [ ] **Step 6: Implement `importRecord(migrationId, record)`**

Use the mapping table before inserting. Remap foreign-key source IDs to previously imported target IDs according to deterministic per-module table order; fail when a required parent mapping is absent instead of guessing.

- [ ] **Step 7: Add validation/commit tests**

`validate` must compare actual mapped counts with `expectedCounts`; mismatch leaves the batch uncommitted. `commit` is allowed only after validation.

- [ ] **Step 8: Add rollback tests**

Rollback a partially imported, uncommitted batch and assert only target rows created by that migration are removed in reverse dependency order; pre-existing target rows or mappings from another migration remain.

- [ ] **Step 9: Wire authenticated endpoints**

Require active device/member and Admin role for start/commit/rollback; allow status/record/validate only for the claimed instance and authenticated Desktop devices, with mutation permissions documented by the tests.

- [ ] **Step 10: Run and verify GREEN**

Run: `node --test apps/lan-server/tests/migration-service.test.mjs apps/lan-server/tests/migrations.test.mjs apps/lan-server/tests/full-flow.test.mjs`
Expected: all PASS.

- [ ] **Step 11: Commit**

```bash
git add apps/lan-server/migrations/006_module_migrations.sql apps/lan-server/src/migration-service.mjs apps/lan-server/src/server.mjs apps/lan-server/src/repository.mjs apps/lan-server/tests/migration-service.test.mjs
git commit -m "feat(lan): add idempotent module migration batches"
```

---

### Task 3: Harden Desktop backup and restore

**Files:**
- Modify: `apps/desktop/electron/services/backup-service.cjs`
- Create/modify: `apps/desktop/electron/services/backup-service.test.ts`
- Optional create: `apps/desktop/electron/services/backup-manifest.cjs`

**Interfaces:**
- `BackupService.create(options?)` returns `{ folder, database, manifest, fingerprint }` when a destination is selected.
- Add non-UI primitive `createSafetySnapshot({ reason, module, migrationId })` for migration use, stored under the app data backup directory without opening a dialog.
- `restore()` validates candidate SQLite before closing/replacing the live database.

- [ ] **Step 1: Write failing naming/manifest tests**

Assert backups use directory prefix `Obra-na-Mao-Backup-`, database filename `obra-na-mao.sqlite`, and JSON manifest containing timestamp, product, DB fingerprint/hash, schema indicator, reason/module/migrationId when supplied.

- [ ] **Step 2: Write failing integrity/schema tests**

Provide: non-SQLite bytes; corrupt SQLite; valid unrelated SQLite with no expected Obra na Mão tables. Assert all are rejected before `db.close()` or live-file replacement.

- [ ] **Step 3: Write failing restore recovery test**

Simulate a candidate that passes precheck but causes `db.open()` to fail after replacement; assert the safety copy is restored and the previous DB reopens.

- [ ] **Step 4: Run and verify RED**

Run: `npm --workspace apps/desktop test -- backup-service.test.ts`
Expected: FAIL against the current legacy backup implementation.

- [ ] **Step 5: Implement validated backup metadata**

Remove `Fluxo-DRE-Backup`/`fluxo-dre.sqlite` naming. Compute the fingerprint from the snapshot file, not from a mutable open DB stream.

- [ ] **Step 6: Implement candidate preflight**

Open the candidate read-only/temporary, run `PRAGMA integrity_check`, and assert required schema markers such as `empresas`, `obras`, `configuracoes` exist before touching the active DB.

- [ ] **Step 7: Implement safe replacement/recovery**

Always create a safety copy; on copy/open failure restore the prior file and reopen it before returning an error.

- [ ] **Step 8: Run and verify GREEN**

Run: `npm --workspace apps/desktop test -- backup-service.test.ts`
Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/desktop/electron/services/backup-service.cjs apps/desktop/electron/services/backup-service.test.ts apps/desktop/electron/services/backup-manifest.cjs
git commit -m "fix(desktop): validate backups and restores safely"
```

---

### Task 4: Implement `ModuleMigrationService` orchestration

**Files:**
- Create: `apps/desktop/electron/services/module-migration-service.cjs`
- Create: `apps/desktop/electron/services/module-migration-service.test.ts`
- Modify: `apps/desktop/electron/services/lan-data-client.cjs`
- Modify: existing LAN data client tests

**Interfaces:**
- Constructor: `new ModuleMigrationService({ database, storage, moduleStorage, lanClient, backup, appVersion })`.
- Public methods:
  - `preflight(moduleName) -> Promise<{ module, state, localCounts, capability, dependencies, canMigrate }>`
  - `migrate(moduleName) -> Promise<{ migrationId, module, backup, counts, status:'committed' }>`
  - `status(moduleName) -> object`
- Migration table order is fixed by module and kept in this service as declarative metadata.

- [ ] **Step 1: Write failing preflight tests**

Cover local mode rejection; unpaired/unreachable LAN rejection; missing capability; core dependency; module not in `migration-required`; valid migration-ready case.

- [ ] **Step 2: Run and verify RED**

Run: `npm --workspace apps/desktop test -- module-migration-service.test.ts`
Expected: FAIL because the service does not exist.

- [ ] **Step 3: Implement declarative export metadata**

Define ordered tables for `core`, `operation`, `planning`, `finance`, `rh`, plus which fields are local foreign keys that must be sent as source IDs for server remapping. Keep data extraction read-only.

- [ ] **Step 4: Add LAN client migration methods**

Add `migrationStart`, `migrationRecord`, `migrationStatus`, `migrationValidate`, `migrationCommit`, `migrationRollback` using Task 2 endpoints and existing bearer/sanitization behavior.

- [ ] **Step 5: Write failing backup-before-write test**

Record call order with mocks and assert `createSafetySnapshot()` completes before `migrationStart`/first `migrationRecord` remote write.

- [ ] **Step 6: Implement `migrate(moduleName)` happy path**

Generate UUID migrationId; capture fingerprint/counts; backup; start batch; export in table/id order; send records; validate; commit; call `moduleStorage.activateAfterMigration(moduleName)` only after successful commit.

- [ ] **Step 7: Write failure and retry tests**

Cover network failure before first record, failure midway, acknowledgement timeout followed by retry, validation-count mismatch, server commit failure. Assert module remains `migration-required`, local DB rows unchanged, and retry reuses the same batch when evidence identifies an unfinished attempt.

- [ ] **Step 8: Implement failure evidence and explicit rollback**

Persist migration attempt metadata in local `configuracoes` or a narrowly scoped new local migration table so restart can resume/retry. Call server rollback only for an uncommitted batch when the user/service explicitly chooses rollback; never delete local source rows.

- [ ] **Step 9: Run and verify GREEN**

Run: `npm --workspace apps/desktop test -- module-migration-service.test.ts lan-data-client`
Expected: all PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/desktop/electron/services/module-migration-service.cjs apps/desktop/electron/services/module-migration-service.test.ts apps/desktop/electron/services/lan-data-client.cjs apps/desktop/electron/services/*lan-data-client*.test.*
git commit -m "feat(desktop): orchestrate safe module migration"
```

---

### Task 5: Wire explicit migration controls into Electron and Settings

**Files:**
- Modify: `apps/desktop/electron/main.cjs`
- Modify: `apps/desktop/electron/preload.cjs`
- Modify: `apps/desktop/src/vite-env.d.ts`
- Modify: `apps/desktop/src/components/StorageServerSettings.tsx`
- Add/modify contract tests for IPC/preload/UI.

**Interfaces:**
- Expose renderer API:
  - `storage.migrationPreflight(module)`
  - `storage.migrateModule(module)`
  - `storage.migrationStatus(module)`
- Renderer never receives a method that directly writes `central-active`.

- [ ] **Step 1: Add IPC/preload contract tests**

Assert the three explicit methods exist and no `setModuleState`/`forceCentralActive` method is exposed.

- [ ] **Step 2: Wire `ModuleMigrationService` in `createServices()`**

Construct it from existing `db`, `storage`, `moduleStorage`, `dataAccess.remote`, `backup`, and `app.getVersion()` dependencies.

- [ ] **Step 3: Add IPC handlers**

Use `withSyncStopped()` around migration mutation so the Cloud sync coordinator does not race the source DB during backup/export/activation.

- [ ] **Step 4: Expand `StorageServerSettings` to five module blocks**

Render Core/Cadastros-base, Operação/RDO, Planejamento, Financeiro, RH. For `migration-required`, show an explicit migration action and copy stating a backup is created and local source data is preserved during copy.

- [ ] **Step 5: Add dependency UI assertions**

When core is not `central-active`, dependent modules show blocked status and no migration button. Do not offer a force-activation control.

- [ ] **Step 6: Add result/error UI tests**

Assert success refreshes all module states; failure keeps the module visibly `migration-required` and surfaces the error without switching modes.

- [ ] **Step 7: Run focused tests and build**

Run: `npm --workspace apps/desktop test -- StorageServerSettings migration`
Run: `npm --workspace apps/desktop run lint`
Expected: tests PASS and TypeScript build/lint succeeds.

- [ ] **Step 8: Commit**

```bash
git add apps/desktop/electron/main.cjs apps/desktop/electron/preload.cjs apps/desktop/src/vite-env.d.ts apps/desktop/src/components/StorageServerSettings.tsx apps/desktop/**/*test*
git commit -m "feat(desktop): add explicit central migration controls"
```

---

### Task 6: Migration regression gate

**Files:**
- Modify only files required by regressions.

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces: test evidence that core does not disappear, migration is retryable, and backups are safe.

- [ ] **Step 1: Run Desktop service tests**

Run: `npm run test:desktop`
Expected: all Desktop tests PASS.

- [ ] **Step 2: Run LAN server tests**

Run: `npm run test:lan-server`
Expected: all LAN tests PASS.

- [ ] **Step 3: Run repository-wide test command**

Run: `npm test`
Expected: all suites PASS or pre-existing unrelated failures are documented and not hidden by this branch.

- [ ] **Step 4: Verify no release behavior changed**

Inspect `apps/desktop/electron/updater-main.cjs`, package scripts and workflow diffs; expected no new publish/auto-update enablement.

- [ ] **Step 5: Commit any narrowly scoped regression fix**

```bash
git add apps/desktop apps/lan-server
git commit -m "test(storage): close migration regression gate"
```
