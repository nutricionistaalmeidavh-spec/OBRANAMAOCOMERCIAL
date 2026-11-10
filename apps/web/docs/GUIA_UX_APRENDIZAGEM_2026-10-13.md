# Revisão de UI, UX e aprendizagem — Do Prompt ao Software
Atualização: 13/10/2026 • Branch: `feat/guia-artisys-do-prompt-ao-software` • Status: revisão de código, sem auditoria visual executada.

## Público e objetivo
Leitor iniciante/intermediário em desenvolvimento, especialmente quem chega por publicação de rede social usando celular. Quer entender como usar agentes de IA para sair de uma ideia e chegar a um MVP, com Git, testes e deploy sem custo obrigatório.

Jornada principal: abrir a área pública → entender o que vai aprender → iniciar na primeira lição → copiar prompt → praticar → marcar conclusão → continuar ou retomar depois.

## Evidências revisadas
- `public/guia/index.html`, `guia.css`, `guia.js`, `conteudo.json`.
- PDF editorial Artisys de 40 páginas e screenshots de referência enviados no chat.
- Não foram observados eventos de usuários ou screenshots do portal rodando nesta revisão. Não confundir inspeção de fonte com estudo de usabilidade ou QA em navegador.

## Correções implementadas (P0/P1)
| Camada | Evidência no código inicial | Fricção provável | Alteração |
| --- | --- | --- | --- |
| UI e leitura | Leitor uniformemente escuro | Monotonia visual e esforço em páginas densas | Folios ímpares roxos e pares claros; composição adaptada à densidade; opção de trocar contraste durante a lição |
| Flow | Início apontava para `#pagina-05` | Omissão involuntária da introdução | CTA começa na página 01 |
| Flow | Retomar aparecia antes de leitura | Ação sugeria estado inexistente | Só aparece com lição anterior registrada |
| Aprendizagem | Texto sem prática explícita a cada página | Baixa transferência do conteúdo à execução | Objetivo + atividade específica nas 40 páginas; conteúdo canônico no JSON |
| Feedback | Apenas concluir, sem desfazer | Erro de marcação não recuperável | Conclusão reversível, com estado e mensagem de confirmação |
| UI/Flow | Índice móvel sem backdrop e Escape | Ambiguidade ao sair da navegação | Backdrop, fechamento e retorno do foco |
| Feedback | Busca sem contagem | Difícil prever abrangência | Contagem visível e aviso de resultados truncados |
| Confiança | Progresso no `localStorage` sem aviso | Suposição de sincronização entre dispositivos | Aviso de armazenamento exclusivamente neste navegador |

## Avaliação por experiência
**UI (leitura e visual):** hierarquia clara e identidade ArtiSys preservada. Mudança recente de contraste ainda requer inspeção real em dispositivos, inclusive quebra de linhas, foco e leitura em ambiente claro.

**Flow (aprendizagem):** a navegação agora começa na lição 1; objetivos/atividades tornam mais evidente o propósito de cada etapa. A abordagem ainda é linear e trata uma página como uma lição; testar se 40 navegações dificultam a retenção ou se agrupamento por módulo ajudaria.

**Feel (confiança):** resultado de conclusão aparece no próprio leitor; sem login nem banco. Falhas de `localStorage` ou acesso à área de transferência precisam ser validadas em ambiente real.

## Melhorias ainda recomendadas
- **P1:** oferecer o PDF e o ZIP prático na área do guia após verificar arquivos, licenças e links (atualmente não existe link público integrado ao portal).
- **P1:** deixar o projeto miniestoque acessível por caminho pedagógico claro (pré-requisitos → executar → verificar resultado), sem fingir que preview estática é a API Node/SQLite.
- **P1:** teste Playwright em viewport móvel/desktop; capturar páginas 04 (clara), 05 (roxa), uma lição densa, menu lateral, busca, cópia, conclusão e retorno.
- **P1:** verificar acessibilidade por teclado, contraste de componentes renderizados, zoom 200%, texto longo, reduced motion e estado sem `localStorage`.
- **P2:** manter glossário curto para PRD, CI/CD, MCP, runner e deploy, no ponto de primeira ocorrência; não exigir familiaridade prévia.
- **P2:** se SEO dos capítulos for necessário, avaliar rotas estáticas reais em vez de somente âncoras `#pagina-XX`.

## Cenários de validação
1. **Primeiro acesso:** pedir para encontrar onde começar, sem mencionar página 1. Confirmar entrada correta.
2. **Aprendizagem:** pedir para definir o problema do miniestoque usando a primeira atividade e avaliar clareza dos passos.
3. **Prática:** localizar e copiar um prompt; explicar onde usá-lo, com acesso à área de transferência permitido e negado.
4. **Continuidade:** concluir uma lição, sair e voltar no mesmo navegador; comprovar retomada e contagem; repetir noutro aparelho e confirmar expectativa de não sincronizar.
5. **Mobile:** localizar uma lição na busca, navegar, fechar índice, alternar fundo, usar teclado e voltar ao sumário.
6. **Falhas:** bloquear `conteudo.json`, clipboard e localStorage separadamente; verificar mensagem e caminho de recuperação.

Resultado deste registro: revisão técnica orientada ao usuário; não equivale a teste com pessoas, QA visual ou deploy.
