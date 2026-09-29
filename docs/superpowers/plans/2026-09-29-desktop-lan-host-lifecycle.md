# Desktop LAN Host Lifecycle and UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `lan-host` a real principal-computer mode in the Desktop, package/manage the LAN server process, support secure claim/pairing credentials and expose clear Local / Principal PC / Existing Server UX without breaking the existing Web/PWA integration.

**Architecture:** The Desktop keeps storage selection, online account state and LAN device credentials separate. In `lan-host`, Electron starts the packaged LAN server using its own runtime, talks to it over loopback and keeps it alive in background/tray mode; connected clients use the same authenticated API with a per-device LAN token. Claiming a server reuses the existing online admin identity and Cloud endpoints from Plan 1; LAN pairing uses endpoints from Plan 2.

**Tech Stack:** Electron 43, CommonJS Electron services, React 19/TypeScript, Vitest, electron-builder, existing `safeStorage`, existing `LanDataClient` and `OnlineService`.

**Spec:** `docs/superpowers/specs/2026-09-29-lan-host-identity-permissions-design.md`

## Global Constraints

- Existing `Desktop ↔ Cloudflare/D1 ↔ PWA` flow must remain unchanged and independently configurable.
- Fresh/update installs remain `local`; never auto-enable `lan-host`.
- Legacy `storage_mode=server` remains compatible as `lan-client` until migration completes.
- `remote` stays modeled but disabled/not production-selectable in this plan.
- No plaintext LAN device token is exposed to renderer code or logs.
- Use Electron `safeStorage` when available; fallback must still keep credentials out of React/localStorage.
- If LAN host/server startup fails, do not silently fall back to Desktop-local data.
- Principal PC mode must not imply administrator privileges; user role still comes from Cloud/LAN authorization.
- Do not add billing, R2, paid-Cloud entitlements or alter current PWA access.

## Review Focus

- Closing the visible window in principal-host mode must not accidentally stop the server while peers are using it.
- A normal local install must not spawn/listen on a LAN port.
- Switching away from `lan-host` must stop the managed server cleanly before changing active storage semantics.
- A LAN credential for server A must never be sent to server B.
- Changing storage mode must not mutate `online-connection.json`, online tenant/device token or Cloudflare base URL.

---

### Task 1: Persist the operational storage mode as an explicit key

**Files:**
- Modify: `apps/desktop/electron/services/storage-connection-service.cjs`
- Modify: `apps/desktop/electron/services/storage-connection-service.test.ts`
- Modify: `apps/desktop/src/vite-env.d.ts`

**Interfaces:**
- Consumes: legacy `storage_mode`, `lan_server_host`, `lan_server_port`.
- Produces: persisted `storage_operational_mode` with `local|lan-host|lan-client|remote`, while preserving legacy `mode` for current callers.

- [ ] **Step 1: Write failing migration/compatibility tests**

Pin: no new key + legacy local => `local`; no new key + legacy server => `lan-client`; explicit `lan-host` persists across restart; `remote` can be read but cannot yet be activated through production UI; invalid value falls back safely/rejects configure; host/port preserved.

- [ ] **Step 2: Run and confirm RED**

Run: `cd apps/desktop && npx vitest run electron/services/storage-connection-service.test.ts`

- [ ] **Step 3: Implement explicit operational-mode persistence**

Add `OPERATIONAL_MODE_KEY='storage_operational_mode'`. Extend `configure` with an explicit backward-compatible API, e.g. `configure({mode,operationalMode,host,port})`, where legacy callers without `operationalMode` keep current behavior. Do not remove `mode` yet.

- [ ] **Step 4: Update renderer type contract**

Keep `mode:'local'|'server'`; keep/add `operationalMode:'local'|'lan-host'|'lan-client'|'remote'`.

- [ ] **Step 5: Re-run and verify GREEN**

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/electron/services/storage-connection-service.cjs apps/desktop/electron/services/storage-connection-service.test.ts apps/desktop/src/vite-env.d.ts
git commit -m "feat(desktop): persist operational storage mode"
```

### Task 2: Add a dedicated LAN device credential service

**Files:**
- Create: `apps/desktop/electron/services/lan-credential-service.cjs`
- Create: `apps/desktop/electron/services/lan-credential-service.test.ts`

**Interfaces:**
- Consumes: Electron `safeStorage`, Desktop data directory.
- Produces: server-scoped opaque credential storage for `LanDataClient`.

- [ ] **Step 1: Write failing credential tests**

Pin: credential is scoped by canonical server identity/base URL; safeStorage encryption is used when available; plaintext token is never returned from `state()`; credential for one server is not returned for another; revoke/disconnect clears only LAN credential and does not touch `online-connection.json`.

- [ ] **Step 2: Run and confirm RED**

Run: `cd apps/desktop && npx vitest run electron/services/lan-credential-service.test.ts`

- [ ] **Step 3: Implement `LanCredentialService`**

Public interface:

```js
state(serverKey)
store({serverKey,deviceId,member,token})
token(serverKey)
clear(serverKey)
```

Persist in a Desktop-private file separate from online connection state. Renderer-visible state may include device/member identity but never token/ciphertext.

- [ ] **Step 4: Run and verify GREEN**

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/electron/services/lan-credential-service.cjs apps/desktop/electron/services/lan-credential-service.test.ts
git commit -m "feat(desktop): store LAN device credentials securely"
```

### Task 3: Authenticate `LanDataClient` requests

**Files:**
- Modify: `apps/desktop/electron/services/lan-data-client.cjs`
- Modify: `apps/desktop/electron/services/lan-data-client.test.ts`
- Modify: `apps/desktop/electron/main.cjs`

**Interfaces:**
- Consumes: Task 2 `LanCredentialService.token(serverKey)` and storage connection state.
- Produces: authenticated Empresas/Clientes/Obras HTTP requests.

- [ ] **Step 1: Add failing client tests**

Require `Authorization: Bearer <token>` for all business requests; missing credential produces a clear pairing-required error before fetch; token is never included in thrown error text; server mismatch does not reuse credential.

- [ ] **Step 2: Run and confirm RED**

Run: `cd apps/desktop && npx vitest run electron/services/lan-data-client.test.ts`

- [ ] **Step 3: Inject credential service into `LanDataClient`**

Use canonical server key from server identity/base URL. Add bearer header only for authenticated business routes. Preserve timeout and JSON behavior.

- [ ] **Step 4: Compose in `main.cjs` and re-run GREEN**

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/electron/services/lan-data-client.cjs apps/desktop/electron/services/lan-data-client.test.ts apps/desktop/electron/main.cjs
git commit -m "feat(desktop): authenticate LAN data requests"
```

### Task 4: Package and manage the LAN server process for `lan-host`

**Files:**
- Create: `apps/desktop/electron/services/lan-host-service.cjs`
- Create: `apps/desktop/electron/services/lan-host-service.test.ts`
- Modify: `apps/desktop/package.json`
- Modify: `apps/desktop/electron/main.cjs`

**Interfaces:**
- Consumes: current `apps/lan-server/src/index.mjs`, Desktop data directory, operational mode.
- Produces: `LanHostService.start()`, `stop()`, `restart()`, `state()`.

- [ ] **Step 1: Write failing lifecycle tests**

Pin: `local` never spawns; `lan-host` starts exactly one child; child gets explicit data dir/host/port/cloud URL env; duplicate starts are idempotent; unexpected exit is reported; `stop()` waits/terminates; no silent fallback.

- [ ] **Step 2: Run and confirm RED**

Run: `cd apps/desktop && npx vitest run electron/services/lan-host-service.test.ts`

- [ ] **Step 3: Implement `LanHostService`**

Use injected `spawnImpl` for tests. In packaged production, spawn `process.execPath` with `ELECTRON_RUN_AS_NODE=1` and the packaged server entry path. Default host-mode listener should be explicitly LAN-capable only after the user selected `lan-host`; keep port 4732 unless configured.

- [ ] **Step 4: Package `apps/lan-server` as an Electron resource**

Add electron-builder `extraResources` mapping from `../lan-server` to `lan-server`, excluding tests if possible. Do not require a separately installed Node runtime.

- [ ] **Step 5: Compose startup/shutdown in Electron main**

Only start automatically when stored operational mode is `lan-host`. Stop before changing away from host mode/app quit.

- [ ] **Step 6: Run tests + build**

Run: `cd apps/desktop && npx vitest run electron/services/lan-host-service.test.ts && npm run build`

Expected: PASS/build success.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/electron/services/lan-host-service.cjs apps/desktop/electron/services/lan-host-service.test.ts apps/desktop/electron/main.cjs apps/desktop/package.json
git commit -m "feat(desktop): manage packaged LAN host process"
```

### Task 5: Add Desktop claim and pairing orchestration without duplicating identity

**Files:**
- Create: `apps/desktop/electron/services/lan-setup-service.cjs`
- Create: `apps/desktop/electron/services/lan-setup-service.test.ts`
- Modify: `apps/desktop/electron/services/online-service.cjs`
- Modify: `apps/desktop/electron/services/online-service.test.ts`
- Modify: `apps/desktop/electron/main.cjs`
- Modify: `apps/desktop/electron/preload.cjs`
- Modify: `apps/desktop/src/vite-env.d.ts`

**Interfaces:**
- Consumes: existing online device token/session, Plan 1 claim route, Plan 2 setup/pair routes, Task 2 credentials.
- Produces: renderer-safe LAN setup API.

- [ ] **Step 1: Add failing OnlineService tests**

Add `startLanServerClaim(serverId)` calling `/api/desktop/lan/claim/start` with existing device token; no token leaks in returned state/errors.

- [ ] **Step 2: Add failing setup-service tests**

Cover host claim: fetch setup status -> request Cloud claim -> POST local setup claim. Cover client pairing: POST pairing code + installation/device name -> securely store returned LAN token. Reject claiming if current Cloud session is not admin. Ensure no mutation of online connection config except normal online calls.

- [ ] **Step 3: Implement `OnlineService.startLanServerClaim(serverId)`**

Return only claim token/expiry from Cloud route.

- [ ] **Step 4: Implement `LanSetupService`**

Public methods:

```js
status()
claimHostedServer({setupCode})
pair({code})
disconnect()
adminStatus()
createPairing({memberId})
listDevices()
setDeviceStatus({deviceId,status})
refreshIdentity()
```

It may use LAN setup/admin endpoints but must delegate Cloud identity to `OnlineService`.

- [ ] **Step 5: Expose minimal IPC/preload API**

Add a dedicated `lan` group under `window.fluxoDre`; never expose bearer/server/device tokens to renderer.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run Desktop tests for online/setup/preload contracts.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/electron/services/lan-setup-service.cjs apps/desktop/electron/services/online-service.cjs apps/desktop/electron/main.cjs apps/desktop/electron/preload.cjs apps/desktop/src/vite-env.d.ts apps/desktop/electron/services/*test.ts
git commit -m "feat(desktop): claim and pair LAN servers"
```

### Task 6: Replace the technical storage selector with the approved product UX

**Files:**
- Modify: `apps/desktop/src/pages/SettingsPage.tsx`
- Modify: `apps/desktop/tests/storage-server-settings.test.ts`
- Add/Modify focused settings tests as needed.

**Interfaces:**
- Consumes: storage operational state and renderer-safe `window.fluxoDre.lan` API.
- Produces: production-selectable `local`, `lan-host`, `lan-client`; `remote` remains omitted/disabled.

- [ ] **Step 1: Write failing UI/source tests**

Require exact conceptual choices: `Somente neste computador`, `Este computador é o principal / servidor local`, `Conectar a um servidor da empresa`. Require visible note that Web/PWA remains included/independent. Require no selectable remote mode.

- [ ] **Step 2: Implement Local UI**

Local choice keeps current behavior and does not start LAN host.

- [ ] **Step 3: Implement Principal-PC panel**

Show server running/error, serverId, claim status/company, LAN address/port, last Cloud permission refresh, paired-device count and actions for claim/pairing/devices/refresh. Do not present server machine as admin.

- [ ] **Step 4: Implement Existing-Server client panel**

Host/port/test connection, setup status, pairing code flow, paired member/role/modules, disconnect/re-pair.

- [ ] **Step 5: Re-run focused tests**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/pages/SettingsPage.tsx apps/desktop/tests
git commit -m "feat(desktop): add principal and existing-server setup UX"
```

### Task 7: Keep the principal host alive safely in background

**Files:**
- Modify: `apps/desktop/electron/main.cjs`
- Create: `apps/desktop/tests/lan-host-background-contract.test.ts`

**Interfaces:**
- Consumes: Task 4 `LanHostService` and operational mode.
- Produces: background/tray/quit behavior for principal PC.

- [ ] **Step 1: Write failing source/lifecycle tests**

Pin: close-window in `lan-host` does not call server stop/application quit; explicit Quit stops server; non-host mode keeps current app behavior; start-at-login is opt-in only.

- [ ] **Step 2: Implement tray/background behavior**

Create tray only for `lan-host`; provide Open Obra na Mão and Quit. Keep main process alive when window closes in host mode. Do not auto-enable OS login startup unless user explicitly turns it on.

- [ ] **Step 3: Run tests and verify GREEN**

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/electron/main.cjs apps/desktop/tests/lan-host-background-contract.test.ts
git commit -m "feat(desktop): keep principal LAN host running in background"
```

### Task 8: End-to-end compatibility and packaging verification

**Files:**
- Modify: `apps/desktop/docs/PROJECT_MAP.md`
- Update PR #60 body after successful verification.

**Interfaces:**
- Consumes: Plans 1–3 complete.
- Produces: verified principal-PC and existing-server foundation, still draft/unmerged.

- [ ] **Step 1: Run Desktop lint/tests/build**

```bash
cd apps/desktop
npm run lint
npm test
npm run build
```

- [ ] **Step 2: Run LAN server suite**

Run: `npm --prefix apps/lan-server test` from repo root.

- [ ] **Step 3: Run Web/PWA regressions**

Run: `cd apps/web && npm test && npm run build` plus local D1 migrations.

- [ ] **Step 4: Add an integration test for one real protocol path**

Test a temporary LAN server with fake Cloud authority: claim server -> pair admin/client -> authenticated Empresas CRUD -> revoke client -> CRUD denied; verify temporary Internet failure still permits previously paired active device with cached snapshot.

- [ ] **Step 5: Verify packaged-resource contract**

CI/build must prove the packaged app contains the LAN server entry/resource and that `LanHostService` resolves the correct production path. Do not publish a release.

- [ ] **Step 6: Update PROJECT_MAP and PR #60**

Document what is genuinely available and what remains future: firewall automation, full-module centralization, local→central migration, remote HTTPS/VPN, paid R2 Cloud, granular CRUD permissions.

- [ ] **Step 7: Keep PR draft**

No merge/deploy until explicit authorization after all CI checks are green.
