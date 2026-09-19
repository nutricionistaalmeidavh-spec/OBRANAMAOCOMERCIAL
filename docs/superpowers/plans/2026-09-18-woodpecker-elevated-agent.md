# Woodpecker Elevated Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a trusted elevated Windows Agent and migrate OBRANAMAOCOMERCIAL desktop validation to it while preserving the current limited Agent.

**Architecture:** Trust policy and reusable Windows CI checks live in `utilidades`; Agent installation/registration remains in `PDV-ARTISYS`; product-specific pipeline wiring remains in `OBRANAMAOCOMERCIAL`. Elevated execution is selected only by explicit Woodpecker labels and guarded by repository allowlist checks.

**Tech Stack:** Woodpecker CI 3.x, Windows PowerShell, Node.js 22, GitHub statuses, Electron/Vitest.

**Spec:** `docs/superpowers/specs/2026-09-18-woodpecker-elevated-agent-design.md`

## Global Constraints
- Keep the current limited Agent operational.
- Elevated Agent runs as the interactive Windows user with `RunLevel Highest`, not SYSTEM.
- Elevated Agent labels: `platform=windows/amd64`, `backend=local`, `privilege=elevated`, `owner=artisys`.
- Only allowlisted ArtiSys repositories may execute elevated product commands.
- No deploy, D1 migration, release publication or production mutation in this phase.
- OBRANAMAOCOMERCIAL elevated Desktop suite must not skip symlink tests.

---

### Task 1: Shared trust policy and Windows CI module

**Files:**
- Create in `utilidades`: `modules/artisys-windows-ci/package.json`
- Create in `utilidades`: `modules/artisys-windows-ci/module.json`
- Create in `utilidades`: `modules/artisys-windows-ci/src/index.mjs`
- Create in `utilidades`: `modules/artisys-windows-ci/bin/artisys-windows-ci.mjs`
- Create in `utilidades`: `modules/artisys-windows-ci/tests/policy.test.mjs`
- Create in `utilidades`: `modules/artisys-windows-ci/README.md`

**Interfaces:**
- Consumes: `CI_REPO`, `CI_COMMIT_EVENT`, `CI_COMMIT_SOURCE_REPO` when available.
- Produces: `assertTrustedElevatedContext(env)` and CLI `artisys-windows-ci verify-elevated`.

- [ ] Write failing Node tests for allowlisted repo, blocked repo, fork PR and required elevated labels.
- [ ] Run tests and confirm RED.
- [ ] Implement minimal policy module and CLI.
- [ ] Run `npm test` and `npm run check` for the module.
- [ ] Commit module to `feat/artisys-windows-ci-elevated`.

### Task 2: Elevated Agent registration

**Files:**
- Create in `PDV-ARTISYS`: `infra/woodpecker/agent-windows/start-elevated-agent.ps1`
- Create in `PDV-ARTISYS`: `infra/woodpecker/agent-windows/install-elevated-agent.ps1`
- Create in `PDV-ARTISYS`: `infra/woodpecker/agent-windows/elevated-agent.contract.test.mjs`
- Update in `PDV-ARTISYS`: `infra/woodpecker/agent-windows/README.md`

**Interfaces:**
- Consumes: existing Woodpecker server `.env`, installed `woodpecker-agent.exe`, `plugin-git.exe`, `ARTISYS_UTILIDADES_PATH`.
- Produces: Scheduled Task `ArtiSys Woodpecker Agent Elevated` and Agent labels `privilege=elevated,owner=artisys`.

- [ ] Write static contract test before scripts.
- [ ] Confirm test fails because scripts are absent.
- [ ] Implement elevated launcher with separate work directory and hostname.
- [ ] Implement administrator-only Scheduled Task registration using current interactive user and `RunLevel Highest`.
- [ ] Run contract test/syntax checks.
- [ ] Commit to `feat/woodpecker-elevated-agent`.

### Task 3: Split OBRANAMAOCOMERCIAL normal and elevated gates

**Files:**
- Modify: `.woodpecker/obra-comercial-qa.yaml`
- Modify: `scripts/woodpecker-qa.ps1`
- Create: `.woodpecker/obra-comercial-desktop-elevated.yaml`
- Create: `scripts/woodpecker-desktop-elevated.ps1`
- Update: `docs/WOODPECKER_QA.md`

**Interfaces:**
- Normal workflow remains on existing `pilot=pdv-artisys` limited Agent.
- Elevated workflow requires `privilege=elevated` and `owner=artisys` and invokes shared `artisys-windows-ci verify-elevated` before npm commands.

- [ ] Remove Desktop tests/build from normal runner.
- [ ] Add elevated workflow and runner.
- [ ] Elevated runner installs Desktop dependencies, prepares Electron, runs the complete `npm run test:desktop` with no `-t` exclusion, then `npm run build:desktop`.
- [ ] Keep GitHub reporter on success/failure.
- [ ] Verify diff contains no product runtime changes.

### Task 4: Activate and prove full Desktop suite

**Files:** none required after scripts are committed.

- [ ] Run `install-elevated-agent.ps1` once in Administrator PowerShell on the Windows host.
- [ ] Confirm second Agent appears with `privilege=elevated` and `owner=artisys`.
- [ ] Trigger OBRANAMAOCOMERCIAL elevated pipeline.
- [ ] Confirm full Desktop suite runs without symlink omissions.
- [ ] Confirm desktop build succeeds.
- [ ] Keep deployment manual.