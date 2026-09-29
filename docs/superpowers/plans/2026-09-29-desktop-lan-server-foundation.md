# Desktop LAN Server Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar as fases 0–2 do modo Servidor da empresa sem alterar o comportamento local atual do Obra na Mão Desktop.

**Architecture:** O CRUD genérico do Electron passa por uma seam `DataAccessService`, que nesta entrega continua delegando ao SQLite local. Um `StorageConnectionService` persiste e valida a preferência Local/Servidor e testa um serviço HTTP LAN. `apps/lan-server` é um processo Node separado e mínimo, inicialmente apenas com `/health` e `/version`.

**Tech Stack:** Electron, CommonJS no processo principal, React/TypeScript no renderer, SQLite/better-sqlite3 já existente, Node.js 22 `node:http`, Vitest e `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-29-desktop-lan-server-foundation-design.md`

## Global Constraints

- `local` continua sendo o modo padrão e nenhuma tela passa a usar CRUD HTTP nesta entrega.
- Renderer não acessa Node, banco nem rede privilegiada diretamente.
- Não criar migration; usar `configuracoes` existente.
- Porta LAN padrão `4732`.
- `apps/lan-server` escuta `127.0.0.1` por padrão.
- Sem dependências pagas, SaaS obrigatório, acesso público ou sincronização offline.
- Não executar `npm run dist` nesta tarefa.

## Review Focus

- Atualização de instalação antiga sem chaves LAN deve resultar em `mode=local`.
- Host com protocolo/caminho/credenciais deve ser rejeitado antes do `fetch`.
- Porta fora de `1..65535` deve ser rejeitada.
- Um HTTP 200 de serviço que não seja Obra na Mão deve ser rejeitado.
- Falha/timeout da rede deve virar mensagem legível e não alterar a configuração persistida.

---

### Task 1: Seam de acesso a dados

**Files:**
- Create: `apps/desktop/electron/services/data-access-service.cjs`
- Create: `apps/desktop/electron/services/data-access-service.test.ts`
- Modify: `apps/desktop/electron/main.cjs`

**Interfaces:**
- Consumes: `DatabaseService.list/get/save/remove`.
- Produces: `DataAccessService.list(table, filters)`, `get(table,id)`, `save(table,data)`, `remove(table,id)`.

- [ ] **Step 1: Write the failing test** que instancia `DataAccessService` com um fake DB e verifica delegação exata de `list/get/save/remove`.
- [ ] **Step 2: Run test to verify it fails**: `npm test -- electron/services/data-access-service.test.ts`.
- [ ] **Step 3: Implement `DataAccessService`** com delegação 1:1 e conectar os handlers `entity:*` a `services.dataAccess`.
- [ ] **Step 4: Run focused test** e verificar PASS.
- [ ] **Step 5: Inspect diff** garantindo que nenhum contrato do renderer mudou.

### Task 2: Persistência e teste da conexão LAN

**Files:**
- Create: `apps/desktop/electron/services/storage-connection-service.cjs`
- Create: `apps/desktop/electron/services/storage-connection-service.test.ts`
- Modify: `apps/desktop/electron/main.cjs`
- Modify: `apps/desktop/electron/preload.cjs`
- Modify: `apps/desktop/src/vite-env.d.ts`

**Interfaces:**
- Produces `StorageConnectionService.state()` → `{mode,host,port,baseUrl}`.
- Produces `configure({mode,host,port})` → estado persistido.
- Produces `testConnection()` → `{ok:true,baseUrl,latencyMs,health}`.
- Produces `window.fluxoDre.storage.state/configure/testConnection`.

- [ ] **Step 1: Write failing tests** para defaults, persistência, validação de host/porta, health correto, health de produto errado e timeout/falha de rede.
- [ ] **Step 2: Run focused tests and verify RED**.
- [ ] **Step 3: Implement service** usando `configuracoes`, `fetchImpl` injetável e timeout de 3000 ms.
- [ ] **Step 4: Wire IPC/preload/types** sem expor `fetch` ao renderer.
- [ ] **Step 5: Run focused tests and verify GREEN**.

### Task 3: UI Local/Servidor

**Files:**
- Create: `apps/desktop/tests/storage-server-settings.test.ts`
- Modify: `apps/desktop/src/pages/SettingsPage.tsx`

**Interfaces:**
- Consumes `window.fluxoDre.storage.state/configure/testConnection`.

- [ ] **Step 1: Write failing regression test** que exige card `Dados e servidor`, opções `Neste computador` e `Servidor da empresa`, host/porta, salvar e testar conexão.
- [ ] **Step 2: Verify RED** com Vitest.
- [ ] **Step 3: Implement UI** mantendo modo local como default e mostrando campos de servidor somente quando aplicável.
- [ ] **Step 4: Verify GREEN** e rodar `npm run lint`.

### Task 4: Serviço HTTP mínimo `apps/lan-server`

**Files:**
- Create: `apps/lan-server/package.json`
- Create: `apps/lan-server/src/server.mjs`
- Create: `apps/lan-server/src/index.mjs`
- Create: `apps/lan-server/tests/server.test.mjs`
- Modify: root `package.json`

**Interfaces:**
- `createLanServer(options)` retorna `http.Server`.
- `GET /health` → `{status:'ok',product:'Obra na Mão',apiVersion:'1'}`.
- `GET /version` → `{product:'Obra na Mão',apiVersion:'1',serverVersion:'0.1.0'}`.

- [ ] **Step 1: Write failing `node:test` contract** para `/health`, `/version`, 404 e 405.
- [ ] **Step 2: Verify RED**: `npm --prefix apps/lan-server test`.
- [ ] **Step 3: Implement server** apenas com módulos nativos do Node.
- [ ] **Step 4: Add root test script** sem tornar o LAN server dependência do Desktop.
- [ ] **Step 5: Verify GREEN**: `npm --prefix apps/lan-server test`.

### Task 5: Documentação estrutural e verificação integrada

**Files:**
- Modify: `apps/desktop/docs/PROJECT_MAP.md`

- [ ] **Step 1: Update map** com `DataAccessService`, `StorageConnectionService`, novos IPCs e `apps/lan-server`.
- [ ] **Step 2: Run Desktop lint**: `npm run lint` em `apps/desktop`.
- [ ] **Step 3: Run Desktop suite**: `npm test` em `apps/desktop`.
- [ ] **Step 4: Run Desktop build**: `npm run build` em `apps/desktop`.
- [ ] **Step 5: Run LAN server tests**: `npm --prefix apps/lan-server test`.
- [ ] **Step 6: Compare branch against main** e confirmar que não há release/deploy/merge e nenhum CRUD remoto foi introduzido.
