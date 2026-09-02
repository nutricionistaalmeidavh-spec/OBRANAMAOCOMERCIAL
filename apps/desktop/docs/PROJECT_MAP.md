# Mapa do projeto — Fluxo DRE

Última revisão estrutural: 2026-08-04.

Este documento é o ponto de partida para alterações. Leia a seção afetada e abra apenas os arquivos diretamente relacionados; evite uma nova varredura global.

## Visão geral

Aplicativo desktop Windows e offline para gestão financeira e operacional de construção civil.

- Renderer: React 19, TypeScript, React Router e Vite.
- Desktop: Electron; entrada em `electron/main.cjs`.
- Persistência: SQLite local via `better-sqlite3`.
- Comunicação: API restrita `window.fluxoDre`, definida no preload e atendida por IPC.
- Dados de execução: `%APPDATA%\fluxo-dre` por padrão; podem ser redirecionados por `FLUXO_DRE_DATA_DIR`.
- Sem servidor web, autenticação ou dependência de internet em produção.

## Fluxo entre camadas

`src/pages/*` → `window.fluxoDre` → `electron/preload.cjs` → handlers em `electron/main.cjs` → `electron/services/*` → SQLite/arquivos locais.

Ao mudar uma operação que cruza camadas, confira apenas os pontos correspondentes desse fluxo. A tipagem pública do preload fica em `src/vite-env.d.ts`.

## Diretórios e arquivos principais

- `src/main.tsx`: inicialização do renderer.
- `src/App.tsx`: tabela de rotas.
- `src/components/AppShell.tsx`: navegação e estrutura visual global.
- `src/components/ui.tsx`: componentes reutilizáveis de interface.
- `src/modules/command-center/`: interface ativa em tema dark, incluindo shell e versões especializadas de Painel, DRE e Financeiro.
- `src/modules/classic-ui/`: interface anterior preservada como módulo sem rota ativa para restauração ou consulta.
- `src/hooks/useAsync.ts`: carregamento assíncrono usado pelas páginas.
- `src/utils/format.ts`: datas, competências e valores monetários.
- `src/pages/`: telas por domínio.
- `src/styles/index.css`: estilos base; `src/styles/enhancements.css`: complementos visuais.
- `electron/main.cjs`: janela, segurança, composição dos serviços e handlers IPC.
- `electron/preload.cjs`: única API exposta ao renderer.
- `electron/services/database.cjs`: CRUD genérico, relatórios, pagamentos e medições.
- `electron/services/*-service.cjs`: serviços especializados.
- `database/migrations/`: schema versionado e incremental.
- `vite.config.ts`, `vitest.config.ts`, `tsconfig*.json`: build, testes e TypeScript.
- `docs/UI_DESIGN_HISTORY.md`: histórico dos drafts preservados e da direção visual aprovada.

## Rotas e telas

| Rota | Arquivo | Domínio |
|---|---|---|
| `/` | `DashboardPage.tsx` | Resumo financeiro e operacional |
| `/dre` | `DrePage.tsx` | DRE mensal/anual e CSV |
| `/financeiro` | `FinancePage.tsx` | Contas e pagamentos |
| `/folha` | `PayrollPage.tsx` | Folha por competência |
| `/obras` | `WorksPage.tsx` | Obras |
| `/orcamento` | `BudgetPage.tsx` | Itens orçamentários |
| `/obras/:id` | `WorkDetailPage.tsx` | Visão consolidada Obra 360 |
| `/frentes` | `FrontsPage.tsx` | Frentes de serviço por obra |
| `/planejamento` | `SchedulePage.tsx` | Cronograma físico-financeiro |
| `/rdo` | `DailyReportPage.tsx` | Diário de obra, equipe e ocorrências |
| `/medicoes` | `MeasurementsPage.tsx` | Medições |
| `/funcionarios` | `EmployeesPage.tsx` | Funcionários |
| `/registro-funcionario` | `EmployeeRegistrationPage.tsx` | Admissão e documentos |
| `/ponto` | `TimeSheetPage.tsx` | Ponto mensal |
| `/documentos` | `DocumentsPage.tsx` | Arquivos e documentos |
| `/cadastros` | `RegistriesPage.tsx` | Empresas, clientes e fornecedores |
| `/importacao` | `ImportPage.tsx` | Importadores legado 2026 e universal por mapeamento |
| `/configuracoes` | `SettingsPage.tsx` | Pastas, backup e configurações |

## Serviços do processo principal

- `database.cjs`: migrations, CRUD permitido por whitelist, dashboard, DRE, pagamentos e medições.
- `works-service.cjs`, `planning-service.cjs`, `field-service.cjs`, `procurement-service.cjs` e `contracts-service.cjs`: serviços modulares para operação, planejamento, RDO, compras e contratos.
- `payroll-service.cjs`: lançamentos e confirmação de folha.
- `time-service.cjs`: ponto e documentos mensais.
- `document-service.cjs`: geração de documentos/PDFs.
- `file-service.cjs`: importação, abertura, localização e exclusão controlada de arquivos.
- `document-root-service.cjs`: raiz configurável dos documentos.
- `import-service.cjs`: prévia e confirmação do modelo específico de 2026.
- `universal-import-service.cjs`: análise de Excel/CSV, mapeamento assistido e importação transacional por área.
- `catalog-service.cjs`: cargos, benefícios e vínculos.
- `backup-service.cjs`: backup, restauração e pasta de dados.

## Banco de dados

- `001_initial.sql`: entidades principais de empresas, obras, finanças, funcionários, folha, documentos, importação, configurações e auditoria.
- `002_cargos_folha_documentos.sql`: vínculos de benefícios e evolução de folha/documentos.
- `003_ponto_documentos_mensais.sql`: ponto mensal e marcações.
- `004_obras_mapa_medicoes.sql`: mapa de medições importado.
- `005_planejamento_rdo.sql`: cronograma físico-financeiro e diário de obra.
- `006_importador_universal.sql`: estrutura para perfis do importador universal.
- `007_nucleo_operacional_modular.sql`: compras, contratos, aditivos, recebimentos, anexos de RDO, modelos do RH e novos vínculos financeiros por obra/etapa.
- `008_frentes_edicoes_medicoes_estoque.sql`: frentes, edição construtora/empreiteira, vínculos por frente, anexos de medição e estoque simples.

Novas mudanças devem ser adicionadas em uma migration numerada posterior. O serviço usa `PRAGMA user_version`, ativa chaves estrangeiras e cria backup antes de migrations sobre banco existente.

- `012_modelos_locais_rh.sql`: registra a origem de modelos HTML locais importados para o RH.

## API do renderer

Os grupos expostos por `window.fluxoDre` são: `app`, `product`, `empresas`, `clientes`, `fornecedores`, `obras`, `frentes`, `etapas`, `locais`, `orcamentos`, `cronograma`, `rdos`, `rdoEquipe`, `rdoEquipamentos`, `rdoOcorrencias`, `medicoes`, `contas`, `categorias`, `cargos`, `funcionarios`, `folhas`, `lancamentosFolha`, `pagamentosFuncionario`, `beneficios`, `epis`, `funcionarioEpis`, `arquivos`, `fontes`, `pastas`, `documentos`, `folha`, `ponto`, `catalogo`, `compras`, `contratos`, `importacoes`, `relatorios` e `backup`.

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
