# Commercial RH Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portar ao desktop comercial as correções técnicas de impressão/reimpressão, o hub de RH e a geração seletiva/configurável de benefícios sem quebrar rotas ou fluxos existentes.

**Architecture:** Preservar as rotas atuais e os contratos IPC existentes, adicionando uma rota `/rh` como hub. Evoluir `TimeService` para imprimir HTML real em lote, reimprimir sem gerar PDFs duplicados e gerar apenas os tipos selecionados. No comercial, benefícios permanecem configuráveis pelos dados da empresa/folha; nenhuma regra fixa de valor da MH será copiada.

**Tech Stack:** Electron, React 19, TypeScript, Vitest, better-sqlite3, pdf-lib.

**Spec:** Requisitos aprovados nesta conversa: 3 entregas comerciais, preservação de páginas/fluxos existentes, sem hardcodes MH de benefícios.

## Global Constraints

- Preservar `/funcionarios`, `/registro-funcionario`, `/ponto` e `/rh/modelos`.
- Adicionar `/rh` sem remover acessos diretos existentes.
- Não copiar valores fixos de vale-alimentação/café da MH.
- Não excluir vale-transporte globalmente; a política deve ser configurável por empresa/benefício.
- Um funcionário inválido não bloqueia o restante do lote.
- Impressão deve usar a caixa normal do Windows, sem `silent:true` e sem imprimir o visualizador PDF oculto.

---

### Task 1: Impressão, reimpressão e geração seletiva

**Files:**
- Modify: `apps/desktop/electron/services/time-service.cjs`
- Modify: `apps/desktop/electron/services/time-service.test.ts`
- Modify: `apps/desktop/src/pages/TimeSheetPage.tsx`

**Interfaces:**
- Consumes: `window.fluxoDre.ponto.generateAll(payload)` já existente.
- Produces: `generateForAll({point,receipts,print,reprint})`, `buildPrintBatchHtml(entries, selection)`, reimpressão sem PDFs duplicados.

- [ ] Adicionar testes falhando para HTML de impressão real, seleção point/receipts, reprint e continuidade quando um cadastro falha.
- [ ] Implementar `buildPrintBatchHtml` e imprimir HTML via `webContents.print({silent:false, printBackground:true})`.
- [ ] Fazer `generateDocuments` respeitar `point !== false` e `receipts !== false`.
- [ ] Adicionar `reprintForAll` sem chamar geração/registro de PDFs.
- [ ] Ajustar UI para `Somente gerar`, `Reimprimir` e `Imprimir`, com relatório de falhas.
- [ ] Rodar testes do desktop e build.

### Task 2: Hub RH e reorganização de Folhas de ponto

**Files:**
- Create: `apps/desktop/src/pages/RhHubPage.tsx`
- Modify: `apps/desktop/src/App.tsx`
- Modify: `apps/desktop/src/modules/command-center/CommandCenterShell.tsx`
- Modify: `apps/desktop/src/pages/TimeSheetPage.tsx`
- Create/Modify: teste de contrato de rotas RH em `apps/desktop/tests/`.

**Interfaces:**
- Produces: rota `/rh` e cards que navegam para as quatro rotas existentes.

- [ ] Escrever teste que exige `/rh` e preserva as quatro rotas existentes.
- [ ] Criar hub com cards Funcionários, Registro de funcionário, Folhas de ponto e recibos, Modelos de documentos.
- [ ] Tornar o grupo RH navegável sem remover links diretos.
- [ ] Reorganizar `TimeSheetPage` com `Documentos da competência` e `Editar marcações do mês` recolhível.
- [ ] Rodar testes e build.

### Task 3: Política comercial configurável de recibos de benefícios

**Files:**
- Modify: `apps/desktop/electron/services/time-service.cjs`
- Modify: `apps/desktop/electron/services/time-service.test.ts`
- Modify/Create migration em `apps/desktop/database/migrations/` somente se a configuração atual não comportar a política.
- Modify UI de configuração existente se necessário, preservando campos/rotas atuais.

**Interfaces:**
- Produces: função de seleção de benefícios assináveis baseada em configuração da empresa/benefício, com fallback compatível para bases antigas.

- [ ] Mapear tabelas atuais de benefícios/configuração antes de criar schema novo.
- [ ] Escrever testes para múltiplas empresas com valores e benefícios distintos.
- [ ] Implementar política configurável sem hardcodes MH.
- [ ] Garantir que benefícios selecionados saiam juntos no mesmo PDF de recibos por funcionário.
- [ ] Garantir fallback retrocompatível para bancos existentes.
- [ ] Rodar testes e build completos.

### Task 4: Release comercial

**Files:**
- Modify: `apps/desktop/package.json` para incrementar a versão comercial.

- [ ] Rodar CI completo no PR.
- [ ] Corrigir regressões até CI verde.
- [ ] Fazer merge no `main`.
- [ ] Validar workflow Windows e release/asset publicados.
