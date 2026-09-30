# F11 — Central Finance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make accounts, payments, DRE/dashboard financial reads and finance-reference sync authoritative in the LAN server for central-active installations.

**Architecture:** Extend the central schema for finance and its required relations, move composite payment behavior into a server-side finance service, route Desktop finance reads/writes through a source adapter, and make the F8 coordinator obtain obligations/financial summary data from the central provider.

**Tech Stack:** Node `node:sqlite`, Electron/CommonJS, Vitest, node:test.

**Spec:** `docs/superpowers/specs/2026-09-30-centralized-modules-sync-f8-f12-design.md`

## Global Constraints

- No central-active financial write may fall back to local SQLite.
- Payment registration and status effects are transactional on the server.
- DRE/dashboard must not combine authoritative central finance with stale local finance silently.
- Preserve existing renderer API/UX where possible.
- Existing local finance data => `migration-required`; F17 migrates it.
- Existing Cloud finance-reference publication stays on the same `SyncCoordinator`/`OnlineService` pipeline.

## Review Focus

- Duplicate/retried payment requests must not create accidental double payment.
- Cross-company/obra finance access must be rejected server-side.
- DRE/dashboard totals must match the current local implementation for the same fixture.
- Server outage must not create a local copy of a central account/payment.
- Finance-reference data sent to Cloud must come from central data when finance is central-active.

---

### Task 1: Add central finance schema and capability

**Files:**
- Create: `apps/lan-server/migrations/004_finance.sql`
- Modify: `apps/lan-server/src/repository.mjs`
- Create/Modify: `apps/lan-server/tests/finance-repository.test.mjs`

**Interfaces:**
- Add `fornecedores`, `categorias_financeiras`, `itens_orcamentarios` where still needed by planning/finance, `contas`, `pagamentos_conta` and required scalar relation columns.
- Capability adds `finance` only after migration succeeds.

- [ ] Write failing schema/repository tests for constraints, soft deletion, company/work filtering and payment FK behavior.
- [ ] Run `npm --prefix apps/lan-server test`; expected RED.
- [ ] Implement migration/allowlists/indexes minimally and idempotently.
- [ ] Run LAN suite; expected GREEN.
- [ ] Commit: `git commit -m "feat(lan): add central finance schema"`.

---

### Task 2: Port finance domain operations to server

**Files:**
- Create: `apps/lan-server/src/finance-service.mjs`
- Modify: `apps/lan-server/src/server.mjs`
- Modify: `apps/lan-server/src/authorization.mjs`
- Create: `apps/lan-server/tests/finance-service.test.mjs`

**Interfaces:**
- `FinanceService.accountPayment(id, payment)` equivalent to current Desktop account payment behavior.
- `FinanceService.dre(filters)` and `FinanceService.dashboard(filters)` preserve current response contracts.
- Endpoints: authenticated domain routes for payment, DRE and dashboard; exact paths may follow existing `/api/v1/finance/*` convention.

- [ ] Write failing tests for partial/full payments, invalid overpayment according to current rules, transaction rollback, DRE parity, dashboard parity and authorization.
- [ ] Run LAN suite; expected RED.
- [ ] Implement one-transaction payment flow plus read models.
- [ ] Run LAN suite; expected GREEN.
- [ ] Commit: `git commit -m "feat(lan): centralize finance domain operations"`.

---

### Task 3: Route Desktop finance reads/writes centrally

**Files:**
- Create: `apps/desktop/electron/services/finance-source-service.cjs`
- Create: `apps/desktop/electron/services/finance-source-service.test.ts`
- Modify: `apps/desktop/electron/services/lan-data-client.cjs`
- Modify: `apps/desktop/electron/main.cjs`
- Modify: `apps/desktop/electron/services/data-access-service.cjs`

**Interfaces:**
- `FinanceSourceService.dashboard(filters)`, `.dre(filters)`, `.accountPayment(id,payment)`.
- Generic central CRUD extends to finance tables only when finance is central-active.

- [ ] Write failing tests for local parity, LAN routing, no local fallback and account/payment visibility from a second client.
- [ ] Run focused Desktop tests; expected RED.
- [ ] Implement source adapter and IPC routing without changing renderer method names.
- [ ] Run focused/full Desktop suites; expected GREEN.
- [ ] Commit: `git commit -m "feat(desktop): route finance through central source"`.

---

### Task 4: Move finance-reference sync reads to the central provider

**Files:**
- Modify: `apps/desktop/electron/services/lan-sync-data-provider.cjs`
- Modify: LAN sync-source service/routes.
- Modify: `apps/desktop/electron/services/sync-coordinator.test.ts`

**Interfaces:**
- LAN provider implements `obligations(scope)` and any summary finance fields currently consumed by `SyncCoordinator`.
- No new Cloud endpoint is created.

- [ ] Write failing tests that seed a central payable, keep local finance empty/different, run sync and assert `publishFinanceReference` receives central values only.
- [ ] Run focused sync/LAN tests; expected RED.
- [ ] Implement central obligations/summary reads.
- [ ] Run focused, Desktop full and LAN full suites; expected GREEN.
- [ ] Commit: `git commit -m "feat(sync): publish central finance through existing pipeline"`.

---

### Task 5: Finance migration-state guard

**Files:**
- Modify module-state service/tests.

- [ ] Write failing tests: any local `contas`/`pagamentos_conta`/relevant finance records => `migration-required`; fresh install + capability => `central-active`.
- [ ] Run RED.
- [ ] Implement detector/state transition with no copy/delete.
- [ ] Run GREEN/full Desktop suite.
- [ ] Commit: `git commit -m "feat(desktop): guard finance central activation"`.

---

### Task 6: F11 regression gate

- [ ] `npm --prefix apps/desktop run lint`
- [ ] `npm --prefix apps/desktop test`
- [ ] `npm --prefix apps/desktop run build`
- [ ] `npm --prefix apps/lan-server test`
- [ ] Existing Web/PWA/Cloudflare regression suite.
- [ ] Compare local-vs-central DRE/dashboard/payment fixtures.
- [ ] Verify a second LAN client observes the committed financial state.
- [ ] PR remains draft; no merge/deploy.
