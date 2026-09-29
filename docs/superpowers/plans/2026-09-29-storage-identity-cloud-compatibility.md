# Storage, Identity and Cloud Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement phases 6–7 so new storage roles are modeled without breaking the existing Desktop ↔ Cloudflare/D1 ↔ PWA product flow.

**Architecture:** Preserve `OnlineService` and `SyncCoordinator` behavior as an independent online layer. Extend `StorageConnectionService` with a backward-compatible operational mode model while retaining the existing `mode` contract during migration. Add regression tests that make any accidental coupling between storage selection and the current online/PWA connection fail loudly.

**Tech Stack:** Electron, CommonJS services, React/TypeScript, Vitest, Node.js 22, existing Cloudflare Worker/PWA tests.

**Spec:** `docs/superpowers/specs/2026-09-29-storage-identity-cloud-compatibility-design.md`

## Global Constraints

- Existing Desktop + Web/PWA functionality remains included and must not require a new paid plan.
- Storage changes must not delete, rewrite, disable or silently reconfigure `online-connection.json`, online tenant, device token, Cloudflare base URL or sync scope.
- `storage_mode=local` remains local; legacy `storage_mode=server` remains valid and maps to operational mode `lan-client`.
- No new remote-server transport, LAN authentication, R2 storage, billing or entitlement changes in phases 6–7.
- Do not create a second Desktop ↔ Cloudflare synchronization pipeline.
- No schema migration unless tests prove the existing `configuracoes` table cannot carry the compatibility keys.
- Before completion run Desktop `npm run lint`, `npm test`, `npm run build`, plus the existing web/PWA workflow tests that cover Desktop → Cloud → field/PWA → Desktop.

## Review Focus

- Existing `storage_mode=server` installations must still route Empresas/Clientes/Obras through the current LAN client after the new operational-mode model is added.
- Changing storage configuration must not mutate the online connection file, token, tenant or Cloudflare URL.
- A linked Web/PWA account must remain linked when the operational storage role changes.
- The default for a fresh or unconfigured installation must remain local and must not start or imply a LAN host.
- The new operational mode must not make `lan-host` or `remote` appear production-ready before their later phases implement transport/lifecycle requirements.

---

### Task 1: Freeze the existing online/PWA behavior with regression tests

**Files:**
- Create: `apps/desktop/electron/services/storage-online-compatibility.test.ts`
- Modify only if needed for testability: `apps/desktop/electron/services/storage-connection-service.cjs`
- Reference, do not alter behavior: `apps/desktop/electron/services/online-service.cjs`
- Reference, do not alter behavior: `apps/desktop/electron/services/sync-coordinator.cjs`

**Interfaces:**
- Consumes: `StorageConnectionService.configure(input)`, `StorageConnectionService.state()`, `OnlineService.state()` and the persisted `online-connection.json` format.
- Produces: regression coverage proving storage and online connection state are independent.

- [x] **Step 1: Write failing compatibility tests**

Cover these assertions:

```ts
it('does not change online connection state when storage configuration changes')
it('keeps a linked online tenant/token when switching legacy local to server storage')
it('keeps Cloudflare base URL independent from LAN host and port')
```

Use a temporary data directory for `OnlineService`, a fake configuration DB for `StorageConnectionService`, and compare the online config file before/after storage changes.

- [x] **Step 2: Run the focused tests and confirm RED only where compatibility support is missing**

Run:

```bash
cd apps/desktop
npx vitest run electron/services/storage-online-compatibility.test.ts
```

Expected: existing separation assertions should pass if already guaranteed; any new operational-mode assertion introduced in Task 2 must remain out of this task.

- [x] **Step 3: Make only the minimum testability change if required**

Do not route storage writes through `OnlineService`. Do not move online config into SQLite. Preserve the existing file-backed online configuration.

- [x] **Step 4: Re-run the focused compatibility tests**

Expected: all pass.

- [x] **Step 5: Commit**

```bash
git add apps/desktop/electron/services/storage-online-compatibility.test.ts apps/desktop/electron/services/storage-connection-service.cjs
git commit -m "test: protect desktop online sync from storage changes"
```

### Task 2: Introduce the backward-compatible operational storage model

**Files:**
- Modify: `apps/desktop/electron/services/storage-connection-service.cjs`
- Modify: `apps/desktop/electron/services/storage-connection-service.test.ts`
- Modify: `apps/desktop/src/vite-env.d.ts`

**Interfaces:**
- Consumes: existing persisted keys `storage_mode`, `lan_server_host`, `lan_server_port`.
- Produces: `state().operationalMode` with exact values `'local' | 'lan-host' | 'lan-client' | 'remote'`, while preserving legacy `state().mode` for current callers.

- [x] **Step 1: Extend tests first**

Add tests for:

```ts
expect(state.operationalMode).toBe('local')
expect(legacyServerState.operationalMode).toBe('lan-client')
expect(state.mode).toBe('server') // legacy compatibility while persisted mode is server
```

Also pin these failure modes:

```ts
fresh install => local
unknown operational mode => rejected
legacy host/port => preserved
```

- [x] **Step 2: Run storage service tests and confirm RED**

Run:

```bash
cd apps/desktop
npx vitest run electron/services/storage-connection-service.test.ts
```

Expected: failure because `operationalMode` does not exist yet.

- [x] **Step 3: Implement the compatibility mapping**

Add exact mapping helpers in `storage-connection-service.cjs`:

```js
legacyToOperational('local') => 'local'
legacyToOperational('server') => 'lan-client'
```

Keep `mode` in public state for current UI and `DataAccessService`. Add `operationalMode` as the forward-looking field. Do not enable `lan-host` or `remote` transport yet.

If persisting a new key is necessary, use the existing `configuracoes` table and keep legacy keys authoritative until the later UX migration phase.

- [x] **Step 4: Update renderer typing**

Add `operationalMode: 'local' | 'lan-host' | 'lan-client' | 'remote'` to the storage state type without removing current `mode: 'local' | 'server'`.

- [x] **Step 5: Run focused tests**

Expected: pass.

- [x] **Step 6: Commit**

```bash
git add apps/desktop/electron/services/storage-connection-service.cjs apps/desktop/electron/services/storage-connection-service.test.ts apps/desktop/src/vite-env.d.ts
git commit -m "feat: add compatible operational storage roles"
```

### Task 3: Keep current LAN routing behavior unchanged under the new model

**Files:**
- Modify: `apps/desktop/electron/services/data-access-service.test.ts`
- Modify only if test requires: `apps/desktop/electron/services/data-access-service.cjs`

**Interfaces:**
- Consumes: `StorageConnectionService.state()` returning both legacy `mode` and `operationalMode`.
- Produces: unchanged remote routing for Empresas/Clientes/Obras when a legacy server install maps to `lan-client`.

- [x] **Step 1: Add routing regression tests**

Pin:

```ts
legacy mode server + operationalMode lan-client => remote empresas/clientes/obras
local => local CRUD
lan-host/remote are not silently treated as supported transport in phases 6-7
```

- [x] **Step 2: Run focused test and confirm behavior**

Run:

```bash
cd apps/desktop
npx vitest run electron/services/data-access-service.test.ts
```

- [x] **Step 3: If necessary, make `useRemote(table)` explicitly compatibility-aware**

Do not add remote URL handling or LAN-host lifecycle. Preserve the current F3–F5 behavior only.

- [x] **Step 4: Re-run focused test**

Expected: pass.

- [x] **Step 5: Commit**

```bash
git add apps/desktop/electron/services/data-access-service.cjs apps/desktop/electron/services/data-access-service.test.ts
git commit -m "test: preserve lan routing with storage roles"
```

### Task 4: Add a source-level contract guard between storage and online APIs

**Files:**
- Create: `apps/desktop/tests/storage-online-contract.test.ts`
- Reference: `apps/desktop/electron/main.cjs`
- Reference: `apps/desktop/electron/preload.cjs`

**Interfaces:**
- Consumes: current IPC/preload source.
- Produces: a regression guard that storage configuration and online/PWA connection remain separate public contracts.

- [x] **Step 1: Write source contract tests**

Assert that:

```ts
window.fluxoDre.storage exposes state/configure/testConnection only
window.fluxoDre.online keeps current auth/sync/session methods
storage:configure handler calls services.storage, not services.online
online handlers remain attached to services.online/services.sync
```

- [x] **Step 2: Run and verify**

```bash
cd apps/desktop
npx vitest run tests/storage-online-contract.test.ts
```

Expected: pass against the intended independent design; if a source pattern differs, adapt the test to the real contract rather than changing behavior unnecessarily.

- [x] **Step 3: Commit**

```bash
git add apps/desktop/tests/storage-online-contract.test.ts
git commit -m "test: guard storage and web pwa contract separation"
```

### Task 5: Document the protected baseline and future roles in the project map/UI copy

**Files:**
- Modify: `apps/desktop/docs/PROJECT_MAP.md`
- Modify: `apps/desktop/src/pages/SettingsPage.tsx`
- Modify: `apps/desktop/tests/storage-server-settings.test.ts`

**Interfaces:**
- Consumes: `operationalMode` model from Task 2.
- Produces: product copy that makes clear the current Web/PWA connection remains included and independent from storage, without presenting later server modes as already implemented.

- [x] **Step 1: Extend settings regression test first**

Require visible copy equivalent to:

```text
Web/PWA continua independente desta configuração.
```

and require the current LAN server wording to remain explicit about the modules already supported.

- [x] **Step 2: Run focused UI source test and confirm RED**

```bash
cd apps/desktop
npx vitest run tests/storage-server-settings.test.ts
```

- [x] **Step 3: Update SettingsPage copy only**

Do not expose `lan-host` or `remote` as selectable production options yet. Clarify that changing local/LAN operational storage does not remove the existing Obra na Mão Web/PWA connection.

- [x] **Step 4: Update PROJECT_MAP.md**

Record:

```text
Operational storage != online services != user role/permissions
```

Document `operationalMode`, legacy compatibility, current SyncCoordinator SQLite coupling, and the non-negotiable Desktop ↔ Cloudflare/D1 ↔ PWA preservation rule.

- [x] **Step 5: Re-run focused settings test**

Expected: pass.

- [x] **Step 6: Commit**

```bash
git add apps/desktop/docs/PROJECT_MAP.md apps/desktop/src/pages/SettingsPage.tsx apps/desktop/tests/storage-server-settings.test.ts
git commit -m "docs: protect web pwa baseline in storage settings"
```

### Task 6: Verify the existing Desktop → Cloud → field/PWA → Desktop flow remains intact

**Files:**
- Modify only if missing regression coverage: `apps/web/backend/p3-workflows.test.ts`
- Modify only if missing regression coverage: `apps/web/backend/p0-flows.test.ts`

**Interfaces:**
- Consumes: existing Cloudflare desktop sync routes and PWA/phone bridge update flow.
- Produces: explicit evidence that phases 6–7 do not alter online synchronization semantics.

- [x] **Step 1: Inspect existing web tests against the spec acceptance criteria**

The existing P3 test must continue proving:

```text
Desktop push
→ duplicate push is idempotent
→ field/PWA bridge update
→ Desktop pull receives updated record
```

If this is already fully covered, do not duplicate it; add only a named compatibility assertion/comment if needed.

- [x] **Step 2: Run the exact existing web workflow test**

Use the repository's existing web test command targeting `p3-workflows.test.ts` and `p0-flows.test.ts`.

Expected: pass with no endpoint or payload changes.

- [x] **Step 3: Commit only if tests required an actual change**

Do not modify backend production code in this task.

### Task 7: Full verification and PR documentation

**Files:**
- Modify: PR #60 body only after code verification succeeds.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: verified phases 6–7 implementation on the existing draft PR, with no merge/deploy.

- [x] **Step 1: Run Desktop lint**

```bash
cd apps/desktop
npm run lint
```

Expected: exit 0.

- [x] **Step 2: Run full Desktop tests**

```bash
npm test
```

Expected: 0 failed tests.

- [x] **Step 3: Run Desktop build**

```bash
npm run build
```

Expected: exit 0.

- [x] **Step 4: Run LAN server tests**

```bash
cd ../lan-server
npm test
```

Expected: exit 0.

- [x] **Step 5: Run targeted Web/PWA sync tests**

Run the existing repository command for `p3-workflows.test.ts` and `p0-flows.test.ts`.

Expected: the Desktop → Cloud → field/PWA → Desktop test remains green.

- [x] **Step 6: Review PR diff against the spec**

Confirmed from F5 head `68bfb6ef429950d4b70eeaeb1a75fbc426dce291` through the F6–7 implementation: no production changes under `apps/web`, no Cloudflare sync-route changes, no billing/R2/entitlement changes; changes are limited to Desktop storage modeling/routing guards, tests, copy and architecture documents.

- [x] **Step 7: Update draft PR #60 description**

Add phases 6–7, compatibility guarantees and explicit out-of-scope items. Keep PR draft. Do not merge or deploy.

## Verification evidence — 2026-09-29

- Windows PR CI run 209: Desktop dependency install, TypeScript lint, full Desktop tests, LAN server tests and Desktop build completed successfully before packaging.
- macOS Apple Silicon PR CI run 167: Desktop tests, build, DMG generation and artifact validation completed successfully.
- Cloudflare PR CI run 489 validation: D1 migrations, `npm test`, UX/assets checks, static build, Pages Functions compile and Worker dry-run all completed successfully.
- Web `npm test`: **64 test files / 266 tests passed**, including `backend/p3-workflows.test.ts` (2/2) and `backend/p0-flows.test.ts` (17/17), preserving the existing Desktop → Cloud → field/PWA → Desktop path.
