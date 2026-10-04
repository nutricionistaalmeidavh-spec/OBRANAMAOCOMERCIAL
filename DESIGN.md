---
version: alpha
name: "Obra na Mão Comercial"
description: "Desktop operacional ArtiSys para gestão de obras, com interface densa, clara e orientada a decisão."
colors:
  navy: "#071A46"
  primary: "#0B59F5"
  cyan: "#0BB8F0"
  ink: "#101936"
  muted: "#69758F"
  background: "#F5F7FC"
  surface: "#FFFFFF"
  success: "#0C929D"
  warning: "#D77724"
  danger: "#D64555"
  border: "#DCE4F0"
typography:
  sans:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
rounded:
  DEFAULT: "1rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
spacing:
  section-gap: "1.25rem"
  page-max: "105rem"
components:
  button:
    source: "apps/desktop/src/components/ui.tsx"
  card:
    source: "apps/desktop/src/components/ui.tsx"
  dialog:
    source: "apps/desktop/src/components/ui.tsx"
  settings:
    source: "apps/desktop/src/modules/command-center/artisys-utilities.css"
---

# Obra na Mão Comercial Design System

## Overview

### Creative North Star

Uma central de operações de engenharia: leitura rápida, estados inequívocos e controles que parecem instrumentos de trabalho, não um painel decorativo. A identidade visual ArtiSys usa azul profundo, superfícies claras e acentos de status com parcimônia.

### Product context and register

- **Audience and primary job:** administradores, engenharia, financeiro e RH de empresas de obras; operar dados reais com segurança.
- **Target market(s) and evidence:** operação comercial brasileira do Obra na Mão; conteúdo e moeda em pt-BR no produto atual.
- **Locale(s) and language policy:** pt-BR; termos técnicos somente quando necessários e com explicação visível.
- **Usage scene:** Desktop Electron, uso frequente em escritório/obra, alta densidade de informação.
- **Register:** produto.
- **Memorable signature:** navegação ArtiSys azul-marinho e, em operações longas, uma faixa única de progresso operacional que resume o estado sem expor implementação interna.
- **Restraint:** configurações, migrações e permissões devem priorizar clareza e recuperação; evitar pilhas de cards técnicos.
- **Anti-references:** dashboards genéricos com excesso de cards, glassmorphism, estados internos expostos como UX principal e ações destrutivas sem contexto.
- **Token ownership/runtime mapping:** os tokens de runtime permanecem canônicos em `apps/desktop/src/modules/command-center/artisys-desktop.css` e `apps/desktop/src/styles/index.css`; este arquivo documenta a intenção e não gera CSS automaticamente.

## Colors

`navy` ancora navegação e identidade; `primary` é reservado a ações e foco; `cyan` é acento secundário. `success`, `warning` e `danger` são semânticos e nunca decorativos. Superfícies operacionais usam `background` + `surface`, com `border` para separação antes de sombra.

## Typography

Inter/system-ui é a família principal. Títulos e dados usam peso para hierarquia, não fontes decorativas. Labels técnicos são curtos, em sentence case sempre que possível; códigos, hashes e identificadores podem usar `mono`.

## Layout

O Command Center é o shell canônico. Configurações agrupam somente tarefas de sistema por intenção; política de pessoas, cargos, salários e benefícios pertence a Pessoas & RH. Cargos e remuneração é o owner visual dos valores-base consumidos pela Folha. Uma operação composta deve ocupar uma superfície principal de largura total quando isso reduzir fragmentação. Estados técnicos detalhados ficam em disclosure/accordion, não competem com a ação principal.

## Elevation & Depth

Cartões usam borda + sombra leve. Superfícies de progresso e recuperação usam tonalidade sem elevar visualmente acima da ação principal. Modais são reservados para confirmação real, não para etapas rotineiras.

## Shapes

Cards: 16px. Controles: aproximadamente 8–10px. Status compactos podem usar pill. Evitar arredondamento excessivo em tabelas ou layouts densos.

## Components

### Foundational visual states

Todo controle interativo tem hover, foco visível, disabled e busy. Operações longas usam `<progress>` ou status equivalente com texto persistente. Erros explicam o próximo passo.

### Buttons and actions

Ação primária descreve o resultado final (`Configurar servidor e migrar dados`). Ações de recuperação (`Tentar novamente`, `Reverter tentativa`) nunca competem visualmente com o caminho normal.

### Navigation and data display

Sidebar, breadcrumb e hubs existentes são canônicos. Tabelas continuam nativas e densas. Detalhes de infraestrutura usam listas compactas, não uma grade de cards.

### Forms and overlays

`Field`, `Button`, `Modal` e `Confirm` de `apps/desktop/src/components/ui.tsx` são os owners compartilhados. Select nativo é aceito quando o popup do SO é suficiente. Browser `alert/confirm/prompt` não pertence ao produto.

### Iconography

Lucide, traço simples, 14–22px. Ícone complementa texto; não substitui rótulos em ações importantes.

### Motion

Transições curtas e funcionais. Progresso comunica trabalho real. Respeitar `prefers-reduced-motion` quando animação adicional for introduzida.

### Content and data visualization

Copy direto, em pt-BR, orientado ao que o usuário controla. Estados internos (`migration-required`, `central-ready`) podem existir em detalhes técnicos, mas não como linguagem principal.

## Do's and Don'ts

- **Do:** resumir fluxos técnicos complexos em uma única jornada operacional.
- **Do:** manter recovery e diagnóstico disponíveis sem poluir o happy path.
- **Don't:** expor cinco módulos como cinco decisões independentes quando a política é migrar todos.
- **Don't:** alterar identidade visual ArtiSys para resolver uma única tela.
