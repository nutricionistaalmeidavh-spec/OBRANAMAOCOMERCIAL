# Catálogo público ArtiSys — design fases 0–3

## Objetivo

Adicionar um catálogo público em `artisys.dev/sistemas/` como extensão comercial da marca ArtiSys, sem alterar o runtime operacional do Obra na Mão.

## Escopo desta entrega

- Fase 0: blindagem e contrato de isolamento.
- Fase 1: estrutura pública do catálogo em `apps/web/public/sistemas/`.
- Fase 2: registro central `products.json` com cinco produtos iniciais.
- Fase 3: UI mobile-first com busca, filtros e cards.

## Fora de escopo

- páginas individuais `/sistemas/<slug>/` completas;
- checkout novo;
- alteração da home `/`;
- alteração da Central `#owner`;
- mudança de SEO/sitemap nesta entrega;
- alteração em Worker, D1, autenticação, licenças ou billing.

## Regra de isolamento

Esta entrega não pode modificar:

- `apps/web/sistema.html`
- `apps/web/obra.html`
- `apps/web/gestao.html`
- `apps/web/universidade.html`
- `apps/web/src/portal.ts`
- `apps/web/src/owner.ts`
- `apps/web/src/main.ts`
- `apps/web/backend/**`
- `apps/web/cloudflare/**`
- `apps/web/wrangler*.jsonc`
- migrations D1

O catálogo deve funcionar apenas com HTML, CSS, JavaScript e JSON estáticos sob `apps/web/public/sistemas/`.

## Produtos iniciais

1. PDV ArtiSys — Comércio — desktop — R$ 189.
2. Obra na Mão — Construção — SaaS — acesso existente via `/sistema.html#portal`.
3. Loja Online — Comércio — SaaS — produto administrado pela Central ArtiSys.
4. Débora Lactação — Saúde — web — produto administrado pela Central ArtiSys.
5. Oficina Agrícola — Agro — desktop — preço não publicado nesta fase.

Preços não confirmados devem aparecer como `Sob consulta`; nenhum preço deve ser inventado.

## UX

- mobile-first;
- busca por nome, categoria e descrição;
- filtros por categoria;
- cards com nome, categoria, tipo, descrição curta, preço e status;
- botão `Ver sistema` abre detalhes resumidos em um `dialog` local;
- quando houver `accessHref`, exibir `Já sou cliente` sem alterar a autenticação existente;
- não usar screenshots falsas ou mockups.

## Dados

`products.json` é a única fonte de verdade do catálogo público nesta fase. Cada item deve ter `slug`, `name`, `category`, `type`, `status`, `priceLabel`, `summary`, `features`, `featured` e `accessHref` opcional.

## Segurança

O catálogo não executa código do sistema operacional, não inicializa sessão, não importa módulos TypeScript e não chama APIs privadas. Links externos devem usar HTTPS; links internos devem ser relativos ao domínio.

## Critérios de aceite

- `/sistemas/` renderiza sem depender de login;
- cinco produtos aparecem;
- busca e filtros funcionam;
- detalhes funcionam sem navegação para páginas inexistentes;
- Obra na Mão continua sendo acessado somente pelo fluxo existente;
- nenhum arquivo protegido pelo contrato de isolamento é alterado.
