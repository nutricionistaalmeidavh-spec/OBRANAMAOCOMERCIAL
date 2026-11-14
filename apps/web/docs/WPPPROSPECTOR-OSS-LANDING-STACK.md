# WppProspector landing — stack open source e self-hosted

Esta página é estática e mantém o HTML de fallback. O JavaScript de interface é compilado como uma ilha React isolada em `public/wppprospector/experience/`; **não transforma nem altera** o aplicativo Obra na Mão, seus logins ou rotas.

## Bibliotecas implementadas

| Prioridade | Tecnologia | Implementação |
| --- | --- | --- |
| P0 | shadcn/ui (MIT) | `src/wppprospector/ui/button.tsx`; botões acessíveis da galeria, Radix Slot/CVA |
| P0 | Magic UI (MIT) | `src/wppprospector/ui/magic-card.tsx`; halo por pointer nos cards reais |
| P0 | Motion (MIT) | Animação do hero e transições dentro da experiência React |
| P1 | Motion Primitives (MIT) | `ui/in-view.tsx`, revelação progressiva da galeria |
| P1 | Embla Carousel (MIT) | Carrossel real de três prints Playwright, arraste e navegação acessível |
| P1 | Umami (MIT) | Loader e eventos de CTA/galeria, **desativado** até conectar uma instância self-hosted |
| P2 | React Parallax Tilt (MIT) | Efeito suave do hero, **apenas** desktop com mouse e sem preferência por movimento reduzido |
| P2 | Lenis (MIT) | Disponível por flag explícita `desktopSmoothScroll`, desligado por padrão |
| P2 | tsParticles | Não incluído: efeito decorativo sem vantagem comprovada, evitar consumo no mobile |
| P3 | React Three Fiber | Não incluído: arte 2.5D usa capturas reais e dispensa WebGL pesado |

Componentes shadcn, Magic UI e Motion Primitives são **código versionado no projeto**, adaptado e atribuído a seus autores MIT. Nenhum produto premium ou API paga foi instalado.

## Build e verificação

A partir de `apps/web/`:

```bash
npm ci
npm run wpp:build
npm run wpp:verify
npm run build
```

O build produz `public/wppprospector/experience/experience.js` e `experience.css`, copiados para `dist/wppprospector/experience` no build principal do Vite. **Nenhuma CDN ou servidor de frontend pago é necessário.** O bundle inclui React, Motion, Embla e os componentes visuais, compilados localmente.

O HTML original permanece navegável sem React. As imagens da galeria e do hero vêm de imagens WebP que combinam screenshots reais do CRM capturados pelo Playwright com dados fictícios de QA.

## Umami: implantação opcional e sem dependência do core

1. Em `apps/web/ops/umami`, copie `.env.example` para `.env` e preencha **localmente** `UMAMI_DB_PASSWORD`, `UMAMI_APP_SECRET` e `UMAMI_2FA_KEY`. Para gerar cada segredo use `openssl rand -hex 32`. Não versionar `.env`.
2. Execute `docker compose up -d`. O painel fica em `http://127.0.0.1:3000` somente no servidor; proteja-o com HTTPS e proxy reverso antes de abrir para a internet.
3. Faça primeiro login na instância Umami, altere a senha padrão conforme orientação oficial, cadastre `artisys.dev` e copie o website ID.
4. Configure um proxy reverso HTTPS de `/analytics/script.js` e demais endpoints de coleta para a sua instância Umami **ou** use outro domínio HTTPS explicitamente autorizado com `allowExternal: true`.
5. Somente após validar o servidor e a política de privacidade, altere `public/wppprospector/analytics-config.js`: `enabled: true`, `websiteId` e `scriptUrl`. Não coloque chave secreta nesse arquivo público.

**Estado inicial:** Umami está desligado; não há envio de pageviews ou eventos, nem falha da landing quando a instância de analytics não existir. Ao ativar, eventos limitados aos nomes `crm_cta_click`, `crm_gallery_slide` e `crm_screenshot_open`, com valores genéricos, sem leads/telefones.

## Motion, performance e QA

- `prefers-reduced-motion` desativa revelações, tilt e Lenis.
- Tela pequena, toque e ponteiro impreciso não usam tilt.
- Lenis exige ativação explícita em `features.desktopSmoothScroll` e condições de desktop, antes de ir a produção.
- Sem particles nem React Three Fiber na bundle inicial.
- Playwright verifica largura 320/390/768/1440, imagens reais, botões Embla, ausência de scroll horizontal e console limpo.
- Para ver capturas de QA: Github Actions → Commercial Cloudflare CI → `qa-release` → artifact `obra-na-mao-web-qa`.

Repositórios de origem/licenças: https://github.com/shadcn-ui/ui (MIT); https://github.com/magicuidesign/magicui (MIT); https://github.com/ibelick/motion-primitives (MIT); https://github.com/motiondivision/motion (MIT); https://github.com/davidjerleke/embla-carousel (MIT); https://github.com/umami-software/umami (MIT); https://github.com/darkroomengineering/lenis (MIT).
