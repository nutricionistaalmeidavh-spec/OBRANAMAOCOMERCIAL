# Obra na Mão — LAN Host, Identity Cache, Pairing and Permissions Design

**Date:** 2026-09-29  
**Status:** Design approved in conversation; written spec pending final user review  
**Branch:** `feat/desktop-lan-server-foundation`  
**PR:** #60  
**Depends on:** phases 0–7 already present on this branch

## 1. Purpose

Turn the already-modeled `lan-host` role into a real, secure local-network mode without changing the product identity that exists today.

The target is to support both:

1. a normal customer PC acting as the principal computer/server; and
2. a company that already owns a local server and only wants Obra na Mão Server installed there.

In both cases, administrator privileges belong to the authenticated **user**, never to the machine that hosts the database.

The existing Web/PWA layer remains part of the product and must continue to work independently of operational storage selection.

## 2. Non-negotiable compatibility rules

The following rules apply to every task in this design:

1. **Do not remove, replace, disable or silently reconfigure the existing `Desktop ↔ Cloudflare/D1 ↔ PWA` flow.**
2. Existing Web/PWA functionality remains included; this work does not add billing, R2 entitlements or a paid Cloud plan.
3. Cloudflare remains the authority for account, tenant/company membership, role, modules, channels and online device authorization.
4. The LAN server may cache last-known identity/permission data so an already-configured company can continue operating during an Internet outage.
5. The LAN cache is not a second identity authority. It cannot create a new member, change a member role or alter module/channel permissions.
6. Local LAN administration may pair, revoke and reactivate **LAN devices**. Those are transport/device controls, not user-role controls.
7. `local` remains the safe default. An update never converts an existing installation into a LAN host automatically.
8. No SQLite file is shared over SMB/network shares. Clients communicate only through the server API.
9. No public-Internet exposure is introduced by this design. Remote HTTPS/VPN remains a later phase.
10. Existing `storage_mode=server` compatibility must remain valid while the new operational-mode key is introduced.

## 3. Existing state that this design builds on

Phases 0–7 already provide:

- `DataAccessService` as the generic CRUD seam;
- `StorageConnectionService` with legacy `mode: local|server` and forward-looking `operationalMode: local|lan-host|lan-client|remote`;
- `LanDataClient` for Empresas, Clientes and Obras;
- `apps/lan-server` with HTTP `/health`, `/version` and CRUD for Empresas/Clientes/Obras;
- a central SQLite owned only by the LAN server;
- existing Cloudflare/PWA identity, members, modules/channels and device authorization;
- Desktop online device tokens and company/tenant binding in `OnlineService`;
- the current `SyncCoordinator` that still reads the Desktop SQLite directly.

The current LAN API is unauthenticated. `lan-host` and `remote` are modeled but intentionally not treated as implemented transports yet.

## 4. Core architecture

### 4.1 Independent dimensions

The product keeps three independent dimensions:

```text
Operational storage
├── local
├── lan-host
├── lan-client
└── remote (future transport)

Identity / authorization
├── company / tenant
├── user/member
├── role
├── modules/channels
└── authorized devices

Online services
├── current Web/PWA
├── current Desktop ↔ Cloudflare sync
└── optional paid Cloud additions (future)
```

Changing operational storage does not change online identity or the Web/PWA connection.

### 4.2 Final LAN topology for this block

Principal PC scenario:

```text
Principal PC
├── Obra na Mão Desktop
├── LAN host lifecycle manager
├── Obra na Mão LAN Server
└── central SQLite
       ↑
       ├── connected Desktop A
       └── connected Desktop B

Existing Cloudflare/PWA connection remains separate and active.
```

Existing company server scenario:

```text
Existing server
├── Obra na Mão LAN Server
└── central SQLite
       ↑
       ├── Admin Desktop
       ├── Engineering Desktop
       └── Finance Desktop

Cloudflare remains the identity/permission authority.
```

The administrator can be on any connected Desktop. The server machine itself has no implicit admin privilege.

## 5. Recommended identity model

### 5.1 Authority

Cloudflare/D1 remains authoritative for:

- company/tenant;
- member identity;
- role (`admin`, `foreman`, `employee` initially, preserving the current model);
- allowed modules;
- allowed channels (`desktop`, `mobile`);
- existing online device status.

The LAN server stores a **last-known authorization snapshot** plus local LAN device credentials.

### 5.2 Offline behavior

After a server has been claimed successfully at least once:

- current cached members and permissions remain usable if Internet access is temporarily unavailable;
- already-paired LAN devices continue working;
- local LAN device revocation remains available to an admin even while offline;
- new Cloud members, role changes and module/channel changes cannot be learned until Cloudflare is reachable again;
- the server displays a stale-identity warning when the last Cloud refresh is old;
- when Cloudflare becomes reachable again, its member/permission state overwrites the cached member/permission snapshot;
- a local LAN device that was explicitly revoked remains revoked until an admin explicitly reactivates it, even if the Cloud member is still active.

This preserves offline LAN usefulness without creating an independent local user directory.

## 6. Secure server claim

A new LAN server starts **unclaimed**.

### 6.1 Server identity

On first start, the LAN server creates:

- a stable random `serverId`;
- a one-time setup code (human-readable, high entropy enough for local setup);
- local server metadata with restrictive filesystem permissions where the OS supports them.

`/health` may expose only minimal product/API status. It must not expose tenant, member or sensitive server state.

A dedicated server operator can read the setup code from the server console/log. On a principal PC, the Desktop lifecycle manager can receive/display it locally.

### 6.2 Cloud claim flow

The existing Desktop online device token is **never sent across the LAN** to the local server.

Claim flow:

```text
Admin Desktop (already linked online)
  ↓ existing deviceToken over HTTPS
Cloudflare: create LAN server claim
  ↓ short-lived, one-use claimToken
Admin Desktop
  ↓ local HTTP + server setup code
LAN Server
  ↓ claimToken over HTTPS
Cloudflare: redeem claim
  ↓ company + admin/member snapshot + serverToken
LAN Server
```

Cloudflare validates that the requesting Desktop belongs to the same company and that the user has admin authority before creating a claim.

The claim token:

- is random and unguessable;
- is one-use;
- expires quickly (target: 10 minutes);
- is bound to `serverId` and company.

After successful redemption, Cloudflare issues a long-lived revocable **LAN server token** scoped to the company. Only a hash of that token is stored in D1. The plaintext is returned once to the LAN server and stored locally as a server credential.

The original setup code is then invalidated permanently unless the server is explicitly factory-reset.

## 7. Cloudflare additions

Additive endpoints only; existing auth/sync routes remain unchanged.

Proposed endpoints:

```text
POST /api/desktop/lan/claim/start
POST /api/lan/claim/redeem
POST /api/lan/server/snapshot
POST /api/lan/server/revoke   (admin/owner workflow or equivalent)
```

### 7.1 `claim/start`

Authenticated using the existing Desktop device token.

Input:

```json
{
  "deviceToken": "existing-desktop-token",
  "serverId": "uuid"
}
```

Cloudflare requires:

- authorized Desktop device;
- company binding;
- current member role `admin`;
- Desktop channel allowed.

Output contains a one-use `claimToken` and expiration only. It does not expose other credentials.

### 7.2 `claim/redeem`

Input:

```json
{
  "serverId": "uuid",
  "claimToken": "one-use-token"
}
```

On success, Cloudflare atomically consumes the claim and returns:

- company identity;
- current member/access snapshot required by the LAN server;
- claiming admin identity;
- new `serverToken`.

### 7.3 `server/snapshot`

Authenticated using `serverToken`.

Returns only the company-scoped authorization information required by the LAN server:

- members;
- role;
- modules;
- channels;
- status/revocation information needed for LAN authorization;
- a revision/timestamp so the server can determine whether the cache changed.

It is not a business-data synchronization endpoint.

### 7.4 D1 persistence

Add a migration for LAN server security state, with concepts equivalent to:

- server claims (hashed one-use token, serverId, companyId, issuedBy, expiry, consumedAt);
- server grants (hashed server token, serverId, companyId, status, createdAt, lastSeenAt, revokedAt);
- optional audit records if the existing audit mechanism cannot represent these events cleanly.

No existing business/PWA table is repurposed in a way that changes current behavior.

## 8. LAN server local security schema

Extend the central LAN SQLite with server-owned security tables. Exact names may vary, but responsibilities are fixed:

```text
lan_server_identity
- server_id
- company_id
- company_name
- cloud_base_url
- server_token (protected local secret or protected reference)
- claimed_at
- last_cloud_refresh_at
- identity_revision

lan_members_cache
- member_id
- email
- display_name
- role
- modules_json
- channels_json
- cloud_status
- refreshed_at

lan_devices
- device_id
- member_id
- installation_id
- device_name
- token_hash
- status
- paired_at
- last_seen_at
- revoked_at

lan_pairing_codes
- code_hash
- member_id
- expires_at
- consumed_at
- created_by_device_id

lan_audit
- actor_member_id
- actor_device_id
- action
- target_type
- target_id
- details_json
- created_at
```

The LAN server stores only the hash of LAN **device tokens**. The plaintext token is returned to the client once.

## 9. LAN device pairing

### 9.1 Administrator creates an invitation

An already-paired LAN admin calls an authenticated endpoint and selects one member from the cached Cloud member list.

The server creates a one-use pairing code:

- scoped to that member;
- expires after 10 minutes;
- single-use;
- rate-limited;
- stored only as a hash.

### 9.2 Connected Desktop claims the invitation

Client enters/selects the LAN server and supplies the code plus local device metadata:

```json
{
  "code": "XXXX-XXXX",
  "installationId": "desktop-installation-id",
  "deviceName": "PC Engenharia"
}
```

On success the server returns:

- random 256-bit LAN device token;
- device id;
- cached member identity/role/modules/channels;
- server/company identity.

The Desktop stores this credential separately from `online-connection.json`, preferably using Electron `safeStorage` when available.

Storage selection and online login remain separate settings.

### 9.3 Local device administration

LAN admin endpoints support:

- list paired devices;
- revoke device;
- reactivate device;
- create/cancel pairing invitations;
- force Cloud permission refresh when Internet is available.

They do **not** support changing a member role or module/channel permissions. Those remain Cloudflare-governed and can continue to be edited through the existing Web/PWA governance experience.

The Desktop may provide a button/link for an admin to open the existing online access-management experience; no second permission editor is created in this phase.

## 10. LAN API authentication and authorization

### 10.1 Public endpoints

Unauthenticated endpoints are restricted to setup/diagnostic minimums:

```text
GET /health
GET /version
GET /api/v1/setup/status
POST /api/v1/setup/claim
POST /api/v1/pair/claim
```

`setup/claim` is valid only while unclaimed and requires both the one-use Cloud claim token and the local setup code.

`pair/claim` requires a valid one-use pairing code.

### 10.2 Authenticated endpoints

All business-data endpoints require:

```text
Authorization: Bearer <lan-device-token>
```

Server flow:

1. hash token;
2. find active `lan_devices` record;
3. load cached member;
4. require member Cloud status active in the last-known snapshot;
5. require Desktop channel;
6. apply route/module policy;
7. update `last_seen_at` and audit sensitive operations.

### 10.3 Current module policy

Do not invent a second permission taxonomy.

For the current Empresas/Clientes/Obras API, the initial policy uses the existing `obra360`/Desktop access model. Admin retains full access according to the current Cloud role semantics.

Granular operation permissions such as `view/create/edit/delete/approve` are a future extension of the **same Cloud permission model**, not a LAN-only ACL.

## 11. `lan-host` operational mode

### 11.1 Persistence

Introduce a persisted operational-role key (for example `storage_operational_mode`) while preserving legacy compatibility:

```text
legacy storage_mode=local  + no new key → local
legacy storage_mode=server + no new key → lan-client
new key local      → local
new key lan-client → lan-client
new key lan-host   → lan-host
new key remote     → modeled only; still not enabled here
```

Current callers that still consume legacy `mode` continue to receive compatible values until the migration is complete.

### 11.2 Principal-PC behavior

When `lan-host` is intentionally enabled:

- Desktop starts/manages the packaged LAN server process;
- server central data directory is explicit and stable;
- Desktop itself talks to the server using loopback (`127.0.0.1`);
- other PCs use the private LAN address;
- server binds to a LAN-capable interface only after explicit host-mode activation;
- no public Internet binding/configuration is created automatically;
- if server startup fails, the Desktop reports the error and does not silently fall back to a different database.

### 11.3 Packaging/lifecycle approach

For the principal-PC implementation in this block, prefer zero-cost/native components already shipped with the application:

- package the existing `apps/lan-server` runtime with the Desktop installer;
- launch it as a managed child/background process from Electron;
- use `ELECTRON_RUN_AS_NODE=1` with the packaged Electron runtime if appropriate after CI verification, avoiding a separate Node installation;
- keep the Electron main process alive in principal-host mode when the visible window is closed, using tray/background behavior;
- optionally enable start-at-login for the principal PC after explicit user consent.

A true Windows SCM service or a dedicated server installer is a later deployment-hardening task if the process model proves insufficient. The standalone `apps/lan-server` remains usable on an existing server throughout this phase.

This choice avoids introducing a paid dependency or an opaque third-party service wrapper into the core.

## 12. Existing-server scenario

A company that already has a server does **not** need to install the Desktop there.

The standalone LAN server:

1. starts unclaimed;
2. reports `serverId` and setup code to the operator;
3. listens on the explicitly configured private interface;
4. is claimed remotely by an already-authorized Obra na Mão admin Desktop;
5. stores its company grant and identity cache;
6. serves paired client PCs.

How the customer's OS keeps the standalone server process running at boot (Windows service/systemd/Task Scheduler) is deployment-specific and may be automated in a later packaging phase. The API/data/auth design does not change.

## 13. Principal-PC UI

Settings should evolve from the current two-option technical presentation to the approved product model without exposing unfinished remote mode as usable.

For this block:

```text
Dados operacionais

○ Somente neste computador
● Este computador é o principal / servidor local
○ Conectar a um servidor da empresa

Servidor remoto: future/disabled or omitted
```

Principal-host panel shows:

- server running/stopped/error;
- local server id;
- LAN address/port;
- claim status/company;
- last Cloud permission refresh;
- paired device count;
- button to create pairing invitation;
- button to list/revoke LAN devices;
- link/button to existing online users/permissions management.

Connected-client panel shows:

- server address;
- connection status;
- paired identity/member;
- current role/modules from server;
- re-pair/disconnect action.

The Web/PWA connection card remains separate and explicitly states that it is independent from operational storage.

## 14. Preservation of the current PWA sync

This phase must not create a second data sync pipeline.

Current reality: `SyncCoordinator` still reads local SQLite directly, including local Empresas/Obras metadata when configuring a sync scope. Therefore:

- local-mode customers remain completely unchanged;
- this phase does not pretend that every operational module is already multi-PC/server-backed;
- Empresas/Clientes/Obras can use secure LAN CRUD as already implemented;
- field/financial modules not yet migrated remain local and keep using the existing Desktop ↔ Cloudflare flow;
- `WorksPage` safety restrictions remain where a server-backed Obra would otherwise open local-only operational modules;
- a later module-migration phase must refactor the synchronization data source deliberately before server-backed RDO/Planning/etc. are enabled.

No code in this phase may make LAN identity cache a replacement for the existing Cloudflare business-data sync.

## 15. Error and recovery behavior

Required visible states:

- LAN server stopped;
- LAN server incompatible version;
- server unclaimed;
- invalid/expired setup claim;
- Cloudflare unavailable during first claim;
- Cloudflare unavailable after successful claim (cached permissions in use);
- stale permission cache warning;
- device token invalid/revoked;
- member no longer authorized after Cloud refresh;
- pairing code invalid/expired/consumed;
- port in use;
- central DB unavailable/corrupt;
- server process crashed/restarted.

No failure may silently switch to the Desktop local DB for a server-backed entity.

## 16. Security constraints

- Server starts loopback-only by default until host/server mode is explicitly configured.
- No automatic router port forwarding/UPnP.
- No plain HTTP server exposure to the public Internet.
- Setup code and pairing codes are one-use and rate-limited.
- Claim tokens and LAN device tokens are random high-entropy secrets.
- D1 stores hashes of server/claim tokens, not plaintext.
- LAN SQLite stores hashes of client device tokens, not plaintext.
- Client credential storage uses `safeStorage` where available.
- Server token must never be exposed to renderer code.
- LAN device token must not be exposed to normal renderer page code beyond the restricted preload/service boundary.
- Authorization is enforced on the LAN server, not only by hiding UI.
- Company/tenant id on every cached member/device must match the claimed server company.
- Audit claim, pairing, revoke/reactivate and denied privileged operations.

## 17. Test strategy / acceptance criteria

### Desktop service tests

Prove:

- operational-mode migration remains backward compatible;
- enabling `lan-host` does not mutate `online-connection.json`;
- host Desktop uses loopback LAN endpoint, not the local CRUD database, for migrated entities;
- client token is stored separately from online token;
- stopping/crashing LAN server produces a visible error and no local fallback;
- local mode behavior remains unchanged.

### LAN server tests

Prove:

- fresh server is unclaimed and business CRUD is denied;
- setup code + valid Cloud claim claims once;
- wrong/expired/replayed claim is denied;
- bearer token is required for business CRUD;
- revoked device is denied;
- non-Desktop channel is denied;
- module policy is enforced;
- admin can create one-use member-scoped pairing code;
- pairing code replay is denied;
- member permission snapshot refresh changes future authorization;
- Cloud outage after successful setup uses cached identity without deleting current access;
- local device revocation continues to work offline.

### Cloudflare/Web tests

Prove:

- only existing authorized admin Desktop can start LAN-server claim;
- claim is company-scoped and serverId-scoped;
- one-use claim is atomic;
- server token hash/revocation works;
- snapshot cannot cross tenant boundaries;
- existing P0/P3 Desktop ↔ Cloud ↔ field/PWA workflows are unchanged;
- existing users/permissions governance tests remain green;
- no billing/R2 entitlement behavior changes.

### Integration scenarios

1. **Local regression** — existing local Desktop + PWA behaves exactly as before.
2. **Principal PC** — host starts server, claims it as admin, creates Empresa/Cliente/Obra, second PC sees same records.
3. **Existing local server** — standalone server claimed by admin Desktop; admin is not running on server machine.
4. **Different permissions** — admin Desktop succeeds, limited member cannot access an unauthorized module.
5. **Internet outage after provisioning** — paired clients continue against cached authorization; Web/PWA simply behaves according to normal Internet availability.
6. **Revocation** — LAN admin revokes a client and that client immediately loses LAN access.
7. **Cloud refresh** — role/module change made in existing Web/PWA governance is reflected by LAN after refresh.

## 18. Scope boundaries

Included in this design:

- real `lan-host` mode for a principal PC;
- LAN server claim to a Cloudflare company;
- cached Cloud identity/permissions;
- LAN device pairing and revocation;
- authenticated/authorized LAN CRUD;
- principal-host lifecycle/status UI;
- support for claiming an existing standalone local server;
- preservation tests for Web/PWA and local mode.

Explicitly not included:

- migration of every operational module to central storage;
- removing `WorksPage` local-module guards;
- full remote-server HTTPS mode;
- VPN setup;
- Internet-facing LAN API;
- R2 documents/paid Cloud plans;
- granular CRUD permission taxonomy beyond the current Cloud module/channel model;
- a second local user/password directory;
- offline business-data synchronization between independent databases;
- automatic router/firewall configuration;
- guaranteed OS-service installation on every server OS.

## 19. Delivery order

Implementation should be sequenced so no insecure window exists:

```text
A. Cloud claim/grant primitives + tests
B. LAN security schema + auth middleware
C. claimed-server identity refresh/cache
D. local device pairing/revocation
E. secure existing CRUD routes
F. persisted lan-host mode
G. principal-PC lifecycle/package integration
H. settings/admin UI
I. cross-system regression + principal/existing-server QA
```

Do not enable a user-facing LAN host option before authenticated LAN CRUD and claim/pairing are working.

## 20. Definition of done

This design is complete when:

- a fresh local customer still works exactly as before;
- a principal PC can intentionally become a LAN host and use the same central server as its connected PCs;
- an existing company server can be claimed without making the server operator the administrator;
- admin rights follow the Cloud member, not the host machine;
- all current LAN business endpoints require server-side authorization;
- paired clients can continue locally during a Cloudflare outage using last-known permission data;
- Cloudflare role/module/channel changes refresh into the LAN cache when online;
- Desktop ↔ Cloudflare/D1 ↔ PWA regression tests remain green;
- PR remains draft until explicit merge/deploy authorization.
