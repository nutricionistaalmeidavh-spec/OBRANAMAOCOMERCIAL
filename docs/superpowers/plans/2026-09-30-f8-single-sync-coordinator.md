# F8 — Single Sync Coordinator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the PC principal (`lan-host`) the only Desktop allowed to coordinate Cloudflare/PWA sync, while preserving the existing sync algorithm and local mode behavior.

**Architecture:** Split synchronization into coordinator state + operational data provider. The current SQLite path becomes `LocalSyncDataProvider`; `lan-host` uses a LAN provider and `lan-client` never runs the central sync. No second Cloud pipeline or endpoint family is introduced.

**Tech Stack:** Electron, CommonJS, better-sqlite3, Node HTTP LAN server, Vitest, node:test, Cloudflare Worker/Web regression suite.

**Spec:** `docs/superpowers/specs/2026-09-30-centralized-modules-sync-f8-f12-design.md`

## Global Constraints

- Preserve `Desktop ↔ Cloudflare/D1 ↔ PWA` and all current Cloud endpoints.
- Do not share SQLite over the network.
- Do not silently fall back from LAN to local data.
- `local` keeps current behavior; `lan-host` is the only LAN sync coordinator; `lan-client` is paused for central sync.
- Keep current outbox/revision/conflict semantics.
- No remote-server production enablement, R2, billing or offline multi-PC writes.

## Review Focus

- A `lan-client` must never execute `syncPull`, `syncPush`, summary or finance-reference publication.
- If the central sync source is unavailable, `lan-host` reports a paused/error state instead of reading local operational rows.
- Local mode must produce the same bridge payloads/change IDs/retry behavior as before the refactor.
- Remote PWA edits must still become manual conflicts when local/central data changed concurrently.
- Changing operational storage must not alter `OnlineService` credentials, tenant or base URL.

---

### Task 1: Freeze current coordinator behavior and extract a local provider

**Files:**
- Create: `apps/desktop/electron/services/sync-data-provider.cjs`
- Create: `apps/desktop/electron/services/sync-data-provider.test.ts`
- Modify: `apps/desktop/electron/services/sync-coordinator.cjs`
- Modify: `apps/desktop/electron/services/sync-coordinator.test.ts`

**Interfaces:**
- Produces: `LocalSyncDataProvider({ database })` with bridge row read/apply, summary and obligations methods used by `SyncCoordinator`.
- `SyncCoordinator({ database, online, dataProvider?, now? })` keeps backward compatibility while preferring the injected provider.

- [ ] **Step 1: Write failing provider-equivalence tests**

Add tests proving that for the same fixture the provider returns the same `frentes_obra`, `tarefas_obra`, `rdos`, `cronograma_etapas`, summary and obligations data currently read directly by the coordinator.

- [ ] **Step 2: Run the focused tests**

Run: `npm --prefix apps/desktop test -- sync-data-provider sync-coordinator`

Expected: FAIL because `LocalSyncDataProvider` does not exist / coordinator still reads business rows directly.

- [ ] **Step 3: Implement the minimal local provider seam**

Move only operational row access and remote patch application behind the provider. Keep the existing local sync metadata/outbox/head/conflict tables and semantics unchanged in this task.

- [ ] **Step 4: Verify focused and full Desktop tests**

Run: `npm --prefix apps/desktop test -- sync-data-provider sync-coordinator`

Run: `npm --prefix apps/desktop test`

Expected: PASS with existing retry/idempotency/conflict tests unchanged.

- [ ] **Step 5: Commit**

`git commit -m "refactor(desktop): extract sync data provider"`

---

### Task 2: Add authenticated LAN sync-source capability contract

**Files:**
- Create: `apps/lan-server/tests/sync-source.test.mjs`
- Modify: `apps/lan-server/src/server.mjs`
- Modify: `apps/lan-server/src/authorization.mjs`
- Modify: `apps/desktop/electron/services/lan-data-client.cjs`
- Modify: `apps/desktop/electron/services/lan-data-client.test.ts`

**Interfaces:**
- Produces server endpoint: `GET /api/v1/sync-source/capabilities`.
- Response shape: `{ version: 1, modules: string[], bridgeEntities: string[] }`.
- Produces `LanDataClient.syncSourceCapabilities()` using the existing device bearer token.

- [ ] **Step 1: Write failing LAN server and Desktop client tests**

Assert unauthenticated calls are `401`, revoked devices are rejected, an authorized Desktop receives version `1`, and tokens never appear in thrown errors.

- [ ] **Step 2: Run tests and observe RED**

Run: `npm --prefix apps/lan-server test`

Run: `npm --prefix apps/desktop test -- lan-data-client`

Expected: FAIL because the capability route/client method does not exist.

- [ ] **Step 3: Implement the capability endpoint and client**

Initially advertise only modules/entities the central server actually supports. Do not advertise RDO/Planning before F9/F10 lands.

- [ ] **Step 4: Verify GREEN**

Run both commands above; expected PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat(lan): expose authenticated sync source capabilities"`

---

### Task 3: Add LAN sync provider and storage-mode gating

**Files:**
- Create: `apps/desktop/electron/services/lan-sync-data-provider.cjs`
- Create: `apps/desktop/electron/services/lan-sync-data-provider.test.ts`
- Modify: `apps/desktop/electron/main.cjs`
- Modify: `apps/desktop/electron/services/sync-coordinator.cjs`
- Modify: `apps/desktop/electron/services/sync-coordinator.test.ts`
- Modify: `apps/desktop/tests/storage-online-contract.test.ts`

**Interfaces:**
- Produces `LanSyncDataProvider({ lanClient })`.
- Produces a sync runtime decision: `local => LocalSyncDataProvider`, `lan-host => LanSyncDataProvider when capability exists`, `lan-client => paused`, `remote => paused`.
- Until F9/F10 routes exist, LAN provider methods for unsupported entities fail explicitly with `Fonte central ainda não suporta este módulo.`; they never call the local provider.

- [ ] **Step 1: Write failing mode-gating tests**

Assert `lan-client` cannot call any OnlineService sync method, `lan-host` chooses the LAN provider, unavailable central capability does not fall back to local rows, and storage changes do not mutate OnlineService configuration.

- [ ] **Step 2: Run RED**

Run: `npm --prefix apps/desktop test -- lan-sync-data-provider sync-coordinator storage-online-contract`

Expected: FAIL on missing provider/gating.

- [ ] **Step 3: Implement provider selection and pause reason**

Keep `OnlineService` connection independent from storage selection. Only coordinator execution changes.

- [ ] **Step 4: Verify GREEN and full Desktop suite**

Run focused tests then `npm --prefix apps/desktop test`.

Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat(desktop): gate sync by operational storage role"`

---

### Task 4: Surface coordinator ownership in UI without changing Cloud product semantics

**Files:**
- Modify: `apps/desktop/src/components/SyncSettings.tsx`
- Create: `apps/desktop/tests/sync-settings.test.ts`
- Modify: `apps/desktop/tests/storage-server-settings.test.ts`
- Modify: `apps/desktop/src/vite-env.d.ts` only if the returned sync state gains `source`/`pauseReason` fields.

**Interfaces:**
- `syncState` may add `source: 'local' | 'lan-host' | 'lan-client'` and `pauseReason?: string` without removing existing fields.

- [ ] **Step 1: Write failing UI/contract tests**

Assert `lan-client` displays that the PC principal coordinates synchronization and that Web/PWA remains included/linked independently.

- [ ] **Step 2: Run RED**

Run: `npm --prefix apps/desktop test -- sync-settings storage-server-settings storage-online-contract`

Expected: FAIL on missing copy/state.

- [ ] **Step 3: Implement minimal state/copy changes**

Do not add a user toggle that lets a `lan-client` override coordinator ownership.

- [ ] **Step 4: Verify GREEN**

Run focused and full Desktop tests.

- [ ] **Step 5: Commit**

`git commit -m "feat(desktop): show central sync ownership"`

---

### Task 5: F8 regression gate

**Files:**
- Modify: `apps/desktop/docs/PROJECT_MAP.md`
- Modify tests only if a missing regression is discovered.

- [ ] **Step 1: Run Desktop verification**

`npm --prefix apps/desktop run lint`

`npm --prefix apps/desktop test`

`npm --prefix apps/desktop run build`

- [ ] **Step 2: Run LAN server verification**

`npm --prefix apps/lan-server test`

- [ ] **Step 3: Run Web/PWA regression suite**

Run the repository's existing Web/Cloudflare test command used by CI and confirm Desktop → Cloud → PWA → Desktop remains green.

- [ ] **Step 4: Verify no production deploy/merge**

PR remains draft; production jobs remain skipped.

- [ ] **Step 5: Commit docs if changed**

`git commit -m "docs: document F8 sync coordinator ownership"`
