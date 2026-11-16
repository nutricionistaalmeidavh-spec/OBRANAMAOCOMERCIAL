# Importador universal P0–P2 — Obra na Mão Desktop

## Jornada
1. Escolher empresa de destino explicitamente.
2. Selecionar um arquivo Excel (.xlsx/.xlsm) ou CSV pelo diálogo ou arrastar e soltar (máximo 25 MB).
3. Detectar área e aba; se houver empate ou nenhuma correspondência, exigir escolha manual da área.
4. Mapear colunas; carregar automaticamente perfil salvo pela empresa + área + assinatura dos cabeçalhos, quando houver. O usuário pode salvar o mapeamento.
5. Gerar prévia de todas as linhas: quantidade, aptas, inválidas, duplicatas internas e avisos de cadastros já existentes.
6. Se houver erro, exportar relatório CSV completo, corrigir a planilha de origem e selecionar novamente. Não gravar com campos obrigatórios não mapeados, linhas inválidas ou arquivo já importado.
7. Confirmar importação com dados transacionais no SQLite canônico existente, preservando o escopo da empresa.

## Capacidades e arquivos
- P0: `saveTemplate(area)` gera XLSX por área (11 opções) com cabeçalhos e instruções usando `exceljs` já incluído no Desktop.
- P0: `exportIssues(token, options)` gera CSV de **todas** as divergências, não só as 20 primeiras da visualização, escapando fórmulas em células.
- P1: drag-and-drop usa `webUtils.getPathForFile` no preload e a validação de extensão/tamanho já existente; não expõe `fs` ao renderer.
- P1: previne linhas exatamente repetidas dentro do arquivo; planilhas já importadas são bloqueadas; sinaliza obras/funcionários com o mesmo nome na empresa, sem sobrescrever.
- P2: perfil de colunas persistido na tabela `configuracoes` do SQLite, chave versionada por empresa, área e assinatura normalizada dos cabeçalhos. Não há armazenamento em navegador, serviço externo ou mensalidade.
- Serviços: `electron/services/universal-import-service.cjs`.
- Pontos de entrada: `electron/main.cjs`, `electron/preload.cjs`, `src/vite-env.d.ts`, `src/pages/ImportPage.tsx`.

## Garantias e limites
- A detecção automática é sugestão; a escolha da empresa é obrigatória.
- Duplicatas internas são bloqueadas. Cadastros de obras e funcionários encontrados pelo nome são sinalizados e reutilizados conforme comportamento atual; isso não significa deduplicação universal de todos os módulos.
- A comparação de importação completa usa hash de arquivo/aba e histórico existente. Registros novos identificam empresa no resumo da importação; registros antigos sem empresa permanecem protegidos de reimportação.
- Desfazer importação não foi habilitado: a reversão de registros relacionados requer contrato de integridade referencial e testes específicos; não é seguro excluir em massa.
- Serviços adicionais pagos não são necessários: ExcelJS, Electron, Node e SQLite locais.
- Sem alteração em Cloudflare, PWA, licenças, chaves, rotas ou mecanismo de atualização.

## Verificação
```bash
cd apps/desktop
npm run lint
npm test -- --run tests/universal-import-assistant.test.ts tests/universal-import-safety.test.ts tests/universal-import-mapping-ui.test.ts
npm test
npm run build
```
Os testes em CI precisam aprovar no último SHA e o fluxo visual deve ser validado com arquivo real antes do merge/release.
