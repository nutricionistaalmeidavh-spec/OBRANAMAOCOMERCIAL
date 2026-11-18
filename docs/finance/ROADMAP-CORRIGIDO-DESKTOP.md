# Roadmap correto — financeiro do Obra na Mão Desktop

Versão de escopo: 18/11/2026. PR #234 permanece em rascunho até autorização de merge/publicação.

## Objetivo e limites

Aprimorar o **financeiro do aplicativo Obra na Mão Desktop**. O Desktop pode funcionar com SQLite local ou acessar APIs autenticadas do **Obra na Mão Server** quando esta infraestrutura opcional estiver configurada.

Não construir site, painel financeiro Web paralelo, novo login de navegador, sincronização extra com Cloudflare, outra fonte de verdade ou dependência paga. O Web atual no Cloudflare é um produto já existente e não faz parte deste roadmap de implementação.

**Core obrigatório:** R$ 0 / self-hosted / tecnologias open source. Serviços pagos só em uma proposta futura expressamente opcional.

## P0 — núcleo bancário e cálculo essencial (implementado na branch; homologar)

| Código | Entrega | Aceite |
|---|---|---|
| B0 | contratos canônicos e migrações | Desktop local e Desktop com servidor usam as mesmas regras; não gravar em fallback indevido |
| B1 | contas bancárias | criar/editar/ativar/desativar, saldo inicial e data, isolamento por empresa |
| B2 | importação OFX/CSV | selecionar → prévia → confirmar → histórico, deduplicação e rollback |
| B3 | conciliação determinística | vincular com pagamentos existentes 1:N/parciais, desfazer com justificativa, auditoria; sem criar outras baixas |
| C0 | saldos diários realizados | saldo informado + movimentações importadas, cobertura explícita |
| C1 | fluxo de caixa projetado | previsão diária de 30/60/90 dias, recebimentos/despesas pendentes, alerta de saldo negativo |

As tabelas `contas` e `pagamentos_conta` permanecem canônicas. A importação de extrato nunca transforma cada linha em nova despesa/receita automaticamente. O saldo calculado por extrato não é saldo consultado em tempo real no banco.

## P1 — usabilidade gerencial do **Desktop** (implementado na branch; homologar)

| Código | Entrega | Aceite |
|---|---|---|
| B4 | interface de conciliação, históricos e filtros | status, empresa, banco, obra atribuída, período, descrição; seleção e reversão explícitas; CSV |
| C2 | filtros e planejamento por empresa/obra/banco | consolidado sem dupla contagem; conta planejada por obrigação; obra não exibe saldo bancário como caixa próprio |

**Integração necessária, não módulo Web:** serviços no backend do Obra na Mão Server e roteamento IPC do Desktop para operar com banco local ou banco central configurado; não criar frontend dentro do servidor.

## P2 — gestão avançada (não implementado)

| Código | Entrega | Aceite |
|---|---|---|
| B5 | auditoria financeira avançada e fechamento por período | relatórios de divergências, bloqueio/reabertura por permissão, reversões rastreadas |
| C3 | cenários de fluxo de caixa | simular adiamentos, despesas e recebimentos futuros sem modificar contas reais |
| C4 | relatórios e alertas | exportações de fluxo, previsto vs realizado, avisos internos de saldo negativo, por empresa/obra/banco |
| I0 | homologação/release | QA integral Desktop local/servidor, migração legada, instaladores, regressões e aprovação antes de merge |

P2 não autoriza APIs bancárias pagas nem ligações de conta por terceiro.

## Controles de qualidade obrigatórios

1. **Preservação**: contratos, DRE, compras, folha, RH, licenças, dados preexistentes, migradores, sem alterar chaves/secrets.
2. **Correção de dados**: isolamentos por empresa, operação idempotente, importações repetidas, pagamentos parciais, transações 1:N, auditoria/reversão, projeções sem somar pagamentos duas vezes.
3. **Modo local e servidor**: todos os serviços financeiros disponíveis no Desktop usando SQLite local ou API autenticada no servidor; sem fallback quando a central for a fonte ativa.
4. **Desktop UI**: menu Financeiro → Contas bancárias / Fluxo de caixa, filtros legíveis, erro e recuperação, formulários e responsividade; QA com extratos de bancos diferentes.
5. **CI sem ruído**: testes Windows/macOS Desktop, servidor Windows/Linux, contratos F31 e CI Web Cloudflare **sem alteração no código/configuração Web**.
6. **Publicação**: PR draft + revisão; merge e release somente mediante ordem explícita.

## Exclusões verificáveis desta PR

Nenhum arquivo da interface `finance-web.html/css/js`; nenhuma rota `/financeiro-web`; nenhum fluxo de pareamento financeiro exclusivo para navegador; nenhuma alteração no workflow `commercial-cloudflare-ci.yml`; nenhum arquivo alterado em `apps/web/`.

Documentos técnicos complementares: `P0-CONCILIACAO-FLUXO-CAIXA.md` e `P1-DESKTOP-FINANCEIRO.md`.
