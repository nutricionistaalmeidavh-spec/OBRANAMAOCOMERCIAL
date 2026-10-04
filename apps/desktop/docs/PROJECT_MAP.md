# Mapa do projeto — Fluxo DRE

## Entrega comercial — 2026-09-05

- `electron/services/sync-coordinator.cjs` e migration `017_desktop_sync.sql`: vínculo explícito empresa/obra/dispositivo, outbox SQLite, repetição idempotente, leitura de bridge e revisão de conflitos. Não associa pessoas por nome nem mistura obras.
- IPC/preload: `online:sync-state`, `online:sync-configure`, `online:sync-now`, `online:sync-resolve-local`. `src/components/SyncSettings.tsx` em Configurações confirma o vínculo e mostra estado/pendências. Alteração de conexão, restauração e encerramento aguardam a sincronização em andamento.
- `useWorkContext.tsx`/`WorkContextBar.tsx`: competência e contexto persistidos. Dashboard consolidado por empresa; DRE/Contas usam empresa/obra; folha e ponto usam competência. O contexto não implica que todas as telas tenham filtro global.
- Shell: busca, grupos recolhíveis e favoritos; navegação compacta por Financeiro, Obras, Pessoas & RH e Configurações. Compras/Contratos e Configurações usam páginas-hub sem remover as rotas diretas dos módulos.
- Contrato `packages/contracts/src/desktop-sync.ts`: tipos do renderer e validação de entrada do backend Cloudflare.
- Validação: testes reais SQLite do coordenador, regressões de UX, testes web de persistência/reenvio/lifecycle. Não substituem instalação Windows/macOS e ensaio real entre dois dispositivos.

Última revisão estrutural: 2026-09-29.

Este documento é o ponto de partida para alterações. Leia a seção afetada e abra apenas os arquivos diretamente relacionados; evite uma nova varredura global.

## Visão geral

Aplicativo desktop Windows e offline para gestão financeira e operacional de construção civil.

- Renderer: React 19, TypeScript, React Router e Vite.
- Desktop: Electron; entrada em `electron/main.cjs`.
- Persistência: SQLite local via `better-sqlite3`.
- Comunicação: API restrita `window.fluxoDre`, definida no preload e atendida por IPC.
- Dados de execução: `%APPDATA%\fluxo-dre` por padrão; podem ser redirecionados por `FLUXO_DRE_DATA_DIR`.
- O núcleo continua offline-first em SQLite. A partir de 2026-09-02 existe uma ponte online opcional para vínculo de dispositivo, sincronização Obra360, Financeiro Inteligente e IA estruturada.
- A partir de 2026-10-01, o modo opcional **Servidor da empresa** cobre o núcleo F8–F12: Empresas/Clientes/Obras, RDO/operação, Planejamento, Financeiro e RH podem usar o banco central LAN quando o módulo está `central-active`. Instalações locais permanecem compatíveis e dados locais existentes exigem migração explícita; não há fallback silencioso.
- `apps/lan-server/` é o processo HTTP destinado a rodar na infraestrutura já existente do cliente; por padrão escuta somente `127.0.0.1:4732`, expõe `/health`, `/version` e `/api/v1/{empresas|clientes|obras}`, e mantém um SQLite central próprio.

## Fluxo entre camadas

Modo local:

`src/pages/*` → `window.fluxoDre` → `electron/preload.cjs` → handlers em `electron/main.cjs` → `DataAccessService` → `DatabaseService` → SQLite local.

Modo Servidor da empresa com módulos F8–F12 ativos:

`src/pages/*` → `window.fluxoDre` → IPC → source/data-access do módulo → `LanDataClient` → HTTP `/api/v1/*` → serviços de domínio/`LanRepository` → SQLite central.

Cada módulo possui estado explícito (`local`, `central-ready`, `central-active` ou `migration-required`). `central-ready` nunca cai silenciosamente para SQLite local. O PC principal (`lan-host`) é o coordenador da sincronização Cloud existente; clientes LAN não criam um segundo pipeline Desktop ↔ Cloudflare/D1 ↔ PWA.

Ao mudar uma operação que cruza camadas, confira apenas os pontos correspondentes desse fluxo. A tipagem pública do preload fica em `src/vite-env.d.ts`.

## Diretórios e arquivos principais

- `src/main.tsx`: inicialização do renderer.
- `src/App.tsx`: tabela de rotas.
- `src/components/AppShell.tsx`: navegação e estrutura visual global do layout clássico.
- `src/components/ui.tsx`: componentes reutilizáveis de interface.
- `src/modules/command-center/`: interface ativa, incluindo o shell ArtiSys e versões especializadas de Painel, DRE e Financeiro.
- `src/modules/classic-ui/`: interface anterior preservada como fallback de compatibilidade.
- `src/pages/ProcurementContractsHubPage.tsx`: hub de Compras e Contratos com acesso aos módulos existentes.
- `src/pages/SettingsHubPage.tsx`: hub de Documentos, Importação e Configurações do sistema.
- `src/hooks/useAsync.ts`: carregamento assíncrono usado pelas páginas.
- `src/utils/format.ts`: datas, competências e valores monetários.
- `src/pages/`: telas por domínio.
- `src/styles/index.css`: estilos base; `src/styles/enhancements.css`: complementos visuais.
- `electron/main.cjs`: janela, segurança, composição dos serviços e handlers IPC.
- `electron/preload.cjs`: única API exposta ao renderer.
- `electron/services/database.cjs`: CRUD genérico local, relatórios, pagamentos e medições.
- `electron/services/data-access-service.cjs`: seam do CRUD genérico; escolhe SQLite local ou HTTP LAN por entidade e modo configurado.
- `electron/services/lan-data-client.cjs`: cliente HTTP restrito a Empresas, Clientes e Obras, com timeout e validação do escopo remoto.
- `electron/services/storage-connection-service.cjs`: configuração Local/Servidor, validação de host/porta e teste do `/health` LAN.
- `electron/services/*-service.cjs`: serviços especializados.
- `database/migrations/`: schema versionado e incremental do Desktop local.
- `vite.config.ts`, `vitest.config.ts`, `tsconfig*.json`: build, testes e TypeScript.
- `docs/UI_DESIGN_HISTORY.md`: histórico dos drafts preservados e da direção visual aprovada.
- `../lan-server/`: serviço Node HTTP com `LanRepository`; persiste `obra-na-mao-lan.sqlite` no servidor da empresa.

## Rotas e telas

| Rota | Arquivo | Domínio |
|---|---|---|
| `/` | `DashboardPage.tsx` | Resumo financeiro e operacional |
| `/assistente-ia` | `AiAssistantPage.tsx` | Assistente IA atual; permanece acessível até a fase de IA global |
| `/dre` | `DrePage.tsx` | DRE mensal/anual e CSV |
| `/financeiro` | `FinancePage.tsx` | Contas e pagamentos |
| `/rh/folha` | `PayrollPage.tsx` | Folha por competência; `/folha` é alias legado |
| `/orcamento` | `BudgetPage.tsx` | Itens orçamentários; navegação no hub Financeiro |
| `/medicoes` | `MeasurementsPage.tsx` | Medições; navegação no hub Financeiro |
| `/compras-contratos` | `ProcurementContractsHubPage.tsx` | Hub financeiro de compras, contratos e parceiros |
| `/compras` | `ProcurementPage.tsx` | Compras, materiais, recebimentos e estoque |
| `/contratos` | `ContractsPage.tsx` | Contratos e aditivos |
| `/cadastros` | `RegistriesPage.tsx` | Empresas, clientes e fornecedores |
| `/obras` | `WorksPage.tsx` | Obras |
| `/obras/:id` | `WorkDetailPage.tsx` | Visão consolidada Obra 360 |
| `/frentes` | `FrontsPage.tsx` | Frentes de serviço por obra |
| `/planejamento` | `SchedulePage.tsx` | Cronograma físico-financeiro |
| `/rdo` | `DailyReportPage.tsx` | Diário de obra, equipe e ocorrências |
| `/tarefas` | `TasksPage.tsx` | Tarefas e pendências operacionais |
| `/rh` | `RhHubPage.tsx` | Hub de Pessoas & RH |
| `/rh/funcionarios` | `EmployeesPage.tsx` | Funcionários; `/funcionarios` é alias legado |
| `/rh/admissoes` | `EmployeeRegistrationPage.tsx` | Admissão e documentos; `/registro-funcionario` é alias legado |
| `/rh/ponto` | `TimeSheetPage.tsx` | Ponto mensal; `/ponto` é alias legado |
| `/rh/remuneracao` | `CompensationPage.tsx` | Owner canônico de cargos, salário-base e benefícios por cargo |
| `/rh/modelos` | `HrTemplatesPage.tsx` | Modelos e regras documentais de RH |
| `/documentos` | `DocumentsPage.tsx` | Arquivos e documentos; acesso pelo hub Configurações |
| `/importacao` | `ImportPage.tsx` | Importadores legado 2026 e universal por mapeamento; acesso pelo hub Configurações |
| `/configuracoes` | `SettingsHubPage.tsx` | Hub de documentos, importação e configurações |
| `/configuracoes/sistema` | `SettingsPage.tsx` | Pastas, backup, integrações, produto, layout e manutenção |

As rotas diretas dos módulos continuam registradas para preservar favoritos, links internos e compatibilidade. A reorganização de 2026-09-05 muda apenas os pontos de entrada da navegação.

Desde o P0 de canonicalização de RH, `src/routes/registry.ts` é o owner de paths, aliases, grupos de navegação e breadcrumbs. As rotas históricas de RH permanecem somente como redirects `replace` para `/rh/*`.

## Serviços do processo principal

- `database.cjs`: migrations, CRUD permitido por whitelist, dashboard, DRE, pagamentos e medições locais.
- `data-access-service.cjs`: interface única para `list/get/save/remove`; em modo servidor roteia `empresas`, `clientes` e `obras` ao `LanDataClient` e mantém as demais entidades no banco local.
- `lan-data-client.cjs`: CRUD HTTP de Empresas/Clientes/Obras em `/api/v1`, sem expor `fetch` ao renderer.
- `storage-connection-service.cjs`: persiste `storage_mode`, `lan_server_host` e `lan_server_port` em `configuracoes`, mantendo `local` como padrão, e testa compatibilidade do serviço LAN v1.
- `works-service.cjs`, `planning-service.cjs`, `field-service.cjs`, `procurement-service.cjs` e `contracts-service.cjs`: serviços modulares para operação, planejamento, RDO, compras e contratos; permanecem locais nesta etapa.
- `payroll-service.cjs`: lançamentos e confirmação de folha.
- `time-service.cjs`: ponto e documentos mensais.
- `document-service.cjs`: geração de documentos/PDFs.
- `file-service.cjs`: importação, abertura, localização e exclusão controlada de arquivos.
- `document-root-service.cjs`: raiz configurável dos documentos.
- `import-service.cjs`: prévia e confirmação do modelo específico de 2026.
- `universal-import-service.cjs`: análise de Excel/CSV, mapeamento assistido e importação transacional por área.
- `catalog-service.cjs`: catálogo local de cargos/benefícios; `saveCompensationPolicy` salva cargo + vínculos em transação única.
- `backup-service.cjs`: backup, restauração e pasta de dados locais.

## Banco de dados

- `001_initial.sql`: entidades principais de empresas, obras, finanças, funcionários, folha, documentos, importação, configurações e auditoria.
- `002_cargos_folha_documentos.sql`: vínculos de benefícios e evolução de folha/documentos.
- `003_ponto_documentos_mensais.sql`: ponto mensal e marcações.
- `004_obras_mapa_medicoes.sql`: mapa de medições importado.
- `005_planejamento_rdo.sql`: cronograma físico-financeiro e diário de obra.
- `006_importador_universal.sql`: estrutura para perfis do importador universal.
- `007_nucleo_operacional_modular.sql`: compras, contratos, aditivos, recebimentos, anexos de RDO, modelos do RH e novos vínculos financeiros por obra/etapa.
- `008_frentes_edicoes_medicoes_estoque.sql`: frentes, edição construtora/empreiteira, vínculos por frente, anexos de medição e estoque simples.

Novas mudanças do schema local devem ser adicionadas em uma migration numerada posterior. O serviço local usa `PRAGMA user_version`, ativa chaves estrangeiras e cria backup antes de migrations sobre banco existente.

- `012_modelos_locais_rh.sql`: registra a origem de modelos HTML locais importados para o RH.
- O banco LAN é independente do banco local e, nas fases 3–5, contém apenas `empresas`, `clientes` e `obras`; é criado pelo `apps/lan-server/src/repository.mjs`, ativa FKs, `busy_timeout` e WAL quando persistido em arquivo.

## API do renderer

Os grupos expostos por `window.fluxoDre` são: `app`, `storage`, `product`, `empresas`, `clientes`, `fornecedores`, `obras`, `frentes`, `etapas`, `locais`, `orcamentos`, `cronograma`, `rdos`, `rdoEquipe`, `rdoEquipamentos`, `rdoOcorrencias`, `medicoes`, `contas`, `categorias`, `cargos`, `funcionarios`, `folhas`, `lancamentosFolha`, `pagamentosFuncionario`, `beneficios`, `epis`, `funcionarioEpis`, `arquivos`, `fontes`, `pastas`, `documentos`, `folha`, `ponto`, `catalogo`, `compras`, `contratos`, `importacoes`, `relatorios` e `backup`.

Ao adicionar ou mudar uma operação pública, mantenha sincronizados:

1. `electron/preload.cjs`;
2. o handler de `electron/main.cjs`;
3. o serviço responsável;
4. a interface em `src/vite-env.d.ts`;
5. a página e os testes relacionados.

## Comandos

- `npm run electron:dev`: desenvolvimento completo com Electron.
- `npm run dev`: somente Vite.
- `npm run lint`: verificação TypeScript (`tsc -b`).
- `npm test`: testes Vitest uma vez.
- `npm run build`: TypeScript e bundle de produção.
- `npm run dist`: build e instalador NSIS x64 em `release/`.
- `npm --prefix ../lan-server test` a partir de `apps/desktop`: testes do contrato HTTP LAN e do repositório central; a partir da raiz use `npm --prefix apps/lan-server test`.

## Estratégia de inspeção por tipo de alteração

- Visual/local de uma tela: página afetada, `ui.tsx` e CSS utilizado.
- Regra de negócio existente: página, método correspondente do preload, handler e serviço específico.
- Novo dado persistido: migration nova, serviço, preload/tipagem e tela.
- Erro de build: arquivo indicado pelo diagnóstico e configurações diretamente relacionadas.
- Erro de teste: teste falho e unidade importada; amplie somente se a causa exigir.

## Adendo 2026-08-11 - nucleo operacional

- `009_tarefas_operacionais.sql`: tarefas e pendencias operacionais por obra/frente, com origem em RDO.
- `010_fluxos_operacionais_completos.sql`: complementos de RDO, tarefas, medicoes, compras, contratos, documentos operacionais, anexos e estoque.
- `documentos.importForWork`: importa documentos de obra/frente/RDO/contrato/pedido.
- `documentos.chooseLocalTemplate`: seleciona e copia um modelo HTML/HTM/TXT local para edicao e geracao de documentos RH.
- `medicoes.itensMedidos`: consulta itens gravados em uma medicao.
- `compras.moveStock`: registra saida ou ajuste de estoque com bloqueio de saldo negativo.
- `importadorUniversal`: reconhece financeiro, obras, orcamento, funcionarios, compras, contratos, aditivos, medicoes, ponto, documentos e estoque.

## Adendo 2026-09-02 — ponte online

- `electron/services/online-service.cjs`: cliente HTTP do Desktop para o backend Obra na Mão.
- `electron/services/online-service.test.ts`: cobre vínculo, armazenamento do token e sessão.
- `electron/main.cjs`: handlers IPC `online:*`.
- `electron/preload.cjs`: API `window.fluxoDre.online`.
- `src/pages/SettingsPage.tsx`: vínculo, verificação de autorização, teste de conexão e desconexão.
- Endpoint padrão: `https://fluxodre-campo-b2u-clbfo5.v2.appdeploy.ai`.
- Override de ambiente: `FLUXO_DRE_PLATFORM_URL`.
- O renderer continua sem acesso direto a Node ou ao token do dispositivo.
- Rotas suportadas incluem sessão, sync pull/push, publicação de resumo mobile, leitura/escrita financeira, publicação de obrigações, IA estruturada e resolução de conflitos.

## Adendo 2026-09-05 — hubs de navegação

- `CommandCenterShell.tsx` concentra DRE, Contas, Orçamento, Medições e `Compras e Contratos` em Financeiro.
- Obras contém Obras, Frentes de serviço, Planejamento, Diário de obra e Tarefas.
- Pessoas & RH expõe o hub de RH e Folha e pagamentos; as subtelas continuam acessíveis pelo hub e por suas rotas diretas.
- `ProcurementContractsHubPage.tsx` reúne Compras e materiais, Contratos e aditivos e Empresas e parceiros sem fundir serviços, dados ou contratos internos.
- `SettingsHubPage.tsx` substitui Configurações como ponto de entrada e direciona para Documentos, Importar planilha e `/configuracoes/sistema`.
- A rota e a entrada atuais de `Assistente IA` permanecem intactas nesta etapa. A IA global é uma fase separada e não faz parte desta refatoração.
- Nenhuma migration, API do preload, handler IPC, serviço Electron ou contrato de banco foi alterado por esta reorganização.

## Adendo 2026-09-10 — ArtiSys QA e Demo Flows

- `qa/artisys-qa.config.json`: integra o Desktop ao `@artisys/qa` 1.2.0 em modo Electron, mantendo QA técnico e fluxos de demonstração separados.
- `qa/flows/smoke.json`: smoke visual do aplicativo desktop real.
- `qa/demo/quick-30s.json` e `qa/demo/overview-60s.json`: tours reutilizáveis; `quick-30s` usa Reels 9:16 (1080×1920) e duração-alvo de 30 s.
- `qa/runtime/` e `qa/artisys-qa.lock.json`: snapshot vendorizado, fixado no commit `2af6556937c7a4074f641069a2e1a6bb02bf942f` do repositório privado `utilidades`; inclui Demo Profiles, adapters, fixtures, redaction e biblioteca de flows comuns do núcleo 1.2, sem expor credenciais do repositório central.
- `.github/workflows/artisys-qa-demo.yml`: executa lint/test/build, inicia o Electron real sob Xvfb, captura vídeo/trace/telemetria e publica os artefatos de QA/Demo.
- A demonstração usa o `DemoDataService` já existente e redireciona `OBRA_NA_MAO_DATA_DIR` para `${{ runner.temp }}`, garantindo que dados reais do Desktop não sejam lidos nem alterados durante a captura.

## Adendo 2026-09-13 — autenticação comercial central

- `src/components/DesktopLogin.tsx`: entrada por e-mail/senha, primeiro acesso por código e configuração de empresa/obra dentro do Desktop; Google permanece via navegador.
- `electron/services/online-service.cjs`: usa as mesmas rotas de senha do Worker, cookie de sessão somente em memória no processo principal, seguido de `/api/desktop/bootstrap`, `/api/desktop/claim` e autorização de dispositivo. Senha/código/cookie não são gravados nem retornados ao renderer.
- IPC/preload/tipagem: `online:password-auth` / `passwordAuth` e `online:password-setup` / `passwordSetup`.
- Perfil local fixa empresa e endpoint após autenticação. Desconectar não remove essa proteção; outra empresa exige perfil Windows separado. Vincular não configura nem inicia publicação de dados locais automaticamente; o vínculo explícito empresa/obra do coordenador continua obrigatório.
- `App.tsx`: oferece login ao computador sem vínculo; computadores já vinculados mantêm operação local offline.

## Adendo 2026-09-29 — Servidor da empresa (fases 0–5)

- Fases 0–2: `DataAccessService` passou a intermediar o CRUD genérico `entity:*`; `StorageConnectionService` adicionou modo `local|server`, host, porta e teste do `/health`; `SettingsPage.tsx` passou a configurar a conexão LAN; `apps/lan-server/` nasceu com `/health` e `/version`.
- Fase 3: `empresas` passa a usar o `LanDataClient` quando o modo `server` estiver ativo.
- Fase 4: `clientes` passa pelo mesmo contrato remoto, mantendo vínculo opcional com `empresa_id` no banco central.
- Fase 5: `obras` passa pelo CRUD HTTP e mantém FKs para empresa/cliente no servidor. `WorksPage.tsx` bloqueia Obra 360, importação e atalhos operacionais nesse modo porque esses módulos ainda são locais.
- `apps/lan-server/src/repository.mjs` usa `node:sqlite` no Node 22 e cria o banco central em `OBRA_NA_MAO_LAN_DATA_DIR/obra-na-mao-lan.sqlite` ou `~/.obra-na-mao-lan/obra-na-mao-lan.sqlite`; ativa FKs, `busy_timeout` e WAL em arquivo.
- API LAN v1: coleções `GET/POST /api/v1/empresas|clientes|obras` e itens `GET/PUT/DELETE /api/v1/<entidade>/<id>`. Exclusão é lógica (`deleted_at`).
- Entidades fora desse trio permanecem no SQLite local. Não há fallback silencioso para o banco local se um cadastro remoto falhar, evitando divergência entre estações.
- O serviço continua ouvindo `127.0.0.1:4732` por padrão. `OBRA_NA_MAO_LAN_HOST`, `OBRA_NA_MAO_LAN_PORT` e `OBRA_NA_MAO_LAN_DATA_DIR` configuram a implantação.
- Ainda não há abertura automática de firewall, exposição à internet, descoberta de servidor, autenticação de terminal, sincronização offline ou migração automática dos cadastros locais existentes. Essas responsabilidades pertencem às fases seguintes.

## Adendo 2026-09-29 — Compatibilidade armazenamento, identidade e Cloud (fases 6–7)

- **Regra de produto:** nenhum modo de armazenamento pode remover, substituir ou alterar silenciosamente o fluxo existente `Desktop ↔ Cloudflare/D1 ↔ PWA`. Web/PWA, vínculo online e sincronização já existentes continuam incluídos no produto.
- Fase 6 adiciona guard rails em `storage-online-compatibility.test.ts` e `storage-online-contract.test.ts`: mudar armazenamento não altera `online-connection.json`, token, tenant, URL Cloudflare, IPC `online:*` nem o contrato público `window.fluxoDre.online`.
- Fase 7 introduz `operationalMode: 'local'|'lan-host'|'lan-client'|'remote'` no estado de armazenamento sem remover o contrato legado `mode: 'local'|'server'`. O mapeamento compatível é `local → local` e `server → lan-client`; as chaves `storage_mode`, `lan_server_host` e `lan_server_port` continuam autoritativas nesta etapa.
- `DataAccessService` só trata `lan-client` como transporte remoto implementado. `lan-host` e `remote` estão modelados para fases futuras, mas não são ativados silenciosamente nem aparecem como opções prontas na UI.
- **Papel da máquina não define papel do usuário.** Fonte operacional, identidade/permissões e serviços online são eixos independentes. Um administrador pode usar qualquer Desktop autorizado, inclusive quando o banco está em outro servidor da empresa.
- `SyncCoordinator` ainda lê diretamente o `DatabaseService`/SQLite local. Quando fontes operacionais remotas passarem a alimentar a sincronização Web/PWA, a evolução deverá adaptar um provider ao pipeline existente `SyncCoordinator → OnlineService → Cloudflare`, e não criar uma segunda sincronização paralela.
- Cloud pago futuro é somente adicional: R2/documentos, PDFs, fotos, anexos, backup/restauração e novas capacidades premium. Login, PWA, bridge, resumos e demais recursos online já incluídos não podem ser movidos para uma assinatura por causa desta reorganização.

## Atualização F8–F12 — 2026-10-01

- **F8 — coordenador único de sync:** o `lan-host` é a autoridade de sincronização Cloud; `lan-client` permanece pausado para sync Cloud e usa o banco central.
- **F9 — operação/RDO central:** frentes, tarefas, RDO e filhos usam a API LAN autenticada quando `operation=central-active`.
- **F10 — Planejamento central:** etapas, cronograma e itens orçamentários usam a fonte central; não misturam silenciosamente planejamento central com fonte local.
- **F11 — Financeiro central:** contas, pagamentos idempotentes, DRE, dashboard e fonte de resumo/obrigações do sync usam o banco LAN quando `finance=central-active`.
- **F12 — RH central:** funcionários, cargos, benefícios, EPIs, folha e ponto usam a fonte LAN quando `rh=central-active`; autorização é aplicada no servidor.
- **Documentos RH:** PDF de ponto/recibos continua sendo uma saída **local derivada**. Em RH central, os dados vêm do servidor e o arquivo não é registrado como segunda cópia autoritativa do RH.
- **Proteção de migração:** se existir dado local de um módulo que passará a central, o estado é `migration-required`; esta PR não copia nem apaga esses registros automaticamente.
- **Release Desktop:** publicação automática continua congelada por `DESKTOP_AUTO_RELEASE_ENABLED=false`; CI, build e artefatos continuam funcionando.
- **Fora do escopo:** migração automática do SQLite legado, descoberta automática LAN, servidor remoto público pronto para produção, R2/billing/Cloud pago e qualquer segundo sincronizador paralelo ao fluxo Desktop ↔ Cloudflare/D1 ↔ PWA.
- **QA integrado:** `apps/lan-server/tests/f8-f12-multi-client.test.mjs` valida compartilhamento multi-PC dos módulos centrais; `apps/desktop/tests/f8-f12-central-flow.test.ts` valida roteamento central e ausência de fallback local.
