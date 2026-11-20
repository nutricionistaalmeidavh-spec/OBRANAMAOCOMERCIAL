# P1 — Financeiro do Obra na Mão DESKTOP

> Escopo corrigido em 18/11/2026. A etapa P1 **não inclui criação de site, painel Web adicional, login Web, nem alterações no portal Cloudflare**. Esta PR não altera o front-end Web atual.

## Produto entregue na PR #234

### Desktop — B4: experiência de conciliação bancária

Navegação existente do aplicativo Desktop:
- **Financeiro → Contas bancárias**: cadastrar, editar, ativar/desativar conta bancária e saldo inicial; importar extrato OFX ou CSV com prévia antes da gravação.
- Visualizar movimentações, histórico das importações, identificar linhas inválidas e duplicadas.
- Na conciliação: filtrar por empresa (contexto), banco, situação, obra vinculada via pagamentos, período e descrição. Selecionar pagamentos já existentes, distribuir valor entre pagamentos e desfazer com justificativa.
- Exportar CSV das movimentações **visíveis após os filtros**. A importação e conciliação **não criam outro pagamento/recebimento**.

### Desktop — C2: fluxo de caixa por empresa, obra ou banco

Navegação existente do aplicativo Desktop:
- **Financeiro → Fluxo de caixa**: escolher empresa, obra opcional, banco opcional, data e projeções de 30/60/90 dias.
- Saldo financeiro geral: saldos de referência informados + extratos importados (não representa consulta bancária em tempo real).
- Filtro por banco: projetar apenas as obrigações cuja **conta bancária prevista** tenha sido atribuída explicitamente. Obrigações sem essa atribuição permanecem no consolidado; não atribuir automaticamente a qualquer banco.
- Filtro por obra: apresentar movimento bancário **reconciliado e atribuído** aos pagamentos da obra e obrigações previstas dessa obra. Esta visão não é saldo bancário.
- **Conta bancária prevista**: vínculo opcional entre obrigação existente e conta bancária para a projeção, sem alterar o registro original `contas` nem reescrever `pagamentos_conta`.

### Backend necessário ao Desktop — somente infraestrutura

Quando o módulo Financeiro do Desktop opera com **servidor próprio autorizado**, o backend LAN fornece APIs autenticadas para o mesmo contrato de dados usado localmente no SQLite. O servidor **não possui nova interface Web**.

Contratos autenticados relevantes:
- `/api/v1/finance/bank-accounts`
- `/api/v1/finance/bank-imports/preview` e `/confirm`
- `/api/v1/finance/bank-imports`
- `/api/v1/finance/bank-transactions`
- `/api/v1/finance/bank-reconciliation/suggestions`, `/confirm`, `/reverse`
- `/api/v1/finance/bank-reconciliation`
- `/api/v1/finance/cash-flow`
- `/api/v1/finance/works`
- `/api/v1/finance/planned-banks`

Nenhuma API de lista global de empresas foi adicionada exclusivamente para uma interface Web. O Desktop continua usando sua funcionalidade existente de cadastro/seleção de empresas.

## Arquitetura e migrações

- Desktop local, sem servidor: banco SQLite local e migrations `021`, `022` e `023`.
- Desktop com servidor próprio: APIs autenticadas e banco SQLite LAN, migrations `032`, `033` e `034`.
- Fonte `central-active` não faz gravação local como fallback.
- `apps/lan-server/src/bank-finance.cjs` e `apps/lan-server/src/bank-p0.cjs` são códigos de domínio e cálculo usados **pelo Desktop em modo local e pelo backend em modo central**. Não são um aplicativo Web.

## Exclusões explícitas do escopo

- Não criar `/financeiro-web`, `finance-web.html`, `finance-web.css` ou `finance-web.js`.
- Não criar login/pareamento de navegador para um financeiro paralelo.
- Não adicionar testes Playwright de um site novo ao CI do Cloudflare.
- Não criar segunda fonte financeira, nem mudar `apps/web/src/finance.ts` ou `apps/web/backend/finance-integrated.ts` nesta PR.
- Não realizar merge, release ou publicação de instaladores sem autorização.

## Critérios de homologação

- Unitários: OFX/CSV, duplicidade, saldo inicial, conciliação parcial/1:N, reversão, isolamentos por empresa/obra e previsão de caixa.
- Integração: migrações SQLite Desktop e LAN, API de servidor e autorização, dados canônicos, modo local/remoto e erro de conexão sem fallback.
- UI/Desktop: build TypeScript, testes Electron, renderização em resolução reduzida, seleção de empresa/obra/banco, prévia CSV, importação e conciliação; smoke manual com OFX/CSV reais antes de venda.
- CI: servidor Windows/Linux, Desktop Windows/macOS, regressão multiplataforma e CI Cloudflare **inalterado em relação à main**.
- Sem serviço pago obrigatório: core R$ 0 / self-hosted / open source.
