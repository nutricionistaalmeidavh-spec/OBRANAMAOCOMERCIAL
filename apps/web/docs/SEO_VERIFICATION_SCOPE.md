# Escopo de verificação desta integração

A integração SEO foi projetada para não alterar Worker, D1, autenticação, billing ou licenciamento.

Verificação executável incluída no repositório:

- `npm run seo:generate`: regenera robots e sitemap pela configuração canônica;
- `npm run seo:verify`: valida canonical, Open Graph, Twitter Cards, JSON-LD, sitemap e noindex das entradas internas;
- `npm test`: regressão funcional existente;
- `npm run ux:verify`: contrato de UI existente;
- `npm run build`: geração final Vite, incluindo a transformação SEO.

O deploy manual deve executar esses gates antes de `wrangler deploy`.
