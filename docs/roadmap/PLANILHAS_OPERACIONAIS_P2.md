# Planilhas operacionais — entrega P2 (tarefas e diário de obra)

## Herança técnica
P2 complementa P0 (orçamento, compras, estoque, financeiro e folha) e P1 (cronograma, medição, etapas e matriz de ponto). Reutiliza `OperationalSheetGrid`, exportação ExcelJS XLSX/CSV e `parseDecimal` do P0. Sem nova assinatura, CDN, infraestrutura paga ou modelo de IA.

## Tarefas e pendências
- Desktop: botão **Editar em planilha** no módulo Tarefas, filtrado por obra, etapa e status.
- Edição em lote dos campos canônicos de tarefas **manuais**: responsável, prazo, prioridade e status. Origem, descrição, título, etapa e ID permanecem intactos. Tarefas geradas por ocorrências do RDO ficam somente para consulta nesta grade e devem ser alteradas na origem, evitando divergência entre o RDO e a pendência.
- `OperationalSheetP2Service.commitTasks`: transação SQLite, validação de obra, ID único, revisão `updated_at`, data calendário válida e valores de status/prioridade. A data de conclusão é preenchida ou limpa conforme a transição.
- Filtros visuais são preferências, não bancos novos; o exportador existente produz XLSX/CSV.
- Não há fallback silencioso para dados locais quando o domínio Operação usa servidor.

## Diário de obra
- O Desktop conserva o formulário de RDO existente e adiciona, opcionalmente, duas grades: **Equipe no dia** e **Equipamentos**.
- Edição, filtros, copiar/colar e exportação no mesmo componente genérico. A grade edita o **rascunho de formulário**; ao aplicar valida horas, custos e vínculos. Apenas **Salvar RDO** chama o serviço canônico `campo.saveRdo` (FieldSourceService), que já roteia entre SQLite local e servidor.
- Valida números brasileiros como `0,5` horas e `1.234,50` reais; limita horas a 0–24 e proíbe valores negativos.
- O formulário mobile/PWA não foi alterado; continua adequado à coleta em campo.
- O `FieldService` local reconcilia ocorrências ao atualizar o RDO, preservando IDs e decisões posteriores das tarefas vinculadas. Antes ele apagava/recriava tarefas sempre que o RDO era editado.

## Limites conscientes e próximos contratos
- **Escrita em lote no servidor central:** ainda depende de endpoint transacional, escopo por obra/permissão e controle de revisão. Até a homologação, operações coletivas ficam bloqueadas; formulários individuais continuam funcionando.
- **Paridade Web/PWA:** o P2 atual concentra a grade de produtividade no Desktop. Não copia dados para D1/R2, não implementa segundo importador, nem adiciona telas pesadas ao mobile.
- Não altera migrations, credenciais, rotas OAuth/API, secrets, licenças ou release automática.

## Gates de qualidade
- Testes SQLite de rollback multiobra, revisão, conclusão/reabertura, origem RDO e bloqueio de servidor.
- Testes de normalização e segurança das linhas do RDO.
- Regressões FieldService: manter tarefa existente e resolvê-la sem duplicar durante atualização do diário.
- CI completo Windows/macOS, contratos LAN, QA PWA, build web e auditoria dos vínculos canônicos.
- Mesclar P2 na main **somente após** P1 aprovado e mergeado, e gates P2 aprovados. Publicação da release fora do escopo.
