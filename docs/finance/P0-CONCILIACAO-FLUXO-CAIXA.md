# P0 — Conciliação bancária e fluxo de caixa
Implementação na PR #234, aguardando aprovação de merge e release.

## Escopo entregue na branch

- **B0:** financeiro canônico por fonte (SQLite Desktop local ou Obra na Mão Server LAN/próprio), com roteamento central e sem fallback local em `central-active`.
- **B1:** contas bancárias cadastráveis por empresa (saldo/data inicial, edição, ativação e desativação).
- **B2:** importação OFX/CSV com prévia, deduplicação, confirmação transacional, histórico e mapeamento CSV.
- **B3:** sugestões determinísticas de correspondência entre transação bancária e `pagamentos_conta` existentes; permite múltiplos pagamentos por transação, parcelas, checagem de saldos remanescentes, histórico, idempotência, reversão com motivo e auditoria por dispositivo/membro.
- **C0:** cálculo diário do saldo realizado por conta e consolidado: saldos de referência + transações bancárias importadas posteriores à data de saldo. Histórico diário de 30 dias com cobertura explícita.
- **C1:** projeção de 30/60/90 dias a partir de contas a pagar/receber, abatimento de pagamentos já realizados até a referência, contas vencidas projetadas para o primeiro dia futuro, alertas de saldo negativo, gráfico e tabela diária.

## Matriz de persistência

| Modo | Fonte de escrita |
|---|---|
| Desktop local | SQLite do Desktop, migrations 021/022 |
| Servidor LAN/próprio | SQLite central LAN, migrations 032/033 |
| Central ativa, conexão indisponível | Bloquear escritas; jamais cair silenciosamente no banco local |
| Web existente no Cloudflare | Fora do escopo desta PR; não criar site ou fonte de dados paralela |

O novo código está em `apps/lan-server/src/bank-finance.cjs` e `bank-p0.cjs`, reutilizado pelo Desktop e pelo servidor. O fluxo acessa `pagamentos_conta` para conciliação, mas **não cria nem apaga pagamentos durante a vinculação/desvinculação**. A confirmação de cada vínculo é transacional e idempotente. Reversões ficam registradas como `reversed`, preservando o histórico.

## Endpoints do servidor

- GET/POST/PATCH `/api/v1/finance/bank-accounts`
- POST `/api/v1/finance/bank-imports/preview`
- POST `/api/v1/finance/bank-imports/confirm`
- GET `/api/v1/finance/bank-imports` e `/bank-transactions`
- GET `/api/v1/finance/bank-reconciliation/suggestions`
- POST `/api/v1/finance/bank-reconciliation/confirm`
- POST `/api/v1/finance/bank-reconciliation/reverse`
- GET `/api/v1/finance/bank-reconciliation`
- GET `/api/v1/finance/cash-flow`

Os endpoints do servidor exigem autenticação e permissão do domínio Financeiro; conciliação e reversão exigem `approve`. No servidor, o autor da ação é derivado do contexto autenticado, nunca aceito do corpo da requisição. Essas APIs dão suporte ao Desktop conectado, não formam um aplicativo Web.

## UX — passos reais

1. Financeiro > Contas bancárias: selecionar a empresa, cadastrar conta e saldo inicial.
2. Importar OFX/CSV, conferir preview e confirmar as movimentações.
3. Na seção Conciliação, selecionar a transação, conferir pagamentos sugeridos e marcar um ou vários, ajustando valores parciais. Confirmar.
4. Histórico permite desfazer com justificativa, sem excluir pagamentos ou transações.
5. Financeiro > Fluxo de caixa: selecionar empresa, referência, janela 30/60/90 e visualizar saldos e alertas.

## Limites explícitos (não confundir com P1/P2)

- **Não há consulta em tempo real a banco/API bancária**: saldos reais são calculados a partir do último saldo inicial informado e dos extratos efetivamente importados; sem extrato completo, o saldo exibido pode estar incompleto.
- **B3 concilia pagamentos/recebimentos já registrados**. Se existe transação sem pagamento no financeiro, registrar a baixa em Financeiro > Contas e então vincular. Não efetuar baixa automática por extrato.
- **C1 prevê obrigações existentes**, com seus vencimentos e saldos pendentes. Não gera automaticamente novas parcelas contratuais ou futuras recorrências que ainda não estejam cadastradas.
- Sem filtros avançados de obra e banco nesta etapa (P1 C2 já implementado para Desktop na mesma PR), sem simulador de cenários (P2 C3), sem fechamento avançado (P2 B5). O P1 é exclusivo do Desktop e das APIs necessárias ao Desktop conectado ao servidor.
- O vínculo é contábil/operacional, não reconhecimento bancário por API externa nem comprovante de quitação certificado.
- Core gratuito/self-hosted/open source, sem serviço pago obrigatório.

## Critérios de QA

- Testar migração 021/022 em Desktop e 032/033 em LAN e atualização de instalações antigas.
- Testar imports duplicados, arquivos diferentes com FITID repetido e rollback.
- Testar conciliação 1:N, parcialmente conciliado, limite por pagamento, compatibilidade do tipo receita/despesa e isolamento de empresas.
- Testar reenvio idempotente e reversão; históricos preservados; nenhuma criação/remoção de `pagamentos_conta` por conciliação.
- Testar saldo diário com e sem extrato, recorte por referência e previsão a partir do restante devido sem duplicar baixa.
- Testar rotas LAN autenticadas, permissões e identidade de auditoria; teste de build/QA UI com fluxo manual.
- Sem merge ou release antes de todos os gates obrigatórios aprovados e autorização.
