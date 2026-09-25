# Observabilidade da Débora na Central Artisys — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ampliar a área Débora Lactação da Central Artisys com contas, online, sessões, uso e vendas, mantendo intactas as licenças atuais e adicionando histórico comercial explícito às ativações manuais de 6 meses.

**Architecture:** A Central continua autoridade das licenças `pro_6m` e armazena transações manuais no próprio D1. Dados de auth/atividade/billing automático vêm da Débora por Service Binding e segredo dedicado. Novas rotas owner enriquecem páginas remotas com licença local por e-mail e combinam vendas Asaas + manuais sem copiar telemetria para o D1 da Central.

**Tech Stack:** Cloudflare Workers, Service Bindings, D1/SQLite, TypeScript, Vitest, Vite, Wrangler 4.

**Spec:** `docs/superpowers/specs/2026-09-25-debora-usage-observability-central-design.md`

## Global Constraints

- Esta branch é aditiva: não substituir `product-license-service.ts`, `debora-license-admin.ts`, `license-center-readonly-internal.ts` ou `owner.ts` por versões antigas.
- `grant`, `renew`, `status`, `revoke`, auditoria e sync Asaas continuam funcionando.
- `product_licenses` representa direito de acesso; `manual_license_sales` representa transações/comercial. Pagamento não controla acesso.
- Cada grant/renew manual gera uma transação própria; nunca sobrescrever venda anterior.
- Revogação não apaga transações históricas.
- Licenças antigas permanecem `Pagamento não informado` até classificação explícita; jamais inferir `paid`.
- Observabilidade indisponível nunca bloqueia liberar/renovar/consultar/revogar licença.
- Listas novas usam cursor/keyset, filtros server-side e máximo de 100 registros.
- A Central nunca recebe nem persiste dados clínicos.
- `DEBORA_OBSERVABILITY_SECRET` não entra no Git.
- Antes de tocar em arquivo de alto risco durante execução, conferir se `origin/main` avançou; se o mesmo arquivo mudou na main, aplicar mudanças sobre a versão nova e registrar a reconciliação. Não sobrescrever trabalho paralelo.
- Não fazer deploy de produção nem merge em `main` durante este plano sem aprovação explícita.

## Review Focus

1. **Atomicidade manual:** se a transação comercial falhar, grant/renew não pode retornar sucesso deixando licença alterada sem registro comercial correspondente.
2. **Renovação:** cada renew soma +6 meses pela regra existente e cria nova linha de venda sem apagar a anterior.
3. **Legado:** licença antiga `mercado_livre_manual` não vira `paid` automaticamente.
4. **Falha do serviço Débora:** 401/503/timeout da observabilidade deve degradar somente métricas/listas; formulário de licença segue funcional.
5. **Paginação consolidada de vendas:** Asaas e manual devem aparecer exatamente uma vez, em ordem determinística, inclusive quando timestamps empatam.

---

### Task 1: Criar schema histórico de vendas manuais

**Files:**
- Create: `apps/web/cloudflare/migrations/0009_debora_manual_sales.sql`
- Create: `apps/web/backend/manual-license-sales.test.ts`

**Preflight:** O slot atual após a main-base desta branch é `0009`. Antes de criar o arquivo, executar `git fetch origin main` e listar `apps/web/cloudflare/migrations`. Se `origin/main` já tiver um `0009_*`, usar o próximo número inteiro livre e manter o nome `*_debora_manual_sales.sql`; atualizar apenas os comandos/referências desta task para esse número. Não apagar nem renomear migration vinda da main.

**Interfaces:**
- Produces table `manual_license_sales`.
- Tasks 2–4 read/write this table.

- [ ] **Step 1: Escrever teste que aplica todas as migrations em SQLite/D1 local e inspeciona a nova tabela**

O teste deve exigir as colunas:

```text
id
license_id
product_code
email
operation
acquisition_channel
payment_status
amount_cents
paid_at
external_order_ref
actor
created_at
updated_at
```

E índices:

```text
manual_license_sales_email_created_idx
manual_license_sales_payment_created_idx
manual_license_sales_channel_created_idx
manual_license_sales_license_created_idx
```

- [ ] **Step 2: Rodar e confirmar falha**

```powershell
Set-Location apps/web
npx vitest run backend/manual-license-sales.test.ts
```

Expected: FAIL porque a migration/tabela ainda não existe.

- [ ] **Step 3: Criar migration**

```sql
CREATE TABLE IF NOT EXISTS manual_license_sales (
  id TEXT PRIMARY KEY,
  license_id TEXT NOT NULL,
  product_code TEXT NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE,
  operation TEXT NOT NULL CHECK (operation IN ('grant','renew','legacy_classification')),
  acquisition_channel TEXT NOT NULL CHECK (acquisition_channel IN ('mercado_livre','direct_sale','shopee','gumroad','courtesy','partnership','other')),
  payment_status TEXT NOT NULL CHECK (payment_status IN ('paid','pending','unpaid','not_applicable','unknown')),
  amount_cents INTEGER CHECK (amount_cents IS NULL OR amount_cents >= 0),
  paid_at TEXT,
  external_order_ref TEXT,
  actor TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS manual_license_sales_email_created_idx
  ON manual_license_sales(product_code,email,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS manual_license_sales_payment_created_idx
  ON manual_license_sales(product_code,payment_status,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS manual_license_sales_channel_created_idx
  ON manual_license_sales(product_code,acquisition_channel,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS manual_license_sales_license_created_idx
  ON manual_license_sales(license_id,created_at DESC,id DESC);
```

- [ ] **Step 4: Testar migration local**

```powershell
npm run d1:migrate:local
npx vitest run backend/manual-license-sales.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add cloudflare/migrations/*_debora_manual_sales.sql backend/manual-license-sales.test.ts
git commit -m "feat: add manual Debora sales history"
```

---

### Task 2: Refatorar grant manual para um plano atômico reutilizável

**Files:**
- Modify: `apps/web/backend/product-license-service.ts`
- Modify: `apps/web/backend/product-license-service.test.ts`

**Interfaces:**
- Produces `prepareManualDeboraLicenseGrant(db,emailValue,actor,now)` → `{action,result,statements}`.
- Existing `grantManualDeboraLicense` remains public and behavior-compatible, now executing `db.batch(statements)`.
- Task 3 combines `statements` with INSERT da venda manual no mesmo D1 batch.

- [ ] **Step 1: Escrever teste preservando comportamento atual**

Cobrir:
- primeira liberação → `action='grant'`, `expires_at = now + 6 meses`;
- licença ainda ativa → `action='renew'`, nova expiração = expiração atual +6 meses;
- licença vencida → nova base = `now`;
- `grantManualDeboraLicense` ainda retorna `{id,email,plan_code:'pro_6m',status:'active',expires_at,source:'mercado_livre_manual'}`.

- [ ] **Step 2: Rodar o teste antes da refatoração**

```powershell
npx vitest run backend/product-license-service.test.ts
```

Expected: testes antigos PASS; novos testes referentes a `prepareManualDeboraLicenseGrant` FAIL.

- [ ] **Step 3: Extrair a preparação sem executar writes**

A nova função deve:
1. normalizar e validar e-mail;
2. buscar a licença manual atual;
3. calcular `base`, `expiresAt`, `id`, `action`;
4. construir D1 prepared statements para:
   - registrar/atualizar `product_accounts` como commercial;
   - inserir/atualizar `product_licenses`;
   - inserir `product_license_events` com `grant` ou `renew`;
5. retornar statements sem executá-las.

Formato:

```ts
return {
  action: existing ? 'renew' as const : 'grant' as const,
  result: {id,email,plan_code:DEBORA_MANUAL_PLAN,status:'active',expires_at:expiresAt,source:DEBORA_MANUAL_SOURCE},
  statements,
};
```

- [ ] **Step 4: Fazer `grantManualDeboraLicense` delegar para o plano**

```ts
export async function grantManualDeboraLicense(db:D1Database,emailValue:unknown,actor='central-artisys',now=new Date().toISOString()) {
  const prepared=await prepareManualDeboraLicenseGrant(db,emailValue,actor,now);
  await db.batch(prepared.statements);
  return prepared.result;
}
```

Não alterar `revokeManualDeboraLicense`, `resolveProductAccess` ou `syncProductLicense` além do necessário para tipos/imports.

- [ ] **Step 5: Rodar testes**

```powershell
npx vitest run backend/product-license-service.test.ts backend/debora-license-admin.test.ts
```

Expected: PASS e payload/semântica legada preservados.

- [ ] **Step 6: Commit**

```powershell
git add backend/product-license-service.ts backend/product-license-service.test.ts
git commit -m "refactor: prepare manual Debora grants atomically"
```

---

### Task 3: Gravar grant/renew + venda manual no mesmo batch

**Files:**
- Create: `apps/web/backend/manual-license-sales.ts`
- Modify: `apps/web/backend/manual-license-sales.test.ts`
- Modify: `apps/web/backend/debora-license-policy.ts`
- Modify: `apps/web/backend/debora-license-admin.test.ts`
- Modify: `apps/web/backend/debora-license-admin.ts`

**Interfaces:**
- `ManualSaleInput`:

```ts
type ManualSaleInput={
  acquisitionChannel:'mercado_livre'|'direct_sale'|'shopee'|'gumroad'|'courtesy'|'partnership'|'other';
  paymentStatus:'paid'|'pending'|'unpaid'|'not_applicable';
  amountCents?:number|null;
  paidAt?:string|null;
  externalOrderRef?:string|null;
};
```

- Produces `grantManualDeboraLicenseWithSale(db,email,sale,actor,now)` → `{grant,sale}`.
- Existing owner route `POST /api/owner/debora-license` action `grant` now requires `sale` object.
- Actions `status` e `revoke` remain backward-compatible e não exigem `sale`.

- [ ] **Step 1: Escrever validação de payload comercial**

Em `debora-license-policy.test`/`debora-license-admin.test`, exigir:

```ts
expect(normalizeManualSaleInput({
  acquisitionChannel:'mercado_livre', paymentStatus:'paid', amountCents:8000,
  externalOrderRef:'MLB-123'
})).toMatchObject({acquisitionChannel:'mercado_livre',paymentStatus:'paid',amountCents:8000});
```

Regras:
- `amountCents` inteiro >=0 ou null;
- `paidAt` ISO válido ou null;
- `externalOrderRef` trim, máximo 160;
- `courtesy`/`partnership` permitem e recomendam `not_applicable`, mas não forçar mudança automática do valor escolhido;
- nenhum default silencioso para `paid`.

- [ ] **Step 2: Escrever teste de atomicidade e histórico**

Usar D1/fake transacional compatível para provar:
- grant com venda paga cria licença + 1 sale;
- renew cria segunda sale com novo `id` e preserva primeira;
- se statement de `manual_license_sales` viola CHECK, o batch falha e a expiração da licença não muda;
- revoke posterior não deleta sale rows.

- [ ] **Step 3: Rodar e confirmar falha**

```powershell
npx vitest run backend/manual-license-sales.test.ts backend/debora-license-admin.test.ts
```

Expected: FAIL por serviço/normalizador ausente.

- [ ] **Step 4: Implementar `grantManualDeboraLicenseWithSale`**

```ts
const prepared=await prepareManualDeboraLicenseGrant(db,email,actor,now);
const saleId=crypto.randomUUID();
const saleStatement=db.prepare(`INSERT INTO manual_license_sales(
  id,license_id,product_code,email,operation,acquisition_channel,payment_status,
  amount_cents,paid_at,external_order_ref,actor,created_at,updated_at
) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
  saleId,prepared.result.id,DEBORA_PRODUCT_CODE,prepared.result.email,prepared.action,
  sale.acquisitionChannel,sale.paymentStatus,sale.amountCents??null,sale.paidAt??null,
  sale.externalOrderRef||null,actor,now,now
);
await db.batch([...prepared.statements,saleStatement]);
```

Retornar a licença e a transação persistida.

- [ ] **Step 5: Atualizar `POST /api/owner/debora-license` apenas no branch `grant`**

```ts
if(action==='grant') {
  const sale=normalizeManualSaleInput(input.sale);
  const activated=await grantManualDeboraLicenseWithSale(db,email,sale,actor);
  return json({state:'active',activation:'cloudflare_d1',grant:activated.grant,sale:activated.sale});
}
```

`status` e `revoke` permanecem iguais.

- [ ] **Step 6: Rodar testes existentes + novos**

```powershell
npx vitest run backend/product-license-service.test.ts backend/debora-license-admin.test.ts backend/manual-license-sales.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add backend/manual-license-sales.ts backend/manual-license-sales.test.ts backend/debora-license-policy.ts backend/debora-license-admin.test.ts backend/debora-license-admin.ts
git commit -m "feat: record manual Debora sale with license activation"
```

---

### Task 4: Adicionar summary, listagem paginada e classificação de vendas manuais legadas

**Files:**
- Modify: `apps/web/backend/manual-license-sales.ts`
- Modify: `apps/web/backend/manual-license-sales.test.ts`
- Modify: `apps/web/backend/debora-license-admin.ts`
- Modify: `apps/web/backend/debora-license-admin.test.ts`

**Interfaces:**
- `GET /api/owner/debora-manual-sales/summary`
- `GET /api/owner/debora-manual-sales?limit=50&cursor=...&paymentStatus=...&channel=...&search=...`
- `POST /api/owner/debora-manual-sales/classify`
- Paginated response `{items,nextCursor,hasMore}`.

- [ ] **Step 1: Escrever testes de paginação e legado**

Casos:
- 3 sales com mesmo `created_at`, IDs diferentes; duas páginas sem duplicação;
- `limit=1000` vira 100;
- cursor adulterado → 400;
- filtros `paymentStatus`, `channel`, `search` usam binds;
- licença `pro_6m` antiga sem sale retorna status comercial `unknown` quando consultada/classificada;
- classificar legado cria `operation='legacy_classification'` sem alterar `product_licenses`.

- [ ] **Step 2: Implementar cursor manual**

Cursor base64url JSON:

```ts
{createdAt:string,id:string}
```

Ordenação e keyset:

```sql
ORDER BY created_at DESC,id DESC
```

```sql
AND (created_at < ? OR (created_at = ? AND id < ?))
```

Buscar `limit+1`.

- [ ] **Step 3: Implementar summary SQL**

Retorno:

```ts
{
  total:number,
  paid:number,
  pending:number,
  unpaid:number,
  notApplicable:number,
  realizedRevenueCents:number,
  byChannel:{mercado_livre:number,direct_sale:number,shopee:number,gumroad:number,courtesy:number,partnership:number,other:number}
}
```

`realizedRevenueCents` soma `amount_cents` somente quando `payment_status='paid'`.

- [ ] **Step 4: Implementar classificação legada explícita**

Input:

```ts
{email, acquisitionChannel, paymentStatus, amountCents?, paidAt?, externalOrderRef?}
```

Fluxo:
1. localizar licença manual existente por e-mail;
2. se não existir, 404;
3. se já houver ao menos uma transação `legacy_classification` para a mesma licença e mesma `external_order_ref` não vazia, 409 para evitar duplicação acidental;
4. inserir nova linha `legacy_classification`;
5. não alterar status, expiração ou source de `product_licenses`.

- [ ] **Step 5: Expor rotas secured em `createDeboraLicenseAdminRoutes`**

Todas usam o mesmo `secured` já aplicado à Central. Erros de cursor = 400; validação = 400.

- [ ] **Step 6: Rodar testes**

```powershell
npx vitest run backend/manual-license-sales.test.ts backend/debora-license-admin.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add backend/manual-license-sales.ts backend/manual-license-sales.test.ts backend/debora-license-admin.ts backend/debora-license-admin.test.ts
git commit -m "feat: expose paginated manual Debora sales"
```

---

### Task 5: Conectar a API de observabilidade da Débora por Service Binding

**Files:**
- Create: `apps/web/backend/debora-observability-admin.ts`
- Create: `apps/web/backend/debora-observability-admin.test.ts`
- Modify: `apps/web/backend/owner-companies.ts`
- Modify: `apps/web/cloudflare/sdk.ts`
- Modify: `apps/web/wrangler.jsonc`

**Interfaces:**
- New env bindings:

```ts
DEBORA_OBSERVABILITY?: {fetch(input:RequestInfo|URL,init?:RequestInit):Promise<Response>};
DEBORA_OBSERVABILITY_SECRET?: string;
```

- Owner routes:
  - `GET /api/owner/debora-observability/summary`
  - `GET /api/owner/debora-observability/users`
  - `GET /api/owner/debora-observability/sales`
  - `GET /api/owner/debora-observability/users/:id/sessions`

- [ ] **Step 1: Escrever teste do cliente server-to-server**

Fake binding deve capturar request e confirmar:

```ts
expect(request.headers.get('x-debora-observability-secret')).toBe('test-secret');
expect(new URL(request.url).pathname).toBe('/api/internal/observability/users');
expect(new URL(request.url).searchParams.get('cursor')).toBe('abc');
```

Cobrir ausência de binding/secret → 503 controlado e upstream 401/500 → 503 `{available:false,error:'debora_observability_unavailable'}`.

- [ ] **Step 2: Rodar e confirmar falha**

```powershell
npx vitest run backend/debora-observability-admin.test.ts
```

Expected: FAIL por módulo/rotas ausentes.

- [ ] **Step 3: Implementar helper de request interno**

```ts
async function deboraRequest(path:string, env:RuntimeEnv) {
  if(!env.DEBORA_OBSERVABILITY?.fetch || !env.DEBORA_OBSERVABILITY_SECRET) throw new Error('debora_observability_unavailable');
  const request=new Request(`https://debora-observability.internal${path}`,{
    headers:{'x-debora-observability-secret':env.DEBORA_OBSERVABILITY_SECRET,'accept':'application/json'}
  });
  const response=await env.DEBORA_OBSERVABILITY.fetch(request);
  if(!response.ok) throw new Error(`debora_observability_${response.status}`);
  return response.json();
}
```

Nunca expor o header ao browser.

- [ ] **Step 4: Criar rotas owner secured que preservam filtros/cursor**

As rotas devem copiar apenas query params reconhecidos para o upstream. Para sessions, `encodeURIComponent(ctx.params.id)`.

- [ ] **Step 5: Registrar as rotas em `owner-companies.ts`**

Importar e espalhar `createDeboraObservabilityAdminRoutes(secured)` ao lado de `createDeboraLicenseAdminRoutes(secured)`, sem mudar a ordem/semântica das rotas existentes.

- [ ] **Step 6: Adicionar binding e secret required ao Wrangler**

Em `services` preservar `LOJAONLINE_LICENSING` e acrescentar:

```json
{
  "binding": "DEBORA_OBSERVABILITY",
  "service": "consulroriaamamenta-o"
}
```

Em `secrets.required`, acrescentar `DEBORA_OBSERVABILITY_SECRET`; não definir valor.

- [ ] **Step 7: Rodar testes de backend e segurança existente**

```powershell
npx vitest run backend/debora-observability-admin.test.ts backend/debora-license-admin.test.ts backend/p1-security.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add backend/debora-observability-admin.ts backend/debora-observability-admin.test.ts backend/owner-companies.ts cloudflare/sdk.ts wrangler.jsonc
git commit -m "feat: proxy Debora observability into Central"
```

---

### Task 6: Enriquecer usuários remotos com licença/manual local e criar summary consolidado

**Files:**
- Modify: `apps/web/backend/debora-observability-admin.ts`
- Modify: `apps/web/backend/debora-observability-admin.test.ts`

**Interfaces:**
- `/api/owner/debora-observability/users` mantém cursor remoto, mas cada item ganha `effectiveLicense` e `manualSale` locais.
- `/api/owner/debora-observability/summary` combina contas/atividade/billing remoto com licenciamento e vendas manuais locais.

- [ ] **Step 1: Escrever teste de enriquecimento por página, não por carteira inteira**

Fake upstream retorna 2 usuários. Instrumentar fake DB e garantir que a query local de licenças usa apenas os dois e-mails da página (máximo 100), nunca `SELECT` de todos os `product_accounts`.

Resultado esperado por item:

```ts
{
  ...remoteUser,
  effectiveLicense:{planCode,status,source,expiresAt}|null,
  manualSale:{acquisitionChannel,paymentStatus,amountCents,externalOrderRef,createdAt}|null
}
```

Se houver licença manual ativa, ela deve aparecer como `effectiveLicense` mesmo que o remoto reporte freemium/sem subscription.

- [ ] **Step 2: Escrever teste de summary consolidado**

Remote summary:
- accounts.total = 20;
- Asaas paid = 5;
- realizedRevenueCents = 49950.

Local:
- 3 e-mails com Pro manual ativo;
- 2 manual sales paid somando 16000;
- 1 cortesia.

Esperar:

```ts
{
  accounts:{total:20,...},
  pro:{total:8, monthly:/* local synced/effective */, annual:/* local synced/effective */, manual6m:3},
  sales:{paid:7, automaticPaid:5, manualPaid:2, realizedRevenueCents:65950},
  manual:{paid:2,...}
}
```

A contagem Pro deve vir do D1 central `product_licenses` usando e-mail efetivo único, não `automatic + manual` cegamente.

- [ ] **Step 3: Implementar query local de licença efetiva por e-mails da página**

Usar placeholders bindados e CTE/window function para escolher no máximo uma licença ativa por e-mail:

```sql
WITH ranked AS (
  SELECT email,plan_code,status,expires_at,source,updated_at,
    ROW_NUMBER() OVER (
      PARTITION BY lower(email)
      ORDER BY CASE WHEN expires_at IS NULL THEN 1 ELSE 0 END DESC,
               expires_at DESC, updated_at DESC
    ) AS rn
  FROM product_licenses
  WHERE product_code=?
    AND lower(email) IN (...)
    AND status IN ('active','trialing')
    AND (expires_at IS NULL OR expires_at>?)
)
SELECT email,plan_code,status,expires_at,source FROM ranked WHERE rn=1;
```

Buscar também a transação manual mais recente apenas para os e-mails da página.

- [ ] **Step 4: Implementar summary local com SQL agregado**

Usar CTE equivalente para uma licença efetiva por e-mail, depois `SUM(CASE...)` por `plan_code`. Para vendas manuais, `COUNT/SUM` em `manual_license_sales`. Não materializar todos os rows no JS.

Calcular:

```ts
freemium = Math.max(0, remote.accounts.total - localEffectiveProTotal)
```

`Pro total` é o total efetivo local porque o fluxo Asaas já sincroniza licença comercial para a Central; isso evita dupla contagem manual+Asaas.

- [ ] **Step 5: Rodar testes**

```powershell
npx vitest run backend/debora-observability-admin.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add backend/debora-observability-admin.ts backend/debora-observability-admin.test.ts
git commit -m "feat: consolidate Debora licenses with usage data"
```

---

### Task 7: Consolidar vendas Asaas + manuais com cursor global determinístico

**Files:**
- Modify: `apps/web/backend/debora-observability-admin.ts`
- Modify: `apps/web/backend/debora-observability-admin.test.ts`
- Coordinated contract dependency: Debora repo Task 5 must accept the merge-boundary query described below.

**Interfaces:**
- `GET /api/owner/debora-observability/sales?limit=50&cursor=...`
- Returns one list sorted by `(createdAt DESC, sourceRank DESC, id DESC)`.
- Source ranks: `asaas=1`, `manual=0`.
- Central cursor is base64url JSON `{createdAt,sourceRank,id}`.

- [ ] **Step 1: Escrever teste com timestamps empatados entre fontes**

Seed/fake:

```text
2026-09-25T12:00:00Z asaas A2
2026-09-25T12:00:00Z asaas A1
2026-09-25T12:00:00Z manual M2
2026-09-25T12:00:00Z manual M1
2026-09-25T11:00:00Z asaas A0
```

Com `limit=2`, percorrer 3 páginas e exigir `[A2,A1,M2,M1,A0]` exatamente uma vez.

- [ ] **Step 2: Definir o boundary enviado ao upstream Débora**

Ao receber cursor global, chamar `/api/internal/observability/sales` com:

```text
mergeCreatedAt=<cursor.createdAt>
mergeSourceRank=<cursor.sourceRank>
mergeId=<cursor.id>
```

Contrato coordenado no repo Débora: a query Asaas (`sourceRank=1`) aplica:

```text
created_at < cursor.createdAt
OR (
  created_at = cursor.createdAt AND
  (1 < cursor.sourceRank OR (1 = cursor.sourceRank AND id < cursor.id))
)
```

A query manual local (`sourceRank=0`) aplica a mesma expressão trocando `1` por `0`.

Sem cursor, ambas buscam do topo. Cada fonte retorna até `limit+1`. Isso preserva empate sem OFFSET e sem buffers no cursor.

- [ ] **Step 3: Implementar query manual local com o mesmo boundary**

Mapear item manual:

```ts
{
  id,
  source:'manual',
  sourceRank:0,
  email,
  planCode:'pro_6m',
  status:payment_status,
  amountCents:amount_cents,
  acquisitionChannel,
  externalOrderRef,
  createdAt
}
```

Mapear upstream Asaas com `source:'asaas'`, `sourceRank:1`.

- [ ] **Step 4: Mesclar, ordenar e paginar**

```ts
const merged=[...automatic,...manual].sort(compareGlobalSaleKey);
const visible=merged.slice(0,limit);
const hasMore=merged.length>limit;
const last=visible.at(-1);
const nextCursor=hasMore && last ? encodeGlobalCursor(last) : null;
```

O comparador deve ser unit-tested e não depender de locale.

- [ ] **Step 5: Rodar testes**

```powershell
npx vitest run backend/debora-observability-admin.test.ts
```

Expected: PASS com empates e paginação estável.

- [ ] **Step 6: Commit**

```powershell
git add backend/debora-observability-admin.ts backend/debora-observability-admin.test.ts
git commit -m "feat: merge automatic and manual Debora sales"
```

---

### Task 8: Criar módulo de UI paginada para observabilidade da Débora

**Files:**
- Create: `apps/web/src/owner-debora-observability.ts`
- Create: `apps/web/src/owner-debora-observability.test.ts`
- Modify: `apps/web/src/owner.css`

**Interfaces:**
- Produces `deboraObservabilitySection()` HTML mount.
- Produces `bindDeboraObservability(api)`; fetches summary/users/sales and binds filters/pagination.
- Does not own manual grant/revoke controls; those remain in `owner.ts`.

- [ ] **Step 1: Escrever testes de renderização e estados**

Testar:
- cards `Online agora`, `Contas totais`, `Freemium`, `Pro ativos`, `Vendas pagas`, `Receita realizada`;
- tabela de usuários com `Plano`, `Origem`, `Pagamento`, `Online`, `Último acesso`, `Conta criada`;
- tabela de vendas com canal/plano/valor/status/referência;
- loading;
- 503 → texto `Atividade indisponível temporariamente` sem esconder informação de licença existente passada externamente;
- botão próxima página usa `nextCursor` e mantém filtros.

- [ ] **Step 2: Rodar e confirmar falha**

```powershell
npx vitest run src/owner-debora-observability.test.ts
```

Expected: FAIL por módulo ausente.

- [ ] **Step 3: Implementar módulo com tipos explícitos**

Tipos mínimos:

```ts
type DeboraSummary={
  accounts:{total:number;createdToday:number;created7d:number;created30d:number};
  presence:{onlineNow:number;activeToday:number;active7d:number;active30d:number};
  usage:{sessionsToday:number;activeSecondsToday:number;activeSeconds7d:number;activeSeconds30d:number};
  pro:{total:number;monthly:number;annual:number;manual6m:number};
  sales:{paid:number;automaticPaid:number;manualPaid:number;realizedRevenueCents:number};
};
```

Manter estado de cursor por tabela e filtros; ao alterar filtro, zerar cursor e recarregar primeira página.

- [ ] **Step 4: Renderizar sessão de atividade por usuário sob demanda**

Ao clicar `Ver atividade`, chamar:

```text
/api/owner/debora-observability/users/:id/sessions?limit=25
```

Mostrar `Hoje`, `7 dias`, `30 dias` a partir dos agregados do user row e histórico paginado de sessões. Não calcular tempo percorrendo todos os heartbeats.

- [ ] **Step 5: Adicionar CSS exclusivamente namespaced**

Novas classes começam com `.owner-debora-observability-` ou `.owner-debora-table-`; não alterar regras globais existentes salvo necessidade comprovada por teste.

- [ ] **Step 6: Rodar testes**

```powershell
npx vitest run src/owner-debora-observability.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/owner-debora-observability.ts src/owner-debora-observability.test.ts src/owner.css
git commit -m "feat: add Debora observability dashboard module"
```

---

### Task 9: Integrar UI no `owner.ts` e enriquecer formulário manual sem remover controles atuais

**Files:**
- Modify: `apps/web/src/owner.ts`
- Modify: `apps/web/src/owner-navigation.test.ts`
- Modify: `apps/web/src/owner.css` only if integration requires a local adjustment not covered in Task 8.

**Preflight obrigatório:** Antes de editar `owner.ts`, executar:

```powershell
git fetch origin main
git diff --name-status HEAD..origin/main -- apps/web/src/owner.ts apps/web/src/owner.css
```

Se `origin/main` modificou esses arquivos depois do baseline da branch, integrar a nova `main` em uma etapa de reconciliação explícita antes de aplicar a alteração; não substituir `owner.ts` por uma cópia do baseline.

**Interfaces:**
- `deboraView()` ganha o mount de observabilidade.
- `bindCurrentView()`/equivalente chama `bindDeboraObservability(api)` quando view=`debora`.
- Form manual envia `sale` no grant; status/revoke continuam enviando somente ação/e-mail.

- [ ] **Step 1: Estender testes antes da UI**

Em `owner-navigation.test.ts`, após abrir `debora` exigir que continuem existindo:

```ts
expect(document.getElementById('deboraLicenseForm')).not.toBeNull();
expect(document.getElementById('deboraLicenseStatus')).not.toBeNull();
expect(document.getElementById('deboraLicenseRevoke')).not.toBeNull();
expect(document.querySelector('[data-debora-observability-root]')).not.toBeNull();
```

E exigir campos:

```text
acquisitionChannel
paymentStatus
amount
externalOrderRef
```

- [ ] **Step 2: Rodar e confirmar falha**

```powershell
npx vitest run src/owner-navigation.test.ts src/owner-debora-observability.test.ts
```

Expected: novos asserts FAIL.

- [ ] **Step 3: Inserir mount sem remover métricas/licença atuais**

`deboraView()` deve manter banner, carteira atual e `${deboraLicenseCard()}` e acrescentar `${deboraObservabilitySection()}`. Não mover ações de licença para o novo módulo nesta entrega.

- [ ] **Step 4: Enriquecer `deboraLicenseCard()`**

Adicionar ao formulário:

```html
<select name="acquisitionChannel" required>
  <option value="mercado_livre">Mercado Livre</option>
  <option value="direct_sale">Venda direta</option>
  <option value="shopee">Shopee</option>
  <option value="gumroad">Gumroad</option>
  <option value="courtesy">Cortesia</option>
  <option value="partnership">Parceria</option>
  <option value="other">Outro</option>
</select>
<select name="paymentStatus" required>
  <option value="paid">Pago</option>
  <option value="pending">Pendente</option>
  <option value="unpaid">Não pago</option>
  <option value="not_applicable">Não se aplica</option>
</select>
<input name="amount" inputmode="decimal" placeholder="0,00">
<input name="externalOrderRef" maxlength="160">
```

Não pré-preencher `paid` com base em licença antiga. O default visual para nova operação pode ser `mercado_livre`/`paid` somente como escolha explícita no formulário, mas status de registros legados continua `unknown` no backend.

- [ ] **Step 5: Alterar somente o payload de `grant` em `bindDeboraLicense()`**

Converter `amount` em centavos de forma determinística e enviar:

```ts
{
  action:'grant',
  email:email(),
  sale:{acquisitionChannel,paymentStatus,amountCents,externalOrderRef}
}
```

Para `status` e `revoke`, manter `{action,email}`.

Após grant/renew bem-sucedido, atualizar `refreshDeboraOverview`, `refreshLicenseHistory` e o módulo de observabilidade; falha desse refresh não deve converter grant bem-sucedido em erro de licença.

- [ ] **Step 6: Integrar bind do novo módulo**

Importar:

```ts
import { bindDeboraObservability, deboraObservabilitySection } from './owner-debora-observability';
```

Na view Débora, ligar o módulo após render.

- [ ] **Step 7: Rodar testes UI**

```powershell
npx vitest run src/owner-navigation.test.ts src/owner-debora-observability.test.ts
```

Expected: PASS e controles antigos ainda presentes.

- [ ] **Step 8: Commit**

```powershell
git add src/owner.ts src/owner-navigation.test.ts src/owner.css
git commit -m "feat: integrate Debora activity and manual sale controls"
```

Se `owner.css` não tiver mudado nesta task, removê-lo do `git add`.

---

### Task 10: QA transacional, regressões e degradação segura

**Files:**
- Modify: `apps/web/scripts/qa-owner-transactional.mjs`
- Create: `apps/web/src/debora-observability-resilience.test.ts`

**Interfaces:**
- QA mocka novos endpoints e confirma fluxos owner em browser.
- Resilience test garante que erro de observabilidade não altera rotas de licença.

- [ ] **Step 1: Adicionar cenários ao QA owner**

Mocks obrigatórios:
- summary disponível;
- users duas páginas;
- sales duas páginas misturando Asaas/manual;
- sessions;
- 503 de observabilidade.

Fluxos obrigatórios:
1. abrir Débora e ver métricas;
2. avançar users/sales;
3. abrir atividade de usuário;
4. preencher Mercado Livre/Pago/R$80/ref e liberar;
5. consultar licença;
6. revogar;
7. repetir view com observabilidade 503 e confirmar que form/status/revoke continuam operacionais.

- [ ] **Step 2: Escrever teste unitário de resiliência**

Com binding que lança erro, `GET /api/owner/debora-observability/summary` retorna 503, enquanto `POST /api/owner/debora-license` com DB válido continua respondendo pelo fluxo normal.

- [ ] **Step 3: Rodar testes focados**

```powershell
npx vitest run backend/product-license-service.test.ts backend/debora-license-admin.test.ts backend/manual-license-sales.test.ts backend/debora-observability-admin.test.ts src/owner-debora-observability.test.ts src/owner-navigation.test.ts src/debora-observability-resilience.test.ts
```

Expected: PASS.

- [ ] **Step 4: Rodar QA owner e suíte completa**

```powershell
npm run qa:owner:transactional
npm test
npm run build
```

Expected: PASS. Não executar `worker:deploy` nem `d1:migrate:remote` nesta etapa.

- [ ] **Step 5: Commit**

```powershell
git add scripts/qa-owner-transactional.mjs src/debora-observability-resilience.test.ts
git commit -m "test: cover Debora observability owner flows"
```

---

### Task 11: Evidência cross-repo e comparação segura com a main mais recente

**Files:**
- Create: `docs/qa/2026-09-25-debora-observability-central-evidence.md`

**Interfaces:**
- Produces evidence and conflict report only. No automatic merge to main.

- [ ] **Step 1: Confirmar SHA/contrato da branch irmã Débora**

Registrar no documento o SHA testado da branch `feat/debora-usage-observability` e exemplos sanitizados dos quatro endpoints internos. Não usar produção nem secrets reais.

- [ ] **Step 2: Executar QA cross-system local**

Usar fake/service binding local ou dois runtimes locais para provar:
- usuário remoto + licença manual local são correlacionados por e-mail;
- manual pago entra em vendas/receita;
- cortesia não entra em receita;
- Asaas+manual empatados paginam sem duplicação;
- telemetria 503 não bloqueia licenciamento.

Registrar comandos/resultados reais no documento.

- [ ] **Step 3: Comparar branch com `origin/main` sem sobrescrever mudanças**

```powershell
git fetch origin main
git log --oneline HEAD..origin/main
git diff --name-status origin/main...HEAD
```

Além disso, comparar explicitamente os arquivos de alto risco:

```powershell
git diff origin/main...HEAD -- apps/web/src/owner.ts apps/web/src/owner.css apps/web/backend/debora-license-admin.ts apps/web/backend/product-license-service.ts apps/web/backend/license-center-readonly-internal.ts apps/web/cloudflare/worker.ts
```

Registrar no evidence doc qualquer arquivo alterado dos dois lados. `license-center-readonly-internal.ts` deve permanecer sem mudanças desta feature salvo reconciliação explicitamente justificada.

- [ ] **Step 4: Se a main avançou, fazer ensaio de reconciliação na própria feature branch apenas após revisão dos diffs**

Não usar `git checkout --theirs/--ours` indiscriminadamente. Aplicar conflitos arquivo por arquivo preservando:
- todo comportamento novo da main;
- toda cobertura de licenciamento existente;
- apenas os pontos aditivos desta feature.

Após reconciliação, repetir Task 10 inteira.

- [ ] **Step 5: Commit da evidência**

```powershell
git add docs/qa/2026-09-25-debora-observability-central-evidence.md
git commit -m "docs: record Central Debora observability QA evidence"
```

- [ ] **Step 6: Gate final da branch**

```powershell
git status --short
git log --oneline --decorate -12
```

Expected: working tree limpa, feature isolada em `feat/debora-usage-observability-central`, sem merge/deploy para `main` ainda.
