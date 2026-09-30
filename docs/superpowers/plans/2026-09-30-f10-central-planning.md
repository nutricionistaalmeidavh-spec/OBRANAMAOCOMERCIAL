# F10 — Central Planning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make planning/cronograma authoritative in the LAN server while preserving the current Planning UI and the existing Cloud/PWA schedule bridge.

**Architecture:** Extend the central schema for planning entities, add a server-side planning domain service for overview calculations, route Desktop planning operations through the selected operational source, and activate the F8 LAN sync provider for `cronograma_etapas`.

**Tech Stack:** Node `node:sqlite`, Electron/CommonJS, Vitest, node:test.

**Spec:** `docs/superpowers/specs/2026-09-30-centralized-modules-sync-f8-f12-design.md`

## Global Constraints

- No duplicate Planning UI or second sync pipeline.
- Local mode stays unchanged.
- `lan-host`/`lan-client` never fall back to local planning data after central activation.
- Preserve current `PlanningService.overview` response semantics as dependencies become central in the F8–F12 branch.
- Existing local planning data triggers `migration-required`; F17 migrates it.

## Review Focus

- `cronograma_etapas` edits from PWA must land in the central DB through the F8 coordinator.
- Front/stage ownership must be validated against the same obra.
- Planning calculations must not mix central cronograma with unrelated local rows silently.
- An unavailable server must produce an explicit error.
- Two LAN clients must observe the same progress/status immediately after commit.

---

### Task 1: Add central planning schema and capability

**Files:**
- Create: `apps/lan-server/migrations/003_planning.sql`
- Modify: `apps/lan-server/src/repository.mjs`
- Modify/Create: `apps/lan-server/tests/planning-repository.test.mjs`

**Interfaces:**
- Add central `etapas_obra` and `cronograma_etapas` with relations to central `obras`/`frentes_obra`.
- Extend capability state with `planning` only after migration succeeds.

- [ ] Write failing migration/repository tests for create/update/list, range constraints and obra/frente ownership.
- [ ] Run `npm --prefix apps/lan-server test`; expected RED.
- [ ] Implement schema/allowlists/indexes minimally.
- [ ] Run LAN suite; expected GREEN.
- [ ] Commit: `git commit -m "feat(lan): add central planning schema"`.

---

### Task 2: Add server-side Planning domain service

**Files:**
- Create: `apps/lan-server/src/planning-service.mjs`
- Modify: `apps/lan-server/src/server.mjs`
- Modify: `apps/lan-server/src/authorization.mjs`
- Create: `apps/lan-server/tests/planning-service.test.mjs`

**Interfaces:**
- Produces `PlanningService.overview(obraId)` with the same public keys used by Desktop: `budget_centavos`, `curve`, `cash`, `fronts`.
- Produces authenticated `GET /api/v1/planning/overview?obra_id=<id>`.

- [ ] Write failing tests for cumulative curve, empty dependencies, front aggregation, unauthorized user and cross-company work access.
- [ ] Run LAN tests; expected RED.
- [ ] Implement the server-side overview using only central tables available at that phase; missing future finance data must be represented consistently and never read from the Desktop local DB.
- [ ] Run LAN tests; expected GREEN.
- [ ] Commit: `git commit -m "feat(lan): compute planning overview centrally"`.

---

### Task 3: Route Desktop planning to the operational source

**Files:**
- Modify: `apps/desktop/electron/services/lan-data-client.cjs`
- Modify: `apps/desktop/electron/services/planning-service.cjs` or add `planning-source-service.cjs`
- Modify: `apps/desktop/electron/main.cjs`
- Modify: planning/data-access tests.

**Interfaces:**
- `LanDataClient.planningOverview(obraId)`.
- `PlanningSourceService.overview(obraId)` chooses local service for `local`, LAN for central-active planning.

- [ ] Write failing tests for local equivalence, LAN routing, server unavailable/no fallback, and response-shape parity.
- [ ] Run focused Desktop tests; expected RED.
- [ ] Implement minimal source routing without renderer API changes.
- [ ] Run focused then full Desktop tests; expected GREEN.
- [ ] Commit: `git commit -m "feat(desktop): route planning through operational source"`.

---

### Task 4: Activate schedule bridge from central data

**Files:**
- Modify: LAN sync-source service/routes from F9.
- Modify: `apps/desktop/electron/services/lan-sync-data-provider.cjs`.
- Modify: `apps/desktop/electron/services/sync-coordinator.test.ts`.

**Interfaces:**
- F8 capability advertises `cronograma_etapas` when planning is central-active.
- LAN provider implements list/get/applyRemote for `cronograma_etapas`.

- [ ] Write failing tests proving central schedule push and PWA remote schedule edit application/conflict behavior.
- [ ] Run focused sync/LAN tests; expected RED.
- [ ] Implement central schedule bridge using the existing Cloud entity name `schedule` and revision semantics.
- [ ] Run focused, Desktop full and LAN full suites; expected GREEN.
- [ ] Commit: `git commit -m "feat(sync): bridge central planning through existing pipeline"`.

---

### Task 5: Planning migration-state guard

**Files:**
- Modify module-state service/tests introduced in F9.
- Modify settings/status copy tests only where necessary.

- [ ] Write failing tests: existing local `cronograma_etapas`/`etapas_obra` => `migration-required`; fresh install + server capability => `central-active`.
- [ ] Run RED.
- [ ] Implement planning detector/state transition without moving or deleting data.
- [ ] Run GREEN/full Desktop suite.
- [ ] Commit: `git commit -m "feat(desktop): guard planning central activation"`.

---

### Task 6: F10 regression gate

- [ ] `npm --prefix apps/desktop run lint`
- [ ] `npm --prefix apps/desktop test`
- [ ] `npm --prefix apps/desktop run build`
- [ ] `npm --prefix apps/lan-server test`
- [ ] Existing Web/PWA/Cloudflare regression suite.
- [ ] Two-client central planning scenario plus PWA schedule round-trip through the PC principal.
- [ ] PR remains draft; no merge/deploy.
