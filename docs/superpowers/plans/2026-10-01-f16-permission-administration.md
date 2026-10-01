# F16 Permission Administration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let authorized Cloud admins configure granular member permissions safely in the existing online governance experience and propagate the resulting effective permissions to LAN snapshots.

**Architecture:** Extend the existing `/api/members` governance flow and `admin-governance.ts` UI instead of creating a second admin surface. The Cloud backend validates authority, license bounds, owner/last-admin safety and persists the member’s explicit permission matrix; F15 then computes effective permissions for LAN snapshots. Desktop remains read-only for permissions.

**Tech Stack:** TypeScript Cloudflare backend, existing Web governance UI, current appClient API, Cloud audit, LAN snapshot refresh, Web tests.

**Spec:** `docs/superpowers/specs/2026-10-01-f14-f16-concurrency-permissions-admin-design.md`

## Global Constraints

- Permission editing lives only in the existing online Cloud governance surface.
- Do not create LAN endpoints that edit member permissions.
- Do not create a second Desktop permission editor.
- A member cannot receive modules/channels outside company/license entitlements.
- Canonical owner and last-admin protections must remain intact.
- Save operations are transactional from the user’s perspective and audited with actor, target and summarized diff.
- Templates suggest defaults; they never overwrite existing custom permissions silently.
- UI is mobile-first and cannot depend on hover.
- Do not modify F13/F17 migration/backup flows.
- No production deploy, merge or release in this branch.

## Review Focus

1. Changing role on a customized member must not silently erase custom granular permissions.
2. A stale UI submission cannot grant permissions outside current license/module/channel bounds.
3. Removing the last effective admin/canonical owner access must be blocked before persistence.
4. Audit data must contain a concise diff but no tokens/secrets.
5. After save and LAN refresh, the next request must use the new policy without restart or re-pairing.

---

## File Structure

### Cloud backend
- Modify `apps/web/backend/index.ts` — extend member API read/write model and validation around existing `/api/members` routes.
- Reuse `apps/web/backend/member-permissions.ts` from F15.
- Create `apps/web/backend/member-permissions-admin.test.ts` — authorization, entitlement, owner/last-admin, audit and snapshot propagation tests.

### Existing governance UI
- Modify `apps/web/src/admin-governance.ts` — matrix editor, role-template preview, custom-state indication, effective-state preview.
- Modify `apps/web/src/admin-governance.css` only if required beyond existing injected mobile styles.
- Create `apps/web/src/admin-governance-permissions.test.ts` — pure/render-contract tests for matrix normalization and mobile-safe controls where practical.

### Desktop read-only summary
- Modify only the existing Desktop server/settings access display if a natural read-only slot exists after F13/F17 reconciliation; otherwise F16 closes without a Desktop editor. Any Desktop surface must consume snapshot state and expose no mutation method.

---

### Task 1: Extend the member administration API contract

**Interfaces:**
- `GET /api/members` returns each member’s stored `permissions` (custom matrix or null), `effectivePermissions`, `permissionsRevision`, plus existing role/modules/channels.
- `POST /api/members` accepts `{ email, role, employeeId?, modules, channels, permissions? }`.
- Backend always normalizes/caps stored permissions through F15 helpers before persistence.

- [ ] **Step 1: Write failing API tests**

Assert an admin can read stored + effective permission state and save a valid matrix; non-admin receives 403.

- [ ] **Step 2: Add entitlement-bound tests**

Attempt to grant domain actions whose required module is absent from company entitlement or member module selection; assert rejection/normalization according to the existing member API validation convention and no privilege is persisted.

- [ ] **Step 3: Run RED**

Run focused member governance backend tests.

- [ ] **Step 4: Extend `Member` and existing `/api/members` serialization/mutation**

Reuse current member tables and audit path. Do not create a second permissions database.

- [ ] **Step 5: Run GREEN**

Run focused backend tests plus current member/license tests.

- [ ] **Step 6: Commit**

```bash
git add apps/web/backend/index.ts apps/web/backend/member-permissions.ts apps/web/backend/member-permissions-admin.test.ts
git commit -m "feat(f16): extend member governance API for permissions"
```

---

### Task 2: Protect owner and last-admin invariants

**Interfaces:**
- Mutation validator receives current actor, current target member, proposed role/modules/channels/permissions and project/company membership set.
- A canonical owner cannot be left without administrative access to its own tenant.
- If current product invariant requires at least one admin, mutation that would remove the last admin fails atomically.

- [ ] **Step 1: Write failing canonical-owner test**

Attempt to downgrade/block canonical owner from effective admin access; assert 409/403 using the current governance error convention and no member change.

- [ ] **Step 2: Write failing last-admin test**

With one admin in project, attempt downgrade/removal of admin authority; assert mutation is rejected. With two admins, downgrade one succeeds.

- [ ] **Step 3: Run RED**

Run focused admin invariant tests.

- [ ] **Step 4: Implement one backend guard before persistence**

Keep owner/last-admin checks Cloud-only; LAN snapshot consumers do not reproduce this administrative rule.

- [ ] **Step 5: Run GREEN**

Expected: all admin-invariant tests PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/backend/index.ts apps/web/backend/member-permissions-admin.test.ts
git commit -m "fix(f16): protect owner and last admin access"
```

---

### Task 3: Audit permission changes safely

**Interfaces:**
- Existing `audit(...)`/platform audit path records action `member_permissions_updated`.
- Details include target member id/email and summarized before/after diff for role/modules/channels/permissions.
- Details never include device tokens, server tokens, setup codes or token hashes.

- [ ] **Step 1: Write failing audit test**

Save a permission change and assert one audit record with actor, target and diff; serialize audit and assert known secret fixture strings are absent.

- [ ] **Step 2: Run RED**

Run focused audit test.

- [ ] **Step 3: Add audit call after successful persistence only**

A rejected mutation must not create a success audit event.

- [ ] **Step 4: Run GREEN**

Run audit + member governance suites.

- [ ] **Step 5: Commit**

```bash
git add apps/web/backend/index.ts apps/web/backend/member-permissions-admin.test.ts
git commit -m "feat(f16): audit granular permission changes"
```

---

### Task 4: Upgrade the existing Web governance UI to a domain × action matrix

**Interfaces:**
- Reuse current `openPermissions()` in `apps/web/src/admin-governance.ts`.
- Domains shown: Cadastros, Operação/RDO, Planejamento, Financeiro, RH.
- Actions shown: Ver, Criar, Editar, Excluir, Aprovar.
- Role change offers a template preview/apply action; it does not immediately overwrite existing custom selections.
- UI displays whether member is `Padrão do papel` or `Personalizado`.

- [ ] **Step 1: Add failing UI contract tests**

Test matrix serialization/deserialization, mobile-safe checkbox/button controls, disabled domains outside member/company modules, and custom-state detection.

- [ ] **Step 2: Run RED**

Run focused Web governance tests.

- [ ] **Step 3: Add permission matrix helpers**

Add pure helpers in `admin-governance.ts` or a small adjacent module if testability materially improves: read selected matrix, render matrix, compare with role template.

- [ ] **Step 4: Change role UX from destructive auto-apply to explicit suggestion**

Current `role change → applyDefaults()` behavior must no longer silently replace custom settings. Present “Aplicar padrão do papel” as an explicit action.

- [ ] **Step 5: Add effective-state preview**

Show permissions blocked by module/channel/license separately from selected custom values so admin can understand why an action will not be effective.

- [ ] **Step 6: Wire save payload**

POST current role/modules/channels plus normalized `permissions` to existing `/api/members`.

- [ ] **Step 7: Run GREEN**

Run governance tests and Web build.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/admin-governance.ts apps/web/src/admin-governance.css apps/web/src/admin-governance-permissions.test.ts
git commit -m "feat(f16): add granular permission matrix to governance UI"
```

---

### Task 5: Prove Cloud → snapshot → LAN live propagation

**Interfaces:**
- Saving a member permission changes Cloud snapshot revision.
- Existing LAN `/api/v1/admin/identity/refresh` fetches the new snapshot.
- `security.replaceSnapshot()` updates effective permissions without restart.

- [ ] **Step 1: Write integrated propagation test**

Member begins with `core:view,edit`; save Cloud matrix with `core:view`; refresh LAN identity; GET succeeds; PUT returns 403. Restore edit; refresh; PUT succeeds again.

- [ ] **Step 2: Add approve-scope test**

Grant `operation:approve` while leaving `finance:approve` and `rh:approve` absent; operation approval path succeeds and finance/payroll approval paths fail.

- [ ] **Step 3: Run GREEN across Cloud + LAN suites**

No restart or re-pair step may be present in the test.

- [ ] **Step 4: Commit**

```bash
git commit -am "test(f16): prove live permission propagation to LAN"
```

---

### Task 6: Final F14–F16 integrated gate

- [ ] **Step 1: Reconcile final F13/F17 head if not already integrated**

Preserve all backup/restore, migration, domain-integrity and release-freeze behavior.

- [ ] **Step 2: Run the approved end-to-end scenario**

A/B read same obra at N; A saves N+1; B stale save conflicts; Cloud admin removes B `core:edit`; LAN refresh; B can view but not save; admin restores edit and grants only `operation:approve`; B edits core and approves operation but not finance/RH.

- [ ] **Step 3: Verify architecture invariants**

`lan-client` has no SyncCoordinator; principal PC remains sole Cloud sync coordinator; no migration/backup code duplicated by F14–F16.

- [ ] **Step 4: Run full quality gates on one candidate SHA**

Desktop lint/test/build; full LAN tests; Web/PWA tests/build; Cloudflare CI. Confirm `DESKTOP_AUTO_RELEASE_ENABLED=false`, Publish GitHub release skipped, and no production migrate/deploy/smoke.

- [ ] **Step 5: Stop before merge/release**

Report candidate SHA, test counts, CI results, unresolved items and exact reconciliation with F13/F17. Await explicit authorization for any merge/deploy/release.
