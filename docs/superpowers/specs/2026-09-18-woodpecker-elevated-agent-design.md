# Woodpecker Elevated Agent Design

## Goal
Add a second Windows Woodpecker Agent with administrative privileges for trusted ArtiSys repositories, while preserving the existing limited Agent for normal CI and keeping deployment manual.

## Architecture
- Existing limited Agent stays unchanged for web/unit/build gates.
- New elevated Agent runs under the interactive Windows user with `RunLevel Highest`, not SYSTEM.
- Elevated Agent labels: `platform=windows/amd64`, `backend=local`, `privilege=elevated`, `owner=artisys`.
- Shared trust/policy logic lives in `nutricionistaalmeidavh-spec/utilidades` as `artisys-windows-ci`.
- Infrastructure scripts that know how to register/start the Agent remain with the existing Woodpecker infrastructure in `PDV-ARTISYS`.
- `OBRANAMAOCOMERCIAL` uses two pipelines: normal web/catalog QA and elevated desktop QA.

## Trusted repository policy
Initial allowlist:
- nutricionistaalmeidavh-spec/OBRANAMAOCOMERCIAL
- nutricionistaalmeidavh-spec/PDV-ARTISYS
- nutricionistaalmeidavh-spec/OficinaAgricola
- nutricionistaalmeidavh-spec/SistemaLavoura
- nutricionistaalmeidavh-spec/frota-e-manutencao
- nutricionistaalmeidavh-spec/pecuaria
- nutricionistaalmeidavh-spec/maquinasagricolas

The elevated Agent must reject any repository outside the allowlist before product commands execute. Pull requests from untrusted/fork sources must never use the elevated path.

## Obra na Mão migration
Normal pipeline remains responsible for catalog contract, dependencies, contracts typecheck, web tests, UX, SEO, assets and web build.

Elevated desktop pipeline is responsible for:
- trusted-repository check;
- administrator/elevation check;
- desktop dependencies;
- Electron preparation;
- complete desktop test suite without symlink skips;
- desktop build.

No deploy, D1 migration, GitHub Release or installer publication is added in this phase.

## Activation
Registering a Scheduled Task at `RunLevel Highest` requires one local PowerShell execution as Administrator. Repository changes prepare the script; this chat cannot execute that Windows administrative action remotely.

## Success criteria
- Existing limited Agent remains available.
- Elevated Agent has independent labels and workspace.
- Shared allowlist gate exists in `utilidades`.
- OBRANAMAOCOMERCIAL elevated pipeline requests `privilege=elevated` and `owner=artisys`.
- Full Desktop tests run with no CI-specific symlink exclusion when the elevated Agent is active.
- No production deploy action is present.