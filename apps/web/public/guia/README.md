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
