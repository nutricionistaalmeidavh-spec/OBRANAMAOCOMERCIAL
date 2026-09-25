# Design — Observabilidade da Débora na Central Artisys

Data: 2026-09-25
Branch: `feat/debora-usage-observability-central`
Repo: `OBRANAMAOCOMERCIAL`

## Objetivo

Ampliar a área Débora Lactação da Central Artisys para visualizar contas, planos, compras, presença online, sessões e tempo de uso, preservando integralmente o licenciamento atual e o trabalho paralelo em andamento na Central de Licenças.

A Central continuará sendo a autoridade para o licenciamento manual de 6 meses e para os registros comerciais dessas ativações. A Débora fornecerá telemetria operacional e billing via API interna somente leitura.

## Princípio de isolamento

Esta mudança deve ser aditiva. Não substituir nem remodelar desnecessariamente `product-license-service.ts`, `debora-license-admin.ts`, `license-center-readonly-internal.ts`, o fluxo atual de grant/renew/revoke nem os demais produtos da Central.

Quando um arquivo de alto risco também mudar em `main`, a integração será refeita sobre a versão mais nova da `main`, nunca sobrescrevendo trabalho paralelo com uma cópia antiga da branch.

## Responsabilidades

### Central Artisys

Continua responsável por:

- licença manual `pro_6m`;
- liberar 6 meses;
- renovar +6 meses;
- consultar;
- revogar;
- auditoria de licença;
- transações comerciais manuais;
- apresentação consolidada no painel.

### Débora Lactação

Fornece via contrato interno:

- contas e cadastro;
- último login;
- presença;
- sessões e tempo agregado;
- billing Asaas;
- checkout, pagamento e assinatura;
- planos automáticos.

## Integração com a Débora

A Central consumirá a API interna por backend/server-to-server, preferencialmente via Cloudflare Service Binding e segredo dedicado.

```text
Browser superadmin
      |
      v
Central Artisys backend
      |
      +-- Service Binding
      +-- segredo interno dedicado
      |
      v
Débora /api/internal/observability/*
```

O browser nunca recebe o segredo e não chama a API administrativa da Débora diretamente.

Se a observabilidade estiver indisponível, licenciamento manual, consulta, revogação e os demais produtos continuam funcionando; apenas métricas/telemetria ficam indisponíveis.

## Tela Débora Lactação

A área existente será ampliada sem criar outro painel administrativo.

### Visão geral

Cards previstos:

- Online agora;
- Contas totais;
- Freemium;
- Pro ativos;
- Vendas pagas;
- Receita realizada;
- Ativos hoje / 7 dias / 30 dias.

Quebra de Pro:

- Pro mensal via Asaas;
- Pro anual via Asaas;
- Pro manual 6 meses.

Quebra de manual:

- pagos;
- pendentes;
- não pagos;
- cortesia/parceria;
- pagamento não informado para legado.

## Lista de usuários

Tabela paginada com:

- e-mail;
- plano;
- origem;
- status da licença;
- status do pagamento;
- online/offline;
- última atividade;
- último login;
- data de criação da conta.

Filtros server-side:

- busca por e-mail;
- plano;
- origem;
- pagamento;
- online/offline;
- período de cadastro;
- último acesso.

A Central não carrega toda a carteira para filtrar no browser.

## Vendas

Tabela paginada que consolida vendas automáticas e manuais, sem confundir licença com receita.

Campos:

- data;
- cliente;
- canal;
- plano;
- valor;
- status de pagamento;
- referência externa/pedido.

`Pro ativo` não significa `venda paga`.

Entram em venda/receita realizada somente registros explicitamente pagos:

- Asaas pago: entra;
- Mercado Livre pago: entra;
- venda direta paga: entra;
- cortesia: não entra;
- pendente: não entra em receita realizada;
- não pago: não entra;
- legado sem informação: não entra até classificação explícita.

## Licença manual de 6 meses

A lógica atual permanece intacta:

- plano `pro_6m`;
- grant;
- renew;
- revoke;
- expiração;
- auditoria.

O formulário será enriquecido com metadados comerciais.

### Campos adicionais

`acquisition_channel`:

- `mercado_livre`;
- `direct_sale`;
- `shopee`;
- `gumroad`;
- `courtesy`;
- `partnership`;
- `other`.

`payment_status`:

- `paid`;
- `pending`;
- `unpaid`;
- `not_applicable`;
- legado pode ser exibido como `unknown`/não informado.

Outros campos:

- `amount_cents` opcional;
- `paid_at` opcional;
- `external_order_ref` opcional;
- `created_at`;
- `updated_at`.

### Persistência separada e histórica

Criar uma estrutura comercial separada, conceitualmente `manual_license_sales`, ligada à licença por `license_id` e ao produto/e-mail.

Cada **grant manual ou renew manual gera uma linha comercial própria**, com `id` próprio. Renovações não sobrescrevem a venda anterior. Isso permite contar corretamente múltiplas vendas/renovações da mesma licença ao longo do tempo.

A tabela comercial representa a transação; `product_licenses` continua representando o direito de acesso atual.

Uma licença pode estar ativa com pagamento pendente se o operador deliberadamente a liberou.

### Consistência entre licença e transação comercial

Para novos grants/renovações, a ação não deve retornar sucesso ao operador deixando a licença e a transação comercial em estados contraditórios. A implementação deve usar uma operação D1 transacional/atômica quando possível; se a arquitetura existente impedir uma transação única, deve existir reconciliação explícita e um estado de erro administrável, nunca sucesso silencioso parcial.

Revogar uma licença não apaga transações de venda históricas. O histórico comercial permanece auditável.

## Compatibilidade com licenças antigas

Licenças manuais existentes não serão marcadas automaticamente como pagas.

Exibição inicial:

```text
Ativação: Manual
Origem histórica: Mercado Livre/manual
Pagamento: Não informado
```

O operador poderá classificar posteriormente. Nenhuma migração inferirá pagamento sem evidência explícita.

## Atividade e sessões

Na ficha do usuário, apresentar:

- Online agora;
- última atividade;
- último login;
- sessões hoje;
- tempo hoje;
- sessões 7/30 dias;
- tempo 7/30 dias.

A Central apresenta os agregados recebidos da Débora; não percorre heartbeats para calcular tempo.

## Paginação e escala

Todos os endpoints de lista consumidos pela Central permanecem paginados:

- cursor/keyset;
- 50 itens por padrão para usuários/vendas;
- máximo de 100;
- sessões com 25 por padrão e máximo de 100;
- filtros server-side;
- ordenação determinística;
- sem `OFFSET` profundo como estratégia principal;
- sem carregar toda a lista no browser;
- cards baseados em summary agregado.

A UI suporta `hasMore` / `nextCursor` e mantém filtros ao avançar páginas.

As transações manuais também devem ter índices coerentes com consulta por data, e-mail, canal e status de pagamento; índices exatos serão definidos a partir das queries finais.

## Segurança

- comunicação apenas backend-to-backend;
- Service Binding quando disponível;
- segredo dedicado de observabilidade;
- não reutilizar segredos de Asaas ou de outro domínio;
- `cache-control: no-store`;
- nenhum dado clínico persistido ou exibido pela Central;
- falha de autenticação interna resulta em 401 controlado.

## UX de indisponibilidade

A indisponibilidade da telemetria não pode parecer perda de licença.

```text
Atividade: indisponível temporariamente
Licença: Pro 6 meses — ativa
```

Status de licença não será reutilizado para representar falha de telemetria.

## Testes obrigatórios

### Licenciamento existente

- grant manual continua funcionando;
- renew +6 meses continua funcionando;
- consultar continua funcionando;
- revogar continua funcionando;
- eventos de auditoria continuam registrados;
- licença Asaas continua sincronizada.

### Transações comerciais manuais

- Mercado Livre pago;
- venda direta paga;
- pendente;
- não pago;
- cortesia;
- parceria;
- valor/referência opcionais;
- cada renovação cria nova transação histórica;
- revogação preserva histórico de venda;
- legado sem dados aparece como não informado;
- nenhuma classificação automática falsa;
- falha parcial não é reportada como sucesso completo.

### Integração observabilidade

- summary;
- usuários paginados;
- vendas paginadas;
- sessões paginadas;
- filtros preservados;
- segredo ausente/incorreto;
- API Débora indisponível sem quebrar licenciamento.

### UI

- cards corretos;
- Pro ativo distinto de venda paga;
- origem/manual/Asaas claramente diferenciados;
- online/offline;
- navegação paginada;
- loading/erro sem bloquear ações de licença.

## Critérios de aceite E2E

### Conta com uso

1. usuário cria conta na Débora;
2. aparece na Central;
3. faz login;
4. aparece online dentro da janela definida;
5. sessão e tempo de uso crescem;
6. após parar de enviar heartbeat, deixa de aparecer online.

### Compra Asaas

1. checkout é criado;
2. pagamento é confirmado;
3. licença é ativada pelo fluxo existente;
4. Central mostra `Pro mensal/anual`, `Asaas`, `Pago`;
5. venda entra em receita realizada.

### Venda Mercado Livre manual

1. operador informa e-mail;
2. canal Mercado Livre;
3. pagamento Pago;
4. valor/referência quando disponíveis;
5. libera 6 meses;
6. Central mostra `Pro 6 meses`, `Manual`, `Mercado Livre`, `Pago`;
7. venda entra em receita manual realizada.

### Renovação manual

1. licença manual já está ativa;
2. operador registra nova venda/condição comercial;
3. renova +6 meses;
4. validade é estendida pela lógica existente;
5. nova transação comercial é preservada sem apagar a anterior.

### Cortesia

1. operador escolhe Cortesia;
2. pagamento Não se aplica;
3. libera 6 meses;
4. Pro fica ativo;
5. registro não entra em vendas pagas nem receita.

## Proteção contra trabalho paralelo

Esta branch nasceu da `main` no commit `52cdf0077a8e08d98bf8d38a4e41e58b55c7660e`, que já contém o snapshot read-only da Central de Licenças.

Antes de qualquer integração:

1. atualizar referência da `main`;
2. comparar `main` atual x branch;
3. identificar arquivos modificados por ambos;
4. reconciliar mudanças sobre a versão nova da `main`;
5. rodar testes do licenciamento existente;
6. rodar testes da observabilidade;
7. somente então preparar merge/PR.

Nenhum merge automático será executado como parte desta especificação.

## Dependência coordenada

O contrato de observabilidade é implementado na branch irmã `feat/debora-usage-observability` do repo `ConsulroriaAmamenta-o`.

As duas branches devem ser integradas de forma coordenada e validadas contra suas respectivas mains atuais antes da publicação.
