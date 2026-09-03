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
- Build command: `npm run build` (a instalação automática executa `npm ci`)
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

## Imagens da Universidade

As 549 imagens das questões são assets estáticos canônicos, versionados individualmente em `public/question-images/` e ligados ao `questionId` por `public/resources/question-visual-map.json`.

A migração do pacote legado foi concluída. O ZIP não participa do runtime, do build nem da fonte atual do projeto. `npm run assets:verify` bloqueia o build se faltar qualquer ID, entrada de mapa ou arquivo.

## Segurança

Nenhuma senha Google é armazenada. O cookie de sessão principal é HttpOnly/Secure/SameSite=Lax. Chaves OAuth e Gemini devem ser configuradas como secrets no Cloudflare, nunca commitadas.


## Monorepo / Git

O repositório contém aplicações diferentes. Para Cloudflare, configure a raiz do projeto como `apps/web`. O diretório `apps/desktop` não faz parte do deploy Cloudflare. Alterações no Desktop podem ser excluídas dos Build watch paths para evitar builds online desnecessários.

Para Workers Builds, use o mesmo repositório e a raiz `apps/web`. O comando de deploy é `npx wrangler deploy`.

### Instalação independente da aplicação web

`apps/web` é um pacote npm independente, com seu próprio `package-lock.json`, e não integra a lista de workspaces da raiz. Isso permite que a instalação automática do Cloudflare execute `npm ci` em `apps/web` sem procurar um lockfile na raiz ou instalar dependências do Desktop. Os atalhos `test:web` e `build:web` da raiz usam `npm --prefix apps/web`.

O CI também executa `npm ci` sem flags de isolamento para verificar o mesmo caminho de instalação usado pelo Cloudflare. Mantenha a raiz do Worker em `apps/web`, o build em `npm run build` e o deploy em `npx wrangler deploy`.
