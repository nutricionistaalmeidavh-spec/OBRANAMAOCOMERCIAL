# SEO deploy check

Antes de publicar:

```powershell
npm run seo:generate
npm run seo:verify
npm test
npm run ux:verify
npm run build
```

O comando `npm run worker:deploy` já executa `npm run build` antes do Wrangler, portanto a geração e a auditoria SEO também são executadas automaticamente no deploy manual.
