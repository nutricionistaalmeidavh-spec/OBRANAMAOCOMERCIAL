# UX Contract

## Product context

- Audience: administradores, engenharia, financeiro e RH de empresas de obras.
- Primary jobs: operar o Obra na Mão, configurar fontes de dados e manter continuidade entre Desktop, servidor e Web/PWA.
- Target market(s): Brasil.
- Active locales: pt-BR.
- Language/content register: direto, operacional, sem jargão de implementação no happy path.
- Timezone/calendar policy: locale do sistema/pt-BR nas superfícies atuais.
- Accessibility target: WCAG 2.2 AA.

## Business-context sources

| Domain / scope | Authoritative source | Source type | Reviewed date |
|---|---|---|---|
| Fonte operacional e Web/PWA | `docs/superpowers/specs/2026-09-29-storage-identity-cloud-compatibility-design.md` | Arquitetura/Produto | 2026-10-01 |
| Migração local → central | `docs/superpowers/specs/2026-10-01-pr60-security-migration-hardening-design.md` | Arquitetura/Dados | 2026-10-01 |
| Permissões LAN/Cloud | `docs/superpowers/specs/2026-10-01-f14-f16-concurrency-permissions-admin-design.md` | Segurança/Permissões | 2026-10-01 |

## Canonical domain ownership

- Domain owner matrix: `docs/CANONICAL_DOMAIN_OWNERS.md`.
- Cargos, salário-base e benefícios pertencem a Pessoas & RH → Cargos e remuneração.
- Folha e pagamentos consome esses valores; Configurações do sistema não é owner de política de RH.
- Cargo + vínculos de benefícios são salvos pela operação única `catalogo.saveCompensationPolicy`, com rollback integral em falha.
- Paths, aliases, sidebar e breadcrumb são derivados de `apps/desktop/src/routes/registry.ts`.

## P1 — Configurações e lifecycle responsivo

- Configurações do sistema são agrupadas por intenção: **Dados e conectividade**, **Arquivos e proteção**, **Preferências** e **Aplicativo**.
- Cards simples têm altura orientada pelo conteúdo; não existe altura mínima global para igualar cards vizinhos.
- O setup de servidor usa **container queries** porque a largura útil depende da sidebar e do grid pai, não apenas do viewport.
- Dados de demonstração ficam atrás de **Ferramentas de suporte** recolhidas por padrão e não competem com tarefas normais.
- O owner Web usa o evento explícito `owner:rendered`; `owner-loja-online.ts` não observa mutações globais do DOM.
- Nenhuma dependência paga é necessária para esses fluxos; o core permanece local/self-hosted/open source.

## Visual contract

- Project `DESIGN.md`: `DESIGN.md`.
- Token ownership model: runtime CSS existente é canônico; `DESIGN.md` documenta intenção e mapeamento.
- Runtime design-system/token source: `apps/desktop/src/styles/index.css`, `apps/desktop/src/modules/command-center/artisys-desktop.css`.
- Mapping/export/adapters: classes compartilhadas do Command Center e `apps/desktop/src/components/ui.tsx`.
- Token drift gate: revisão de diff + QA visual do Desktop.
- Supported themes: Command Center ArtiSys (canônico); classic é legado/compatibilidade.
- Design-context owner/review policy: mudanças duráveis atualizam `DESIGN.md` e runtime no mesmo changeset.

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Select/Listbox | `Field` + `<select>` nativo | DESIGN + esta UX contract | native | teclado + QA visual |
| Form | `Field` + `Button` | `apps/desktop/src/components/ui.tsx` | create / edit / setup | testes + QA renderer |
| Scrollbar | stylesheet global | `apps/desktop/src/styles/index.css` | geometry exceptions | CSS + QA |
| Dialog | `Modal` / `Confirm` | `apps/desktop/src/components/ui.tsx` | neutral / danger | teclado + foco |
| Long-running progress | `StorageServerSettings` | esta UX contract | setup / recovery | testes + QA renderer |

## Flow ledger

| Operation | Trigger | Pending | Success destination | Success feedback | Failure recovery | Focus outcome | Source ref |
|---|---|---|---|---|---|---|---|
| Configurar servidor | `Configurar servidor e migrar dados` | progresso único por etapas | permanece em Configurações | `Servidor pronto` + 100% | `Tentar novamente`; detalhes técnicos | permanece na superfície | migration hardening spec |
| Migrar dados | parte da configuração | módulos internos na ordem core→operation→planning→finance→rh | permanece em Configurações | resumo único | retry idempotente; rollback técnico | permanece na superfície | migration hardening spec |
| Reverter tentativa | ação em `Detalhes técnicos` | botão busy | permanece no disclosure | mensagem inline | erro inline | retorno ao disclosure | migration hardening spec |
| Parear computador | continuar configuração | autorização/pareamento | permanece em Configurações | progresso continua | novo código / retry | campo relevante | LAN identity specs |

## Navigation and responsive behavior

- Route document title policy: preservar comportamento existente.
- Breadcrumb/tab/route-state policy: Command Center atual permanece canônico.
- Sidebar/drawer transformation: preservar shell existente.
- Focus restoration: `Modal`/`Confirm` restauram foco; disclosures usam `<details>/<summary>` nativos.

## Overlays and feedback

- Dialog primitive: `Modal` / `Confirm`.
- Destructive confirmation levels: rollback técnico usa confirmação app-owned; saves rotineiros não usam confirmação.
- Alert/banner scope: erro persistente fica junto da superfície de configuração; mensagens transitórias continuam no feedback compartilhado da página.
- Unsaved changes: configuração de servidor usa estado dirty e ação explícita.

## Async and resilience

- Mutation default: pessimista para configuração/migração.
- Idempotency and duplicate-submit policy: botões desabilitados enquanto `busy`; retry reutiliza protocolo de migração existente.
- Offline/read-stale/write behavior: local permanece fonte enquanto módulo não é `central-active`.
- Retry/backoff/timeout behavior: serviços existentes mantêm seus timeouts; UI oferece retry explícito.
- Version conflict and multi-user behavior: preserva F14 existente.
- Long-running progress and return path: uma única barra de progresso, com módulos detalhados apenas em disclosure.
- Dialog/form preservation and retry after mutation failure: valores de host/porta/códigos permanecem na tela.

## Validation

- Schema/validation layer: serviços Electron/LAN existentes.
- Trigger timing: validar ao executar a configuração.
- Server error mapping: mensagem inline com ação de retry.
- Duplicate-submit prevention: `busy` desabilita ações.
- Browser native `alert/confirm/prompt`: proibidos no fluxo de servidor.

## Permission and clipboard

- Permission UI strategy: migração inicial exige usuário Admin; usuário não-admin recebe mensagem de ação necessária.
- Disabled-state explanation: texto no painel de progresso quando a próxima ação depende de vínculo/pareamento/admin.

## Migration status

- Canonical primitives and owners: `StorageServerSettings` para setup; `ModuleMigrationService` para segurança por módulo.
- Current risk-prioritized slice: transformar a migração por módulo em uma jornada única sem remover estados internos, backup, retry ou rollback.
- Rollout/rollback and removal gates: não remover o protocolo por módulo; apenas retirar seus estados do happy path visual.

## Verification

- Required static commands: Desktop lint/test/build e LAN tests quando ambiente de execução estiver disponível.
- Browser/device matrix: Desktop Command Center em largura normal e estreita suportada.
- Accessibility checks: teclado, foco, `<progress>`, `<details>`, Modal/Confirm.
- Canonical sibling flow used for comparison: Configurações do sistema no Command Center.
- Failure-path evidence: erro de migração mantém dados locais e expõe retry/rollback.
