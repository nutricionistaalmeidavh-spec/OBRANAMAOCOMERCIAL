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

## 7. Loja Online na Central Artisys

A Central Artisys gerencia a Loja Online sem copiar tenants ou licenças para o D1 do Obra na Mão.

Configuração de produção obrigatória:

1. Gere um segredo forte aleatório para `LOJAONLINE_LICENSE_SERVICE_SECRET`.
2. Cadastre **o mesmo valor** como secret no Worker `artisys-lojaonline` e no Worker `obra-na-mao-comercial`.
3. Publique primeiro o Worker da Loja Online contendo `/api/internal/artisys/loja-online/*`.
4. Confirme o Service Binding `LOJAONLINE_LICENSING -> artisys-lojaonline` no Worker da Central.
5. Publique o Worker `obra-na-mao-comercial`.
6. Abra `https://artisys.dev/sistema#owner` e confirme o card **Loja Online**.
7. Crie um tenant descartável, estenda +6 meses, bloqueie e desbloqueie.
8. Confirme que a aba Clientes e a auditoria exibem a Loja Online sem alterar Obra na Mão ou Débora Lactação.

Nunca coloque o valor de `LOJAONLINE_LICENSE_SERVICE_SECRET` em `wrangler.jsonc`, documentação, Git ou frontend.

Para desenvolvimento local, o adapter aceita `LOJAONLINE_LICENSE_BASE_URL` como fallback; em produção o caminho preferido é o Service Binding.

## 8. Central de Licenças no Painel Geral — fases 5 a 7

A nova Central do `artisys-mercadolivre` usa o Obra como autoridade e não recebe acesso direto aos D1 de licenciamento.

Configure os segredos de escrita separadamente dos segredos de leitura:

```bash
npx wrangler secret put LICENSE_CENTER_WRITE_SECRET --config wrangler.jsonc
```

No `MercadoLivre`, configure o mesmo valor em `OBRA_LICENSE_CENTER_WRITE_SECRET`. Não reutilize o segredo de leitura.

Antes do rollout, mantenha:

```text
LICENSE_CENTER_WRITE_ENABLED=false
```

Rode:

```bash
npm run qa:admin-parity
```

Depois siga o runbook completo em:

`apps/web/docs/LICENSE_CENTER_PHASES_5_7_RUNBOOK.md`

A escrita só deve ser habilitada depois do gate de paridade e do E2E isolado. O E2E live só pode criar/alterar registros QA do próprio `qaRunId`; clientes e licenças preexistentes são proibidos como alvo.

Durante toda a fase 7, mantenha `https://artisys.dev/sistema#owner` disponível como fallback.
