# Obra na Mão — Financeiro B0–B2: modelo canônico, contas bancárias e importação assistida

Status: **design aprovado para implementação técnica, ainda não implementado**.  
Escopo: B0 (arquitetura), B1 (contas bancárias), B2 (importador OFX/CSV).  
Referência: branch principal inspecionada em 18/11/2026.  
Limite de custo: core R$ 0, self-hosted e código open source; serviço pago exclusivamente opcional.

## 1. Evidência atual

No Desktop/servidor, as fontes operacionais são `contas` e `pagamentos_conta`, usadas por `FinancePage.tsx`, `FinanceService` e DRE. `FinanceSourceService` escolhe fonte local ou central conforme o estado autorizado do módulo e **não permite fallback SQLite quando a fonte central estiver ativa**.

No web existe outro conjunto de estruturas de extratos e conciliação em `apps/web/backend/finance-integrated.ts` e UI em `apps/web/src/finance.ts`, com parsers OFX/CSV/PDF, sugestões e auditoria. Esses recursos não autorizam considerar que o Desktop já possua conciliação bancária canônica. O primeiro passo técnico é criar **um contrato de leitura/integração explícito**, não copiar obrigações financeiras entre sistemas sem controle.

## 2. Usuários e suas tarefas

- **Administrador financeiro:** cadastrar banco da empresa, importar extrato, conferir lançamentos e localizar divergências.
- **Operador financeiro:** importar e revisar extratos nas empresas autorizadas; sem permissão para alterar saldos iniciais ou excluir históricos sensíveis.
- **Gestor de obras:** visualizar custos vinculados à obra, sem ter que cadastrar uma conta bancária para cada obra.

Hipótese de UX (a validar com usuário real): o início mais reconhecível é `Financeiro > Contas bancárias`, com duas ações principais `Adicionar conta` e `Importar extrato`, e não um menu técnico separado “Integrações”.

## 3. Modelo de domínio e fonte de verdade

| Conceito da pessoa | Entidade proposta | Escopo / vínculo | O que NÃO faz |
|---|---|---|---|
| Conta bancária | `contas_bancarias` | 1 empresa, 0..N transações | Não é uma obra nem a tabela `contas` de obrigações |
| Importação de extrato | `extrato_importacoes` | Empresa + conta bancária + hash | Não efetua baixa financeira |
| Movimento no banco | `transacoes_bancarias` | Importação + conta bancária | Não é despesa/receita econômica automaticamente |
| Conta a pagar/receber | `contas` existente | Empresa, obra opcional | Não recriar nesta entrega |
| Pagamento ou recebimento | `pagamentos_conta` existente | Conta operacional e data efetiva | Não recriar ao importar extrato |
| Conciliação | B3, fora deste escopo | Vínculo banco ↔ pagamento/obrigação | Não simular baixa em B2 |

**Invariantes:** `empresa_id` em todas as entidades; nenhuma transação aceita conta bancária de outra empresa. `obra_id` não pertence à conta bancária, podendo ser identificado em lançamentos operacionais/conciliados no B3. Uma conta pode ter múltiplas importações e uma importação várias transações. Registro bancário nunca é automaticamente lançamento em `contas` ou `pagamentos_conta`.

**Fontes por modo:** quando Desktop local for canônico, persistência SQLite local. Quando servidor LAN/próprio for canônico, escrita exclusivamente no servidor. PWA/Web só lê/escreve por API autorizada e não mantém banco paralelo. O financeiro web `afi_*` deve ser tratado como integração/migração explícita, com identidade de empresa mapeada, e não como segunda fonte canônica implícita.

## 4. Esquema conceitual de banco (proposta, NÃO executar sem migração validada)

```sql
CREATE TABLE contas_bancarias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id),
  nome TEXT NOT NULL,
  banco_nome TEXT NOT NULL,
  agencia TEXT,
  conta_identificador TEXT,
  tipo_conta TEXT NOT NULL DEFAULT 'corrente',
  saldo_inicial_centavos INTEGER NOT NULL DEFAULT 0,
  saldo_referencia_data TEXT NOT NULL,
  ativo INTEGER NOT NULL DEFAULT 1 CHECK(ativo IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);
CREATE INDEX idx_banco_empresa_ativo ON contas_bancarias(empresa_id,ativo);

CREATE TABLE extrato_importacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id),
  conta_bancaria_id INTEGER NOT NULL REFERENCES contas_bancarias(id),
  nome_arquivo TEXT NOT NULL,
  formato TEXT NOT NULL CHECK(formato IN ('ofx','csv')),
  sha256 TEXT NOT NULL,
  estado TEXT NOT NULL CHECK(estado IN ('confirmada','falha')),
  total_linhas INTEGER NOT NULL,
  importadas INTEGER NOT NULL,
  duplicadas INTEGER NOT NULL,
  rejeitadas INTEGER NOT NULL,
  criado_por TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(conta_bancaria_id,sha256)
);
CREATE INDEX idx_extrato_empresa_conta ON extrato_importacoes(empresa_id,conta_bancaria_id);

CREATE TABLE transacoes_bancarias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id),
  conta_bancaria_id INTEGER NOT NULL REFERENCES contas_bancarias(id),
  importacao_id INTEGER NOT NULL REFERENCES extrato_importacoes(id),
  chave_transacao TEXT NOT NULL,
  data TEXT NOT NULL,
  descricao TEXT NOT NULL,
  valor_centavos INTEGER NOT NULL,
  origem_identificador TEXT,
  origem_linha INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(conta_bancaria_id,chave_transacao)
);
CREATE INDEX idx_transacoes_banco_data ON transacoes_bancarias(empresa_id,conta_bancaria_id,data);
```

As chaves `UNIQUE` e FKs são necessárias, mas **não suficientes**: serviço deve validar o pertencimento de empresa de todos os vínculos, utilizar transação SQL atômica, registrar eventos de auditoria, e permitir desfazer/corrigir importação de maneira auditável sem apagar dados conciliados futuramente. Não inserir automaticamente essas tabelas no repositório genérico sem revisar `TABLES`, migration runner e whitelist do servidor.

## 5. B1 — Cadastro de contas bancárias

**Navegação:** Financeiro > Contas bancárias. A lista exibe nome, banco, identificador mascarado, saldo de referência, situação e última importação. Não mistura lançamentos operacionais.

**Novo cadastro (formulário curto):**
1. Empresa (pré-selecionada pelo contexto autorizado e visível).
2. Nome de referência: “Conta principal”, “Conta operacional”, etc.
3. Banco (texto, sem depender de catálogo/API paga), agência e identificação da conta.
4. Tipo de conta (corrente, poupança, pagamento).
5. Saldo inicial em R$ (permite valor negativo) e data exata do saldo.
6. Salvar conta — mensagem com nome, empresa e opção “Importar extrato”.

**Regras de comportamento:** não pedir obra nesta tela. Validar a empresa antes da escrita; não duplicar conta por clique repetido (idempotência de requisição). Desativar conta não exclui histórico. A confirmação de criação só aparece após leitura persistida. Dados bancários parcialmente mascarados onde cabível. Erro mantém o formulário preenchido e indica o campo.

## 6. B2 — Importação assistida

**Entrada:** Financeiro > Contas bancárias > [conta] > Importar extrato.

`1. Selecionar` → `2. Conferir prévia` → `3. Importar` → `4. Ver resultado`

- Selecionar conta bancária antes do arquivo. Aceitar OFX e CSV, exibindo suporte de formato e tamanho. PDF será evolução separada e opcional, com leitura determinística quando possível; IA/OCR pagas nunca são dependência.
- OFX: respeitar `FITID` quando disponível; converter datas a `YYYY-MM-DD` com interpretação explícita do extrato, valor com sinal e centavos; tratar encoding compatível e lançamentos negativos.
- CSV: oferecer detecção assistida de delimitador, decimal, cabeçalho e colunas `data`, `descrição`, `valor` ou `entrada/saída`; mostrar mapeamento editável antes da confirmação.
- Prévia não pode gravar em `transacoes_bancarias`. Mostrar número de importáveis, duplicados (arquivo repetido ou transação identificada), inválidos, soma de entradas/saídas e alertas de competência/data.
- Chave de duplicidade: por conta e FITID quando ele existir; se ausente, usar fingerprint determinístico a partir de campos normalizados + referência de origem que preserve transações legítimas idênticas. Registros ambíguos precisam ser evidenciados para revisão em vez de descartados silenciosamente.
- Confirmação: inserir importação + registros elegíveis numa **única transação**. Se a operação falhar, rollback. Reenvio da mesma requisição ou do mesmo arquivo na mesma conta deve ser seguro.
- Tela de sucesso: “N transações importadas, M já existentes, K com erro”, link “Ver movimentações” e CTA “Conciliar” desabilitado/rotulado “Em breve” até B3 estar operacional, evitando promessa falsa.

**Não fazer em B2:** baixa automática, conciliação automática, alteração de DRE, “criar despesas a partir de linhas” sem escolha explícita, armazenamento duplicado em Cloudflare e LAN.

## 7. Estados de interface, feedback e recuperação

| Estado | Mensagem/controle esperado | Recuperação |
|---|---|---|
| Nenhuma conta | “Cadastre uma conta para importar extratos” + CTA | Adicionar conta |
| Sem arquivo | “Selecione OFX ou CSV” | Selecionar |
| Colunas CSV não reconhecidas | Campos com exemplo de valor real | Mapear manualmente |
| Linha inválida | Linha, causa específica e total de rejeições | Corrigir e repetir |
| Arquivo já importado | “Este arquivo já foi importado nesta conta em [data]” | Visualizar histórico |
| Parcialmente duplicado | Contadores separados e prévia de novas linhas | Confirmar somente elegíveis |
| Falha ao salvar | “Não foi possível concluir; nenhuma linha nova foi aplicada” | Tentar novamente com dados preservados |
| Importação concluída | Resumo persistido e link para extrato | Ver movimentações |

Interface deve atender teclado, foco, mensagens acessíveis e mobile, com ação primária única em cada etapa. Sem confirmação baseada apenas em toast otimista.

## 8. Contrato API proposto

```text
GET    /api/v1/finance/bank-accounts?empresa_id=...
POST   /api/v1/finance/bank-accounts
PATCH  /api/v1/finance/bank-accounts/:id
POST   /api/v1/finance/bank-imports/preview
POST   /api/v1/finance/bank-imports/confirm
GET    /api/v1/finance/bank-imports?conta_bancaria_id=...
GET    /api/v1/finance/bank-transactions?conta_bancaria_id=...
```

Desktop IPC deve usar exatamente o mesmo serviço de domínio/contrato e o roteamento de fonte de dados existente; não criar uma implementação semântica diferente para cada superfície. Controlar escopo de empresa no servidor, não confiar no seletor da UI. CSV/OFX são processados sem internet ou serviço pago.

### Idempotência e conciliação futura

`preview` devolve `previewHash` derivado de conta + arquivo + mapeamento + parser version; `confirm` valida que o mesmo arquivo e versão ainda são válidos. Requisicoes concorrentes não criam importação duplicada graças a restrições no banco e transação serializada. O contrato B3 deverá referenciar `transacoes_bancarias.id` e `pagamentos_conta.id` sem duplicar `contas`.

## 9. Plano de QA/testes de aceite

### Testes unitários (parser)
- OFX débito/crédito, datas, separadores e texto acentuado.
- CSV ponto/vírgula, vírgula decimal, mapeamento alternativo e linhas vazias.
- Arquivo incompatível rejeitado sem escrita.
- Duas transações legítimas com mesmo valor/data preservadas quando identificadores divergem.
- FITID repetido na mesma conta tratado como duplicado.

### Testes de integração (SQLite e LAN)
- Cadastrar conta na empresa A; empresa B não consegue consultar/modificar.
- Saldo inicial negativo e data persistidos corretamente.
- Importação de arquivo com 5 linhas válidas e 1 inválida: prévia correta; confirmação política definida para linhas inválidas.
- Importar mesmo arquivo duas vezes: contagem idempotente, sem duplicatas.
- Duas importações simultâneas: só transações novas e um resultado consistente.
- Interromper gravação no meio: rollback completo.
- Migrar instalação antiga: sem perder contas/folha/DRE.
- Em modo LAN central ativo sem conexão: bloquear escrita; nunca salvar em SQLite local.
- Reabrir Desktop/PWA após importação: estado lido da fonte persistente.

### Teste de usabilidade (ainda NÃO realizado)
Dar ao usuário a tarefa “Cadastre a conta usada para pagar funcionários e importe o extrato do mês”; observar se encontra o menu, entende o mapeamento CSV, identifica duplicidades, confirma o resultado e sabe o que fazer depois. Não instruir o caminho antes. Testar também erro e retorno sem perder dados.

## 10. Entrega e limites

- B0: contrato, matriz de fontes e invariantes → presente neste documento, pendente implementação.
- B1: schema, domínio, API, interface e testes → pendentes.
- B2: parser, prévia, persistência, histórico, interface e testes → pendentes.
- B3: conciliação bancária → fora do escopo desta etapa.
- É proibido afirmar B1/B2 como liberados a clientes antes de build, migração, QA e release autorizada.
- Branch própria; PR draft; sem merge na main, sem release e sem alteração de secrets.
