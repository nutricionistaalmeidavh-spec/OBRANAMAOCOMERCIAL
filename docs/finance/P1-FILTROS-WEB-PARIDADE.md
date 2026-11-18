# P1 — Financeiro integrado: UX, filtros por obra/banco e acesso Web do servidor
Atualizado: 18/11/2026. Branch `design/finance-b0-b2-20261118`, PR #234.

## Entregas da implementação

**B4 — Interface completa de conciliação**
- Desktop em **Financeiro > Contas bancárias**: cadastro/edição/ativação de bancos, OFX/CSV com prévia e histórico, seleção de pagamento, vínculo parcial ou múltiplo, reversão com justificativa.
- Filtros por situação (todas, pendentes, parcialmente conciliadas, conciliadas), período, descrição e obra atribuída.
- Exportação local CSV dos movimentos filtrados.
- Sem baixa automática. Pagamentos devem existir em `pagamentos_conta` antes da conciliação.

**C2 — Financeiro por empresa, obra e banco**
- Desktop em **Financeiro > Fluxo de caixa**: empresa, banco e obra, com referência e janela de 30/60/90 dias.
- Consolidado: saldo de referência bancário + movimentos importados, sem misturar novamente os pagamentos operacionais.
- Conta bancária selecionada: saldo real da conta e **somente** projeções de obrigações com conta bancária planejada explicitamente.
- Obra selecionada: o realizado vem exclusivamente de valores reconciliados e atribuídos à obra por `pagamentos_conta -> contas.obra_id`. **Não é saldo bancário nem disponível financeiro da obra**.
- Planejamento da conta bancária: o gestor pode vincular ou desvincular cada obrigação; mantém-se a obrigação única na tabela `contas`. Um mapeamento único por `conta_id` reside em `conta_previsao_bancaria`.
- Comissões, recorrências futuras ainda não materializadas, contas ainda não registradas e movimentos de banco ainda não importados não entram automaticamente na projeção.

**P1 Web/Servidor**
- O módulo Web self-hosted é servido **pelo mesmo Obra na Mão Server** em `/financeiro-web`.
- Dados escritos e lidos nas mesmas entidades e SQLite do servidor; navegador não possui banco financeiro paralelo.
- É compatível com LAN e acesso remoto via HTTPS/VPN existentes, sem liberar CORS nem abrir outra porta.
- Interface de navegador para contas bancárias, importação OFX/CSV, conciliação e fluxo; suporte responsivo mobile.
- Pareamento pelo protocolo **já existente** de convite com código temporário (10 minutos, uso único): o admin gera um código para membro Desktop ativo; este acessa o Web e vincula o navegador como dispositivo. Token fica em `sessionStorage`, nunca em querystring ou localStorage. Revogação de dispositivo vale também para a sessão Web.
- Autorização real é conferida pela API LAN a cada requisição (domínio `finance`; ações `view`, `edit`, `create`, `approve`). A interface não substitui a segurança do servidor.

## Como acessar o Web local
1. Instale/inicie o **Obra na Mão Server** e realize a vinculação/licença da empresa.
2. Na mesma máquina: abra `http://127.0.0.1:4732/financeiro-web` (ou porta configurada).
3. Para outra máquina, use o hostname autorizado do servidor pela rede/VPN, preferencialmente HTTPS. Para acesso público, use o modelo de proxy reverso **Caddy** em `apps/lan-server/packaging/remote/Caddyfile.template`. Nunca exponha a porta 4732 diretamente à internet.
4. Um administrador autorizado do servidor emite código de pareamento para o colaborador com módulo Financeiro; o colaborador informa o código em **Conectar ao servidor**.
5. Se o membro não possui permissão Financeiro/desktop, o login ou os endpoints recusam acesso; nenhuma operação é gravada.

## Independência do portal Cloudflare
O módulo financeiro existente em `apps/web/src/finance.ts` e `apps/web/backend/finance-integrated.ts` tem estruturas diferentes e **não foi colocado como fonte de verdade do Obra na Mão**. Paridade Web no P1 significa a **interface nativa do servidor próprio/LAN** em `/financeiro-web`. Não implica que o portal público Cloudflare espelhe em tempo real o SQLite da empresa. Uma futura sincronização para Cloudflare exige projeto explícito, controle de permissões, provisionamento de conexão e contrato de dados; é proibido criar uma base financeira paralela.

## Migrações e serviços
- Desktop local: `021_finance_bank_import.sql`, `022_reconciliacao_bancaria.sql` e `023_finance_planned_bank.sql`.
- Servidor próprio: `032_finance_bank_import.sql`, `033_reconciliacao_bancaria.sql` e `034_finance_planned_bank.sql`.
- Código de domínio único: `apps/lan-server/src/bank-finance.cjs` e `bank-p0.cjs`. Sem fallback local em `central-active`.

## Contrato Web e Desktop
- `GET /api/v1/finance/companies`
- `GET /api/v1/finance/works?empresaId`
- `GET/POST/PATCH /api/v1/finance/bank-accounts`
- `POST /api/v1/finance/bank-imports/preview`, `/confirm`
- `GET /api/v1/finance/bank-imports`, `/bank-transactions` (status/data/obra/descrição)
- `GET /api/v1/finance/bank-reconciliation/suggestions`
- `POST /api/v1/finance/bank-reconciliation/confirm`, `/reverse`
- `GET /api/v1/finance/bank-reconciliation`
- `GET /api/v1/finance/cash-flow` (empresa, obra, banco, data, janela)
- `GET/POST /api/v1/finance/planned-banks`

## Regras de segurança
- Não exibir token em URL, log, cabeçalho público ou HTML; armazenamento em `sessionStorage` por aba.
- HTML/JS/CSS fornecidos por URLs fixas, sem permitir caminho arbitrário, headers CSP restritivos e `cache-control: no-store`.
- Browser usa API mesma origem: sem permissões CORS abertas.
- Acesso remoto público precisa TLS; LAN deve permanecer em rede confiável/VPN.
- Sem Gemini, Open Finance, bancos pagos ou outros serviços pagos como dependência.

## Critérios de entrega
- Testes P0 e P1 em `apps/lan-server/tests/bank-p0.test.mjs` e `bank-finance-http.test.mjs`.
- QA de servidor Windows/Linux, Desktop Windows/macOS e contratos multiplataforma.
- Teste HTTP confere rota Web e headers de segurança, autenticação e filtro C2.
- Homologação manual com extratos reais, navegadores desktop/mobile, permissões diferenciadas e screenshot Playwright devem ser concluídos antes de disponibilizar comercialmente.
- **Não realizar merge ou release sem autorização explícita.**
