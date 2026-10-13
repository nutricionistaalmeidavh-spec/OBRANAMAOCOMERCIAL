# Guia Artisys — Do Prompt ao Software

Área pública experimental dentro de `apps/web/public/guia/`, baseada nas 40 páginas do PDF editorial da Artisys.

- Acesse `/guia/` sem autenticação.
- Conteúdo em `conteudo.json`, extraído e adaptado do guia de 40 páginas.
- Índice e busca inteiramente estáticos, sem API ou armazenamento remoto.
- Progresso é salvo somente no `localStorage` do navegador.
- Prompts copiáveis e impressão de páginas individuais em PDF via navegador.
- Menu da landing inclui link "Guia gratuito".
- O site comercial e os fluxos de pagamento, autenticação, D1 e Workers não foram alterados.
- O PDF original será disponibilizado para download separado em etapa posterior, após validação de licença e versionamento do arquivo no repositório.
- **Não publicar sem revisão editorial**, QA e confirmação de que a implantação não interfere nas rotas comerciais.

Para verificar localmente, na raiz `apps/web`, execute `npm ci && npm run build`. O diretório `public/guia` será copiado para `dist/guia`.

O núcleo é HTML + CSS + JavaScript, sem dependências pagas ou backend.

## Alternância editorial e melhoria da aprendizagem
- A leitura intercala fundo escuro nas páginas ímpares e fundo claro nas pares, mantendo a página 4 clara e a 5 roxa, como no PDF. Densidade alta ajusta espaçamento e largura das linhas.
- Cada página traz objetivo e exercício específico; inicia na lição 1, e retomar só aparece após leitura anterior.
- Conclusão reversível, busca com contagem, menu móvel com backdrop/Escape e progresso salvo exclusivamente neste navegador.
- Verificar renderização e ações no navegador antes de publicar; a análise estática não substitui testes reais com leitores.

O objetivo e o exercício de cada lição pertencem canonicamente a `conteudo.json`, evitando duplicidade no JavaScript. Pesquisa inclui o contexto educativo da lição.

## Download disponível na branch

- `/guia/guia-completo.pdf`: PDF estático de **40 páginas**, produzido a partir de `conteudo.json` com a alternância editorial entre páginas claras e roxas.
- Arquivo gerado de forma reproduzível: `node public/guia/build-pdf.mjs` a partir de `apps/web`.
- Este PDF é uma **edição web**, não uma cópia pixel-a-pixel do PDF editorial original distribuído anteriormente no chat. Evitar anunciá-lo como arquivo idêntico.
- Download público, gratuito, sem login, cookies de rastreio ou API paga.
- O botão 'Imprimir esta lição' permanece para imprimir apenas a página atual.
- Exemplos de código e YAML usam fonte monoespaçada, indentação preservada, rolagem horizontal no celular e botão próprio para copiar.
- Os YAML das lições 20 e 39 tiveram a indentação reestruturada a partir dos exemplos editoriais e requerem teste no projeto de destino antes da adoção.
- **ZIP:** NÃO existe um download no portal. Só há um aviso 'Em preparação'. A definição do pacote depende de especificação e testes dos exemplos; jamais apontar para caminho inexistente.

### O que o eventual ZIP poderia conter e por quê
- `README.md`: instalação, requisitos, licenças e limitações.
- `docs/`: PRD, decisões de arquitetura e prompts testados.
- `exemplos/`: miniestoque local, gerador de documentos e leitor de documentos com dados fictícios, se aprovados para distribuição.
- `tests/`: testes e comandos para a pessoa verificar os resultados.
- `LICENSE` e `NOTICE`: direitos do código didático e dependências externas.

O ZIP é **opcional**: serve para o leitor executar o que aprendeu sem transcrever o livro inteiro; não deve incluir arquivos dos sistemas comerciais, chaves, bancos reais, credenciais nem código proprietário.
