# P2 — Liberação do Login Google para clientes (Obra na Mão)

**Status:** Automação QA de navegador implementada nesta branch. **O login com uma conta Google externa real e a homologação em dispositivos físicos NÃO estão comprovados.**

## Evidências automatizadas (R$ 0)

Executar de `apps/web` após `npm ci`, `npm run build` e instalação do Playwright Chromium + WebKit:

```sh
node scripts/qa-google-customers-e2e.mjs
```

O script usa o build Web/PWA em `vite preview` local, motores de navegador reais (Chromium e WebKit), mas **Google Identity Services e respostas de API simuladas**. Não envia ID tokens reais, não acessa licenças de clientes e não altera o D1. Gera evidências em `qa-artifacts/google-customer-auth-e2e/`.

- iPhone: perfil mobile de iPhone em **WebKit de Linux**, não Safari em iOS físico.
- Android: perfil de Pixel em **Chromium de Linux**, não Android físico.
- Desktop Web: Chromium de Linux; o Electron Desktop é coberto separadamente por `qa-desktop-renderer-transactional.mjs` e `qa-collaborator-onboarding-e2e.mjs`.
- Para cada perfil, testa: cliente ativo, licença ainda sem empresa, sem licença, só Desktop, bloqueado, pendente, PWA proibido e falha de autenticação Google.
- São **24 cenários**; captura imagens do login, acesso licenciado e erro Google. A execução de QA de release falha se algum cenário ou perfil estiver ausente.

O `report.json` registra `providerMocked: true` e `realExternalGoogleAccountVerified: false`. **QA automatizado aprovado não equivale a autorização para publicar comercialmente.**

## Bloqueio obrigatório: teste externo real

**Não usar contas pessoais de clientes sem consentimento.** Usar contas de homologação autorizadas e um cadastro/licença de teste isolados da operação real.

1. Na conta Google Cloud correta, conferir em produção os domínios e o redirect exato utilizado pelo sistema, especialmente `/api/auth/callback` para o fluxo de autorização e as origens do Google Identity Services.
2. Em um iPhone físico com Safari: abrir o endereço Web oficial do Obra na Mão, entrar via Google com conta de homologação autorizada, confirmar redirecionamento para a mesma empresa/obras e sair. Repetir a falha/cancelamento do seletor Google.
3. Em um Android físico com Chrome: repetir o teste, incluindo retomada após recarregar a página e acesso Web/PWA.
4. Em um Desktop Windows com Chrome/Edge: entrar com o mesmo usuário, verificar a empresa e módulos; abrir o aplicativo Electron já instalado e conferir autorização/pareamento sem exigir segunda licença.
5. Testar conta externa **sem cadastro/licença**: não permitir acesso a dados empresariais nem criar empresa/licença automaticamente; apresentar orientação para o cadastro correto.
6. Testar usuário **bloqueado**, licença **revogada/expirada**, funcionário de empresa distinta e canal **Desktop-only**: confirmar rejeição de cada ação sem expor obras ou módulos de outras empresas.
7. Testar conta anteriormente cadastrada com e-mail/senha e depois Google: verificar que não houve duplicidade de usuário, convite, licença, empresa, obra ou dispositivo. Se o e-mail Google não corresponder ao e-mail autorizado, exigir correção/validação do vínculo.
8. Testar retorno ao sistema e logout, inclusive após sessão expirada. Confirmar que nenhum segredo, token, código de licença ou dado pessoal aparece no console, prints ou relatório.

**Registrar por plataforma:** modelo/versão do dispositivo e navegador, data/hora, identificador anonimizado da conta QA, resultado, URL acessada, screenshot sem dados pessoais, e eventual erro/sugestão. Não armazenar tokens/cookies OAuth nem credenciais em artefatos.

## Gate de autorização comercial

- [ ] CI `Commercial Cloudflare CI / validate` e `qa-release` com sucesso no commit final.
- [ ] `qa-artifacts/google-customer-auth-e2e/report.json` completo, 24/24 aprovações.
- [ ] Google OAuth externo real aprovado em iPhone Safari, Android Chrome e Desktop Web.
- [ ] Desktop Electron, licença e contas existentes sem duplicação.
- [ ] Conta bloqueada, expirada, sem licença e multiempresa verificadas com dados QA.
- [ ] Verificado URL de acesso Web/PWA nos e-mails de boas-vindas, com instrução de escolher o e-mail cadastrado.
- [ ] Revisão final da PR antes de merge; merge/deploy somente com aprovação explícita do responsável.

**Não publicar automaticamente:** o workflow `commercial-cloudflare-ci.yml` mantém os jobs de produção desabilitados. A branch P0/P1/P2 permanece isolada até autorização.
