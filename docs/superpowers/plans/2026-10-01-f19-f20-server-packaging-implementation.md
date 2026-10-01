# F19/F20 Server Packaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Empacotar o Server Core F18 como serviço instalável e atualizável em Windows e Linux, sem exigir Node global e sem alterar contratos F8–F18.

**Architecture:** O mesmo `apps/lan-server/src/index.mjs` continua sendo o único runtime. A camada nova cria um bundle self-contained com Node oficial 22.14.0, metadados de build e wrappers/instaladores específicos por SO. Windows usa WinSW 2.12.0 + Inno Setup 7.1.0; Linux usa systemd e scripts idempotentes.

**Tech Stack:** Node.js 22.14.0, node:test, PowerShell, WinSW 2.12.0, Inno Setup 7.1.0, Bash, systemd, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-01-f19-f20-server-packaging-design.md`

## Global Constraints

- F18 é a única implementação do runtime headless.
- F8–F17 permanecem intactas.
- Não criar segundo backend, `SyncCoordinator`, SQLite central, ACL local ou pipeline de sync.
- Runtime final não exige Node/npm/Electron/Git instalados no cliente.
- Dados/config/backups/logs ficam fora do diretório de binários.
- Upgrade nunca remove DB/config/backups.
- Uninstall preserva estado persistente por padrão.
- Purge destrutivo fica fora do uninstall padrão.
- Windows Service roda como `NT AUTHORITY\LocalService`, com escrita concedida somente aos diretórios persistentes necessários; nunca como `LocalSystem` por padrão.
- Firewall Windows somente opt-in `LocalSubnet`; Linux não altera firewall automaticamente.
- Bind padrão seguro é `127.0.0.1`; opção LAN na primeira instalação muda explicitamente para `0.0.0.0` e cria a regra `LocalSubnet`. Upgrade não sobrescreve configuração existente.
- Setup code e credenciais não entram em logs, config ou artefatos.
- Node deve ser lido da `.nvmrc`; baseline atual: `22.14.0`.
- WinSW deve permanecer pinado em `2.12.0` e verificado por SHA-256 registrado no lock de dependências de build.
- Inno Setup deve permanecer pinado em `7.1.0`; instalador oficial x64 SHA-256 `0362a383ed217d4c4239b5933866dd96d3eb2102737da92f80f6057a4b40df2f`.
- `DESKTOP_AUTO_RELEASE_ENABLED=false` permanece.
- Nenhum GitHub Release, deploy, merge ou auto-update nesta branch.
- Nenhum código específico para Everton.

## Review Focus

1. **Upgrade sobre instalação existente:** DB, serverId, config, backups e sentinel devem sobreviver a reinstalação.
2. **Uninstall padrão:** serviço/binários saem; estado persistente permanece.
3. **Dependência externa adulterada:** hash divergente deve interromper o build antes de gerar artefato.
4. **LAN opt-in e upgrades:** primeira instalação LAN pode bindar `0.0.0.0`; reinstalação nunca reescreve uma configuração já existente.
5. **Serviço que não fica ready:** instalador/script deve falhar explicitamente sem apagar estado existente.

---

### Task 1: Common self-contained package builder

**Files:**
- Create: `apps/lan-server/packaging/common/vendor-lock.json`
- Create: `apps/lan-server/packaging/common/package-manifest.mjs`
- Create: `apps/lan-server/packaging/common/build-package.mjs`
- Create: `apps/lan-server/packaging/common/wait-ready.mjs`
- Create: `apps/lan-server/tests/packaging-common.test.mjs`
- Modify: `apps/lan-server/package.json`

**Interfaces:**
- Consumes: `.nvmrc`, `apps/lan-server/src`, `apps/lan-server/migrations`, `apps/lan-server/package.json`.
- Produces: `buildServerPackage({ repoRoot, outputDir, platform, arch, commitSha, nodeArchive })` and `waitForReady({ host, port, timeoutMs })`.

- [ ] **Step 1: Write failing tests** for allowlisted package layout, safe `build.json`, no CI absolute paths, same F18 entrypoint, invalid platform/arch rejection, and checksum mismatch rejection.
- [ ] **Step 2: Run** `node --test apps/lan-server/tests/packaging-common.test.mjs`; expected FAIL because packaging modules do not exist.
- [ ] **Step 3: Implement `vendor-lock.json`** with Node 22.14.0 source patterns, WinSW 2.12.0 metadata, Inno Setup 7.1.0 metadata, and SHA fields required to be 64 hex chars.
- [ ] **Step 4: Implement `package-manifest.mjs`** to emit only `{ productVersion, commitSha, nodeVersion, platform, arch, builtAt }`.
- [ ] **Step 5: Implement `build-package.mjs`** to copy only `src/**`, `migrations/**`, `package.json`, selected runtime binary, metadata, and requested platform files.
- [ ] **Step 6: Implement `wait-ready.mjs`** with bounded retries against `GET /ready`, rejecting timeout/non-JSON terminal failures.
- [ ] **Step 7: Add package scripts** `packaging:test` and `packaging:common` without changing `start` or `test`.
- [ ] **Step 8: Run tests**; expected PASS.
- [ ] **Step 9: Commit** `feat(server): add reproducible common package builder`.

### Task 2: Windows Service package

**Files:**
- Create: `apps/lan-server/packaging/windows/service.xml`
- Create: `apps/lan-server/packaging/windows/server.env.template`
- Create: `apps/lan-server/packaging/windows/build.ps1`
- Create: `apps/lan-server/packaging/windows/service-control.ps1`
- Create: `apps/lan-server/tests/packaging-windows-service.test.mjs`

**Interfaces:**
- Consumes: common package layout from Task 1.
- Produces: Windows bundle containing `runtime/node.exe`, `platform/ObraNaMaoServer.exe`, `platform/ObraNaMaoServer.xml`, and safe env template.

- [ ] **Step 1: Write failing tests** asserting service id/display name, bundled node path, `app/src/index.mjs`, automatic start, restart-on-failure, service account `NT AUTHORITY\LocalService`, log path under ProgramData, and no secret-bearing env defaults.
- [ ] **Step 2: Run** `node --test apps/lan-server/tests/packaging-windows-service.test.mjs`; expected FAIL.
- [ ] **Step 3: Implement WinSW XML** with service id `ObraNaMaoServer`, display name `Obra na Mão Server`, built-in `LocalService`, stop timeout, restart policy and relative bundled runtime command.
- [ ] **Step 4: Implement env template** targeting `%ProgramData%\ArtiSys\Obra na Mão Server\{data,backups,logs}` with `127.0.0.1:4732` default and `SHOW_SETUP_CODE=false`.
- [ ] **Step 5: Implement `build.ps1`** to download Node 22.14.0 Windows x64 and WinSW 2.12.0 during build only, verify hashes, call common builder, and never embed credentials.
- [ ] **Step 6: Implement `service-control.ps1`** for install/start/stop/restart/uninstall of the wrapper, granting `LocalService` write only on data/backups/logs and never deleting ProgramData.
- [ ] **Step 7: Run tests**; expected PASS.
- [ ] **Step 8: Commit** `feat(server): add Windows service package`.

### Task 3: Windows Inno Setup installer and safe upgrade/uninstall

**Files:**
- Create: `apps/lan-server/packaging/windows/installer.iss`
- Create: `apps/lan-server/packaging/windows/install-hooks.ps1`
- Create: `apps/lan-server/tests/packaging-windows-installer.test.mjs`

**Interfaces:**
- Consumes: Windows bundle from Task 2.
- Produces: `Obra-na-Mao-Server-Setup-<version>-x64.exe`.

- [ ] **Step 1: Write failing tests** asserting Program Files binary destination, ProgramData persistence, no recursive delete of ProgramData, service stop before binary replacement, service start + readiness after install, and firewall task disabled by default.
- [ ] **Step 2: Add Review Focus tests** for paths with spaces, reinstall preserving config/sentinel, readiness failure leaving persistent data untouched, and LAN opt-in writing `HOST=0.0.0.0` only when creating config for the first time.
- [ ] **Step 3: Run tests**; expected FAIL.
- [ ] **Step 4: Implement Inno script** with x64-only guard, upgrade-safe binary replacement, service registration/start, first-install config creation, and default uninstall preserving ProgramData.
- [ ] **Step 5: Implement firewall/LAN opt-in** so the selected first install creates the named TCP rule scoped to `LocalSubnet` and initial bind `0.0.0.0`; default remains loopback. Existing config is never overwritten on upgrade. Uninstall removes only the named product rule.
- [ ] **Step 6: Implement installer tool bootstrap** in CI/build script using Inno Setup 7.1.0 x64 and verified official SHA-256.
- [ ] **Step 7: Run tests**; expected PASS.
- [ ] **Step 8: Commit** `feat(server): add Windows installer lifecycle`.

### Task 4: Linux package and systemd unit

**Files:**
- Create: `apps/lan-server/packaging/linux/obra-na-mao-server.service`
- Create: `apps/lan-server/packaging/linux/server.env.template`
- Create: `apps/lan-server/packaging/linux/build.sh`
- Create: `apps/lan-server/tests/packaging-linux-service.test.mjs`

**Interfaces:**
- Consumes: common package layout from Task 1.
- Produces: Linux amd64 bundle with bundled Node, systemd unit and default env template.

- [ ] **Step 1: Write failing tests** for `User=obra-na-mao`, bundled `/opt/obra-na-mao/server/runtime/node`, `EnvironmentFile=/etc/obra-na-mao/server.env`, `Restart=on-failure`, `NoNewPrivileges=true`, writable paths limited to persistent directories, and no firewall commands.
- [ ] **Step 2: Run tests**; expected FAIL.
- [ ] **Step 3: Implement systemd unit** with graceful SIGTERM and hardening compatible with SQLite/backups/logs.
- [ ] **Step 4: Implement Linux env template** with `/var/lib/obra-na-mao`, `/var/lib/obra-na-mao/backups`, `/var/log/obra-na-mao`, port 4732 and no secret values.
- [ ] **Step 5: Implement `build.sh`** to fetch Node 22.14.0 linux-x64, verify against official Node SHASUMS256, call common builder, and emit a deterministic tar.gz layout.
- [ ] **Step 6: Run `bash -n` + Node contract tests**; expected PASS.
- [ ] **Step 7: Commit** `feat(server): add Linux systemd package`.

### Task 5: Linux install/upgrade/uninstall lifecycle

**Files:**
- Create: `apps/lan-server/packaging/linux/install.sh`
- Create: `apps/lan-server/packaging/linux/uninstall.sh`
- Create: `apps/lan-server/tests/packaging-linux-installer.test.mjs`

**Interfaces:**
- Consumes: Linux package from Task 4.
- Produces: idempotent install/upgrade and non-destructive uninstall.

- [ ] **Step 1: Write failing tests** asserting root check, amd64 check, system user without login shell, `/opt` replacement only, config creation only-if-absent, ownership of persistent dirs, `daemon-reload`, enable/start, readiness verification, and no firewall mutation.
- [ ] **Step 2: Add Review Focus tests** for reinstall preserving config/sentinel/server data and uninstall preserving `/etc/obra-na-mao` + `/var/lib/obra-na-mao`.
- [ ] **Step 3: Run tests**; expected FAIL.
- [ ] **Step 4: Implement `install.sh`** with explicit failure messages and no destructive rollback of persistent data.
- [ ] **Step 5: Implement `uninstall.sh`** to disable/remove service and `/opt` runtime only; no purge flag in default path.
- [ ] **Step 6: Run `bash -n` + Node tests**; expected PASS.
- [ ] **Step 7: Commit** `feat(server): add Linux install lifecycle`.

### Task 6: Dedicated packaging CI

**Files:**
- Create: `.github/workflows/server-platform-ci.yml`
- Create: `apps/lan-server/tests/packaging-ci-contract.test.mjs`

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces: Windows + Ubuntu packaging gates and CI artifacts only.

- [ ] **Step 1: Write failing CI-contract test** asserting two jobs (`windows`, `linux`), LAN tests before packaging, no `gh release create`, and artifact upload only.
- [ ] **Step 2: Implement Windows job**: checkout → Node from `.nvmrc` → LAN tests → packaging tests → Windows bundle → Inno compile → silent install smoke → `/ready` → serverId capture → service restart → same serverId → sentinel → reinstall → sentinel/config preserved → uninstall → service absent + ProgramData preserved → upload artifact.
- [ ] **Step 3: Implement Linux job**: checkout → Node from `.nvmrc` → LAN tests → packaging tests → `bash -n` → `systemd-analyze verify` → package build → install → `/ready` → serverId capture → restart → same serverId → sentinel → reinstall → persistence → uninstall → `/opt` absent + data/config preserved → upload tarball.
- [ ] **Step 4: Ensure workflow permissions are read-only where possible** and contains no release/deploy step.
- [ ] **Step 5: Run CI-contract test**; expected PASS.
- [ ] **Step 6: Commit** `ci(server): validate Windows and Linux service packages`.

### Task 7: Whole-branch regression and evidence

**Files:**
- Modify only if a real F19/F20 regression requires it; do not change F8–F18 contracts to satisfy packaging.
- Update: PR description/evidence after gates finish.

**Interfaces:**
- Consumes: all previous tasks.
- Produces: same-SHA evidence for F19/F20 readiness.

- [ ] **Step 1: Run complete LAN suite** `npm --prefix apps/lan-server test`.
- [ ] **Step 2: Run Desktop lint/tests/build** through existing Windows CI because `apps/lan-server/**` is a shared path.
- [ ] **Step 3: Run dedicated Windows packaging CI** and require install/restart/reinstall/uninstall smoke PASS.
- [ ] **Step 4: Run dedicated Linux packaging CI** and require `systemd-analyze verify` plus real service lifecycle PASS.
- [ ] **Step 5: Verify artifacts contain no secrets, no absolute CI paths and correct metadata/checksums.**
- [ ] **Step 6: Verify no GitHub Release, deploy or production job executed.**
- [ ] **Step 7: Compare branch against F18 head** and confirm changes are limited to packaging/tests/workflow/docs/package scripts.
- [ ] **Step 8: Keep PR draft and stop before merge.**

## Definition of Done

### F19

- Windows x64 installer builds from pinned/verified dependencies.
- Node global is not required.
- `ObraNaMaoServer` runs under `NT AUTHORITY\LocalService`, installs as automatic service and becomes `/ready`.
- Restart and reinstall preserve `serverId`, DB, config and persistent sentinel.
- Default bind is loopback; LAN bind/firewall is explicit opt-in and `LocalSubnet` only.
- Uninstall removes service/binários but preserves ProgramData.
- Windows CI is green on final SHA.

### F20

- Ubuntu/Debian amd64 package includes bundled Node.
- `obra-na-mao-server.service` runs as `obra-na-mao` and becomes `/ready`.
- Restart and reinstall preserve `serverId`, DB/config and sentinel.
- Linux install does not mutate firewall.
- Uninstall removes runtime/unit but preserves `/etc/obra-na-mao` and `/var/lib/obra-na-mao`.
- Linux CI is green on final SHA.

### Global

- F8–F18 continue green.
- No duplicate backend/sync/auth/migration/permission implementation.
- No merge, deploy, release or auto-update.