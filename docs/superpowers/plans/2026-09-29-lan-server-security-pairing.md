# LAN Server Security and Pairing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current unauthenticated LAN server into a claimed, company-bound server with cached Cloud permissions, per-device LAN credentials, pairing, revocation and authenticated business-data routes.

**Architecture:** `apps/lan-server` keeps owning the central SQLite and adds a focused security repository plus a Cloud authority client. The server starts unclaimed, is claimed once with setup code + Cloud claim token, caches the last-known company/member snapshot and thereafter requires `Authorization: Bearer <lan-device-token>` for Empresas/Clientes/Obras. Offline operation uses only previously cached identities and paired devices; member roles/modules remain Cloud-authoritative.

**Tech Stack:** Node.js 22, `node:http`, `node:sqlite`, built-in crypto/fetch, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-29-lan-host-identity-permissions-design.md`

## Global Constraints

- Do not share the SQLite file over SMB/network shares.
- Public LAN endpoints stay limited to `/health`, `/version`, setup status/claim and pair claim.
- Business CRUD must require an active LAN device token after this plan.
- LAN device tokens are random 256-bit-equivalent secrets; only token hashes are stored.
- Pairing codes are one-use, member-scoped, expire after 10 minutes and are stored only as hashes.
- Cached member role/modules/channels are read-only replicas of Cloudflare authority.
- A local LAN admin may pair/revoke/reactivate devices but may not change member role/modules/channels.
- Already-paired devices continue during temporary Internet loss using the last-known snapshot.
- No silent fallback to Desktop-local SQLite when LAN authorization/server access fails.

## Review Focus

- An unclaimed server must reject all business CRUD.
- A valid token for a revoked LAN device must fail immediately.
- A paired member without `desktop` channel must not access business routes.
- A stale cache may continue existing access but must never authorize a member absent/revoked in the last successfully received snapshot.
- Pairing-code brute force/replay must be rate-limited and single-use.

---

### Task 1: Add LAN security persistence without bloating the business repository

**Files:**
- Create: `apps/lan-server/src/security-repository.mjs`
- Create: `apps/lan-server/tests/security-repository.test.mjs`
- Modify: `apps/lan-server/src/repository.mjs`

**Interfaces:**
- Consumes: the same `DatabaseSync` connection owned by `LanRepository`.
- Produces: `LanSecurityRepository` over the same central SQLite connection.

- [ ] **Step 1: Write failing repository tests**

Pin creation/read of server identity, snapshot replacement, device token-hash lookup/status, pairing-code creation/consume/expiry, local audit append, and persistence across repository reopen.

- [ ] **Step 2: Run and confirm RED**

Run: `cd apps/lan-server && node --test tests/security-repository.test.mjs`

- [ ] **Step 3: Expose the existing database handle safely**

Add `connection()` to `LanRepository` returning its existing `DatabaseSync`; do not open a second writable DB for security state.

- [ ] **Step 4: Implement `LanSecurityRepository`**

Constructor signature: `new LanSecurityRepository({ db, now = () => new Date().toISOString() })`.

Required methods:

```js
serverState()
initializeServer({ serverId, setupCodeHash })
claimServer({ company, cloudBaseUrl, serverToken, snapshot })
replaceSnapshot(snapshot)
member(memberId)
createDevice({ memberId, installationId, deviceName, tokenHash })
deviceByTokenHash(tokenHash)
setDeviceStatus(deviceId, status)
listDevices()
createPairingCode({ memberId, codeHash, expiresAt, createdByDeviceId })
consumePairingCode(codeHash)
appendAudit(entry)
close? // no-op; LanRepository owns connection
```

Schema responsibilities match the spec's `lan_server_identity`, `lan_members_cache`, `lan_devices`, `lan_pairing_codes`, `lan_audit`.

- [ ] **Step 5: Run and verify GREEN**

Run: `cd apps/lan-server && node --test tests/security-repository.test.mjs tests/repository.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/lan-server/src/repository.mjs apps/lan-server/src/security-repository.mjs apps/lan-server/tests/security-repository.test.mjs
git commit -m "feat(lan): persist server identity and device security"
```

### Task 2: Create server setup identity and Cloud authority client

**Files:**
- Create: `apps/lan-server/src/server-identity.mjs`
- Create: `apps/lan-server/src/cloud-authority-client.mjs`
- Create: `apps/lan-server/tests/server-identity.test.mjs`
- Create: `apps/lan-server/tests/cloud-authority-client.test.mjs`
- Modify: `apps/lan-server/src/index.mjs`

**Interfaces:**
- Consumes: Plan 1 Cloud routes `/api/lan/claim/redeem` and `/api/lan/server/snapshot`.
- Produces: stable `serverId`, one-time local setup code, claim redemption and snapshot refresh.

- [ ] **Step 1: Write failing identity/client tests**

Require: first boot generates stable UUID-like `serverId`; setup code exists only while unclaimed; setup code hash is persisted; Cloud client sends HTTPS requests only by default; server token never appears in logs/errors; snapshot client rejects company mismatch.

- [ ] **Step 2: Run and confirm RED**

Run: `cd apps/lan-server && node --test tests/server-identity.test.mjs tests/cloud-authority-client.test.mjs`

- [ ] **Step 3: Implement `ServerIdentity`**

Exact public methods: `state()`, `verifySetupCode(code)`, `invalidateSetupCode()`. Generate a human-readable setup code and store only its digest in SQLite. Console output may print the setup code only on unclaimed first-run/setup reset.

- [ ] **Step 4: Implement `CloudAuthorityClient`**

Constructor: `new CloudAuthorityClient({ baseUrl, fetchImpl = globalThis.fetch, timeoutMs = 10000 })`.

Methods: `redeemClaim({serverId,claimToken})`, `snapshot({serverToken})`. Require `https://` unless `OBRA_NA_MAO_ALLOW_INSECURE_CLOUD=1` is explicitly set for tests/dev.

- [ ] **Step 5: Compose services in `index.mjs`**

Instantiate `LanRepository`, `LanSecurityRepository`, `ServerIdentity`, and `CloudAuthorityClient`; pass them into `createLanServer`.

- [ ] **Step 6: Run and verify GREEN**

Same focused test command plus existing server tests.

- [ ] **Step 7: Commit**

```bash
git add apps/lan-server/src/index.mjs apps/lan-server/src/server-identity.mjs apps/lan-server/src/cloud-authority-client.mjs apps/lan-server/tests
git commit -m "feat(lan): add secure server claim identity"
```

### Task 3: Implement setup claim and cached Cloud snapshot

**Files:**
- Modify: `apps/lan-server/src/server.mjs`
- Modify: `apps/lan-server/tests/server.test.mjs`

**Interfaces:**
- Consumes: Task 2 identity/cloud services and security repository.
- Produces: `GET /api/v1/setup/status`, `POST /api/v1/setup/claim`, server-side `refreshIdentitySnapshot()`.

- [ ] **Step 1: Add failing HTTP tests**

Pin: setup status exposes only `{claimed,serverId}`; setup claim requires both valid setup code and Cloud claim token; successful claim binds exact company and invalidates setup code; second claim returns conflict; Cloud company mismatch fails without partially claiming.

- [ ] **Step 2: Run and confirm RED**

Run: `cd apps/lan-server && node --test tests/server.test.mjs`

- [ ] **Step 3: Implement setup routes**

`POST /api/v1/setup/claim` body `{setupCode,claimToken}`. Redeem through Cloud, validate returned company/snapshot, atomically persist identity + snapshot, then invalidate setup code.

- [ ] **Step 4: Implement snapshot refresh helper**

Refresh uses the stored server token; replace member cache only after a complete valid response for the same company. Record `last_cloud_refresh_at`/revision. A failed refresh leaves the previous cache untouched.

- [ ] **Step 5: Run and verify GREEN**

Run focused server tests; expected PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/lan-server/src/server.mjs apps/lan-server/tests/server.test.mjs
git commit -m "feat(lan): claim server and cache Cloud permissions"
```

### Task 4: Authenticate all business CRUD with LAN device credentials

**Files:**
- Create: `apps/lan-server/src/authorization.mjs`
- Create: `apps/lan-server/tests/authorization.test.mjs`
- Modify: `apps/lan-server/src/server.mjs`
- Modify: `apps/lan-server/tests/server.test.mjs`

**Interfaces:**
- Consumes: `LanSecurityRepository.deviceByTokenHash`, cached member snapshot.
- Produces: `authenticateLanRequest(request)` and `authorizeBusinessRoute(context,{table,method})`.

- [ ] **Step 1: Write failing auth tests**

Pin missing/malformed token 401; unknown/revoked device 401/403; missing member/revoked cached member 403; missing `desktop` channel 403; valid admin/allowed member succeeds; token comparison uses digest lookup, never plaintext storage.

- [ ] **Step 2: Run and confirm RED**

Run: `cd apps/lan-server && node --test tests/authorization.test.mjs tests/server.test.mjs`

- [ ] **Step 3: Implement authorization module**

Use SHA-256 of bearer token. Return context `{device,member,company}` only for active device + active cached member + `desktop` channel. Initial Empresas/Clientes/Obras policy follows the existing Cloud `obra360`/admin access semantics; do not invent LAN-only CRUD permissions.

- [ ] **Step 4: Protect current entity routes**

All `/api/v1/empresas|clientes|obras` collection/item routes require authorization. `/health` and `/version` remain public and minimal.

- [ ] **Step 5: Re-run and verify GREEN**

Expected: existing CRUD tests updated to authenticate and pass; unauthenticated variants fail.

- [ ] **Step 6: Commit**

```bash
git add apps/lan-server/src/authorization.mjs apps/lan-server/src/server.mjs apps/lan-server/tests
git commit -m "feat(lan): require device authorization for business data"
```

### Task 5: Implement member-scoped pairing and local device administration

**Files:**
- Create: `apps/lan-server/src/pairing-service.mjs`
- Create: `apps/lan-server/tests/pairing-service.test.mjs`
- Modify: `apps/lan-server/src/server.mjs`
- Modify: `apps/lan-server/tests/server.test.mjs`

**Interfaces:**
- Consumes: authenticated admin context and security repository.
- Produces: pairing invitation/claim and device list/revoke/reactivate endpoints.

- [ ] **Step 1: Write failing pairing tests**

Cover admin creates code for existing cached member; non-admin rejected; absent/revoked/no-desktop-channel target rejected; code expires at 10 minutes; one-use replay rejected; repeated invalid claims are rate-limited; successful claim returns plaintext device token once and stores only digest; revoke blocks token immediately; reactivate restores it.

- [ ] **Step 2: Run and confirm RED**

Run: `cd apps/lan-server && node --test tests/pairing-service.test.mjs tests/server.test.mjs`

- [ ] **Step 3: Implement `PairingService`**

Methods: `createInvitation({actor,targetMemberId})`, `claim({code,installationId,deviceName})`, `listDevices(actor)`, `setDeviceStatus({actor,deviceId,status})`. Generate cryptographically random code/token; invitation TTL exactly 10 minutes.

- [ ] **Step 4: Add HTTP routes**

Authenticated admin: `POST /api/v1/admin/pairing`, `GET /api/v1/admin/devices`, `PUT /api/v1/admin/devices/:id`. Public one-use: `POST /api/v1/pair/claim`.

- [ ] **Step 5: Re-run and verify GREEN**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/lan-server/src/pairing-service.mjs apps/lan-server/src/server.mjs apps/lan-server/tests
git commit -m "feat(lan): pair and revoke local devices"
```

### Task 6: Offline-cache behavior and refresh diagnostics

**Files:**
- Modify: `apps/lan-server/src/server.mjs`
- Modify: `apps/lan-server/src/index.mjs`
- Modify: `apps/lan-server/tests/server.test.mjs`

**Interfaces:**
- Consumes: claimed server state and cached snapshot.
- Produces: manual/periodic refresh, stale metadata and safe offline continuation.

- [ ] **Step 1: Write failing offline tests**

A Cloud refresh failure must preserve current cache and existing paired access; successful refresh that revokes/removes a member must deny that member on next request; stale timestamp is reported to admin diagnostics but does not silently elevate access.

- [ ] **Step 2: Implement refresh lifecycle**

Refresh on startup when claimed and periodically (target 5 minutes) with unref'd timer; failures logged without secrets. Add authenticated admin `POST /api/v1/admin/identity/refresh` and `GET /api/v1/admin/status` exposing company, revision, last refresh, device count and stale flag.

- [ ] **Step 3: Run and verify GREEN**

Run: `cd apps/lan-server && npm test`

Expected: all LAN tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/lan-server/src apps/lan-server/tests
git commit -m "feat(lan): preserve cached authorization offline"
```

### Task 7: LAN security full verification

**Files:**
- Modify: `apps/desktop/docs/PROJECT_MAP.md`

**Interfaces:**
- Consumes: Tasks 1–6.
- Produces: documented authenticated LAN contract ready for Desktop integration.

- [ ] **Step 1: Run full LAN suite**

Run: `cd apps/lan-server && npm test`

- [ ] **Step 2: Verify public-surface regression**

Explicitly verify `/health` and `/version` contain no company/member/token/setup-code data and business routes reject unauthenticated calls.

- [ ] **Step 3: Update PROJECT_MAP**

Document server claim, cached Cloud identity, pairing endpoints and authenticated business CRUD. Preserve the non-negotiable Web/PWA compatibility note.

- [ ] **Step 4: Commit docs**

Do not merge or deploy.
