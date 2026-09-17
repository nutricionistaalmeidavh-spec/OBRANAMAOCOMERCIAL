# Loja Online na Central Artisys Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrar a Loja Online à Central Artisys (`artisys.dev/sistema#owner`) com provisionamento empresarial, renovação, bloqueio, desbloqueio, consulta e auditoria, mantendo a Loja Online como fonte única de verdade de tenants e licenças.

**Architecture:** A Central Artisys atua somente como orquestradora. O browser chama `/api/owner/loja-online/*` no Worker da Central; o backend da Central usa um adapter dedicado para chamar `/api/internal/artisys/loja-online/*` no Worker da Loja Online, preferencialmente por Cloudflare Service Binding e sempre com segredo compartilhado. A Loja Online executa e persiste todas as mutações no próprio D1 e reutiliza sua lógica nativa de multitenancy/licenciamento.

**Tech Stack:** Node.js >=22, JavaScript ESM, TypeScript, Cloudflare Workers, D1, Service Bindings, Vite, Vitest, node:test, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-17-lojaonline-central-licensing-design.md`

## Global Constraints

- A Central Artisys não deve persistir uma segunda cópia da licença da Loja Online.
- A Loja Online continua sendo a autoridade sobre tenant, administrador, licença, validade, bloqueio e limite de usuários.
- Nenhuma alteração pode mudar login, licenças ou tenants existentes do Obra na Mão ou da Débora Lactação.
- A API interna da Loja Online não aceita sessão de cliente como substituto do segredo interno.
- O segredo nunca vai para o frontend; permanece apenas em secrets/bindings do Worker.
- Renovação usa `base = max(now, expiresAt atual)` e adiciona os meses a partir dessa base.
- Bloqueio/desbloqueio reutiliza a regra nativa da Loja Online, inclusive indisponibilidade da vitrine pública quando a licença está inativa.
- Toda mutação administrativa deve produzir auditoria identificando `central-artisys`.
- Desenvolvimento local pode usar URL configurável; produção prefere Service Binding.
- Implementação deve seguir TDD e manter `npm run check` verde em `lojaonline` e `npm test && npm run build` verde em `OBRANAMAOCOMERCIAL/apps/web`.

---

## File Structure

### `nutricionistaalmeidavh-spec/lojaonline`

- Create: `src/http/internal-artisys-licensing.mjs` — autenticação por segredo, roteamento interno e normalização de resposta.
- Create: `src/application/internal-licensing-admin.mjs` — operações administrativas internas que reutilizam o estado/licenciamento sem depender de sessão do browser.
- Modify: `src/application/final-app-service.mjs` — extrair/reutilizar núcleo de provisionamento para evitar duplicação entre superadmin próprio e integração interna.
- Modify: `src/http/final-handler.mjs` — despachar namespace `/api/internal/artisys/loja-online/*` antes das rotas autenticadas por Bearer.
- Modify: `apps/api-cloudflare/final-worker.mjs` — fornecer `LOJAONLINE_LICENSE_SERVICE_SECRET` ao handler e persistir mutações internas no D1.
- Modify: `apps/api-cloudflare/wrangler.jsonc` — documentar secret requerido.
- Test: `test/internal-artisys-licensing.test.mjs` — contrato de segredo, provisionamento, renovação, bloqueio, desbloqueio e auditoria.

### `nutricionistaalmeidavh-spec/OBRANAMAOCOMERCIAL`

- Create: `apps/web/backend/loja-online-admin.ts` — adapter + rotas owner da Loja Online.
- Create: `apps/web/backend/loja-online-admin.test.ts` — testes do adapter, erros e payloads.
- Modify: `apps/web/cloudflare/sdk.ts` — bindings/env para Worker/URL/secret da Loja Online.
- Modify: `apps/web/backend/owner-companies.ts` — compor `createLojaOnlineAdminRoutes(secured)` sem incorporar regras da Loja Online.
- Modify: `apps/web/src/owner.ts` — terceira área de produto, métricas, clientes, licenças e ações.
- Modify: `apps/web/src/owner.css` — apenas estilos estritamente necessários para novo card/form/status, reutilizando classes existentes.
- Create: `apps/web/src/owner-loja-online-contract.test.ts` — contrato visual/funcional da nova área.
- Modify: `apps/web/wrangler.jsonc` — service binding/secret/configuração de fallback.
- Modify: `apps/web/UI_ROUTE_MAP.md` — registrar Loja Online na Central Artisys.

---

### Task 1: Criar o contrato interno seguro na Loja Online

**Files:**
- Create: `src/http/internal-artisys-licensing.mjs`
- Test: `test/internal-artisys-licensing.test.mjs`

**Interfaces:**
- Consumes: `FinalAppService`, `DomainError`, `Request`, segredo recebido do Worker.
- Produces: `handleInternalArtisysLicensing(app, request, {secret}) -> Promise<Response>` e `isValidInternalSecret(request, secret) -> Promise<boolean>`.

- [ ] **Step 1: Write the failing secret contract test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { FinalAppService } from '../src/application/final-app-service.mjs';
import { handleInternalArtisysLicensing } from '../src/http/internal-artisys-licensing.mjs';

test('API interna rejeita segredo ausente ou inválido',async()=>{
  const app=new FinalAppService();
  const request=new Request('https://loja.test/api/internal/artisys/loja-online/companies');
  const response=await handleInternalArtisysLicensing(app,request,{secret:'segredo-correto'});
  assert.equal(response.status,401);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/internal-artisys-licensing.test.mjs`

Expected: FAIL because `src/http/internal-artisys-licensing.mjs` does not exist.

- [ ] **Step 3: Implement constant-time secret verification and 401 response**

```js
const json=(value,status=200)=>new Response(JSON.stringify(value),{
  status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
});

async function digest(value){
  return new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(value||''))));
}

export async function isValidInternalSecret(request,secret){
  const expected=String(secret||'');
  const supplied=String(request.headers.get('x-artisys-license-secret')||'');
  if(!expected||!supplied)return false;
  const [a,b]=await Promise.all([digest(expected),digest(supplied)]);
  let diff=0;
  for(let i=0;i<a.length;i++)diff|=a[i]^b[i];
  return diff===0;
}

export async function handleInternalArtisysLicensing(app,request,{secret}={}){
  if(!await isValidInternalSecret(request,secret)){
    return json({error:'INTERNAL_AUTH_REQUIRED',message:'Integração administrativa não autorizada.'},401);
  }
  return json({error:'NOT_IMPLEMENTED',message:'Rota interna ainda não implementada.'},404);
}
```

- [ ] **Step 4: Add tests proving browser Bearer/cookie cannot replace the secret**

```js
for(const headers of [
  {authorization:'Bearer qualquer'},
  {cookie:'session=qualquer'},
]){
  const response=await handleInternalArtisysLicensing(app,new Request(url,{headers}),{secret:'segredo-correto'});
  assert.equal(response.status,401);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test test/internal-artisys-licensing.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/http/internal-artisys-licensing.mjs test/internal-artisys-licensing.test.mjs
git commit -m "test: define secure internal licensing contract"
```

---

### Task 2: Reutilizar o núcleo de provisionamento/licenciamento da Loja Online

**Files:**
- Create: `src/application/internal-licensing-admin.mjs`
- Modify: `src/application/final-app-service.mjs`
- Test: `test/internal-artisys-licensing.test.mjs`

**Interfaces:**
- Consumes: `createUser`, `updateUser`, `resetUserPassword`, `createCompany`, `setCompanyLicense`, `extendCompanyLicense`, `blockCompanyLicense`, `unblockCompanyLicense`, `licenseStatus`.
- Produces:
  - `listInternalClients(app)`
  - `createInternalClient(app,input,{actor})`
  - `setInternalLicense(app,companyId,input,{actor})`
  - `extendInternalLicense(app,companyId,{months},{actor})`
  - `blockInternalClient(app,companyId,{reason},{actor})`
  - `unblockInternalClient(app,companyId,{actor})`
  - `internalLicenseAudit(app)`

- [ ] **Step 1: Write failing tests for atomic business outcomes**

```js
test('Central provisiona tenant, admin e licença ativa',()=>{
  const app=new FinalAppService();
  const created=createInternalClient(app,{
    companyName:'Casa Silva',adminName:'Carlos Silva',adminEmail:'carlos@example.com',
    adminPassword:'SenhaSegura123!',months:6,maxUsers:3,plan:'6_MONTHS'
  },{actor:'central-artisys'});
  assert.equal(created.company.name,'Casa Silva');
  assert.equal(created.admin.email,'carlos@example.com');
  assert.equal(created.license.status,'ACTIVE');
  assert.equal(created.license.maxUsers,3);
});
```

Also assert a repeated ambiguous email is rejected before a second usable tenant is created.

- [ ] **Step 2: Run the focused test**

Run: `node --test test/internal-artisys-licensing.test.mjs`

Expected: FAIL because internal admin operations do not exist.

- [ ] **Step 3: Extract one shared provisioning primitive**

Move the current body shared by `createClientCompany()` into a focused function that accepts an explicit actor instead of requiring a browser session. The superadmin method remains a wrapper:

```js
createClientCompany(token,input){
  const {user}=requireSuperadminSession(this.state,token);
  return provisionClientCompany(this,input,{actorUserId:user.id,actor:'superadmin'});
}
```

The internal path uses the same primitive:

```js
export function createInternalClient(app,input,{actor='central-artisys'}={}){
  return provisionClientCompany(app,input,{actorUserId:null,actor});
}
```

Do not duplicate company/user/license creation logic.

- [ ] **Step 4: Implement renewal from remaining validity**

Before extending, assert behavior with a fixed future `expiresAt`. The implementation must delegate to the existing `extendCompanyLicense` if it already preserves remaining validity; otherwise fix that domain primitive once so both superadmin and internal flows share the rule.

Expected rule:

```js
const base=currentExpiresAt&&Date.parse(currentExpiresAt)>Date.now()?currentExpiresAt:new Date().toISOString();
// add N calendar months from base
```

- [ ] **Step 5: Implement block/unblock through native domain operations**

```js
export function blockInternalClient(app,companyId,{reason=null}={},{actor='central-artisys'}={}){
  const license=blockCompanyLicense(app.state,{companyId,reason});
  app.audit({companyId,userId:null,action:'central.license.block',entityType:'license',entityId:license.id,meta:{actor}});
  return license;
}
```

Use equivalent audit actions for create/update/extend/unblock.

- [ ] **Step 6: Expose audit rows without inventing a second database**

Read the existing audit collection/state and filter only licensing/client events. Return a normalized representation:

```js
{
  id, companyId, action, actor, createdAt,
  details:{licenseId,months,reason}
}
```

- [ ] **Step 7: Run all Loja Online unit tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/application/internal-licensing-admin.mjs src/application/final-app-service.mjs test/internal-artisys-licensing.test.mjs
git commit -m "feat: reuse licensing operations for Central Artisys"
```

---

### Task 3: Implementar todas as rotas internas e conectá-las ao Worker da Loja Online

**Files:**
- Modify: `src/http/internal-artisys-licensing.mjs`
- Modify: `src/http/final-handler.mjs`
- Modify: `apps/api-cloudflare/final-worker.mjs`
- Modify: `apps/api-cloudflare/wrangler.jsonc`
- Test: `test/internal-artisys-licensing.test.mjs`

**Interfaces:**
- Consumes: operations from Task 2.
- Produces the exact internal HTTP contract from the spec.

- [ ] **Step 1: Write failing route tests**

Cover exact routes:

```text
GET  /api/internal/artisys/loja-online/companies
GET  /api/internal/artisys/loja-online/companies/:companyId
POST /api/internal/artisys/loja-online/companies
PUT  /api/internal/artisys/loja-online/companies/:companyId/license
POST /api/internal/artisys/loja-online/companies/:companyId/extend
POST /api/internal/artisys/loja-online/companies/:companyId/block
POST /api/internal/artisys/loja-online/companies/:companyId/unblock
GET  /api/internal/artisys/loja-online/license-audit
```

Use `x-artisys-license-secret: segredo-correto` in successful requests.

- [ ] **Step 2: Run focused test and confirm 404/NOT_IMPLEMENTED failures**

Run: `node --test test/internal-artisys-licensing.test.mjs`

- [ ] **Step 3: Implement routing in `internal-artisys-licensing.mjs`**

Map each route directly to one Task 2 operation. Return DomainError codes/status unchanged as JSON.

For POST create, return HTTP `201`.

- [ ] **Step 4: Dispatch internal namespace before ordinary Bearer-session routes**

At the top of `handleFinalApiRequest` after URL parsing:

```js
if(path.startsWith('/api/internal/artisys/loja-online')){
  return handleInternalArtisysLicensing(app,request,{secret:internalLicenseSecret});
}
```

Extend the function signature:

```js
export async function handleFinalApiRequest(app,request,{fileStore=null,internalLicenseSecret=''}={})
```

- [ ] **Step 5: Pass Worker secret and persist successful internal mutations**

In `apps/api-cloudflare/final-worker.mjs`:

```js
const response=await handleFinalApiRequest(app,request,{
  fileStore,
  internalLicenseSecret:env.LOJAONLINE_LICENSE_SERVICE_SECRET||''
});
```

Keep the existing rule that successful non-GET mutations save `app.exportState()`.

- [ ] **Step 6: Document secret in Wrangler without hardcoding a value**

Add a required-secret declaration/comment consistent with repository conventions. Do not commit the actual secret.

- [ ] **Step 7: Run full Loja Online verification**

Run:

```bash
npm run check
npm run qa:e2e
```

Expected: all current tests plus the new internal licensing contract pass.

- [ ] **Step 8: Commit**

```bash
git add src/http/internal-artisys-licensing.mjs src/http/final-handler.mjs apps/api-cloudflare/final-worker.mjs apps/api-cloudflare/wrangler.jsonc test/internal-artisys-licensing.test.mjs
git commit -m "feat: expose internal Central Artisys licensing API"
```

---

### Task 4: Criar o adapter da Loja Online no backend da Central

**Files:**
- Create: `apps/web/backend/loja-online-admin.ts`
- Create: `apps/web/backend/loja-online-admin.test.ts`
- Modify: `apps/web/cloudflare/sdk.ts`
- Modify: `apps/web/wrangler.jsonc`

**Interfaces:**
- Consumes: Loja Online internal HTTP contract from Task 3.
- Produces:
  - `LojaOnlineCompany`
  - `LojaOnlineOverview`
  - `LojaOnlineLicenseEvent`
  - `lojaOnlineRequest(path,init?)`
  - `createLojaOnlineAdminRoutes(secured)`

- [ ] **Step 1: Extend RuntimeEnv types with explicit server-only bindings**

```ts
export type RuntimeEnv = {
  // existing fields...
  LOJAONLINE_LICENSING?: Fetcher;
  LOJAONLINE_LICENSE_SERVICE_SECRET?: string;
  LOJAONLINE_LICENSE_BASE_URL?: string;
};
```

- [ ] **Step 2: Write failing adapter tests using a fake Fetcher**

```ts
it('calls Loja Online with internal secret and returns normalized companies',async()=>{
  const calls:Request[]=[];
  const fetcher={fetch:async(input:RequestInfo|URL,init?:RequestInit)=>{
    const request=new Request(input,init);calls.push(request);
    return Response.json([{company:{id:'c1',name:'Casa Silva'},license:{status:'ACTIVE',maxUsers:3}}]);
  }} as Fetcher;
  // inject runtime env according to current sdk test helpers
  // call adapter and assert path + x-artisys-license-secret header
});
```

- [ ] **Step 3: Implement transport selection**

```ts
async function lojaOnlineFetch(path:string,init:RequestInit={}){
  const env=runtimeEnv();
  const secret=String(env.LOJAONLINE_LICENSE_SERVICE_SECRET||'');
  if(!secret)throw new Error('LOJAONLINE_LICENSE_SERVICE_SECRET não configurado.');
  const headers=new Headers(init.headers);
  headers.set('content-type','application/json');
  headers.set('x-artisys-license-secret',secret);
  if(env.LOJAONLINE_LICENSING){
    return env.LOJAONLINE_LICENSING.fetch(new Request(`https://lojaonline.internal${path}`,{...init,headers}));
  }
  const base=String(env.LOJAONLINE_LICENSE_BASE_URL||'').replace(/\/$/,'');
  if(!base)throw new Error('Binding/URL da Loja Online não configurado.');
  return fetch(base+path,{...init,headers});
}
```

- [ ] **Step 4: Normalize upstream errors without leaking secret/body internals**

For non-2xx, parse only `{error,message}` and throw an error carrying upstream status. Never include headers or secret in logs/errors.

- [ ] **Step 5: Add Wrangler configuration**

Production target:

```jsonc
"services": [
  {"binding":"LOJAONLINE_LICENSING","service":"artisys-lojaonline"}
]
```

Keep `LOJAONLINE_LICENSE_SERVICE_SECRET` as Cloudflare secret, not `vars`.

For local development document optional `LOJAONLINE_LICENSE_BASE_URL`.

- [ ] **Step 6: Run focused tests**

Run: `npm test -- loja-online-admin.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/backend/loja-online-admin.ts apps/web/backend/loja-online-admin.test.ts apps/web/cloudflare/sdk.ts apps/web/wrangler.jsonc
git commit -m "feat: add Loja Online licensing adapter"
```

---

### Task 5: Expor a Loja Online pelas rotas protegidas da Central Artisys

**Files:**
- Modify: `apps/web/backend/loja-online-admin.ts`
- Modify: `apps/web/backend/owner-companies.ts`
- Test: `apps/web/backend/loja-online-admin.test.ts`

**Interfaces:**
- Consumes: `secured: RouterRoutes[string]` and adapter transport from Task 4.
- Produces owner routes:
  - `GET /api/owner/loja-online/overview`
  - `GET /api/owner/loja-online/companies`
  - `GET /api/owner/loja-online/companies/:id`
  - `POST /api/owner/loja-online/companies`
  - `PUT /api/owner/loja-online/companies/:id/license`
  - `POST /api/owner/loja-online/companies/:id/extend`
  - `POST /api/owner/loja-online/companies/:id/block`
  - `POST /api/owner/loja-online/companies/:id/unblock`
  - `GET /api/owner/loja-online/license-audit`

- [ ] **Step 1: Write failing route-shape tests**

Assert that every route exists and prepends the same `secured` middleware stack used by Obra/Débora.

- [ ] **Step 2: Implement `createLojaOnlineAdminRoutes(secured)`**

Each handler should forward only validated business fields. Example create:

```ts
'POST /api/owner/loja-online/companies':[
  ...secured,
  async ctx=>{
    const body=(ctx.body||{}) as Record<string,unknown>;
    const payload={
      companyName:String(body.companyName||'').trim(),
      adminName:String(body.adminName||'').trim(),
      adminEmail:String(body.adminEmail||'').trim().toLowerCase(),
      months:Number(body.months||6),
      maxUsers:Number(body.maxUsers||5),
      plan:String(body.plan||'6_MONTHS')
    };
    // validate then call adapter
  }
]
```

- [ ] **Step 3: Compose routes from `owner-companies.ts`**

```ts
import { createLojaOnlineAdminRoutes } from './loja-online-admin';

export function createCompanyRoutes(secured:RouterRoutes[string]):RouterRoutes{return{
  ...createDeboraLicenseAdminRoutes(secured),
  ...createLojaOnlineAdminRoutes(secured),
  // existing Obra na Mão routes
};}
```

- [ ] **Step 4: Run backend tests**

Run: `npm test -- loja-online-admin.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/backend/loja-online-admin.ts apps/web/backend/loja-online-admin.test.ts apps/web/backend/owner-companies.ts
git commit -m "feat: expose Loja Online in owner API"
```

---

### Task 6: Adicionar Loja Online à UI da Central Artisys

**Files:**
- Modify: `apps/web/src/owner.ts`
- Modify: `apps/web/src/owner.css`
- Create: `apps/web/src/owner-loja-online-contract.test.ts`

**Interfaces:**
- Consumes owner routes from Task 5.
- Produces `OwnerView='overview'|'obra'|'debora'|'loja'|'clients'|'licenses'` and complete Loja Online UI.

- [ ] **Step 1: Write failing source-contract tests**

```ts
it('Central exposes Loja Online as third managed product',async()=>{
  const source=await readFile(new URL('./owner.ts',import.meta.url),'utf8');
  expect(source).toContain("'loja'");
  expect(source).toContain('Loja Online');
  expect(source).toContain('/api/owner/loja-online/overview');
  expect(source).toContain('/api/owner/loja-online/companies');
  expect(source).toContain('Criar loja e liberar licença');
  expect(source).toContain('Estender licença');
  expect(source).toContain('Bloquear');
  expect(source).toContain('Desbloquear');
});
```

- [ ] **Step 2: Add Loja Online types/state without changing Obra/Débora models**

```ts
type LojaOnlineClient={
  company:{id:string;name:string};
  admin?:{email?:string;name?:string};
  license:{plan?:string;status:string;expiresAt?:string|null;maxUsers:number};
  accessStatus:string;
  accessible:boolean;
  userCount:number;
};

type LojaOnlineOverview={
  totalClients:number;active:number;expired:number;blocked:number;expiringSoon:number;
};
```

- [ ] **Step 3: Add third product card to overview**

Use existing `owner-product-card` markup/classes. Show total + active and `data-owner-open="loja"`.

- [ ] **Step 4: Implement Loja Online provision form**

Fields:

```text
Empresa / Loja
Nome do administrador
E-mail do administrador
Plano
Duração em meses
Máximo de usuários
```

Submit to `POST /api/owner/loja-online/companies` and refresh Loja Online overview, clients and license history.

- [ ] **Step 5: Implement per-client actions**

Buttons must call:

```text
POST .../:id/extend   {months:6}
POST .../:id/block    {reason}
POST .../:id/unblock
PUT  .../:id/license  {plan,maxUsers,expiresAt,status}
```

Require confirmation for block/unblock and show API error messages in the existing status/notice pattern.

- [ ] **Step 6: Include Loja Online in unified Clients view**

Add product filter option `loja-online` and render cards with company, admin e-mail, status, plan, expiry and `userCount/maxUsers`.

- [ ] **Step 7: Include Loja Online in unified Licenses/Audit view**

Extend `LicenseEvent.product` to include `'loja-online'`. Merge Loja Online audit events into the same chronological list used for Obra/Débora.

- [ ] **Step 8: Add only necessary CSS**

Reuse `owner-product-card`, `owner-status`, `owner-form-card`, `owner-client-card`. New CSS should be limited to a Loja Online product accent/icon if required; no redesign of existing products.

- [ ] **Step 9: Run UI contract tests**

Run: `npm test -- owner-loja-online-contract.test.ts`

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/owner.ts apps/web/src/owner.css apps/web/src/owner-loja-online-contract.test.ts
git commit -m "feat: manage Loja Online from Central Artisys"
```

---

### Task 7: Validar isolamento, expiração e vitrine na Loja Online

**Files:**
- Modify: `test/internal-artisys-licensing.test.mjs`
- Modify: `test/superadmin-licensing.test.mjs` only if shared primitives changed and regression coverage needs to be extended.

**Interfaces:**
- Consumes: complete internal API.
- Produces regression proof that Central integration does not weaken multitenancy/licensing.

- [ ] **Step 1: Add cross-tenant isolation test**

Create two clients through the internal API, authenticate both through ordinary app login, create data in company A and assert company B cannot see/access it.

- [ ] **Step 2: Add renewal balance test**

Set a known future expiry, extend 6 months and assert the new expiry is six calendar months after the previous expiry, not six months after now.

- [ ] **Step 3: Add blocked catalog test through internal route**

Create/publish a product and public catalog for a tenant, verify catalog works, block through `/api/internal/artisys/loja-online/companies/:id/block`, then assert `getPublicCatalog(slug)` raises `PUBLIC_CATALOG_LICENSE_INACTIVE`.

- [ ] **Step 4: Add unblock restoration test**

Unblock the same tenant and assert dashboard + catalog become accessible without creating a second tenant/license.

- [ ] **Step 5: Run complete Loja Online verification**

Run:

```bash
npm run check
npm run qa:e2e
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add test/internal-artisys-licensing.test.mjs test/superadmin-licensing.test.mjs
git commit -m "test: cover Central Artisys licensing isolation"
```

---

### Task 8: Validar a Central Artisys e documentar operação/deploy

**Files:**
- Modify: `apps/web/UI_ROUTE_MAP.md`
- Modify: `apps/web/CLOUDFLARE_OWNER_CHECKLIST.md`
- Modify: `apps/web/docs/` deployment/licensing doc that currently documents Central licensing, or create `apps/web/docs/LOJAONLINE_LICENSING.md` if no focused document exists.
- Test: all Central tests/build.

**Interfaces:**
- Consumes: production-ready integration from Tasks 4–7.
- Produces deploy checklist and operator documentation.

- [ ] **Step 1: Update route map**

Add Loja Online under `#owner` and explicitly list its provisioning/license actions. Do not change existing portal/login routes.

- [ ] **Step 2: Document secret/binding setup**

Document exact Cloudflare configuration sequence:

```text
1. Set the same strong random LOJAONLINE_LICENSE_SERVICE_SECRET in both Workers.
2. Deploy Loja Online Worker first with internal routes.
3. Configure Central service binding LOJAONLINE_LICENSING -> artisys-lojaonline.
4. Deploy Central Artisys Worker.
5. Open artisys.dev/sistema#owner and verify Loja Online overview.
6. Create a disposable test tenant, extend, block, unblock, then remove/disable test data according to app policy.
```

Never put the secret value in docs or Git.

- [ ] **Step 3: Run Central full verification**

From `apps/web`:

```bash
npm test
npm run build
npm run ux:verify
```

Expected: PASS.

- [ ] **Step 4: Run Loja Online full verification one final time**

From `lojaonline`:

```bash
npm run check
npm run qa:e2e
```

Expected: PASS.

- [ ] **Step 5: Manual production smoke after deploy**

Verify in `https://artisys.dev/sistema#owner`:

```text
Visão geral -> Loja Online card visible
Loja Online -> overview loads
Create disposable tenant -> appears in Clients
Extend +6 months -> expiry changes
Block -> status blocked and catalog unavailable
Unblock -> access restored
Licenças -> audit shows create/extend/block/unblock
Obra na Mão -> existing controls still work
Débora Lactação -> grant/status/revoke controls still work
```

- [ ] **Step 6: Commit docs**

```bash
git add apps/web/UI_ROUTE_MAP.md apps/web/CLOUDFLARE_OWNER_CHECKLIST.md apps/web/docs
git commit -m "docs: document Loja Online licensing in Central Artisys"
```

---

## Execution Order and Repository Boundaries

Execution should use separate isolated worktrees/branches for the two repositories.

1. Implement Tasks 1–3 and 7 in `lojaonline` first, because they establish the authoritative internal contract.
2. Verify `lojaonline` completely before wiring Central.
3. Implement Tasks 4–6 and 8 in `OBRANAMAOCOMERCIAL` against the fixed contract.
4. Deploy Loja Online first, then Central Artisys.
5. Perform the production smoke only after both deployments are live.

Do not merge either repository while its own full verification is red. Do not deploy the Central adapter before the Loja Online internal API exists in production.

## Self-Review

- Spec coverage: API interna, autenticação, adapter, UI, provisionamento, renovação, bloqueio/desbloqueio, clientes, auditoria, Service Binding, fallback local, isolamento e deploy estão mapeados para Tasks 1–8.
- Placeholder scan: no `TBD`, `TODO` or deferred implementation remains in this plan.
- Type consistency: Central uses `LojaOnlineClient`, `LojaOnlineOverview`, `LojaOnlineLicenseEvent`; internal routes and owner routes use the exact paths defined in the approved spec.
- Source of truth: no task writes Loja Online license state into Central D1.
- Regression boundary: existing Obra na Mão and Débora flows are explicitly preserved and smoke-tested.
