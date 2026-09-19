# ArtiSys Public Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar as fases 0–3 do catálogo público ArtiSys em `/sistemas/` sem alterar o runtime operacional do Obra na Mão.

**Architecture:** Catálogo 100% estático em `apps/web/public/sistemas/`, alimentado por `products.json` e renderizado por JavaScript próprio. O build existente apenas copiará os assets públicos; nenhuma rota operacional, Worker, D1 ou autenticação será modificada.

**Tech Stack:** HTML5, CSS, JavaScript ES2020, JSON, Node.js para verificação estática.

**Spec:** `docs/superpowers/specs/2026-09-18-artisys-public-catalog-design.md`

## Global Constraints

- Não modificar arquivos operacionais listados no contrato de isolamento.
- Não adicionar dependência runtime.
- Não inventar preços ou screenshots.
- Manter o catálogo público sem login e sem chamadas a APIs privadas.
- Fases 0–3 apenas; páginas individuais e SEO ficam para fases posteriores.

---

### Task 1: Blindagem do catálogo

**Files:**
- Create: `apps/web/scripts/verify-public-catalog.mjs`

**Interfaces:**
- Consumes: arquivos estáticos do catálogo.
- Produces: verificação Node que falha se o contrato básico do catálogo for quebrado.

- [ ] Criar verificador com validação de JSON, cinco produtos, slugs únicos, tipos permitidos, links seguros e ausência de imports do runtime operacional.
- [ ] Executar `node apps/web/scripts/verify-public-catalog.mjs` em checkout completo.

### Task 2: Modelo central de produtos

**Files:**
- Create: `apps/web/public/sistemas/products.json`

**Interfaces:**
- Produces: array `{version, products}` usado por `catalog.js`.

- [ ] Registrar PDV ArtiSys, Obra na Mão, Loja Online, Débora Lactação e Oficina Agrícola.
- [ ] Manter preços não confirmados como `Sob consulta`.
- [ ] Definir `accessHref` somente onde existe rota confirmada.

### Task 3: Página e UI do catálogo

**Files:**
- Create: `apps/web/public/sistemas/index.html`
- Create: `apps/web/public/sistemas/catalog.css`
- Create: `apps/web/public/sistemas/catalog.js`

**Interfaces:**
- Consumes: `./products.json`.
- Produces: busca, filtros, cards e dialog de detalhes.

- [ ] Criar HTML sem dependência do shell operacional.
- [ ] Criar CSS mobile-first responsivo.
- [ ] Renderizar categorias, busca e cards via DOM seguro.
- [ ] Implementar dialog `Ver sistema` e CTA opcional `Já sou cliente`.
- [ ] Tratar falha de carregamento do JSON com estado de erro legível.

### Task 4: Revisão de isolamento

**Files:**
- Compare branch contra `main`.

- [ ] Confirmar que apenas docs, verificador e `public/sistemas/**` mudaram.
- [ ] Confirmar que nenhum arquivo protegido foi alterado.
- [ ] Abrir PR sem merge automático para revisão final.
