# ArtiSys Marketing — P0, P1, P2 e P3

Vitrine comercial estática em Astro com Astro Component Kit (MIT), Motion (MIT) e Embla (MIT), 100% licenciada para uso local e self-hosted, sem serviço externo obrigatório.

## Arquitetura

- Catálogo canônico: `apps/web/public/sistemas/products.json`; preços, destinos, categorias e screenshots são lidos desse único arquivo.
- Contratos de navegação e validação: `apps/web/catalog-contract.mjs`.
- Astro produz a página `dist-preview/index.html` e arquivos `dist-preview/_artisys-marketing/*` (sem backend).
- Build do site: `npm run build` em `apps/web` primeiro compila a aplicação atual no Vite, depois compila Astro e integra **somente** `/sistemas/index.html` e `/_artisys-marketing/*` no mesmo `dist`.
- `/api/*`, logins, operações de obra, licenciamento, pagamentos, D1, R2, demais landing pages e arquivos do Worker permanecem intactos.
- O código antigo do catálogo em `apps/web/public/sistemas/index.html` continua no repositório como fallback; o build novo o substitui só no diretório gerado.
- `/sistemas/agro/` e os demais links de segmento continuam funcionando separadamente.

## P2 — Vitrine

O Astro renderiza os cards em HTML estático. O visitante pode pesquisar e filtrar categorias. JavaScript apenas controla visibilidade dos cards já existentes, sem segundo store, requests de catálogo ou MutationObserver. Os oito sistemas priorizados mantêm suas landing pages; a consultoria de amamentação original continua como nona entrada.

## P3 — Capturas reais e efeitos

As imagens são arquivos reais previamente publicados e validados do CRM WppProspector, Financeiro, Holerites, Oficina e PDV ArtiSys. Outros produtos usam um card tipográfico da marca até haver screenshot real. **Não são gerados mockups fictícios.**

- Manifesto de mídia, descrição e alt-text fica em `products.json`.
- `npm run check:media --prefix apps/marketing-astro` verifica o arquivo local, formato, existência e conteúdo.
- O Embla navega pelas imagens reais, com toque, botões e teclado.
- Motion acrescenta animações leves quando o visitante não solicita movimento reduzido.
- O kit Astro é importado por componente, **sem CSS global e sem chamadas ao Google Fonts**.
- Testes Playwright capturam o catálogo em 320, 390, 768 e 1440 px e validam funcionalidade, links, mídia e overflow.

## Execução e QA

```bash
npm ci --prefix apps/web
npm run build --prefix apps/web
npm run marketing:verify --prefix apps/web
# para teste visual, com Playwright e Chromium previamente instalados:
npm run qa:marketing --prefix apps/web
```

Build isolado:

```bash
cd apps/marketing-astro
npm install --no-audit --no-fund
npm run check:catalog
npm run build
npm run dev
```

O build integrado instala dependências Astro caso ainda não estejam disponíveis. Core do site não faz chamadas obrigatórias a serviços pagos.

## Rollback

Para retornar ao HTML antigo sem mudar conteúdo comercial, remover a etapa `node scripts/build-marketing.mjs && node scripts/verify-marketing-build.mjs` do script `build` em `apps/web/package.json`. O próximo build voltará a copiar o HTML original de `apps/web/public/sistemas/index.html`. Não executar migrações de banco como parte desse rollback.

## Publicação

O merge em `main` não significa automaticamente deploy: o CI principal pode ter jobs de produção desabilitados. Publicar apenas pelo fluxo autorizado e validar `https://artisys.dev/sistemas/` após o deploy. Não alterar secrets/chaves ou rotas de API como parte da publicação.
