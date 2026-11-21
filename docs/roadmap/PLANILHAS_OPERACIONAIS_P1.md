# Roadmap técnico — Planilhas operacionais P1 (Desktop)

## Dependência e ordem
- Esta branch nasce de `feat/planilhas-operacionais-p0-20261120` (PR #236).
- Não fazer merge do P1 antes de estabilizar o P0. Não publicar release nesta entrega.
- Todas as bibliotecas continuam open-source/self-hosted, sem novas assinaturas nem serviços pagos.
- Serviço de base: `OperationalSheetGrid` e exportador XLSX/CSV de P0, reutilizados para P1.

## Escopo implementado
1. **Cronograma:** botão contextual abre planilha; edita datas, responsável, etapa vinculada, percentuais, status e custos. A duração é calculada pela diferença entre as datas. Validação local de percentuais e integridade do vínculo com a obra; gravação transacional SQLite. Curva S e previsões permanecem calculadas no módulo de planejamento.
2. **Etapas e subetapas:** criação e edição em lote, com código, ordem, status, pavimento/escopo; verifica se etapa/subetapa pertence à mesma obra. Troca de etapa de origem de subetapa existente só pelo fluxo de detalhe, para não quebrar dependências. Exclusão continua no fluxo individual.
3. **Medições:** painel de saldos por item de orçamento (mês, acumulado, a medir e aprovado a faturar) e por contrato (valor inicial + aditivos aprovados - faturado). Saldo contratual e saldo orçamentário **não** são fundidos: não existe rateio de item para contrato sem vínculo explícito. O formulário de medição ganhou planilha de rascunho para seus itens; confirmação efetiva continua em `medicoes.saveWithItems`, com validações e auditoria canônicas.
4. **Ponto/equipe:** matriz de funcionários por dia e competência com filtros; mostra horas apenas quando existem quatro marcações válidas, sem gerar batidas ou presumir presença. Salva marcações selecionadas por funcionário na fonte canônica `TimeService.save`, dentro de transação SQLite, e bloqueia fichas geradas, pagamentos confirmados e colaboradores de outra obra/empresa. Limite de consulta: 60 funcionários por recorte (filtros para conjuntos maiores), visualização paginada de 120 linhas.

## Segurança e consistência
- P1 usa `operational-sheet:p1-*` no preload/Main; nenhuma porta, rota OAuth/API ou segredo é alterado.
- Mutação em lote somente se domínio canônico respectivo estiver em estado `local` ou `migration-required`. Em `central-active/central-ready`, a grade coletiva é bloqueada explicitamente; o usuário pode usar formulários individuais compatíveis com servidor.
- As operações de lote usam transação SQLite do banco local, validam ID/obra/empresa, proíbem repetição de ID no mesmo lote e checam `updated_at` quando disponível.
- Exportação não escreve em registros. Valores calculados continuam somente projeções; não são tabelas adicionais nem saldos artificiais.
- Sem novas migrations: usa as tabelas/constraints já existentes.
- P0 e P1 não substituem a estratégia de sync; paridade de escrita coletiva no servidor fica para P2, após endpoints e permissões específicos, com contratos primeiro e testes de concorrência.

## QA obrigatório antes de merge
- `cd apps/desktop && npm test`, `npm run lint`, `npm run build`;
- workflow de CI Windows, QA de base, testes Desktop/macOS quando disponíveis;
- regressões SQLite de alterações multiobra, datas, percentuais, status de ponto, acesso central e saldos contratuais;
- QA de interface em Chrome/Playwright quando executável disponível.
- Nenhuma publicação/release sem autorização explícita.
