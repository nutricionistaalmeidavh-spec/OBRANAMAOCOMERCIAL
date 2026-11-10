# Guia ArtiSys — Edição didática v2 (branch de revisão)

As 40 aulas online agora são conteúdos estruturados por um cenário contínuo: miniestoque local com agente de IA, Git, Actions e deploy opcional.

## Fonte editorial

`aulas/01-10.json`, `11-20.json`, `21-30.json`, `31-40.json` contêm o texto canônico das aulas.

Cada entrada traz:
- explicação contextual e resultado concreto;
- cinco ou mais passos reproduzíveis;
- artefato/comando ou exemplo realista;
- prompt reutilizável;
- checklist de autoavaliação;
- caminho sem API paga, alternativa opcional e advertência;
- links para documentação quando adequados.

Os arquivos são conteúdo didático preparado para revisão; **não** se afirma que screenshots, ferramentas, integrações ou resultados de tutorial foram pessoalmente executados pelo leitor. Um QA de navegador do próprio portal gera capturas reais em Actions para revisão visual. Capturas de telas de conexão GitHub de contas reais só devem ser adicionadas depois de geradas e ocultados tokens, identificadores e dados pessoais.

## Navegação
`guia.js` busca os 4 JSONs e usa o índice de capítulos em `conteudo.json`. A estrutura original do portal (menu, leitura, busca, versão claro/roxo, progresso no navegador) foi preservada.

`conteudo.json` continua atendendo o **PDF da edição anterior**, cuja cópia é `guia-completo.pdf`. O PDF não representa ainda o conteúdo aprofundado v2; o portal informa claramente isso. Não confundir 'guia de 40 páginas' com 40 aulas longas.

## Testar

Na pasta `apps/web`: `npm ci && node scripts/verify-guia.mjs && npm run build`.

Para QA visual real, usar o workflow de PR `guia-ui-review.yml`, que abre a URL local via Playwright e gera imagens de mobile/desktop como artefatos do Actions. Não altera a produção e não usa secrets.

## Pendências de publicação

1. Revisão humana do conteúdo, referências e custos.
2. QA Playwright por captura de navegador e acessibilidade inicial.
3. Teste com leitor novato (conseguir achar aula 16, seguir roteiro sem ajuda, distinguir CI de deploy).
4. Nova edição PDF aprofundada quando a versão web for aprovada.
5. Capturas do GitHub/conectores reais com dados sensíveis ocultos, só após autorização.
6. ZIP de exemplo NÃO incluído; o download continua marcado em preparação.

**NÃO alterar** OAuth, endpoints `/api/*`, login, D1/R2, pagamentos ou regras de deploy do site comercial durante este trabalho editorial.
