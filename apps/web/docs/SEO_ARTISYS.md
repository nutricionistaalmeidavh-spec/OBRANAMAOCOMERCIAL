# SEO da landing ArtiSys

A landing pública `https://artisys.dev/` usa um snapshot pinado do módulo `artisys-seo` do repositório `nutricionistaalmeidavh-spec/utilidades`.

## O que o build faz

1. `npm run seo:generate` gera `public/robots.txt` e `public/sitemap.xml` a partir de `seo.config.mjs`.
2. `npm run seo:verify` audita o contrato SEO antes do build.
3. O plugin `artisys-seo` em `vite.config.ts` injeta na landing pública title, description, canonical, robots, Open Graph, Twitter Cards e JSON-LD.
4. `sistema.html`, `gestao.html`, `obra.html` e `universidade.html` recebem `noindex,nofollow` somente no HTML de saída do Vite.

## Segurança da integração

- Nenhuma rota de API foi alterada.
- Nenhuma migration D1 é necessária.
- Nenhum secret novo é exigido para publicar o SEO técnico.
- O build falha antes do deploy caso o contrato SEO crítico regrida.
- A origem exata do snapshot está registrada em `vendor/artisys-seo/SOURCE.json`.

## Verificação local

```powershell
npm run seo:generate
npm run seo:verify
npm test
npm run ux:verify
npm run build
```

O Google Search Console permanece desacoplado do deploy técnico; credenciais administrativas não são necessárias para canonical, robots, sitemap, Open Graph, Twitter Cards e JSON-LD funcionarem.
