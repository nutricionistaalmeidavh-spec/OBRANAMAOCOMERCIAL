# Revisão editorial, aprendizagem e UX — Guia Artisys
Data: 2026-10-13 | Fonte: estrutura da branch, conteúdo JSON com 40 lições e comparação visual das páginas do PDF fornecidas.

## Público e objetivo
- Público primário: seguidor que quer sair de uma ideia e aprender a construir sistemas com um agente de IA, Git e infraestrutura de baixo custo.
- Jornada: chega do TikTok -> compreende o que vai aprender -> inicia a lição 1 -> entende -> pratica -> verifica -> retorna -> continua.
- Êxito: encontra a lição correta sem saber a arquitetura do site, reproduz ao menos uma tarefa prática, compreende o que é gratuito e distingue validar de publicar.

## Melhorias aplicadas na branch
1. **Acesso inicial** — o CTA principal agora começa na lição 1. Antes abria diretamente a página 5; isso pulava contexto para iniciantes.
2. **Retomada honesta** — “Retomar” só aparece depois de uma leitura anterior. Progresso exclusivamente local, sem prometer sincronização.
3. **Orientação** — objetivo da lição junto ao título, sem esconder o que o leitor ganhará com a etapa.
4. **Prática** — toda uma das 40 lições recebeu uma atividade objetiva. São atividades de aprendizagem, não execução automática.
5. **Alternância editorial** — páginas ímpares roxo escuro e pares claras. Página 4 clara, página 5 escura como no modelo. Blocos/labels usam variantes contrastantes.
6. **Leitura responsiva** — largura de parágrafo controlada, espaçamento em lições densas, índice móvel com fechamento por backdrop e Escape.
7. **Feedback** — busca exibe contagem; marcar leitura é reversível e comunica persistência no próprio navegador.

## Avaliação de atritos (evidência do código, não estudo com usuários)
| Prioridade | Achado | Impacto | Situação |
|---|---|---|---|
| P0 | CTA pulava as lições introdutórias | pessoa pode começar implementação sem compreender a jornada | Corrigido |
| P0 | Corpo das 40 páginas com o mesmo fundo escuro | fadiga visual em trechos densos; não segue exemplo editorial | Corrigido por alternância |
| P1 | Página só explicava conteúdo sem dizer o que fazer a seguir | aprendizado passivo e baixa capacidade de aplicação | Objetivo + atividade em cada lição |
| P1 | Retomada aparecia antes de primeira leitura | ação prometia estado inexistente | Corrigido |
| P1 | Ausência de download original e do kit executável no portal | pessoa não conclui o projeto com os arquivos prometidos | Pendente |
| P1 | Extração de conteúdo do PDF conserva fragmentos com tipografia linear | blocos de código/fluxos ficam menos legíveis que no PDF | Pendente: revisar 40 lições manualmente e trocar conteúdo por Markdown/MDX estruturado |
| P1 | Avaliação das lições é apenas autodeclarada | clicar “concluída” não prova entendimento | Pendente: checkpoints práticos opcionais por capítulo |
| P2 | Busca simples considera correspondência textual, sem evidenciar trecho | difícil saber qual resultado contém a resposta | Pendente: mostrar contexto e termos destacados |
| P2 | Progresso não sincroniza entre dispositivos | leitores que alternam celular/computador recomeçam | Manter explícito; sincronização opcional no futuro sem exigir cadastro |

## Verificações necessárias para release (ainda não executadas em navegador)
1. Desktop: abrir /guia e navegar 01 -> 02 -> 03 -> 04 -> 05 -> 06 -> 40; conferir paridade claro/escuro.
2. Mobile 320, 375 e 414 CSS px: sem overflow lateral; abrir índice, selecionar lição, Escape/backdrop e reabrir.
3. Teclado: tabulação, anéis de foco, leitura e retorno ao índice.
4. Funcional: busca, busca vazia, termos com acentos, copiar prompt, falha de clipboard, marcar/desmarcar, recarregar e retomar.
5. Falha: conteúdo JSON indisponível deve apresentar erro acionável. Verificar offline e ausência de dados privados.
6. QA de aprendizagem: pedir a leitor novo para (a) achar como comparar GitHub público e privado, (b) copiar prompt de escopo, (c) marcar uma lição e voltar, (d) explicar diferença entre Actions e deploy. Não indicar o controle ou caminho.
7. Build canônico: npm ci && npm run build em apps/web, npm test, npm run seo:verify. Não executar workflow por commit desnecessariamente.

## Sequência recomendada de refinamento
- **P1:** disponibilizar PDF e ZIP verificáveis; tutorial de miniestoque precisa realmente abrir/baixar.
- **P1:** conteúdo estruturado de verdade (código, prompts, listas, diagramas e links) em vez de depender de parágrafos extraídos do PDF.
- **P2:** exercícios com conferência manual/autoavaliação e “você conseguiu?” com próximos passos para erro.
- **P2:** pesquisa guiada por casos de uso; índice por temas é complemento, não substitui jornada.
- **P3:** biblioteca de recursos e versões futuras, com changelog e garantia de licença dos exemplos.

## Limites da avaliação
Revisão baseada no código da branch e no PDF original; não é observação de leitores reais nem captura da interface hospedada. A branch não deve ser chamada de produção validada até build, QA de renderização e testes funcionais.
