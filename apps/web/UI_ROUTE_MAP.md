# ArtiSys / Operação Comercial — mapa de páginas e superfícies

Atualizado em 2026-09-06. Este arquivo é o inventário visual obrigatório antes de qualquer rodada de redesign.

## 1. Entradas públicas e roteamento

| Entrada | Rota / arquivo | Superfície | Status visual |
|---|---|---|---|
| Site público ArtiSys | `index.html` + hashes `#topo`, `#conteudo`, `#servicos`, `#prova`, `#processo`, `#contato` | Landing page | Premium atual |
| Aplicação / roteador | `sistema.html` | Decide portal, owner, universidade, finanças, bridge, ativação e módulos | Infraestrutura |
| Portal | `#portal` | Login corporativo ou dashboard geral conforme sessão | Premium atual |
| Login exclusivo de colaborador | `#colaborador` | Celular, senha e primeiro acesso do colaborador | Premium atual |
| Administração comercial | `#owner` | Licenças, clientes, acessos e dispositivos | Revisar em rodada própria |
| Universidade | `universidade.html#universidade` / `#universidade*` | Ambiente educacional | Premium Bloco 3 |
| Obra360 | `obra.html#obra` / `#obra*` | PWA operacional de campo | Em migração premium |
| Gestão | `gestao.html#gestao` / `#gestao*` | Consulta administrativa móvel | Em migração premium |
| Financeiro | `#finance` | Redireciona para o portal / superfície financeira autorizada | Rota de compatibilidade |
| Ativação | `#activate=<código>` | Ativação de operação/licença | Premium Bloco 2 |
| Planos e checkout | `#planos` / `#checkout?plano=<código>` | Contratação comercial responsiva | Premium cobrança |
| Confirmação de assinatura | `#assinatura?pedido=<id>` | Pagamento Asaas e ativação | Premium cobrança |
| Plano e cobrança | `#plano-cobranca` | Consulta da assinatura e financeiro | Premium cobrança |
| Desktop bridge | `#desktop-bridge` | Ponte com Desktop | Estado técnico |
| Autorização Desktop | `#desktop-auth=<token>` | Login e pareamento do computador | Estado técnico |

Regra da landing: apenas os hashes de seção pública permanecem no site; qualquer outro hash é encaminhado para `sistema.html`.

## 2. Portal / dashboard geral

Superfícies possíveis em `portal.ts`:

- Login corporativo com Google, sem campos de celular.
- Alternância discreta para `#colaborador`.
- Login exclusivo de colaborador por celular e senha.
- Primeiro acesso por celular / criação de senha dentro da superfície do colaborador.
- Retorno discreto para o acesso da empresa.
- Visão geral corporativa.
- Visão geral por acesso de colaborador.
- Resumo executivo carregando / carregado / erro com tentar novamente.
- Estado de credencial da plataforma `pending`.
- Estado de acesso `blocked`.
- Estado sem módulos liberados.
- Menu da conta / logout.
- Cards de módulo: Gestão, Obra360, Universidade, Administração de acessos e Ativar operação.

Os hashes legados `#phone-login` e `#celular` são normalizados para `#colaborador` para preservar atalhos antigos sem reintroduzir o login por celular no portal corporativo.

## 3. Obra360 — navegação principal

O `field.js` possui quatro abas persistentes no rodapé:

| ID interno | Rótulo | Renderer | Status visual |
|---|---|---|---|
| `today` | Dias | `renderDay()` | Premium |
| `obra360` | Obra360 | `renderObra360()` | Premium v2 |
| `team` | Equipe | `renderTeam()` | Premium v2 |
| `management` | Gestão | `renderManagement()` | Premium |

## 4. Obra360 — páginas internas alcançáveis por cards

| ID interno | Tela | Renderer / fluxo | Status visual |
|---|---|---|---|
| `floors` | Pavimentos | `renderFloors()` | Premium Bloco 1 |
| `floors` + pavimento selecionado | Detalhe de pavimento | `renderFloor()` | Premium Bloco 1 |
| `issues` | Pendências | `renderIssues()` | Premium Bloco 1 |
| `more` | Planejamento / produtividade | `renderMore()` | Premium Bloco 1 |
| `settings` | Configurações | `renderSettings()` | Premium Bloco 1 |

## 5. Obra360 — modais e subfluxos

A camada premium compartilhada cobre os dialogs do módulo e diferencia visualmente etapa/checklist, planejamento, pendência, equipe/usuários e configurações.

- Detalhe/checklist de etapa — `openStage()` — Premium Bloco 1.
- Novo planejamento — `openPlan()` — Premium Bloco 1.
- Novo apontamento — `openNewSession()` — camada premium compartilhada.
- Pausar e retomar apontamento — camada premium compartilhada.
- Concluir apontamento — `openFinishSession()` — camada premium compartilhada.
- Atualizar equipe da sessão — `openCrewUpdate()` — camada premium compartilhada.
- Editar horários — `openEditTimes()` — camada premium compartilhada.
- Detalhes da sessão — `openSessionDetails()` — camada premium compartilhada.
- Revisão/fechamento do RDO — `openRdoReview()` — camada premium compartilhada.
- Nova pendência — `openIssue()` — Premium Bloco 1.
- Editor de checklist/configurações — Premium Bloco 1.
- Gestão de usuários da obra — `openUsers()` — Premium Bloco 1.
- Dialog da conta / sair / Central de Licenças — Premium Bloco 2.

## 6. Estados de autenticação e preparação do módulo de campo

Antes de chegar às abas, o aplicativo pode renderizar:

| Superfície | Fluxo | Status visual |
|---|---|---|
| Login | `renderLogin()` | Premium Bloco 2 |
| Primeiro acesso / claim de licença | `renderClaim()` + `#activate=<código>` | Premium Bloco 2 |
| Inicialização/migração de dados compartilhados | `renderMigration()` | Premium Bloco 2 |
| Obra em preparação | estado de projeto não inicializado para não-admin | Premium Bloco 2 |
| Canal mobile não contratado | estado de acesso sem canal `mobile` | Premium Bloco 2 |
| Tela exclusiva de funcionário | `renderWorker()` — “Hoje” e “Minha semana” | Premium Bloco 2 |
| Erro de carregamento | retry / sair e erro de funcionário | Premium Bloco 2 |

A camada `field-premium-access` diferencia autenticação, ativação, preparação, indisponibilidade, erro e rotina do funcionário sem transformar todos os estados no mesmo card genérico.

## 7. Gestão móvel

- Hero Gestão.
- Indicadores e KPI's.
- Cards Faturamento, Despesas e Vencimentos.
- Resumo administrativo.
- Estado sem resumo publicado pelo Desktop.
- Módulos agregados quando disponíveis: Obra/Produção, RDO, DRE, RH, Contratos, Compras, Medições e Documentos.

Os valores devem sempre vir do resumo publicado pelo Desktop; ausência de dado é exibida como estado vazio, nunca como valor inventado.

## 8. Universidade

| Superfície | Navegação / contexto | Status visual |
|---|---|---|
| Início | `inicio` | Premium Bloco 3 |
| Sondagem / Diagnóstico | `diagnostico` | Premium Bloco 3 |
| Trilhas e progresso | `trilhas` | Premium Bloco 3 |
| Aula | contexto `lesson` dentro de trilhas | Premium Bloco 3 |
| Prática & Desafios | `pratica` | Premium Bloco 3 |
| Desenvolvimento / evolução | `evolucao` / contexto `development` | Premium Bloco 3 |
| Tarefas | `tarefas` | Premium Bloco 3 |
| Tutor / Admin | `admin` para superadmin/admin/RH | Premium Bloco 3 |

O Bloco 3 mantém conteúdo, progresso, autenticação e permissões existentes. A camada `university-premium.css` diferencia visualmente estudo, prática, acompanhamento e administração, em vez de tratar toda a Universidade como o mesmo conjunto de cards.

## 9. Regra para próximas alterações visuais

Antes de publicar uma fase de redesign:

1. Marcar neste mapa quais superfícies entram na entrega.
2. Alterar todas as superfícies marcadas, inclusive estados vazios e modais relacionados.
3. Executar os testes de contrato visual e o build.
4. Só então promover para `main` / Cloudflare.
5. Atualizar a coluna de status deste mapa.

Objetivo: evitar que uma aba principal fique premium enquanto uma rota interna ou estado intermediário continue com o shell antigo.
