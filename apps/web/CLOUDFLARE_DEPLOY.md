# Obra na Mão Comercial — Cloudflare

Esta pasta substitui as dependências de runtime do AppDeploy por serviços Cloudflare.

## Arquitetura

- Frontend: Vite/PWA.
- API: o mesmo backend de domínio, executado em Cloudflare Workers/Pages Functions.
- Banco: D1 através de uma camada compatível com `db.list/get/add/update/delete`.
- Arquivos: R2.
- Login: Google OAuth 2.0 com sessão HttpOnly armazenada no D1.
- IA/OCR estrutural: Gemini API através do segredo `GEMINI_API_KEY`.

## Deploy em Cloudflare Pages

Configuração recomendada para o primeiro teste:
- Root directory: `apps/web`
- Build command: `npm ci && npm run build`
- Build output: `dist`
- Functions directory: `functions`

Crie e vincule:
1. D1 com binding `DB`.
2. R2 com binding `FILES`.
3. Variáveis/segredos: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `OWNER_EMAIL`, `GEMINI_API_KEY`.
4. Rode `cloudflare/migrations/0001_base.sql` no D1.
5. No Google Cloud Console autorize o callback: `https://SEU-PROJETO.pages.dev/api/auth/callback`.

## Workers

Cloudflare atualmente recomenda Workers como plataforma principal para novos projetos full-stack. O mesmo código pode ser publicado com `wrangler deploy`; `wrangler.jsonc` já está preparado para isso.

## Assets grandes

O ZIP original `question-assets-549.zip` não é copiado para o repositório comercial. Ele deve ser expandido e publicado como assets estáticos ou no R2. O manifesto das 549 imagens foi preservado.

## Segurança

Nenhuma senha Google é armazenada. O cookie de sessão principal é HttpOnly/Secure/SameSite=Lax. Chaves OAuth e Gemini devem ser configuradas como secrets no Cloudflare, nunca commitadas.
