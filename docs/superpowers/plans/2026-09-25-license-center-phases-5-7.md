# Central de Licenças — Fases 5 a 7 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar a nova Central de Licenças do `MercadoLivre` em interface administrativa real até a fase 7, reutilizando as autoridades atuais, comprovando paridade por E2E isolado/live e impedindo que futuras capacidades administrativas fiquem silenciosamente ausentes do Painel Geral.

**Architecture:** `artisys-mercadolivre` permanece somente como interface/orquestrador autenticado e chama `obra-na-mao-comercial` por Service Binding. O Obra continua sendo a autoridade para Obra/Débora e orquestra a Loja Online. Escrita usa segredo separado, feature flag e guarda QA server-side. A paridade futura é governada por registro canônico de capacidades, scanner de rotas `/api/owner/*`, handshake de capacidades no snapshot e gate live cross-repo.

**Tech Stack:** Cloudflare Workers, Service Bindings, D1, TypeScript/Vitest/Vite no Obra, Node 22 `node:test` no MercadoLivre, Playwright para E2E, Wrangler 4.

**Spec:** `docs/superpowers/specs/2026-09-25-license-center-phases-5-7-design.md`

## Global Constraints

- Nenhum cliente, licença, usuário, dispositivo ou loja preexistente pode ser alterado por testes automatizados.
- E2E live só escreve em registros sintéticos criados pelo próprio `qaRunId`.
- `OBRANAMAOCOMERCIAL` continua sendo autoridade; `MercadoLivre` não acessa D1 de licenciamento diretamente.
- Nenhum novo D1, nenhuma migração de schema e nenhum DELETE físico para QA.
- Central antiga `artisys.dev/sistema#owner` permanece disponível durante toda a fase 7.
- Fase 8 e reorganização de URLs `artisys.dev` ficam fora do escopo.
- Escrita exige `LICENSE_CENTER_WRITE_SECRET`/`OBRA_LICENSE_CENTER_WRITE_SECRET` e `LICENSE_CENTER_WRITE_ENABLED=true`.
- Toda mutação bem-sucedida deve ser seguida por nova leitura; 2xx isolado não comprova sucesso.
- Toda nova rota administrativa `/api/owner/*` deve ser classificada e toda capacidade obrigatória do Painel Geral deve ter suporte explícito ou exclusão justificada.

## Review Focus

1. **QA tentando atingir ID preexistente:** deve falhar com `403 qa_scope_violation`; coberto nas Tasks 3 e 8.
2. **Segredo de leitura usado para escrever ou segredo ausente:** deve falhar antes de qualquer efeito colateral; coberto na Task 3.
3. **Nova rota `/api/owner/*` não registrada/classificada:** CI deve falhar com rota exata; coberto na Task 1.
4. **Autoridade anuncia capability obrigatória que o Painel Geral não suporta:** UI/gate live devem sinalizar `ADMIN_PARITY_FAILURE`; coberto nas Tasks 4, 5 e 9.
5. **Write retorna sucesso mas estado não persistiu/auditoria não apareceu:** E2E deve falhar na releitura independente; coberto nas Tasks 7 e 8.

---

### Task 1: Criar o registro canônico e o scanner de paridade administrativa

**Files:**
- Create: `apps/web/qa/admin-parity-capabilities.json`
- Create: `apps/web/scripts/verify-admin-parity.mjs`
- Create: `apps/web/src/admin-parity-contract.test.ts`
- Modify: `apps/web/qa/ui-capability-matrix.json`
- Modify: `apps/web/qa/business-capabilities.json`
- Modify: `apps/web/package.json`

**Interfaces:**
- Consumes: rotas literais `METHOD /api/owner/...` presentes em `apps/web/backend/**/*.ts` e `backend`/`profiles`/`surface` de `qa/ui-capability-matrix.json`.
- Produces: `admin-parity-capabilities.json` com `contractVersion:number` e `capabilities[]`; script `verify-admin-parity.mjs` que retorna exit code 1 em rota não classificada ou exclusão sem motivo.

- [ ] **Step 1: Write the failing contract test**

Criar `apps/web/src/admin-parity-contract.test.ts` com teste que importa os dois JSONs, lê recursivamente `backend/**/*.ts`, extrai rotas com regex e exige classificação:

```ts
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(__dirname,'..');
const parity=JSON.parse(fs.readFileSync(path.join(root,'qa/admin-parity-capabilities.json'),'utf8'));
const ui=JSON.parse(fs.readFileSync(path.join(root,'qa/ui-capability-matrix.json'),'utf8'));

function files(dir:string):string[]{return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)])}
function ownerRoutes(){
  const routes=new Set<string>();
  for(const file of files(path.join(root,'backend')).filter(f=>f.endsWith('.ts'))){
    const text=fs.readFileSync(file,'utf8');
    for(const match of text.matchAll(/['"](GET|POST|PUT|PATCH|DELETE) (\/api\/owner\/[^'"]+)['"]/g)) routes.add(`${match[1]} ${match[2]}`);
  }
  return [...routes].sort();
}

it('classifies every owner admin route and requires explicit general-panel parity',()=>{
  const uiRoutes=new Set(ui.entries.flatMap((entry:any)=>entry.backend||[]));
  const registryRoutes=new Set(parity.capabilities.flatMap((entry:any)=>entry.authorityRoutes||[]));
  for(const route of ownerRoutes()) expect(uiRoutes.has(route)||registryRoutes.has(route),`unclassified owner route: ${route}`).toBe(true);
  for(const entry of parity.capabilities){
    if(entry.generalPanelRequired===false) expect(String(entry.reason||'').trim().length).toBeGreaterThan(0);
    if(entry.generalPanelRequired===true) expect(String(entry.generalPanelCapability||'').trim().length).toBeGreaterThan(0);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd apps/web
npx vitest run src/admin-parity-contract.test.ts
```

Expected: FAIL because `qa/admin-parity-capabilities.json` does not exist.

- [ ] **Step 3: Add the initial canonical registry**

Criar `apps/web/qa/admin-parity-capabilities.json` com capability IDs estáveis e rotas reais da Central comercial:

```json
{
  "schemaVersion": 1,
  "contractVersion": 1,
  "capabilities": [
    {"id":"obra.company.read","authorityRoutes":["GET /api/owner/companies","GET /api/owner/companies/:id"],"legacySurface":"Central Artisys / Clientes","generalPanelRequired":true,"generalPanelCapability":"obra.company.read","e2e":["qa-license-center-isolated","qa-license-center-live"],"status":"active"},
    {"id":"obra.company.create","authorityRoutes":["POST /api/owner/companies"],"legacySurface":"Central Artisys / Clientes","generalPanelRequired":true,"generalPanelCapability":"obra.company.create","e2e":["qa-license-center-isolated","qa-license-center-live"],"status":"active"},
    {"id":"obra.company.update-license","authorityRoutes":["PUT /api/owner/companies/:id"],"legacySurface":"Central Artisys / Cliente / Licença","generalPanelRequired":true,"generalPanelCapability":"obra.company.update-license","e2e":["qa-license-center-isolated","qa-license-center-live"],"status":"active"},
    {"id":"obra.device.control","authorityRoutes":["GET /api/owner/devices","PUT /api/owner/devices/:id"],"legacySurface":"Central Artisys / Cliente / Computadores","generalPanelRequired":true,"generalPanelCapability":"obra.device.control","e2e":["qa-license-center-isolated"],"status":"active"},
    {"id":"debora.license.manage","authorityRoutes":["GET /api/owner/debora-overview","POST /api/owner/debora-license"],"legacySurface":"Central Artisys / Débora Lactação","generalPanelRequired":true,"generalPanelCapability":"debora.license.manage","e2e":["qa-license-center-isolated","qa-license-center-live"],"status":"active"},
    {"id":"owner.license.audit","authorityRoutes":["GET /api/owner/license-audit"],"legacySurface":"Central Artisys / Licenças e auditoria","generalPanelRequired":true,"generalPanelCapability":"owner.license.audit","e2e":["qa-license-center-isolated","qa-license-center-live"],"status":"active"},
    {"id":"loja-online.company.read","authorityRoutes":["GET /api/owner/loja-online/overview","GET /api/owner/loja-online/companies","GET /api/owner/loja-online/companies/:id","GET /api/owner/loja-online/license-audit"],"legacySurface":"Central Artisys / Loja Online","generalPanelRequired":true,"generalPanelCapability":"loja-online.company.read","e2e":["qa-license-center-isolated","qa-license-center-live"],"status":"active"},
    {"id":"loja-online.company.create","authorityRoutes":["POST /api/owner/loja-online/companies"],"legacySurface":"Central Artisys / Loja Online","generalPanelRequired":true,"generalPanelCapability":"loja-online.company.create","e2e":["qa-license-center-isolated","qa-license-center-live"],"status":"active"},
    {"id":"loja-online.license.update","authorityRoutes":["PUT /api/owner/loja-online/companies/:id/license"],"legacySurface":"Central Artisys / Loja Online","generalPanelRequired":true,"generalPanelCapability":"loja-online.license.update","e2e":["qa-license-center-isolated","qa-license-center-live"],"status":"active"},
    {"id":"loja-online.license.extend","authorityRoutes":["POST /api/owner/loja-online/companies/:id/extend"],"legacySurface":"Central Artisys / Loja Online","generalPanelRequired":true,"generalPanelCapability":"loja-online.license.extend","e2e":["qa-license-center-isolated","qa-license-center-live"],"status":"active"},
    {"id":"loja-online.license.block","authorityRoutes":["POST /api/owner/loja-online/companies/:id/block","POST /api/owner/loja-online/companies/:id/unblock"],"legacySurface":"Central Artisys / Loja Online","generalPanelRequired":true,"generalPanelCapability":"loja-online.license.block","e2e":["qa-license-center-isolated","qa-license-center-live"],"status":"active"}
  ]
}
```

Para qualquer outra rota `/api/owner/*` atualmente encontrada pelo scanner e que pertença a outra área administrativa fora desta Central, adicionar entrada explícita com `generalPanelRequired:false` e `reason` específico; não usar um wildcard.

- [ ] **Step 4: Implement the verifier**

Criar `apps/web/scripts/verify-admin-parity.mjs` com a mesma descoberta recursiva do teste, mensagens legíveis e exit code 1:

```js
if (missing.length) {
  console.error('ADMIN_PARITY_UNCLASSIFIED_ROUTES');
  for (const route of missing) console.error(`- ${route}`);
  process.exit(1);
}
console.log(`ADMIN_PARITY_OK contractVersion=${parity.contractVersion} routes=${ownerRoutes.length}`);
```

- [ ] **Step 5: Wire existing QA governance**

Adicionar entradas `admin-parity-contract` em `ui-capability-matrix.json` e `business-capabilities.json`, apontando para `qa:admin-parity`, e no `package.json`:

```json
"qa:admin-parity": "node scripts/verify-admin-parity.mjs"
```

- [ ] **Step 6: Run tests**

Run:

```bash
npm run qa:admin-parity
npx vitest run src/admin-parity-contract.test.ts
```

Expected: PASS, incluindo `ADMIN_PARITY_OK`.

- [ ] **Step 7: Commit**

```bash
git add apps/web/qa apps/web/scripts/verify-admin-parity.mjs apps/web/src/admin-parity-contract.test.ts apps/web/package.json
git commit -m "test: enforce admin parity capability registry"
```

---

### Task 2: Extrair operações compartilhadas de Obra sem mudar a Central antiga

**Files:**
- Create: `apps/web/backend/owner-company-service.ts`
- Create: `apps/web/backend/owner-company-service.test.ts`
- Modify: `apps/web/backend/owner-companies.ts`
- Modify: `apps/web/backend/index.ts`

**Interfaces:**
- Produces: `createManagedCompany(input, actor)`, `updateManagedCompany(companyId,input,actor)`, `setManagedDeviceStatus(deviceId,status)`; retornos equivalentes às rotas antigas.
- Consumes: `createLicense`, `mutateLicense`, `db`, `runtimeEnv` existentes.

- [ ] **Step 1: Write failing service tests**

Testar criação por e-mail, conflito de e-mail, atualização de limites/status e revogação de dispositivo sem alterar licença. Exemplo:

```ts
it('updates license status through the same domain service used by owner routes',async()=>{
  const result=await updateManagedCompany('company-1',{status:'suspended'},{userId:'owner',email:'owner@test'});
  expect(result.license.status).toBe('revoked');
});
```

- [ ] **Step 2: Run the tests and confirm failure**

```bash
npx vitest run backend/owner-company-service.test.ts
```

Expected: FAIL because exports do not exist.

- [ ] **Step 3: Move existing route logic into service functions**

`owner-company-service.ts` must preserve existing validation, `limit()` behavior, duplicate checks, audit source/actor, and `companyViews` semantics. `owner-companies.ts` becomes a thin HTTP adapter calling those functions.

- [ ] **Step 4: Reuse device service from `backend/index.ts`**

Move only the `PUT /api/owner/devices/:id` mutation logic into `setManagedDeviceStatus`; keep the route signature unchanged.

- [ ] **Step 5: Run legacy and new tests**

```bash
npx vitest run backend/owner-company-service.test.ts src/owner-navigation.test.ts backend/p0-flows.test.ts
```

Expected: PASS; old UI contracts unchanged.

- [ ] **Step 6: Commit**

```bash
git add apps/web/backend/owner-company-service.ts apps/web/backend/owner-company-service.test.ts apps/web/backend/owner-companies.ts apps/web/backend/index.ts
git commit -m "refactor: share owner license operations"
```

---

### Task 3: Adicionar gateway interno de escrita, segredo, feature flag e guarda QA

**Files:**
- Create: `apps/web/backend/license-center-admin-internal.ts`
- Create: `apps/web/backend/license-center-admin-internal.test.ts`
- Modify: `apps/web/cloudflare/worker.ts`
- Modify: `apps/web/wrangler.jsonc`
- Modify: `apps/web/.dev.vars.example`

**Interfaces:**
- Consumes: funções da Task 2, `grantManualDeboraLicense`, `getManualDeboraLicense`, `revokeManualDeboraLicense`, `resolveProductAccess`, `lojaOnlineRequest`.
- Produces: handlers allowlisted em `/api/internal/license-center/{obra,debora,loja-online}/...`.

- [ ] **Step 1: Write failing auth/flag/QA guard tests**

Casos obrigatórios:

```ts
it('rejects read secret on write', async()=>{ /* expect 401 and zero service calls */ });
it('rejects writes when feature flag is disabled', async()=>{ /* expect 503 write_disabled */ });
it('rejects qa mutation against preexisting target', async()=>{ /* expect 403 qa_scope_violation */ });
it('accepts qa mutation only when persisted identity matches qaRunId', async()=>{ /* expect service call */ });
```

- [ ] **Step 2: Run test and verify failure**

```bash
npx vitest run backend/license-center-admin-internal.test.ts
```

- [ ] **Step 3: Implement common write gate**

Core helpers:

```ts
async function requireWriteAccess(request:Request,env:Env){
  if(String(env.LICENSE_CENTER_WRITE_ENABLED||'').toLowerCase()!=='true') return json(503,{error:'write_disabled'});
  if(!await sameSecret(request.headers.get('x-artisys-license-center-write-secret')||'',String(env.LICENSE_CENTER_WRITE_SECRET||''))) return json(401,{error:'unauthorized'});
  return null;
}
```

Do not accept `LICENSE_CENTER_READ_SECRET` on mutating routes.

- [ ] **Step 4: Implement server-side QA scope checks**

Provide product-specific guards that load persisted records before mutation and validate exact `qaRunId`. On mismatch return:

```json
{"error":"qa_scope_violation"}
```

For creation with `X-Artisys-QA-Run`, derive/validate the expected QA name/email before creation; for later mutations, validate persisted canonical values.

- [ ] **Step 5: Implement allowlisted routes**

Implement only the routes defined in the spec and return `405` for wrong methods. Loja Online must delegate through `lojaOnlineRequest`, not direct DB access.

- [ ] **Step 6: Register handler in Worker and config examples**

Add import/dispatch in `apps/web/cloudflare/worker.ts`; add `LICENSE_CENTER_WRITE_ENABLED="false"` to non-secret vars/example only. `LICENSE_CENTER_WRITE_SECRET` remains Wrangler secret, not plaintext config.

- [ ] **Step 7: Run security suite**

```bash
npx vitest run backend/license-center-admin-internal.test.ts backend/license-center-readonly-internal.test.ts backend/p1-security.test.ts backend/loja-online-admin.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/backend/license-center-admin-internal.ts apps/web/backend/license-center-admin-internal.test.ts apps/web/cloudflare/worker.ts apps/web/wrangler.jsonc apps/web/.dev.vars.example
git commit -m "feat: add guarded license center write gateway"
```

---

### Task 4: Expor handshake de capacidades no snapshot da autoridade

**Files:**
- Modify: `apps/web/backend/license-center-readonly-internal.ts`
- Modify: `apps/web/backend/license-center-readonly-internal.test.ts`
- Read: `apps/web/qa/admin-parity-capabilities.json`

**Interfaces:**
- Produces: `adminParity:{contractVersion,requiredCapabilities}` dentro do snapshot.

- [ ] **Step 1: Add failing snapshot test**

```ts
expect(payload.adminParity).toEqual({
  contractVersion:1,
  requiredCapabilities:expect.arrayContaining(['obra.company.create','debora.license.manage','loja-online.license.update'])
});
```

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run backend/license-center-readonly-internal.test.ts
```

- [ ] **Step 3: Implement registry-to-snapshot projection**

Read/build a typed constant from the JSON at bundle time or mirror it through a small TS module generated from the JSON. Only entries with `generalPanelRequired:true` and `status:'active'` go into `requiredCapabilities`.

- [ ] **Step 4: Run tests and parity verifier**

```bash
npm run qa:admin-parity
npx vitest run backend/license-center-readonly-internal.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/backend/license-center-readonly-internal.ts apps/web/backend/license-center-readonly-internal.test.ts apps/web/qa/admin-parity-capabilities.json
git commit -m "feat: publish admin capability contract"
```

---

### Task 5: Implementar proxy de escrita e suporte explícito de capabilities no MercadoLivre

**Files:**
- Create: `cloudflare/src/license-center-capabilities.mjs`
- Modify: `cloudflare/src/license-center.mjs`
- Modify: `cloudflare/src/general-panel-index.mjs`
- Modify: `cloudflare/.dev.vars.example`
- Modify: `package.json`
- Create: `test/license-center-write.test.mjs`
- Create: `test/admin-parity.test.mjs`

**Interfaces:**
- Produces: `SUPPORTED_LICENSE_CENTER_CAPABILITIES`, `proxyLicenseCenterWrite(request,env,targetPath)`, API allowlisted `/api/license-center/...`, parity `{status,missing}`.

- [ ] **Step 1: Write failing proxy tests**

```js
test('write proxy uses write secret and preserves qa header server-side',async()=>{
  const response=await proxyLicenseCenterWrite(request,env,'/api/internal/license-center/obra/companies');
  assert.equal(captured.headers.get('x-artisys-license-center-write-secret'),'write-secret');
  assert.equal(captured.headers.get('x-artisys-qa-run'),'run-123');
  assert.equal(captured.headers.get('x-artisys-license-center-secret'),null);
});
```

Also test unauthenticated API remains `401` through `general-panel-index.mjs` and arbitrary target path is impossible.

- [ ] **Step 2: Write failing parity test**

```js
assert.deepEqual(compareCapabilities(
  ['obra.company.create','debora.license.manage'],
  new Set(['obra.company.create'])
),{status:'incomplete',missing:['debora.license.manage']});
```

- [ ] **Step 3: Implement explicit supported capabilities**

`cloudflare/src/license-center-capabilities.mjs` exports exact IDs from the registry implemented by this panel, no wildcard:

```js
export const SUPPORTED_LICENSE_CENTER_CAPABILITIES=new Set([
  'obra.company.read','obra.company.create','obra.company.update-license','obra.device.control',
  'debora.license.manage','owner.license.audit','loja-online.company.read','loja-online.company.create',
  'loja-online.license.update','loja-online.license.extend','loja-online.license.block'
]);
```

- [ ] **Step 4: Implement read parity and write client**

`fetchLicenseCenterSnapshot` augments payload with `parity`. Write client requires `OBRA_LICENSE_CENTER_WRITE_SECRET`, forwards body/method and only `X-Artisys-QA-Run` from browser; never forwards arbitrary security headers.

- [ ] **Step 5: Route explicit public APIs**

In `general-panel-index.mjs`, match only the public routes from the spec and map each to a fixed internal path. Do not derive target path from a query/body parameter.

- [ ] **Step 6: Update examples and syntax checks**

Add `OBRA_LICENSE_CENTER_WRITE_SECRET=` to `.dev.vars.example` as placeholder. Add `cloudflare/src/license-center-capabilities.mjs` and `license-center.mjs` to `check:cloudflare`.

- [ ] **Step 7: Run tests**

```bash
npm test
npm run check
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add cloudflare/src cloudflare/.dev.vars.example test package.json
git commit -m "feat: add guarded license center write proxy"
```

---

### Task 6: Transformar `/licenses` em interface administrativa completa

**Files:**
- Modify: `license-center.html`
- Create: `license-center.js`
- Modify: `.assetsignore`
- Modify: `test/license-center.test.mjs`
- Create: `test/license-center-ui-contract.test.mjs`

**Interfaces:**
- Consumes: APIs da Task 5.
- Produces: UI para Obra, Débora e Loja Online com mutações, confirmações e refetch obrigatório.

- [ ] **Step 1: Extract current inline behavior into `license-center.js` under tests**

Manter renderização atual e criar helper único:

```js
async function mutate(path,options){
  const response=await fetch(path,options);
  const payload=await response.json();
  if(!response.ok) throw new Error(payload.message||payload.error||'Falha na operação');
  await loadSnapshot();
  return payload;
}
```

- [ ] **Step 2: Add failing UI contract tests**

Assert that UI contains forms/actions for create/update/suspend/reactivate, Debora grant/revoke, Loja extend/block/unblock, and that every handler calls `loadSnapshot()` after success.

- [ ] **Step 3: Implement Obra controls**

Create company form plus per-company edit modal/section for plan, expiry, modules, channels, limits, suspend/reactivate and device status. Destructive buttons must use `window.confirm` with target identity.

- [ ] **Step 4: Implement Débora controls**

Email input with `status`, `grant/renew`, `revoke`, `reactivate`; reuse same endpoint/action semantics.

- [ ] **Step 5: Implement Loja Online controls**

Create tenant form and edit/extend/block/unblock controls using allowed month values `1,3,6,12`.

- [ ] **Step 6: Render parity warning**

When `snapshot.parity.status==='incomplete'`, show prominent admin banner listing `missing`. Do not hide the mismatch.

- [ ] **Step 7: Include JS asset**

Add `!license-center.js` to `.assetsignore` and `<script src="/license-center.js" defer></script>` to HTML.

- [ ] **Step 8: Run tests**

```bash
npm test
npm run check
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add license-center.html license-center.js .assetsignore test
git commit -m "feat: enable license administration in general panel"
```

---

### Task 7: Adicionar E2E isolado de escrita e paridade

**Files:**
- Create: `scripts/qa-license-center-isolated.mjs`
- Create: `test/qa-license-center-isolated-contract.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: relatório local `qa-artifacts/license-center-isolated/report.json` e script `qa:license-center:isolated`.

- [ ] **Step 1: Write contract test for the isolated QA script**

Assert script covers these request paths and explicit refetch after each mutation:

```js
for(const path of [
 '/api/license-center/obra/companies',
 '/api/license-center/debora/license',
 '/api/license-center/loja-online/companies'
]) assert.match(source,new RegExp(path.replaceAll('/','\\/')));
assert.match(source,/loadSnapshot|\/api\/license-center/);
```

- [ ] **Step 2: Implement Playwright harness with network-controlled authority**

Use real `/licenses` page, authenticated admin session fixture, mock only `**/api/license-center**`, and exercise desktop/tablet/mobile. Maintain in-memory canonical snapshot and audit so write -> refetch -> visible state is verified.

- [ ] **Step 3: Add destructive guard cases**

Simulate `403 qa_scope_violation`, `503 write_disabled`, missing parity capability and API 500; UI must surface errors without optimistic state mutation.

- [ ] **Step 4: Add package script**

```json
"qa:license-center:isolated": "node scripts/qa-license-center-isolated.mjs"
```

- [ ] **Step 5: Run isolated QA**

```bash
npm run qa:license-center:isolated
npm test
```

Expected: report `status:"passed"`.

- [ ] **Step 6: Commit**

```bash
git add scripts/qa-license-center-isolated.mjs test/qa-license-center-isolated-contract.test.mjs package.json
git commit -m "test: add isolated license center e2e"
```

---

### Task 8: Adicionar E2E live protegido por baseline e `qaRunId`

**Files:**
- Create: `scripts/qa-license-center-live.mjs`
- Create: `test/qa-license-center-live-contract.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Environment required: `LICENSE_CENTER_PANEL_URL`, `LICENSE_CENTER_ADMIN_PASSWORD`, `LICENSE_CENTER_AUTHORITY_URL`, `LICENSE_CENTER_READ_SECRET`.
- Produces: `qa-artifacts/license-center-live/<qaRunId>/report.json`.

- [ ] **Step 1: Write failing safety contract test**

The source must contain explicit `baselineIds`, `createdIds`, `assertWritableTarget`, final cleanup, and must not contain generic iteration that mutates baseline IDs. Example requirement:

```js
function assertWritableTarget(id){
  if(baselineIds.has(id)||!createdIds.has(id)) throw new Error(`unsafe_target:${id}`);
}
```

- [ ] **Step 2: Implement authority read client outside browser**

Use Node `fetch` with `x-artisys-license-center-secret` only in runner process. Never call `page.evaluate` with the secret.

- [ ] **Step 3: Implement browser login and baseline capture**

Login through existing `/api/auth?op=login`; capture snapshot from panel and authority before first write. Build sets of all company/license/tenant IDs.

- [ ] **Step 4: Implement Obra live flow**

Create `ARTISYS QA E2E <run>`, capture returned IDs, assert IDs not in baseline, update limits/modules/channels/expiry, suspend/reactivate, audit-check, then suspend for cleanup. Device live mutation runs only if a device was created by the same run; otherwise report `skipped_safe_no_qa_device`.

- [ ] **Step 5: Implement Débora live flow**

Use `qa-license-<run>@example.test`; grant, verify, grant again and assert expiry advanced by six calendar months according to authority response, revoke, reactivate, audit-check, final revoke.

- [ ] **Step 6: Implement Loja Online live flow**

Create QA tenant/admin, capture IDs, update plan/maxUsers, extend, block/unblock, audit-check, final block.

- [ ] **Step 7: Implement post-run safety proof**

Compare baseline IDs and administrative fingerprints; never auto-restore preexisting changes. Report:

```json
{
  "existingIdsTouched": 0,
  "qaRecordsActive": 0,
  "status": "passed"
}
```

Any nonzero value exits 1.

- [ ] **Step 8: Add explicit opt-in package script**

```json
"qa:license-center:live": "node scripts/qa-license-center-live.mjs"
```

Script must refuse to start unless `LICENSE_CENTER_LIVE_CONFIRM=I_UNDERSTAND_THIS_WRITES_QA_RECORDS`.

- [ ] **Step 9: Run contract tests only in CI by default**

```bash
node --test test/qa-license-center-live-contract.test.mjs
```

Do not run live QA automatically on every PR.

- [ ] **Step 10: Commit**

```bash
git add scripts/qa-license-center-live.mjs test/qa-license-center-live-contract.test.mjs package.json
git commit -m "test: add production-safe license center live e2e"
```

---

### Task 9: Adicionar gate live de paridade cross-repo e CI permanente

**Files — Obra:**
- Modify: `.github/workflows/commercial-cloudflare-ci.yml`
- Modify: `apps/web/scripts/qa-p2-release.mjs`

**Files — MercadoLivre:**
- Create: `scripts/verify-license-center-parity-live.mjs`
- Create: `test/license-center-parity-live-contract.test.mjs`
- Modify: `.github/workflows/mercadolivre-automation-ci.yml`
- Modify: `package.json`

**Interfaces:**
- Produces: `npm run verify:license-center:parity-live` and permanent PR gates.

- [ ] **Step 1: Add Obra CI gate**

Run `npm run qa:admin-parity` before build/deploy dry-run and add it to `qa-p2-release.mjs` so new `/api/owner/*` routes cannot merge unclassified.

- [ ] **Step 2: Implement Mercado live parity verifier**

Read `LICENSE_CENTER_AUTHORITY_URL` + `LICENSE_CENTER_READ_SECRET`, fetch snapshot, compare `adminParity.requiredCapabilities` to `SUPPORTED_LICENSE_CENTER_CAPABILITIES`, and output exactly:

```text
ADMIN_PARITY_FAILURE
missing: <capability-id>
```

with exit 1 when missing; otherwise `ADMIN_PARITY_OK contractVersion=<n>`.

- [ ] **Step 3: Add local contract test**

Mock snapshot with one unknown required capability and assert exit/result fails; mock matching set and assert pass.

- [ ] **Step 4: Add Mercado CI local parity tests**

PR CI runs `npm test`/`npm run check`, including `test/admin-parity.test.mjs` and contract test. Live verifier is a manual/release gate requiring secrets, not a normal fork/PR action.

- [ ] **Step 5: Add package script**

```json
"verify:license-center:parity-live": "node scripts/verify-license-center-parity-live.mjs"
```

- [ ] **Step 6: Run both repository CI-equivalent commands**

Obra:

```bash
cd apps/web
npm run qa:admin-parity
npm test
npm run build
```

MercadoLivre:

```bash
npm test
npm run check
```

Expected: PASS.

- [ ] **Step 7: Commit in each repository**

Obra:

```bash
git add .github/workflows/commercial-cloudflare-ci.yml apps/web/scripts/qa-p2-release.mjs
git commit -m "ci: enforce admin parity gate"
```

MercadoLivre:

```bash
git add scripts/verify-license-center-parity-live.mjs test/license-center-parity-live-contract.test.mjs .github/workflows/mercadolivre-automation-ci.yml package.json
git commit -m "ci: verify license center capability parity"
```

---

### Task 10: Documentar configuração, rollout, rollback e fase 7

**Files — Obra:**
- Create: `apps/web/docs/LICENSE_CENTER_PHASES_5_7_RUNBOOK.md`
- Modify: `apps/web/CLOUDFLARE_OWNER_CHECKLIST.md`

**Files — MercadoLivre:**
- Modify: `DEPLOY.md`

**Interfaces:**
- Produces: runbook operacional sem secrets em texto.

- [ ] **Step 1: Document secret setup without values**

Obra command:

```bash
npx wrangler secret put LICENSE_CENTER_WRITE_SECRET --config wrangler.jsonc
```

Mercado command:

```bash
npx wrangler secret put OBRA_LICENSE_CENTER_WRITE_SECRET --config cloudflare/wrangler.jsonc
```

Document that values must be identical but never pasted into docs/chat/logs.

- [ ] **Step 2: Document safe rollout order**

1. Deploy Obra with `LICENSE_CENTER_WRITE_ENABLED=false`.
2. Deploy MercadoLivre with write UI/proxy.
3. Configure matching write secrets.
4. Run live parity gate.
5. Set `LICENSE_CENTER_WRITE_ENABLED=true`.
6. Run isolated E2E.
7. Run live E2E with explicit confirm env.
8. Require `existingIdsTouched=0` and `qaRecordsActive=0`.
9. Keep old Central active.

- [ ] **Step 3: Document rollback**

First action is feature flag false; then Worker rollback if necessary. No DB rollback/migration exists. QA cleanup may only inactivate records from the current run.

- [ ] **Step 4: Run doc/config checks**

```bash
cd apps/web && npm run qa:admin-parity && npm test
cd ../../../MercadoLivre && npm test && npm run check
```

- [ ] **Step 5: Commit docs**

```bash
git add apps/web/docs/LICENSE_CENTER_PHASES_5_7_RUNBOOK.md apps/web/CLOUDFLARE_OWNER_CHECKLIST.md
git commit -m "docs: add license center phase 7 runbook"
```

and in MercadoLivre:

```bash
git add DEPLOY.md
git commit -m "docs: document license center phase 7 rollout"
```

---

### Task 11: Final verification before merge/deploy

**Files:** no product code changes unless verification exposes a defect.

**Interfaces:** validates all previous tasks as one branch-level gate.

- [ ] **Step 1: Obra full verification**

```bash
cd apps/web
npm run qa:admin-parity
npm test
npm run build
npm run qa:p1:security
```

Expected: all PASS.

- [ ] **Step 2: MercadoLivre full verification**

```bash
npm test
npm run check
npm run qa:license-center:isolated
```

Expected: all PASS.

- [ ] **Step 3: Wrangler dry-runs**

Obra:

```bash
npx wrangler deploy --dry-run --config wrangler.jsonc
```

MercadoLivre:

```bash
npx -y wrangler@4 deploy --dry-run --config cloudflare/wrangler.jsonc
```

Expected: both bundle successfully and Service Bindings resolve in config.

- [ ] **Step 4: Open draft PRs and wait for CI**

PR titles:

```text
OBRANAMAOCOMERCIAL: feat: enable guarded license center administration
MercadoLivre: feat: complete license center phases 5 to 7
```

Do not merge until both CI suites pass.

- [ ] **Step 5: Deploy in documented order and run live gates**

After merge/deploy authorization, execute parity-live then E2E-live. Preserve reports as evidence. Do not declare phase 6/7 complete without live report showing `existingIdsTouched=0` and `qaRecordsActive=0`.

- [ ] **Step 6: Final completion evidence**

Record in PR/runbook:

```text
Admin parity gate ........ PASS
Obra CI .................. PASS
MercadoLivre CI .......... PASS
Isolated E2E ............. PASS
Live capability parity ... PASS
Live E2E ................. PASS
Existing IDs touched ..... 0
QA records active ........ 0
Legacy Central ........... AVAILABLE
```
