# ArtiSys — fontes canônicas de analytics no painel Marketing e SEO

## Dicionário e origem dos números

| Origem exibida | Endpoint owner | Coleção D1 `kv_records` | Definição |
| --- | --- | --- | --- |
| Página inicial `artisys.dev/` | `/api/owner/marketing-analytics?days=7\|30\|90` | `artisys_marketing_daily_v1` | `view:home` = carregamentos; `site_click:home:<destino>` = cliques em links classificados |
| Vitrine `/sistemas/` | mesmo endpoint comercial | mesma coleção | `view:catalog` = carregamentos da vitrine |
| Landing pages | mesmo endpoint comercial | mesma coleção | `view:<slug>` = carregamentos; `product_click:<slug>` = cliques vindos da vitrine; `checkout_click` = intenção, **não pedido nem pagamento**; `contact_click` = clique em contato |
| `/links/` | `/api/owner/links-analytics?days=7\|30\|90` | `artisys_links_daily_v1` | `view` = carregamento; `click:<linkId>` = clique por destino fixado no código |

As métricas são contagens **de eventos**, não visitantes únicos nem conversões comprovadas. O mesmo percurso pode gerar uma abertura da homepage, um clique para a vitrine e uma abertura da vitrine: são **três eventos de diferentes naturezas**, não três pessoas. **Não somar** as três fontes para declarar visitas totais ao domínio. O monitoramento da página inicial **não substitui** analytics abrangentes de todo o domínio; outras rotas, como DevKits, ainda não são incluídas no contador de aberturas da home.

Há também Cloudflare Web Analytics/Beacon instalado pela infraestrutura existente. Seus dados **não** são misturados ou reclassificados como contadores first-party desta Central. O sistema da Central opera sem bibliotecas pagas e sem dependência do Cloudflare Web Analytics. Umami continua opcional, não obrigatório.

## Canonicidade

1. As duas APIs existentes são a fonte de verdade; nenhum dado de `/links/` é replicado nem mesclado na coleção comercial.
2. Ambas usam a mesma janela: `days=7\|30\|90`, fuso `America/Sao_Paulo`, contagem diária D1 por chave e incremento atômico (UPSERT).
3. Validação no frontend antes de renderizar: resumo comercial = catálogo + produtos = série diária; home = série diária = destinos; links = série diária = destinos; `interactionRate` de links corresponde a cliques / aberturas × 100.
4. Uma fonte indisponível gera mensagem explícita, **não 0 falso**; dados de outras fontes podem ser exibidos separadamente com aviso. Fontes retornando valores divergentes ocultam os cartões até correção.
5. Frontend rotula `product_click` como **clique da vitrine** e `checkout_click` como **intenção de compra**; nunca como vendas confirmadas ou usuários únicos.
6. Primeira medição da home começa somente após a nova publicação; não há backfill ou estimativa histórica.

## SEO e limitações da entrega

- O módulo SEO da Central permanece com D1 de overrides e HTML `<head>` apenas. A instrumentação da home é exclusivamente `<script defer src="/sistemas/home-analytics.js">` no `<head>`, preservando todo o `<body>`.
- As landing pages individuais e a página `/links/` mantêm seus layouts, CTAs, estilos, scripts próprios e canonicals.
- Nenhuma migração do D1, alteração de secret, login ou licença é necessária.
- `/api/owner/*` exige `role=owner` pelo mecanismo de autenticação central. A API de eventos públicos aceita somente nomes e destinos previamente listados, sem IP, cookies, UTM ou URL arbitrária persistida.
- `analyticsViews` de quaisquer sistemas são eventos registrados, não volume total de requisições HTTP nem métricas históricas do Cloudflare.

## Testes

```bash
cd apps/web
npm ci
npx vitest run cloudflare/marketing-analytics.test.ts cloudflare/links-analytics.test.ts src/marketing-analytics-canonical.test.ts src/owner-navigation.test.ts
npm run build
npm run qa:marketing   # Playwright + Chromium instalados
```

Validações de release seguem o workflow Commercial Cloudflare CI. As contagens do painel podem ser auditadas com `SELECT id, CAST(json_extract(record_json,'$.count') AS INTEGER) FROM kv_records WHERE collection IN ('artisys_marketing_daily_v1','artisys_links_daily_v1')` em conexão somente leitura, sem consultar dados pessoais.
