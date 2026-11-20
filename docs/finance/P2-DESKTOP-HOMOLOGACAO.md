# P2 — Financeiro avançado do Obra na Mão Desktop

Escopo fechado: **somente Desktop + serviços necessários ao modo servidor próprio**. Nenhum painel Web paralelo, nenhuma alteração no portal Cloudflare, nenhuma dependência paga.

## B5 — Auditoria e fechamento bancário

Navegação: **Financeiro > Contas bancárias > Auditoria e fechamento bancário**.

- Filtrar o relatório por mês, banco e obra; ver movimentações, pendências parciais, diferenças e totais de entradas e saídas.
- O fechamento é **por empresa e mês**, incluindo todos os bancos da empresa, e não depende dos filtros de relatório.
- Se houver valores ainda não conciliados, o usuário deve reconhecer explicitamente as pendências para prosseguir.
- Bloquear novas importações de linhas com data dentro de mês fechado, novas conciliações e reversões dos movimentos bancários desse mês; reabertura requer justificativa e registra responsável e data.
- Uma tentativa de importar arquivo com linhas de mês fechado falha atomicamente; dados não são parcialmente gravados.
- Preservar um instantâneo quantitativo e o histórico de fechamento/reabertura no SQLite.
- **Limitação deliberada:** o fechamento é do **módulo bancário**, não um fechamento contábil global do financeiro. Não bloqueia operações em RH, DRE, compras ou pagamentos operacionais, que mantêm seus fluxos existentes. Se o sistema precisar de fechamento contábil universal, isso exige requisito e testes específicos.

## C3 — Simulação temporária de cenários

Navegação: **Financeiro > Fluxo de caixa > Simulador de cenários financeiros**.

- Hipóteses de novas entradas/saídas e adiamento de obrigações existentes para datas futuras.
- Adicionar, editar ou excluir múltiplas hipóteses e calcular resultado para 30/60/90 dias.
- Comparar saldo final original versus simulado, diferença e quantidade de dias negativos.
- Respeitar filtros atuais de empresa, banco e obra, sem cruzar registros.
- **Não persistir simulações, não criar contas, não criar pagamentos, não reprogramar vencimentos reais**. Cálculo somente em memória.

## C4 — Relatórios e alertas internos

Navegação: **Financeiro > Fluxo de caixa > Relatório — previsto × realizado**.

- Tabela diária com entradas/saídas previstas pelas obrigações existentes e entradas/saídas efetivamente encontradas em extratos importados.
- Valores por empresa, conta bancária prevista ou obra atribuída conforme filtros já existentes.
- Alertas no próprio Desktop de previsão negativa, obrigações vencidas, contas sem banco planejado e divergências de conciliação.
- Exportar CSV sem serviço externo e imprimir/salvar PDF pelo próprio sistema operacional.
- **Limitações:** comparativo retrospectivo reconstituído pelos dados atuais, não substitui uma previsão histórica congelada; não garante saldo bancário real sem extratos completos.

## I0 — Homologação e proteção de release

- Migrações SQLite Desktop `024_finance_bank_period_closures.sql` e servidor `035_finance_bank_period_closures.sql`, reabertura de banco, proteção dos dados existentes.
- Um motor de domínio compartilhado: `apps/lan-server/src/bank-p2.cjs`, exposto por `bank-finance.cjs`.
- Desktop local usa IPC e banco local; Desktop conectado usa APIs autenticadas do Obra na Mão Server, **sem fallback local indevido**.
- Rotas de leitura e simulação exigem `finance:view`. Fechar e reabrir exigem `finance:approve` no servidor; autor da auditoria vem da sessão autenticada.
- CI testando `bank-p2.test.mjs`, `bank-p2-http.test.mjs`, migrações e testes de fonte de dados, junto aos demais testes existentes Windows/Linux/macOS.
- Testar manualmente no Desktop: atualização de cliente com dados antigos; importação OFX/CSV antes/depois do fechamento; conciliação 1:N, parcial e reversão; simulação com receita, despesa, adiamento; exportação CSV e impressão PDF; usabilidade em telas menores.
- Nenhuma mudança em `apps/web` ou workflow Cloudflare; nenhum segredo alterado.
- **Não fazer merge nem publicar release sem autorização expressa do usuário.** Testes automatizados aprovados não equivalem à homologação manual de todos os bancos reais.

## Critérios de aceite P2

1. Criar/importar movimento de novembro e conciliar parcialmente.
2. Relatório B5 mostra divergência; fechamento exige consentimento explícito e audita o responsável.
3. Período fechado impede novos extratos e alterações da conciliação, sem apagar dados antigos.
4. Reabertura exige justificativa e deixa evento rastreável.
5. Simulador C3 altera apenas o resultado, não os registros canônicos.
6. C4 calcula previsto/realizado sem duplicar baixas; alerta sobre lacunas.
7. Modo Desktop local e LAN produzem a mesma semântica e preservam instalação antiga.
8. Todos os jobs de QA necessários aprovados; release desabilitada até autorização.

## Complemento de homologação — identidade, histórico e exportação

- **Auditoria local:** ações bancárias críticas usam a conta real do sistema operacional (username + hostname), extraída pelo processo principal do Electron. O renderer não define o responsável. Este Desktop local não cria login por colaborador; a separação de pessoas em computadores compartilhados exige contas diferentes no sistema operacional. As permissões são do dono da sessão e arquivos locais, não um `finance:approve` multiusuário inventado. No Desktop com servidor, a API exige `finance:approve` e registra membro/dispositivo pareado.
- **C4 histórico verdadeiro:** o usuário pode escolher **Guardar previsão atual**, criando fotografia imutável de entradas, saídas e saldo diário com empresa/data/horizonte/obra/banco. Futuras alterações em obrigações não reescrevem a fotografia. O relatório pode selecionar a fotografia para comparar com movimentos posteriormente importados, ou escolher **Previsão atual (recalculada)**. Snapshots não são criados automaticamente, não modificam contas nem extratos.
- Migrações novas: Desktop `025_finance_forecast_snapshots.sql`; servidor `036_finance_forecast_snapshots.sql`. Fonte única conforme modo local/central. O histórico `finance_bank_forecast_snapshots` só recebe inserts, com idempotência por requestId e verificação do escopo.
- **B4 exportação sem corte:** listagem de movimentos paginada em blocos de até 500 e exportação percorrendo todas as páginas. Limite seguro explícito de 50 mil registros; se ultrapassado, a operação informa o limite e não gera CSV parcial.
- **QA visual Electron:** `apps/desktop/qa/finance-electron-smoke.cjs` abre o aplicativo real com banco QA isolado, visita Contas bancárias/Fluxo de caixa, salva uma fotografia e captura imagens. Job `.github/workflows/finance-desktop-electron-qa.yml` publica apenas evidências de QA (não releases); resultados só são considerados homologados quando o job concluir com sucesso e as capturas forem inspecionadas.
- O Portal Web existente do Cloudflare e a configuração de servidores próprios por cliente não mudaram. Nenhuma API paga foi introduzida como dependência do núcleo.
