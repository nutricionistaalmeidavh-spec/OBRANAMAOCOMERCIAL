# ArtiSys Holerites — landing estática

Rota canônica: `/gestãoholerites/` (`/gest%C3%A3oholerites/` no formato URL escapado).

Imagens promocionais licenciadas pelo usuário no chat: hero, recursos e impressão. Prints reais provenientes do artefato GitHub Actions do repositório `holerite` e documento real gerado pelo Electron. Todas as imagens usam dados fictícios. Imagens otimizadas em WebP (nove assets, ~560 KB no total).

A página usa somente HTML/CSS/JS estáticos e os assets do próprio repositório, sem APIs, provedores pagos, cookies de rastreamento, autenticação ou mudanças no produto. CTA comercial direciona ao WhatsApp informado na landing ArtiSys e à loja oficial do Mercado Livre, sem prometer SKU ou preço inexistente.

Testes automatizados: `src/holerites-landing.test.ts`. Verifique a rota, o sitemap, o HTML e os links após o deploy automático.

## Qualidade visual e stack P0 / P1

- **Correção das proporções:** a galeria usa a imagem integral com `object-fit: contain`, e o PDF real preserva a página A4 sem corte. O hero usa um *recorte* horizontal do arquivo de QA (não uma imagem sintética); a captura completa permanece na galeria.
- **shadcn/ui (linguagem visual):** tokens semânticos, estados acessíveis e componentes padronizados em CSS. A landing é HTML estático; portanto **não** instala componentes React de shadcn/ui nem cria runtime React oculto.
- **Magic UI (direção Bento):** Bento responsivo com bordas suaves e realces discretos implementado localmente sem dependência React.
- **Motion:** pacote open source empacotado em `experience.bundle.js`, para entrada de seções e transições respeitando `prefers-reduced-motion`.
- **Motion Primitives:** receita de microinteração magnética discreta nos CTAs para ponteiro fino, usando Motion, sem nova biblioteca nem CSS excessivo.
- **Embla Carousel:** pacote open source incluído no mesmo bundle local. Mantém o swipe, controles anterior/próximo, setas de teclado e fallback nativo.
- **Umami:** rastreamento de cliques pronto via `window.umami?.track`. **Opt-in**, auto-hospedado: inclua `<meta name="artisys-umami-script" content="/caminho-local/script.js">` e `<meta name="artisys-umami-id" content="ID">` somente ao implantar seu próprio Umami na mesma origem. Sem meta tags, não há cookies, coleta, custo nem requisição a terceiros.
- **P2/P3:** tilt, Lenis, partículas e React Three Fiber **não** foram instalados. Esses efeitos exigem teste visual/performance e não resolvem o defeito de proporção.

Arquivos de origem:
- `apps/web/src/holerites-landing-experience.ts`: integração Motion/Embla.
- `apps/web/public/gestãoholerites/experience.bundle.js`: bundle estático versionado (dependências incluídas).
- `apps/web/public/gestãoholerites/media/holerites-dashboard-viewport.webp`: recorte real de QA.
- `apps/web/scripts/qa-holerites-landing.mjs`: inspeção em Chromium desktop/mobile e capturas.
- `.github/workflows/holerites-stack-bundle.yml`: empacotamento reprodutível, sem dependências de CDN em produção.

O CI principal continua com o deploy de produção congelado. Nenhuma alteração em autenticação, bancos, segredos, checkout ou releases desktop foi necessária.
