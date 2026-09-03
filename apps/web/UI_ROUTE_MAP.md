# ArtiSys / Operação Comercial — mapa de páginas e superfícies

Atualizado em 2026-09-03. Este arquivo é o inventário visual obrigatório antes de qualquer rodada de redesign.

## 1. Entradas públicas e roteamento

| Entrada | Rota / arquivo | Superfície | Status visual |
|---|---|---|---|
| Site público ArtiSys | `index.html` + hashes `#topo`, `#conteudo`, `#servicos`, `#prova`, `#processo`, `#contato` | Landing page | Premium atual |
| Aplicação / roteador | `sistema.html` | Decide portal, owner, universidade, finanças, bridge, ativação e módulos | Infraestrutura |
| Portal | `#portal` | Login ou dashboard geral conforme sessão | Premium atual |
| Administração comercial | `#owner` | Licenças, clientes, acessos e dispositivos | Revisar em rodada própria |
| Universidade | `universidade.html#universidade` / `#universidade*` | Ambiente educacional | Design próprio |
| Obra360 | `obra.html#obra` / `#obra*` | PWA operacional de campo | Em migração premium |
| Gestão | `gestao.html#gestao` / `#gestao*` | Consulta administrativa móvel | Em migração premium |
| Financeiro | `#finance` | Redireciona para o portal / superfície financeira autorizada | Rota de compatibilidade |
| Ativação | `#activate=<código>` | Ativação de operação/licença | Estado utilitário |
| Desktop bridge | `#desktop-bridge` | Ponte com Desktop | Estado técnico |
| Autorização Desktop | `#desktop-auth=<token>` | Login e pareamento do computador | Estado técnico |

Regra da landing: apenas os hashes de seção pública permanecem no site; qualquer outro hash é encaminhado para `sistema.html`.

## 2. Portal / dashboard geral

Superfícies possíveis em `portal.ts`:

- Login público.
- Login com Google.
- Login por celular.
- Primeiro acesso por celular / criação de senha.
- Visão geral corporativa.
- Visão geral por acesso de colaborador.
- Resumo executivo carregando / carregado / erro com tentar novamente.
- Estado de credencial da plataforma `pending`.
- Estado de acesso `blocked`.
- Estado sem módulos liberados.
- Menu da conta / logout.
- Cards de módulo: Gestão, Obra360, Universidade, Administração de acessos e Ativar operação.

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
- Dialog da conta / sair / Central de Licenças — revisar na rodada administrativa.

## 6. Estados de autenticação e preparação do módulo de campo

Antes de chegar às abas, o aplicativo pode renderizar:

- Login.
- Primeiro acesso / claim de licença.
- Ativação por código.
- Inicialização/migração de dados compartilhados.
- Obra em preparação para perfis não-admin.
- Canal mobile não contratado.
- Tela exclusiva de funcionário com “Hoje” e “Minha semana”.
- Erro de carregamento com tentar novamente / sair.

Todos esses estados precisam entrar em uma futura auditoria visual completa.

## 7. Gestão móvel

- Hero Gestão.
- Indicadores e KPI's.
- Cards Faturamento, Despesas e Vencimentos.
- Resumo administrativo.
- Estado sem resumo publicado pelo Desktop.
- Módulos agregados quando disponíveis: Obra/Produção, RDO, DRE, RH, Contratos, Compras, Medições e Documentos.

Os valores devem sempre vir do resumo publicado pelo Desktop; ausência de dado é exibida como estado vazio, nunca como valor inventado.

## 8. Universidade

Navegação principal definida por `navigation-model.ts`:

- `inicio` — Início.
- `diagnostico` — Sondagem, apenas enquanto não concluída.
- `trilhas` — Trilhas e progresso.
- `pratica` — Prática & Desafios.
- `admin` — Tutor, para superadmin/admin/RH.

Contextos adicionais de conteúdo: aula, desenvolvimento/evolução e tarefas.

## 9. Regra para próximas alterações visuais

Antes de publicar uma fase de redesign:

1. Marcar neste mapa quais superfícies entram na entrega.
2. Alterar todas as superfícies marcadas, inclusive estados vazios e modais relacionados.
3. Executar os testes de contrato visual e o build.
4. Só então promover para `main` / Cloudflare.
5. Atualizar a coluna de status deste mapa.

Objetivo: evitar que uma aba principal fique premium enquanto uma rota interna ou estado intermediário continue com o shell antigo.
