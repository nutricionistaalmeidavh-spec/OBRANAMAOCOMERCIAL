# LAN Cloud Claim Authority Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Cloudflare/D1 authority for claiming, refreshing and revoking Obra na Mão LAN servers without changing the current Desktop ↔ Cloudflare/D1 ↔ PWA behavior.

**Architecture:** The existing Desktop device token authenticates an admin to create a short-lived one-use LAN server claim. The LAN server redeems that claim over HTTPS and receives a long-lived revocable server token plus a company-scoped authorization snapshot. Cloudflare remains authoritative for company membership, role, modules, channels and online device status.

**Tech Stack:** Cloudflare Worker, D1, TypeScript, existing backend router/sdk, Vitest, Wrangler.

**Spec:** `docs/superpowers/specs/2026-09-29-lan-host-identity-permissions-design.md`

## Global Constraints

- Do not change existing Desktop auth, sync, PWA, billing, R2 or entitlement semantics.
- Cloudflare remains the only authority for member role/modules/channels.
- `POST /api/desktop/lan/claim/start` requires an authorized Desktop device whose current member role is `admin` and whose access includes `desktop`.
- Claim tokens are random, one-use, expire after 10 minutes and are bound to `serverId` + company.
- Server tokens are random, revocable and company-scoped; D1 stores only their hashes.
- Never return or log an existing Desktop device token from a LAN endpoint.
- Existing Web/PWA functionality remains included and unaffected.

## Review Focus

- A non-admin Desktop must receive 403 from claim creation even if its device token is valid.
- An expired, consumed, wrong-server or wrong-company claim must not be redeemable.
- A revoked server token must stop receiving authorization snapshots immediately.
- Snapshot data must never include members from another company.
- Replaying claim redemption must not mint a second server token.

---

### Task 1: Persist LAN claim and server-grant security state in D1

**Files:**
- Create: `apps/web/cloudflare/migrations/0010_lan_server_security.sql`
- Create: `apps/web/backend/lan-server-authority.ts`
- Create: `apps/web/backend/lan-server-authority.test.ts`

**Interfaces:**
- Consumes: existing D1 binding and backend time/hash utilities.
- Produces: `createLanClaim`, `redeemLanClaim`, `authenticateLanServer`, `revokeLanServerGrant`, `lanServerSnapshot`.

- [ ] **Step 1: Write the failing schema/service tests**

Pin these cases: migration creates claim/grant indexes; `createLanClaim({companyId,serverId,issuedByDeviceId,issuedByMemberId})` returns a plaintext token once while storing only its digest; `redeemLanClaim({serverId,claimToken})` consumes exactly one live matching claim; replay, expiry and wrong `serverId` fail.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `cd apps/web && npx vitest run backend/lan-server-authority.test.ts`

Expected: FAIL because migration/service do not exist.

- [ ] **Step 3: Add migration `0010_lan_server_security.sql`**

Create normalized tables equivalent to `lan_server_claims` and `lan_server_grants` with token hashes, `server_id`, `company_id`, issuer, expiry/consumed timestamps, status, created/last-seen/revoked timestamps and indexes for token hash/server/company lookups. Before implementation, verify `0010` is still the next free migration slot; if main gained a migration, use the next integer without renaming existing migrations.

- [ ] **Step 4: Implement the authority service**

Exact exported interface:

```ts
export type LanServerMemberSnapshot = {
  memberId:string; email:string; name?:string; role:'admin'|'foreman'|'employee';
  modules:string[]; channels:string[]; status:'active'|'revoked';
};
export async function createLanClaim(input:{companyId:string;serverId:string;issuedByDeviceId:string;issuedByMemberId:string}):Promise<{claimToken:string;expiresAt:string}>;
export async function redeemLanClaim(input:{serverId:string;claimToken:string}):Promise<{companyId:string;serverToken:string;claimingMemberId:string}>;
export async function authenticateLanServer(serverToken:string):Promise<{grantId:string;serverId:string;companyId:string}|null>;
export async function revokeLanServerGrant(input:{serverId:string;companyId:string}):Promise<void>;
export async function lanServerSnapshot(companyId:string):Promise<{companyId:string;revision:string;generatedAt:string;members:LanServerMemberSnapshot[]}>;
```

Use cryptographically random tokens and SHA-256 digests. Claim TTL is exactly 10 minutes.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `cd apps/web && npx vitest run backend/lan-server-authority.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/cloudflare/migrations apps/web/backend/lan-server-authority.ts apps/web/backend/lan-server-authority.test.ts
git commit -m "feat(web): add LAN server claim authority"
```

### Task 2: Add admin-only Desktop claim creation route

**Files:**
- Modify: `apps/web/backend/index.ts`
- Create: `apps/web/backend/lan-server-claim-routes.test.ts`

**Interfaces:**
- Consumes: existing `deviceContext(deviceToken)` and Task 1 `createLanClaim`.
- Produces: `POST /api/desktop/lan/claim/start`.

- [ ] **Step 1: Write failing route tests**

Test: valid admin Desktop returns `{claimToken,expiresAt}`; valid `foreman` and `employee` return 403; revoked/invalid Desktop token returns 403; missing/invalid `serverId` returns 400.

- [ ] **Step 2: Run and confirm RED**

Run: `cd apps/web && npx vitest run backend/lan-server-claim-routes.test.ts`

Expected: route missing.

- [ ] **Step 3: Implement `POST /api/desktop/lan/claim/start`**

Input: `{deviceToken:string,serverId:string}`. Resolve `deviceContext`; require company/project binding, member role `admin`, and `desktop` channel. Call `createLanClaim` using server/company/device/member identifiers. Do not expose member lists or server token here.

- [ ] **Step 4: Run and verify GREEN**

Run: `cd apps/web && npx vitest run backend/lan-server-claim-routes.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/backend/index.ts apps/web/backend/lan-server-claim-routes.test.ts
git commit -m "feat(web): allow admins to create LAN server claims"
```

### Task 3: Add claim redemption and server snapshot routes

**Files:**
- Modify: `apps/web/backend/index.ts`
- Create: `apps/web/backend/lan-server-runtime-routes.test.ts`

**Interfaces:**
- Consumes: Task 1 authority functions.
- Produces: `POST /api/lan/claim/redeem`, `POST /api/lan/server/snapshot`.

- [ ] **Step 1: Write failing runtime route tests**

Cover successful one-use redemption; replay 409/403; wrong `serverId`; expired claim; valid server token returns only its own company snapshot; invalid/revoked server token returns 403.

- [ ] **Step 2: Run and confirm RED**

Run: `cd apps/web && npx vitest run backend/lan-server-runtime-routes.test.ts`

- [ ] **Step 3: Implement `POST /api/lan/claim/redeem`**

Input `{serverId,claimToken}`. Atomically consume claim, issue server token, then return `{serverToken,company,snapshot}` where snapshot is generated from current company members/entitlements only.

- [ ] **Step 4: Implement `POST /api/lan/server/snapshot`**

Input `{serverToken}`. Authenticate grant, refresh `lastSeenAt`, return company-scoped member authorization snapshot with revision/timestamp. Do not return license secrets, Desktop tokens, password credentials or unrelated business data.

- [ ] **Step 5: Run and verify GREEN**

Run: `cd apps/web && npx vitest run backend/lan-server-runtime-routes.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/backend/index.ts apps/web/backend/lan-server-runtime-routes.test.ts
git commit -m "feat(web): redeem LAN claims and serve auth snapshots"
```

### Task 4: Add administrator server revocation without creating a second permissions UI

**Files:**
- Modify: `apps/web/backend/index.ts`
- Modify: `apps/web/backend/lan-server-claim-routes.test.ts`

**Interfaces:**
- Consumes: Task 1 `revokeLanServerGrant` and existing Desktop admin identity.
- Produces: `POST /api/desktop/lan/server/revoke`.

- [ ] **Step 1: Add failing tests**

Require admin Desktop token + company ownership; reject non-admin and cross-company `serverId`; after revocation, the old server token cannot call snapshot.

- [ ] **Step 2: Run and confirm RED**

Run: `cd apps/web && npx vitest run backend/lan-server-claim-routes.test.ts backend/lan-server-runtime-routes.test.ts`

- [ ] **Step 3: Implement revoke route**

Input `{deviceToken,serverId}`. Resolve current admin/company and revoke only a grant belonging to that company. Audit through the existing platform/project audit mechanism when possible.

- [ ] **Step 4: Re-run and verify GREEN**

Same command; expected PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/backend/index.ts apps/web/backend/lan-server-claim-routes.test.ts
git commit -m "feat(web): revoke company LAN servers"
```

### Task 5: Full Cloudflare regression verification

**Files:**
- Modify only if structural documentation changed: `apps/desktop/docs/PROJECT_MAP.md`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: verified additive Cloud authority with no current-product regression.

- [ ] **Step 1: Run LAN authority tests**

Run: `cd apps/web && npx vitest run backend/lan-server-authority.test.ts backend/lan-server-claim-routes.test.ts backend/lan-server-runtime-routes.test.ts`

- [ ] **Step 2: Run existing critical Web/PWA tests**

Run: `cd apps/web && npx vitest run backend/p0-flows.test.ts backend/p3-workflows.test.ts src/field-sync.test.ts`

Expected: all current Desktop/PWA flows remain green.

- [ ] **Step 3: Run full Web verification**

Run: `cd apps/web && npm test && npm run build`

Expected: zero failures.

- [ ] **Step 4: Validate migrations locally**

Run: `cd apps/web && npx wrangler d1 migrations apply obra-na-mao-comercial --local --config wrangler.jsonc`

Expected: all migrations apply successfully from a clean local D1.

- [ ] **Step 5: Commit documentation only if needed**

Do not deploy or apply remote migrations from this branch.
