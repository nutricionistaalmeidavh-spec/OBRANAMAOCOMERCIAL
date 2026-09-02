# Cloudflare — passos restantes do proprietário

Worker atual:
`https://obra-na-mao-comercial.nutricionistaalmeidavh.workers.dev`

Superadmin esperado:
`nutricionistaalmeidavh@gmail.com`

## 1. Criar D1

No Cloudflare:
Workers & Pages / Storage & Databases / D1 / Create database

Nome:
`obra-na-mao-comercial`

Depois copie o **Database ID** e informe no chat. O ID não é segredo.

Após o binding entrar no `wrangler.jsonc`, execute uma vez o SQL:
`apps/web/cloudflare/migrations/0001_base.sql`

Binding esperado:
`DB`

## 2. Criar R2

No Cloudflare:
R2 Object Storage / Create bucket

Nome:
`obra-na-mao-comercial-files`

Binding esperado:
`FILES`

R2 é usado para PDFs, OFX/CSV importados, anexos e demais arquivos. Ele não participa das respostas de texto da Gemini.

## 3. Google OAuth

No Google Cloud Console:
APIs & Services → Credentials → Create credentials → OAuth client ID → Web application

Authorized JavaScript origin:
`https://obra-na-mao-comercial.nutricionistaalmeidavh.workers.dev`

Authorized redirect URI:
`https://obra-na-mao-comercial.nutricionistaalmeidavh.workers.dev/api/auth/callback`

Depois configure no Worker:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Não envie o Client Secret pelo chat. Cadastre diretamente no Cloudflare.

## 4. Gemini

Crie/reutilize uma API key da Gemini e cadastre no Worker como secret:

`GEMINI_API_KEY`

Não envie a chave pelo chat.

O Financeiro e a IA continuam no Desktop. O fluxo é:

Desktop → Worker → regras determinísticas / D1 → Gemini API → Worker → Desktop

A chave Gemini fica somente no Worker. O Desktop nunca recebe a chave.

## 5. Diagnóstico

Depois do próximo deploy, acesse:

`https://obra-na-mao-comercial.nutricionistaalmeidavh.workers.dev/api/health`

A resposta não mostra segredos. Ela informa:

- `readyForLogin`
- `readyForDesktopAi`
- `readyForFileImports`
- estado dos bindings D1, R2, Google OAuth, Gemini e owner
- se a migration do D1 já está aplicada

Quando tudo estiver pronto, o esperado é:

`readyForLogin: true`
`readyForDesktopAi: true`
`readyForFileImports: true`

## 6. Desktop

O Desktop comercial já usa por padrão:

`https://obra-na-mao-comercial.nutricionistaalmeidavh.workers.dev`

Também é possível alterar o endpoint em Configurações → Conexão Obra na Mão.

O Financeiro não aparece na interface web comercial. Ele permanece no Desktop, consumindo as APIs do Worker.
