# Obra na Mão — Centralização de módulos e coordenador único de sincronização (F8–F12)

## Objetivo

Evoluir o Obra na Mão de um servidor LAN que hoje centraliza Empresas, Clientes e Obras para uma arquitetura em que os principais módulos operacionais também possam compartilhar a mesma fonte de dados entre vários computadores, sem criar um segundo pipeline de sincronização e sem quebrar a integração já existente `Desktop ↔ Cloudflare/D1 ↔ PWA`.

Esta especificação cobre somente as Fases F8 a F12 do roadmap aprovado:

- **F8** — coordenador único de sincronização no PC principal;
- **F9** — RDO e operação de obra centralizados;
- **F10** — Planejamento centralizado;
- **F11** — Financeiro centralizado;
- **F12** — RH centralizado.

## Princípios inegociáveis

1. O fluxo atual `Desktop ↔ Cloudflare/D1 ↔ PWA` continua existindo e continua incluído no produto.
2. Não criar um segundo pipeline de sincronização paralelo ao `SyncCoordinator` atual.
3. O servidor LAN é a única autoridade de escrita para módulos centralizados em `lan-host`/`lan-client`.
4. Não compartilhar arquivos `.sqlite` pela rede.
5. Não existir fallback silencioso para SQLite local quando o servidor LAN estiver indisponível.
6. O papel da máquina continua independente do papel/permissões do usuário.
7. Operações de negócio compostas devem ser transacionais no processo que possui o banco central.
8. Instalações existentes com dados locais não podem parecer vazias nem migrar dados automaticamente nesta etapa.
9. Web/PWA, login, D1 atual e sincronização básica não podem ser movidos para um plano pago por causa desta evolução.
10. Servidor remoto público, Cloud pago/R2 e escrita offline multi-PC permanecem fora deste bloco.

## Estado atual a preservar

O Desktop já possui:

- `StorageConnectionService` com `local | lan-host | lan-client | remote`;
- `DataAccessService` que centraliza Empresas, Clientes e Obras em LAN;
- autenticação LAN por dispositivo, claim, pareamento e revogação;
- identidade Cloud como autoridade de empresa, membro, papel, canais e módulos;
- `SyncCoordinator` que atualmente lê diretamente o `DatabaseService`/SQLite local;
- bridge efetiva de sincronização para `frentes_obra`, `tarefas_obra`, `rdos` e `cronograma_etapas`;
- `OnlineService` e endpoints Cloudflare atuais já usados pela PWA.

O acoplamento direto do `SyncCoordinator` ao SQLite local é a principal fronteira que F8 resolve.

---

# F8 — Coordenador único de sincronização

## Decisão arquitetural

Em `lan-host`, o Desktop do PC principal é o **único coordenador do sync** com Cloudflare/PWA.

```text
PC cliente 1 ─┐
PC cliente 2 ─┼──→ API LAN → SQLite central
PC cliente 3 ─┘                 │
                                ↓
                     Desktop do PC principal
                         SyncCoordinator
                                │
                                ↓
                     Cloudflare / D1 ↔ PWA
```

`lan-client` não executa o sync central. Isso evita múltiplos escritores enviando o mesmo estado operacional para Cloudflare.

### Servidor dedicado sem Desktop principal

Nesta fase, um `lan-client` ligado a um servidor dedicado continua podendo usar a fonte central para módulos já suportados, mas o servidor dedicado **não recebe um novo SyncCoordinator próprio**. Sincronização Cloud coordenada nesse cenário fica para a etapa de servidor dedicado/remoto.

## Provider de sincronização

O `SyncCoordinator` deixa de depender obrigatoriamente do `DatabaseService` e passa a consumir um provider de dados sincronizáveis.

Contrato conceitual:

```ts
interface SyncDataProvider {
  binding(): SyncBinding | null
  saveBinding(binding: SyncBinding): void
  clearBinding(): void
  listBridge(entity: SyncBridgeEntity, scope: SyncScope): unknown[]
  getBridge(entity: SyncBridgeEntity, localId: number, scope: SyncScope): unknown | null
  applyRemote(entity: SyncBridgeEntity, localId: number, patch: unknown, scope: SyncScope): void
  summary(scope: SyncScope, modules: string[]): unknown
  obligations(scope: SyncScope): unknown[]
  // estado de outbox, heads, conflitos e revisão necessário ao pipeline atual
}
```

A assinatura final pode ser refinada no plano desde que preserve estes invariantes:

- provider local mantém comportamento atual;
- provider LAN usa a fonte central;
- o algoritmo do `SyncCoordinator` e os endpoints Cloudflare não são duplicados;
- conflitos continuam usando a mesma semântica de revisão existente.

## Regras de execução

- `local`: sync continua usando provider local;
- `lan-host`: sync usa provider central e pode iniciar automaticamente;
- `lan-client`: sync central fica pausado/desabilitado;
- `remote`: continua sem ativação de produção nesta spec.

A UI deve indicar em `lan-client` que a sincronização central é responsabilidade do PC principal.

## Critérios de aceite F8

- provider local produz resultados equivalentes ao comportamento anterior;
- `lan-host` sincroniza dados vindos do banco central;
- `lan-client` não executa push/pull central por engano;
- endpoints Cloudflare atuais não são removidos ou renomeados;
- PWA continua recebendo e enviando alterações pelo pipeline já existente;
- não existe segundo outbox/sync paralelo.

---

# Regra comum F9–F12 — centralização sem duplicar produto

A UI e contratos públicos existentes devem ser preservados sempre que possível.

```text
UI atual
  ↓
preload / IPC atual
  ↓
serviço do módulo
  ↓
adaptador de fonte operacional
  ├─ local                 → SQLite local
  └─ lan-host / lan-client → API LAN → SQLite central
```

Não criar “RDO LAN”, “Financeiro LAN” ou telas paralelas. O produto continua sendo um só.

## CRUD simples vs operações de domínio

CRUD simples pode usar contrato genérico quando:

- não depende de múltiplas tabelas;
- não exige regra de negócio transacional;
- a permissão da rota pode ser validada de forma inequívoca.

Operações compostas devem ter endpoint de domínio no LAN Server. Exemplos:

- salvar RDO + equipe + equipamentos + ocorrências + anexos + tarefas geradas;
- confirmar folha;
- registrar pagamento;
- movimentar estoque;
- qualquer operação que hoje depende de uma única transação SQLite local.

O objetivo é impedir estado parcial quando a rede cair entre chamadas.

---

# F9 — RDO e operação de obra

## Entidades alvo

- `frentes_obra`;
- `tarefas_obra`;
- `rdos`;
- `rdo_equipe`;
- `rdo_equipamentos`;
- `rdo_ocorrencias`;
- `rdo_anexos`;
- dependências mínimas necessárias às relações anteriores.

## Operações de domínio

O servidor central deve executar atomicamente o comportamento atual de `FieldService.saveDailyReport`, incluindo:

- criação/edição de RDO;
- substituição segura de equipe/equipamentos/ocorrências/anexos ao editar;
- geração de tarefas para ocorrências não resolvidas;
- baixa lógica das tarefas antigas ligadas a ocorrências substituídas;
- auditoria equivalente.

## Integração Cloud/PWA

F9 é a primeira prova completa do provider central do F8, porque `frentes_obra`, `tarefas_obra` e `rdos` já participam da bridge atual.

Critério central: RDO criado em um PC LAN deve aparecer nos demais PCs e continuar sincronizando com a PWA pelo PC principal, sem segundo pipeline.

---

# F10 — Planejamento

## Entidades e dados alvo

- `cronograma_etapas`;
- `etapas_obra` necessárias ao cronograma;
- `frentes_obra` relacionadas;
- progresso físico;
- custos planejados e realizados usados pelo planejamento.

O `PlanningService` deve manter a mesma semântica de overview, curva e dados associados, mas ler a fonte operacional correspondente ao modo atual.

`cronograma_etapas` continua usando a bridge existente com a PWA através do coordenador único.

---

# F11 — Financeiro

## Entidades alvo

- `contas`;
- `pagamentos_conta`;
- `categorias_financeiras` necessárias;
- `fornecedores` quando necessários às relações financeiras;
- vínculos de contas com obra, cliente, fornecedor, medição, etapa e frente;
- dependências mínimas exigidas pelos fluxos atuais de DRE/resumo financeiro.

## Operações de domínio

Registrar pagamento e outras alterações que hoje dependam de transação local devem ocorrer inteiramente no servidor central.

DRE, dashboard e resumos financeiros devem consultar a fonte central quando a instalação estiver em LAN, sem manter uma segunda cópia financeira autoritativa no Desktop cliente.

## Sincronização Cloud

Referências financeiras atualmente publicadas pelo `SyncCoordinator` continuam passando pelo mesmo coordenador/provider. Não criar API Cloud paralela específica para “financeiro LAN”.

---

# F12 — RH

## Entidades alvo

- `funcionarios`;
- `funcionario_obras`;
- `cargos`;
- `beneficios`;
- `funcionario_beneficios`;
- `folhas_pagamento`;
- `folha_lancamentos`;
- `pagamentos_funcionario`;
- `pontos_mensais` e `ponto_marcacoes`;
- `epis` e `funcionario_epis`;
- dependências mínimas necessárias aos fluxos atuais.

## Operações de domínio

A lógica atual de folha permanece equivalente, mas operações como:

- criação/garantia da folha da competência;
- sincronização de itens fixos;
- lançamento variável;
- confirmação de quinzena;
- cálculo de pendências;
- operações compostas de ponto;

passam a ser executadas na fonte autoritativa correspondente.

Em LAN, ações transacionais devem acontecer no servidor central.

---

# Ativação dos módulos e proteção contra perda aparente de dados

## Estados por módulo

Cada grupo de módulo centralizável possui estado conceitual:

```text
local
central-ready
central-active
migration-required
```

### Instalação nova

Um módulo sem dados locais pré-existentes pode ser habilitado como `central-active` após o servidor indicar suporte de schema/API compatível.

### Instalação existente

Se houver dados locais no módulo:

1. detectar conteúdo local;
2. marcar `migration-required`;
3. não mudar silenciosamente a fonte para central;
4. preservar uso local até a migração deliberada;
5. F17 executará a migração de dados;
6. somente após validação o módulo vira `central-active`.

F9–F12 **não implementam a migração automática completa** de bases existentes.

## IDs e relações

IDs usados pela bridge/PWA e por relações locais não podem ser renumerados sem mapeamento explícito.

A futura F17 deve preferir preservação de IDs. Quando isso não for possível, deverá existir mapping permanente `local_id ↔ central_id` antes de ativar o módulo central.

---

# Concorrência

F9–F12 centralizam a autoridade de escrita e garantem transações, mas não implementam ainda o sistema completo de controle otimista da F14.

Regras desta etapa:

- servidor é único writer da fonte central;
- gravações mantêm `updated_at`/revisão disponível;
- nenhum cliente LAN grava localmente como fallback;
- servidor indisponível resulta em erro explícito;
- não existe fila de escrita offline no `lan-client`;
- operações compostas são atômicas.

F14 futuramente adicionará controle explícito de versão/revisão para detectar edições concorrentes e impedir sobrescrita silenciosa.

---

# Autorização

Todas as novas rotas LAN reutilizam a identidade já implementada.

Regras:

- servidor valida a permissão em cada operação;
- esconder funcionalidade na UI não substitui autorização de backend;
- RDO/Planejamento exigem acesso operacional compatível;
- Financeiro exige módulo/permissão financeira compatível;
- RH exige módulo/permissão RH compatível;
- Admin preserva acesso administrativo conforme a matriz existente;
- dispositivo revogado ou membro desativado não pode operar módulos centralizados.

A matriz exata de papéis/permissões granulares continua pertencendo às F15/F16; F9–F12 devem respeitar a autoridade/módulos atuais, sem inventar um segundo modelo.

---

# Sequência de implementação

A ordem é obrigatória:

```text
F8  coordenador/provider único
 ↓
F9  RDO/operação
 ↓
F10 Planejamento
 ↓
F11 Financeiro
 ↓
F12 RH
```

Cada fase precisa terminar verde antes da próxima.

## Gate por fase

Para cada módulo:

1. schema central e testes do repositório;
2. testes RED de API/autorização;
3. endpoints CRUD/domínio mínimos;
4. cliente/adaptador Desktop;
5. preservação do caminho local;
6. teste de indisponibilidade sem fallback;
7. teste com dois clientes sobre o mesmo banco central;
8. regressão de autorização;
9. integração F8 quando o módulo participa do sync/PWA;
10. Desktop `npm run lint`, `npm test`, `npm run build`;
11. `npm --prefix apps/lan-server test`;
12. Web/PWA/Cloudflare regression suite atual.

---

# Cenário integrado de aceite ao final de F12

```text
PC principal
├─ RDO
├─ Planejamento
├─ Financeiro
└─ RH
        ↕
Servidor LAN / SQLite central
        ↑
PC cliente 2
        ↑
PC cliente 3

PC principal
   ↓ SyncCoordinator único
Cloudflare / D1
   ↕
PWA
```

Para instalações novas, Empresas + Clientes + Obras + RDO + Planejamento + Financeiro + RH podem usar a fonte central compartilhada.

Para instalações existentes com dados locais, módulos que dependem de migração permanecem `migration-required` até F17; nenhum dado é apagado ou ocultado por troca automática de fonte.

---

# Fora do escopo F8–F12

- migração automática completa de dados locais para servidor — F17;
- controle otimista de concorrência completo — F14;
- painel completo de papéis/permissões — F15/F16;
- descoberta automática LAN — F21;
- Windows Service dedicado — F22;
- servidor remoto público/HTTPS/VPN pronto para produção — F24+;
- R2, documentos Cloud pagos, billing ou entitlement novo;
- escrita offline em `lan-client`;
- eleição/failover entre múltiplos coordenadores;
- novo SyncCoordinator dentro do LAN Server;
- alteração da PWA apenas para acomodar uma segunda arquitetura de sync.

## Critério final

F8–F12 estarão concluídas quando o Obra na Mão puder, em instalação LAN nova, usar vários Desktops sobre uma única fonte autoritativa para os principais módulos, com um único coordenador mantendo o fluxo existente com Cloudflare/PWA, sem fallback silencioso, sem segundo pipeline e sem migração destrutiva de clientes existentes.