# Obra na Mão Comercial

Base comercial independente do ecossistema Obra na Mão.

## Estrutura

- `apps/web`: aplicação online/PWA, APIs e runtime Cloudflare.
- `apps/desktop`: aplicativo Electron/SQLite, compilado separadamente.
- `packages`: contratos, domínio e integração compartilhados.

## Deploy online

O Cloudflare deve apontar somente para `apps/web`.

### Opção recomendada para o primeiro deploy: Cloudflare Pages + Functions

- Root directory: `apps/web`
- Build command: `npm install --no-audit --no-fund && npm run build`
- Output directory: `dist`
- Functions: `apps/web/functions`
- Build watch include: `apps/web/**`

Bindings:
- `DB` → D1
- `FILES` → R2 Standard

Secrets/variáveis:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `OWNER_EMAIL`
- `GEMINI_API_KEY`
- `OWNER_COMPANY`
- `OWNER_PROJECT`
- `OWNER_CUSTOMER`

O callback OAuth do Google deve ser:
`https://SEU-PROJETO.pages.dev/api/auth/callback`

O runtime Worker equivalente também está em `apps/web/cloudflare/worker.ts` e pode ser publicado depois com Wrangler.

## Desktop

O Desktop não é enviado ao Cloudflare.

O GitHub Actions gera o instalador Windows a partir de `apps/desktop`.

Identidade comercial própria:
- appId: `br.com.obranamao.comercial.desktop`
- produto: `Obra na Mão Desktop`
- diretório local: `obra-na-mao-comercial`

Isso impede mistura com o banco local da instalação privada da MH.

O endpoint online é configurável em:
`Configurações → Conexão Obra na Mão`

Depois do primeiro deploy Cloudflare, informe ali a URL `pages.dev` ou `workers.dev` correspondente.

## Regra de desenvolvimento

A instalação privada da MH e este produto comercial evoluem separadamente.

Melhorias comuns podem ser portadas seletivamente, mas alterações comerciais não devem ser aplicadas automaticamente ao sistema privado.
