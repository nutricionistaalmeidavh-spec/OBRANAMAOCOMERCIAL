# Paridade de planilhas operacionais — Desktop conectado ao Obra na Mão Server

## Contrato implementado

O Desktop utiliza os mesmos componentes e fontes de entidades, mas escolhe automaticamente o destino conforme o módulo em `ModuleStorageStateService`:

| Estado | Escrita | Leitura |
|---|---|---|
| `local` | Serviços locais existentes (SQLite local, transação) | SQLite local |
| `migration-required` | Serviços locais existentes, até concluir migração | Dados locais em migração |
| `central-active` | API autenticada do servidor LAN, transação central | API central |
| `central-ready` | Bloqueada até ativação | Sem fallback de escrita |

Não existe tabela paralela de planilhas; saldos e acumulados permanecem projeções dos registros canônicos.

## API do servidor (mínimo 0.4.3)

Todas as rotas são **POST** autenticadas com o bearer do dispositivo LAN existente, requerem usuário ativo com canal Desktop e permissões granulares por módulo:

- `/api/v1/operational-sheets/commit` — áreas `orcamento`, `financeiro`, `cronograma`, `etapas`, `subetapas`, `tarefas`. Corpo `{area,obraId?,empresaId?,rows:[{id,revision,...camposPermitidos}]}`. Criação de etapas/subetapas requer também permissão `create`. A transação é indivisível e exige `revision` na atualização.
- `/api/v1/operational-sheets/measurements` — `{obraId,competencia}`, visão de saldo orçamentário/contratual sem persistir projeções.
- `/api/v1/operational-sheets/time-matrix` — `{competencia,obraId?,empresaId?}`, matriz de até 60 colaboradores, com `pointRevision` por mês e sem criar marcações.
- `/api/v1/operational-sheets/time-commit` — `{competencia,obraId?,empresaId?,rows:[{funcionario_id,data,tipo,entrada,intervalo_saida,intervalo_entrada,saida,observacoes,pointRevision}]}`. Bloqueia folhas fechadas, pagamentos e conflitos de revisão em transação única.
- `/api/v1/operational-sheets/receive-many` — `{requestId,data,nota_fiscal?,items:[{pedido_item_id,quantidade_recebida}]}`. Atualiza recebimentos, saldos derivados de movimentações e status do pedido de forma atômica, com replay idempotente.

O Desktop verifica `sync-source/capabilities` e requer `features` contendo `operational-sheets-batch-v1`; em servidores antigos, mostra mensagem explícita de atualização e **não grava localmente**. Para lotes remotos, o timeout de request é 30 segundos. A infraestrutura existente usa exclusivamente Node, SQLite e comunicação local/self-hosted: R$0 de serviço obrigatório.

## Atualização dos clientes

Para ativar a nova funcionalidade em computadores que usam servidor da empresa:
1. Atualizar o **Obra na Mão Server** para versão 0.4.3 ou posterior usando seu instalador/assistente já existente e preservar backup e banco.
2. Atualizar o **Obra na Mão Desktop** com a versão que inclua esta PR.
3. Validar conexão do Desktop, permissões do colaborador e estado `central-active`; abrir uma planilha, editar uma linha pendente e confirmar que outro computador vê a alteração após atualizar a consulta.
4. Validar negativamente duas edições concorrentes e reenvio do mesmo recebimento.

Nenhuma alteração em DNS, secrets, chaves, Cloudflare D1/R2 ou planos comerciais é necessária. O recurso de leitura/exportação continua quando uma operação de edição é negada por falta de permissão ou incompatibilidade de versão.

## Escopo e limitações

Esta entrega é a **paridade Desktop local ↔ Desktop conectado ao servidor central** nas planilhas operacionais citadas. O importador universal de arquivos XLSX/CSV de 11 domínios continua com seu fluxo original e suas regras próprias (não é reimplementado nem habilitado indiscriminadamente no servidor). O Web/PWA móvel conserva seus formulários apropriados e não passa a exibir uma grade de Desktop automaticamente. O RDO já salva agregado pelo `FieldSourceService` e não precisa de nova rota de escrita de planilha.

## Gates obrigatórios

- Testes HTTP com banco LAN real: permissões, rollback multiobra, conflito 409, revisão RH, duplicidade de estoque e contas pagas.
- Testes Desktop: rota remota sem fallback para SQLite, negociação de capability e idempotência.
- Testes server Linux/Windows, Desktop Windows/macOS, F31, build e lint.
- A PR só fica apta a merge quando os checks estiverem aprovados; nenhuma release é disparada por esta alteração.
