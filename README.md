# Obra na Mão Comercial

Base comercial independente do ecossistema Obra na Mão.

## Estrutura

- `apps/web`: aplicação online/PWA, APIs e runtime Cloudflare.
- `apps/desktop`: aplicativo Electron/SQLite, compilado separadamente.
- `packages`: contratos, domínio e integração compartilhados.

## Deploy online

O Cloudflare deve apontar somente para `apps/web`.

### Página inicial ArtiSys

- `/` apresenta a página comercial ArtiSys, com a identidade aprovada e a MH somente como cliente na seção de depoimentos.
- O ícone **Acessar sistema**, no menu superior e sempre visível no celular, abre `sistema.html#portal`. Login Google, celular, primeiro acesso e permissões usam os fluxos existentes.
- Links antigos como `index.html#portal`, `#owner`, `#activate=...` e `#desktop-auth=...` continuam funcionando; a entrada preserva query e fragmento e encaminha ao sistema.
- Gestão, Obra e Universidade mantêm suas páginas e assets separados. A página pública não importa o CSS nem inicializa a sessão do sistema.
- O botão **Início** do portal retorna à página ArtiSys.

Os contatos WhatsApp e Instagram foram preservados da página aprovada. O WhatsApp `5516999999999` ainda é provisório e precisa de confirmação antes de campanhas.

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

### Universidade — imagens das questões

As 549 imagens ficam versionadas individualmente em `apps/web/public/question-images/`, com nomes derivados do ID canônico da questão. O mapa `apps/web/public/resources/question-visual-map.json` faz a ligação direta `questionId → arquivo`.

O build executa `npm run assets:verify` e falha se houver imagem, ID ou entrada de mapa ausente. A migração do ZIP legado já foi encerrada: o build e o runtime usam somente os assets individuais versionados no repositório.

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
