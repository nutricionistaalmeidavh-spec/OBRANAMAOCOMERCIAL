# PR #60 Integration, QA and Release Gates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close PR #60 with reproducible integration evidence across local/LAN modes, Web/PWA compatibility, frozen-head CI, packaging checks, and accurate release documentation without publishing an update.

**Architecture:** Treat security hardening and migration as prerequisites, then run a matrix across `local`, `lan-host` and `lan-client` with core/operation/planning/finance/RH states. Add automated contract/integration tests where they can be deterministic, keep hardware/network restart scenarios as an explicit manual candidate checklist, and update PR/documentation only after the head is frozen and green.

**Tech Stack:** npm workspaces, Vitest, `node:test`, GitHub Actions, Electron Builder, Cloudflare/Web test suite, Markdown release evidence.

**Spec:** `docs/superpowers/specs/2026-10-01-pr60-security-migration-hardening-design.md`

## Global Constraints

- Do not merge PR #60 from this plan.
- Do not deploy production Cloudflare changes from this plan.
- Do not publish a GitHub Release or enable automatic Desktop update delivery.
- Existing Web/PWA behavior remains included and must not become dependent on a paid Cloud feature.
- No direct SQLite network sharing.
- No silent fallback to local storage when a central module is configured but unavailable.
- Candidate packaging happens only after security and migration plans are green.
- Final CI evidence must come from one frozen commit SHA with no later code commits.

## Review Focus

1. A user staying entirely local must see no behavior regression from the LAN work — covered by Task 1.
2. `lan-client` must never become the Cloud sync coordinator by accident — covered by Task 2.
3. Web/PWA data flow must keep working after core/module centralization and migration — covered by Task 2.
4. Closing the Desktop window in `lan-host` must not silently stop the server, while explicit app quit must stop cleanly — covered by Task 3.
5. A green CI run from an old SHA must not be accepted after the branch changes — covered by Task 5.

---

## File Structure

- Create `docs/qa/pr60-storage-mode-matrix.md` — automated/manual matrix and evidence placeholders.
- Create/extend Desktop integration contract tests near `apps/desktop/electron/services/` for storage routing/sync ownership.
- Extend `apps/lan-server/tests/full-flow.test.mjs` only for cross-module happy-path smoke that belongs at server level.
- Modify `apps/desktop/src/components/StorageServerSettings.tsx` only for inaccurate state copy discovered during QA.
- Update `docs/superpowers/specs/2026-10-01-pr60-security-migration-hardening-design.md` only if implementation details legitimately differ from the approved design.
- Create `docs/qa/pr60-release-candidate-checklist.md` — manual server/client/package gate.
- Update the PR #60 description only after code freeze and evidence collection.

---

### Task 1: Build the automated storage-mode regression matrix

**Files:**
- Create: `docs/qa/pr60-storage-mode-matrix.md`
- Modify/create: Desktop routing/integration tests for `DataAccessService`, source services and `ModuleStorageStateService`

**Interfaces:**
- Consumes: completed security and migration plans.
- Produces: deterministic test coverage for mode/module routing and a matrix mapping each scenario to an automated test or manual gate.

- [ ] **Step 1: Define the matrix in Markdown before adding tests**

Rows: core, operation/RDO, planning, finance, RH. Columns: `local`, `lan-host`, `lan-client`, `migration-required`, `central-ready`, `central-active`, central unavailable. For every cell, state expected read/write source or explicit block.

- [ ] **Step 2: Add local-mode regression tests**

Assert all supported modules keep using local services/database when operational mode is `local`, regardless of stale persisted central state; no LAN client call occurs.

- [ ] **Step 3: Add LAN host/client routing tests**

For each module assert `migration-required → local`, `central-ready → blocked`, `central-active → remote`, and central transport failure propagates instead of falling back local.

- [ ] **Step 4: Run focused Desktop tests**

Run: `npm --workspace apps/desktop test -- data-access module-storage source-service`
Expected: all matrix cases PASS.

- [ ] **Step 5: Mark automated rows in the QA matrix with exact test filenames**

Do not mark manual-only network/reboot scenarios as automated.

- [ ] **Step 6: Commit**

```bash
git add docs/qa/pr60-storage-mode-matrix.md apps/desktop/**/*test*
git commit -m "test(desktop): add PR60 storage mode matrix"
```

---

### Task 2: Verify sync ownership and Web/PWA compatibility

**Files:**
- Modify/create: tests for `apps/desktop/electron/services/lan-sync-data-provider.cjs`
- Modify/create: tests for `apps/desktop/electron/services/sync-coordinator.cjs`
- Modify only if failing: related sync provider/coordinator implementation
- Update: `docs/qa/pr60-storage-mode-matrix.md`

**Interfaces:**
- Consumes: existing Cloud sync contract and operational storage providers.
- Produces: proof that `lan-host` is the coordinator where designed, `lan-client` stays paused, and central data can feed the existing Cloud/PWA sync path without changing billing/product semantics.

- [ ] **Step 1: Add coordinator ownership tests**

Assert `local` keeps existing behavior; `lan-host` uses LAN operational provider; `lan-client` returns paused reason indicating central synchronization belongs to the principal host; `remote` remains unavailable.

- [ ] **Step 2: Add no-fallback sync tests**

When LAN capabilities or server access fail in `lan-host`, assert sync reports failure/paused state and does not read the local module DB as a substitute.

- [ ] **Step 3: Run Desktop sync tests**

Run: `npm --workspace apps/desktop test -- lan-sync-data-provider sync-coordinator`
Expected: all PASS.

- [ ] **Step 4: Run Web compatibility tests**

Run: `npm run test:web`
Expected: all existing Web/PWA tests PASS without new paid-service dependency or contract break.

- [ ] **Step 5: Run Cloudflare validation/build commands used by CI**

Use repository scripts/workflow-equivalent validation locally where available; expected no contract/schema regression. Do not deploy production.

- [ ] **Step 6: Record evidence in QA matrix**

Record command, commit SHA and pass/fail for Desktop sync + Web tests.

- [ ] **Step 7: Commit any compatibility-only test/fix**

```bash
git add apps/desktop apps/web docs/qa/pr60-storage-mode-matrix.md
git commit -m "test(sync): verify LAN and Web compatibility"
```

---

### Task 3: Validate Desktop host lifecycle and candidate behavior

**Files:**
- Create: `docs/qa/pr60-release-candidate-checklist.md`
- Modify/create contract tests around `apps/desktop/electron/main.cjs` / `lan-host-service.cjs` where deterministic
- Do not publish installer.

**Interfaces:**
- Consumes: `lan-host` lifecycle, tray behavior, packaged LAN server resource.
- Produces: automated lifecycle assertions plus a manual release-candidate checklist for real Windows/macOS behavior.

- [ ] **Step 1: Add deterministic host lifecycle tests**

Assert configured `lan-host` starts the host service; switching away stops it; explicit app shutdown calls sync/scanner/host stop; start-at-login control does not alter storage mode.

- [ ] **Step 2: Verify packaging resource configuration**

Assert `apps/desktop/package.json` still includes `../lan-server` as `extraResources` with `src`, `migrations`, `package.json`, and packaging uses `--publish never` for candidate generation.

- [ ] **Step 3: Write manual candidate checklist**

Include: one principal PC + one client PC; claim/pair/revoke; migrate core then at least one dependent module; create/edit from both PCs; close principal window and confirm server remains available; explicit quit stops; OS reboot/start-at-login; server unavailable/reconnect; internet unavailable while LAN is available; backup/restore rejection of invalid DB; PWA/Web smoke.

- [ ] **Step 4: Add platform-specific package gates**

Windows: installer launches, LAN resource exists, server starts, no release is published. macOS: app/DMG build succeeds where CI supports it, LAN resource exists, no publish action.

- [ ] **Step 5: Commit**

```bash
git add docs/qa/pr60-release-candidate-checklist.md apps/desktop/**/*test* apps/desktop/package.json
git commit -m "docs(qa): add PR60 release candidate checklist"
```

---

### Task 4: Update architecture and PR documentation to the implemented truth

**Files:**
- Modify: `docs/superpowers/specs/2026-10-01-pr60-security-migration-hardening-design.md` only for confirmed implementation deltas
- Update/add relevant PR #60 roadmap/QA docs already present in the branch
- Prepare PR body content; do not claim gates that have not passed.

**Interfaces:**
- Consumes: actual final code and QA evidence from Tasks 1–3.
- Produces: accurate documented scope and merge checklist.

- [ ] **Step 1: Audit code vs. PR #60 description**

List actual status of core, operation/RDO, planning, finance, RH; storage modes; claim/pairing; migration; sync ownership; known deferred items.

- [ ] **Step 2: Remove stale statements**

In particular, remove any statement that Finance/RH/Planning remain local if the final code centralizes them, and remove references that imply `remote` is production-ready.

- [ ] **Step 3: Document guarantees and deferrals**

Guarantees: Web/PWA preserved, no network-shared SQLite, no silent local fallback, explicit migration, single-tenant LAN claim. Deferred: public remote server, multi-tenant LAN instance, paid cloud features, automatic LAN discovery if still not implemented.

- [ ] **Step 4: Build PR checklist from evidence**

Leave unchecked any Windows/macOS/Cloudflare/manual-candidate gate not yet observed on the frozen SHA.

- [ ] **Step 5: Commit documentation**

```bash
git add docs
git commit -m "docs(pr60): align roadmap with implemented architecture"
```

---

### Task 5: Freeze the branch and obtain one-SHA CI evidence

**Files:**
- No code changes after freeze unless a failing gate forces a fix; any fix resets the freeze and requires new CI evidence.

**Interfaces:**
- Consumes: all previous tasks/plans.
- Produces: one immutable candidate SHA with complete CI result set.

- [ ] **Step 1: Run full local tests before freeze**

Run: `npm test`
Run: `npm run build`
Expected: all tests/builds PASS.

- [ ] **Step 2: Record candidate SHA in both QA documents**

Use `git rev-parse HEAD`; this SHA becomes invalid as candidate evidence after any new commit.

- [ ] **Step 3: Push/finalize the branch and wait for CI on that exact SHA**

Required checks: Windows Desktop, macOS Apple Silicon, Cloudflare/QA pipelines applicable to PR #60.

- [ ] **Step 4: If any check fails, investigate from logs, fix narrowly, and restart freeze**

Never carry forward green evidence from the previous SHA.

- [ ] **Step 5: When all checks are green, update only evidence/checklist if that documentation update can be made without invalidating code SHA semantics**

If evidence is committed, distinguish `code candidate SHA` from `documentation-only evidence SHA`; otherwise place final evidence in PR conversation/body.

---

### Task 6: Generate and manually validate release candidates without publishing

**Files:**
- No release metadata publication.
- Evidence goes to `docs/qa/pr60-release-candidate-checklist.md` or PR conversation.

**Interfaces:**
- Consumes: frozen green candidate from Task 5.
- Produces: manually validated installer/app artifacts ready for a later explicit release decision.

- [ ] **Step 1: Build Windows candidate with publishing disabled**

Run the repository's Windows packaging command equivalent to `electron-builder --win nsis --x64 --publish never`.
Expected: installer generated locally/CI artifact; no GitHub Release created.

- [ ] **Step 2: Build macOS candidate in CI/eligible macOS environment with publishing disabled**

Expected: app/DMG artifact generated; no release publication.

- [ ] **Step 3: Execute the real two-machine checklist**

Use one principal/host and at least one client. Mark each scenario with evidence and observed version/SHA.

- [ ] **Step 4: Execute Web/PWA smoke against the candidate-compatible backend**

Confirm existing login/PWA and synced data path; do not deploy a new production backend solely to satisfy this step.

- [ ] **Step 5: Stop at release decision**

Do not merge PR #60, create a release, or re-enable auto-update without a separate explicit user instruction.
