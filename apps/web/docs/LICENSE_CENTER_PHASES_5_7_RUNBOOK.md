# Central de Licenças — Runbook Fases 5 a 7

## Objetivo

Colocar a nova Central do Painel Geral em operação com leitura e escrita reais sem substituir a autoridade atual, sem migrar D1 e sem remover `artisys.dev/sistema#owner`.

Workers envolvidos:

- `obra-na-mao-comercial` — autoridade de Obra e Débora e orquestrador da Loja Online.
- `artisys-mercadolivre` — Painel Geral e UI administrativa.
- `artisys-lojaonline` — autoridade da Loja Online, acessada pelo Obra via `LOJAONLINE_LICENSING`.

## Segredos

Leitura e escrita usam credenciais separadas.

No Obra:

```bash
npx wrangler secret put LICENSE_CENTER_READ_SECRET --config wrangler.jsonc
npx wrangler secret put LICENSE_CENTER_WRITE_SECRET --config wrangler.jsonc
```

No MercadoLivre:

```bash
npx wrangler secret put OBRA_LICENSE_CENTER_READ_SECRET --config cloudflare/wrangler.jsonc
npx wrangler secret put OBRA_LICENSE_CENTER_WRITE_SECRET --config cloudflare/wrangler.jsonc
```

Os pares de leitura devem ter o mesmo valor entre os dois Workers, e os pares de escrita também. O segredo de escrita deve ser diferente do segredo de leitura.

Nunca coloque os valores em Git, documentação, frontend, chat ou logs.

## Feature flag

O Obra publica a nova superfície de escrita com:

```text
LICENSE_CENTER_WRITE_ENABLED=false
```

por padrão.

Com `false`, os endpoints internos mutáveis retornam `503 write_disabled`; leitura e Central antiga continuam funcionando.

Somente altere para `true` depois de:

1. CI do Obra verde;
2. CI do MercadoLivre verde;
3. Painel Geral publicado;
4. segredos de escrita configurados;
5. gate de paridade live aprovado.

## Gate de paridade futura

No Obra:

```bash
cd apps/web
npm run qa:admin-parity
```

Toda nova rota administrativa `/api/owner/*` deve estar classificada em `qa/admin-parity-capabilities.json` ou já coberta pela matriz existente. Uma rota não classificada bloqueia o CI.

O snapshot da autoridade publica `adminParity.contractVersion` e `adminParity.requiredCapabilities`.

No MercadoLivre, antes de habilitar escrita:

```bash
npm run verify:license-center:parity-live
```

Variáveis necessárias somente no processo local/CI de release:

```text
LICENSE_CENTER_AUTHORITY_URL
LICENSE_CENTER_READ_SECRET
```

Falha esperada quando o painel ficar atrás da autoridade:

```text
ADMIN_PARITY_FAILURE
missing: <capability-id>
```

Nesse estado, `/licenses` também mostra o alerta e desabilita as ações de escrita.

## E2E isolado

Executar antes do live:

```bash
npm run qa:license-center:isolated
```

Esse teste usa a página real da Central e uma autoridade controlada em memória. Ele cobre desktop, tablet e mobile, refetch canônico, `qa_scope_violation`, `write_disabled` e paridade incompleta.

## E2E live de produção

O live QA cria somente registros sintéticos do próprio run.

Variáveis necessárias no MercadoLivre:

```text
LICENSE_CENTER_PANEL_URL
LICENSE_CENTER_ADMIN_PASSWORD
LICENSE_CENTER_AUTHORITY_URL
LICENSE_CENTER_READ_SECRET
LICENSE_CENTER_LIVE_CONFIRM=I_UNDERSTAND_THIS_WRITES_QA_RECORDS
```

Executar:

```bash
npm run qa:license-center:live
```

Cada execução cria `qaRunId` único e usa exclusivamente:

```text
ARTISYS QA E2E <qaRunId>
ARTISYS QA E2E LOJA <qaRunId>
qa-license-<qaRunId>@example.test
```

O runner captura `baselineIds` antes do primeiro write. Um alvo só pode ser alterado se estiver em `createdIds` e não estiver no baseline. O backend repete a proteção usando a identidade persistida e `X-Artisys-QA-Run`.

O relatório final fica em:

```text
qa-artifacts/license-center-live/<qaRunId>/report.json
```

Critérios obrigatórios:

```text
status = passed
existingIdsTouched = 0
qaRecordsActive = 0
```

Ao terminar, os registros QA permanecem apenas para auditoria e ficam inativos:

- Obra QA: licença `revoked`/suspensa;
- Débora QA: `revoked`;
- Loja Online QA: `BLOCKED`.

Não existe DELETE físico nesta entrega.

## Ordem segura de rollout

1. Deploy do `obra-na-mao-comercial` com `LICENSE_CENTER_WRITE_ENABLED=false`.
2. Configurar `LICENSE_CENTER_WRITE_SECRET` no Obra.
3. Deploy do `artisys-mercadolivre`.
4. Configurar o mesmo segredo em `OBRA_LICENSE_CENTER_WRITE_SECRET` no MercadoLivre.
5. Executar `npm run verify:license-center:parity-live`.
6. Executar o E2E isolado.
7. Habilitar `LICENSE_CENTER_WRITE_ENABLED=true` no Obra e publicar essa configuração.
8. Executar o E2E live com confirmação explícita.
9. Exigir `existingIdsTouched=0` e `qaRecordsActive=0`.
10. Usar a nova Central em paralelo.
11. Manter `artisys.dev/sistema#owner` disponível como fallback.

## Rollback

### Nível 1 — imediato

Defina:

```text
LICENSE_CENTER_WRITE_ENABLED=false
```

e publique o Worker do Obra. Isso corta somente a nova escrita.

### Nível 2 — Painel Geral

Faça rollback do `artisys-mercadolivre` para a versão anterior. A Central antiga continua funcionando.

### Nível 3 — autoridade

Faça rollback do `obra-na-mao-comercial` para a versão anterior. Não existe rollback de schema porque esta entrega não cria migrações.

Nenhum rollback automatizado pode modificar, apagar ou restaurar registros que já existiam antes de um run QA.

## Fase 7

A fase 7 está operacional quando:

- nova Central lê e escreve pelas autoridades existentes;
- CI dos repositórios está verde;
- E2E isolado está verde;
- gate de paridade live está verde;
- E2E live está verde;
- `existingIdsTouched=0`;
- `qaRecordsActive=0`;
- Central antiga segue disponível;
- feature flag continua sendo rollback imediato.

A fase 8 e qualquer redirecionamento/remoção da Central antiga permanecem fora deste runbook.
