# Canonical domain rules — phases 0–4

## Phase 0 baseline

These invariants are frozen before refactoring:

1. packages/contracts/lan-data-contract.json is the canonical entity-ownership contract.
2. An installation uses local SQLite **or** Obra na Mão Server as the active operational source. A central state never silently falls back to local storage.
3. Module activation remains gated by backup, idempotent import, validation, commit and post-commit central sanity.
4. Module dependency ordering and explicit rollback remain unchanged.
5. PWA/Cloudflare remains independent of Desktop storage mode and continues through the existing SyncCoordinator/OnlineService pipeline.
6. Central-only concerns (authorization, tenant/company scoping, optimistic concurrency, idempotency and server transactions) remain adapter concerns and are not moved into pure domain policy.

## Phase 1 inventory

| Rule | Desktop owner before | LAN owner before | Canonical target |
| --- | --- | --- | --- |
| Payroll net amount and pending installments | payroll-service.cjs | payroll-service.mjs | @obranamao/domain-core |
| Planning accumulated curve/cash | planning-service.cjs | planning-service.mjs | @obranamao/domain-core |
| RDO child normalization and occurrence-derived task | field-service.cjs | field-service.mjs | @obranamao/domain-core |
| Account payment status | database.cjs | finance-service.mjs | @obranamao/domain-core |

Persistence queries, transactions, authorization, company scoping, optimistic concurrency and transport are adapters, not duplicate domain owners.

## Phase 2–3 target

Pure business decisions above have one source owner: packages/domain-core/index.cjs.
Desktop and LAN services consume that package. They keep only persistence/transport/concurrency responsibilities.

## Phase 4 equivalence gate

A refactor is accepted only when:
- domain-core contract tests pass;
- existing Desktop behavior tests pass;
- existing LAN behavior tests pass;
- Local and LAN fixtures produce equivalent business outcomes for the extracted rules;
- Phase 0 baseline tests remain green.
