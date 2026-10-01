# PR #60 Hardening Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Orchestrate the approved PR #60 hardening work across security, migration/backup and final integration gates while minimizing conflicts with the still-moving functional branch.

**Architecture:** Execute the three detailed plans as separate workstreams on `hardening/pr60-security-migration-docs`. Security and backup primitives can progress in parallel; core routing and migration protocol share hotspots and are sequenced. Final integration/QA starts only after both security and migration workstreams are green, followed by a rebase/update onto the stabilized PR #60 head and one frozen candidate SHA.

**Tech Stack:** Git/GitHub, Node.js 22, Electron 43, Vitest, `node:test`, SQLite, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-01-pr60-security-migration-hardening-design.md`

## Global Constraints

- Work only on `hardening/pr60-security-migration-docs` until the integration step.
- No merge, deploy, GitHub Release or auto-update publication.
- Rebase/update from `feat/desktop-lan-server-foundation` only after a coherent workstream checkpoint; never overwrite concurrent F12 work blindly.
- Preserve `local`, `lan-host`, `lan-client`, Web/PWA and current Cloud sync semantics.
- Treat `data-access-service.cjs`, `lan-data-client.cjs`, `module-storage-state-service.cjs`, `server.mjs` and `repository.mjs` as hotspots: one workstream owns each hotspot at a time.
- Every implementation task follows its detailed plan's TDD cycle and ends in a small commit.

## Review Focus

1. F12 may advance on the source branch while hardening is implemented; integration must reconcile, not overwrite, those changes — covered by Tasks 1 and 4.
2. Security and migration both touch `server.mjs`/`repository.mjs`; parallel work must not edit those files concurrently — covered by Task 2.
3. Backup work can run independently but its final interface must match `ModuleMigrationService` exactly — covered by Task 2.
4. A rebase after tests pass invalidates prior test evidence until rerun — covered by Task 4.
5. Final CI/manual evidence must reference the same frozen candidate code SHA — covered by Task 5.

---

### Task 1: Establish execution checkpoints and hotspot ownership

**Files:**
- Read: all three detailed plans in `docs/superpowers/plans/`.
- No production code change.

**Interfaces:**
- Produces: execution order and temporary hotspot ownership.

- [ ] **Step 1: Record current source/head SHAs**

Record `feat/desktop-lan-server-foundation` and `hardening/pr60-security-migration-docs` SHAs before implementation.

- [ ] **Step 2: Assign hotspot ownership for Wave 1**

Security owns `apps/lan-server/src/server.mjs` and `repository.mjs`; Backup owns only Desktop backup files. Core-routing work waits for the LAN security hotspot checkpoint.

- [ ] **Step 3: Verify branch contains no unrelated functional changes**

Compare against its original base and confirm only approved spec/plan docs exist before code begins.

---

### Task 2: Execute Wave 1 in parallel where safe

**Files:**
- Plan A: `docs/superpowers/plans/2026-10-01-pr60-lan-security-hardening.md`
- Plan B subset: Task 3 of `docs/superpowers/plans/2026-10-01-pr60-module-migration-backup.md`

**Interfaces:**
- Produces: hardened LAN identity/domain invariants and hardened Desktop backup primitives.

- [ ] **Step 1: Run LAN Security Tasks 1–4 sequentially within that workstream**

Security may edit LAN `server.mjs`/`repository.mjs`; no migration-protocol edits to those files yet.

- [ ] **Step 2: In parallel, run Backup Task 3**

Backup edits only Desktop `backup-service.cjs` and its focused helper/tests.

- [ ] **Step 3: Run each workstream's focused suites**

Both workstreams must be green independently before Wave 2.

- [ ] **Step 4: Commit checkpoint**

Ensure LAN security and backup work are separate commits so either can be reviewed/reverted independently.

---

### Task 3: Execute Wave 2 migration/core work

**Files:**
- Plan: `docs/superpowers/plans/2026-10-01-pr60-module-migration-backup.md`

**Interfaces:**
- Consumes: Wave 1 hardened repository/server and backup interface.
- Produces: core gate, LAN migration protocol, Desktop migration orchestration and explicit UI controls.

- [ ] **Step 1: Implement core gate (Task 1 of migration plan)**

This owns Desktop storage-routing hotspots for the duration of the task.

- [ ] **Step 2: Implement LAN migration batches (Task 2)**

Start only after LAN Security commits are stable; build on hardened `server.mjs`/`repository.mjs` rather than replacing them.

- [ ] **Step 3: Implement ModuleMigrationService (Task 4)**

Use the exact hardened backup interface produced in Wave 1.

- [ ] **Step 4: Wire explicit controls (Task 5)**

Do not expose arbitrary module-state mutation.

- [ ] **Step 5: Close migration regression gate (Task 6)**

Run full Desktop + LAN tests before integration work.

---

### Task 4: Reconcile with the stabilized PR #60 source branch

**Files:**
- Potential conflicts limited to files changed by both branches.

**Interfaces:**
- Consumes: completed hardening work and latest stabilized `feat/desktop-lan-server-foundation`.
- Produces: one reconciled hardening branch containing all newer F12 fixes plus hardening.

- [ ] **Step 1: Fetch/inspect latest PR #60 head and compare from original base**

List source-branch commits made after `7bcc7604`; identify overlaps with hardening hotspots.

- [ ] **Step 2: Rebase or merge-update consciously**

For each conflict, preserve newer F12 behavior and reapply the hardening invariant/test. Do not choose ours/theirs wholesale on hotspots.

- [ ] **Step 3: Rerun all focused suites after reconciliation**

Prior green evidence is invalid after source integration.

- [ ] **Step 4: Run `npm test`**

Expected: all repository tests green before final QA plan begins.

---

### Task 5: Execute final integration/QA/release gates

**Files:**
- Plan: `docs/superpowers/plans/2026-10-01-pr60-integration-qa-release-gates.md`

**Interfaces:**
- Consumes: reconciled green hardening branch.
- Produces: frozen candidate SHA, CI evidence, manual candidate checklist and accurate PR documentation.

- [ ] **Step 1: Execute Integration Tasks 1–4**

Build automated mode matrix, sync/Web compatibility evidence, host lifecycle checks and documentation.

- [ ] **Step 2: Freeze the candidate**

No code changes after candidate SHA is declared without restarting the freeze process.

- [ ] **Step 3: Obtain Windows/macOS/Cloudflare CI on exact candidate SHA**

Old green runs do not count.

- [ ] **Step 4: Generate candidate artifacts with publish disabled and execute the real host+client checklist**

No production release/deploy.

- [ ] **Step 5: Stop for explicit merge/release authorization**

The completed hardening branch/PR is presented for review; merge, deploy and updater publication remain separate user decisions.

## Parallelization Summary

```text
Wave 1
├─ LAN security/integrity ───────────────┐
└─ Desktop backup hardening ─────────────┤  (parallel; disjoint files)
                                         ▼
Wave 2
core gate → LAN migration protocol → ModuleMigrationService → UI controls
                                         ▼
Source reconciliation with latest PR #60/F12
                                         ▼
Wave 3
├─ automated mode/sync/Web QA
├─ documentation audit
└─ candidate checklist preparation       (partly parallel)
                                         ▼
frozen SHA → CI → package candidates → real 2-machine QA → STOP before merge/release
```
