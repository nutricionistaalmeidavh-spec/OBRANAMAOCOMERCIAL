# ArtiSys Marketing — P4 a P6 (sem mudanças visuais)

Escopo: metadados de SEO, métricas agregadas de marketing e QA. **Não altera layout, CSS, componentes, imagens, HTML do corpo, CTAs ou checkout das landing pages.**

## P4 — Metadados

A fonte canônica é `apps/web/seo.config.mjs`. O build executa `apps/web/scripts/marketing-head.mjs` após gerar o Vite e o Astro. Ele atualiza **somente** o `<head>` na cópia gerada em `dist` para o catálogo `/sistemas/` e oito landings. O arquivo original de cada landing não muda.

Campos: `<title>`, descrição, `robots`, canonical, Open Graph, Twitter e JSON-LD. Imagens sociais reais são lidas de `products.json`, apenas onde a mídia foi validada. Os links `externalHref` locais passam a ser URLs absolutas em JSON-LD.

O build valida que o trecho `<body>` até `</html>` permanece idêntico entre fonte e `dist` para cada página individual. Ele também verifica que não há metadados duplicados.

## P5 — Métricas

O script `/sistemas/marketing-analytics.js` é **first-party**, sem cookies, IPs, URLs de visitantes, referrer, UTM ou identificadores persistidos. Ele recebe somente o identificador do produto e o tipo do evento por meio de um manifesto embutido no `<head>`. Nenhum serviço SaaS pago é carregado.

Eventos:

- `view`: visualização da vitrine ou landing.
- `product_click`: clique da vitrine para uma landing.
- `checkout_click`: clique de saída para checkout/página de compra, **não é uma venda**.
- `contact_click`: clique para contato.
- `gallery_click`: clique em link para a seção de imagens.

Transporte: `POST /api/marketing/metrics`, com payload somente `{"type":"view","product":"catalog"}` ou evento permitido + slug aprovado. Backend valida origem, campos e tamanho. A contagem é diária e atômica na collection `artisys_marketing_daily_v1` da tabela `kv_records` existente; nenhuma migração D1.

Consulta administrativa:

```http
GET /api/owner/marketing-analytics?days=7
GET /api/owner/marketing-analytics?days=30
GET /api/owner/marketing-analytics?days=90
```

É obrigatória uma sessão da Central com `role=owner`. A resposta contém resumo, série diária, totais da vitrine e ranking dos sistemas por eventos, **sem pedidos/vendas confirmadas**. Para conciliar vendas reais é necessária uma fonte de checkout existente e reconciliação separada, nunca inferência de cliques.

Na landing Oficina, o rastreamento só é acionado quando o consentimento já é `allowed` ou passa a ser permitido pelo visitante. O script não altera a interface do consentimento.

O Umami self-hosted já tem um `docker-compose.yml` próprio em `apps/web/ops/umami/` e continua **opcional**, sem conexão silenciosa e sem obrigação para o contador agregado existente. A infraestrutura atualmente publicada usa o Worker/D1 já configurado pela ArtiSys; fora dela, o adaptador de métricas precisa apontar para uma implementação self-hosted compatível. Não há novas APIs pagas.

## P6 — QA

```bash
cd apps/web
npm ci
npm run marketing:analytics:test
npm run build
npm run marketing:metadata:verify
npm run qa:marketing # Playwright/Chromium previamente instalados
```

Cobertura: whitelist de produtos, bloqueio Oficina Agrícola legado, rejeição de origem e dados pessoais, autorização owner, canonical/OG/JSON-LD, HTML visual intacto, links, filtros, Embla, visualização e clique de analytics no servidor QA local.

O workflow `artisys-marketing-storefront.yml` incorpora esses checks e screenshots mobile/desktop. A execução do build ou o merge na main **não força deploy nem ativa uma migração remota**. A publicação usa o fluxo Cloudflare existente, sem modificar secrets. O retorno à versão anterior pode ser feito revertendo o commit e republicando o build, sem migração de dados.
